import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

function sessionPhase(meeting, now = Date.now()) {
  const start = meeting.scheduledStart
    ? new Date(meeting.scheduledStart).getTime()
    : new Date(`${meeting.scheduledDate}T${meeting.scheduledTime || '00:00'}`).getTime();
  const end = meeting.scheduledEnd ? new Date(meeting.scheduledEnd).getTime() : start + 60 * 60 * 1000;
  if (Number.isNaN(start)) return { phase: 'unknown', minsUntil: null };
  const minsUntil = Math.round((start - now) / 60000);
  if (meeting.needsRecording || (end < now && meeting.status !== 'completed' && meeting.status !== 'cancelled')) {
    return { phase: 'needsRecording', minsUntil };
  }
  if (minsUntil <= 0 && end >= now) return { phase: 'live', minsUntil };
  if (minsUntil > 0 && minsUntil <= 15) return { phase: 'soon', minsUntil };
  if (minsUntil > 15) return { phase: 'scheduled', minsUntil };
  return { phase: 'ended', minsUntil };
}

function formatCountdown(minsUntil, phase) {
  if (phase === 'needsRecording') return 'Session ended — upload recording';
  if (minsUntil === null || minsUntil === undefined) return '';
  if (minsUntil <= 0) return 'Session window open';
  if (minsUntil < 60) return `Starts in ${minsUntil} min`;
  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  return `Starts in ${h}h ${m}m`;
}

export default function MeetLiveClassesPanel({
  batchId = '',
  batches = [],
  compact = false,
  title = 'Live classes'
}) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [expandedId, setExpandedId] = useState('');
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const fileInputRef = React.useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryGeneratingId, setSummaryGeneratingId] = useState('');
  const [summaryOpenId, setSummaryOpenId] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [intimating, setIntimating] = useState(false);
  const [materialMeetingId, setMaterialMeetingId] = useState('');
  const materialInputRef = React.useRef(null);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('all'); // all | upcoming | completed
  const [sessionBatchFilter, setSessionBatchFilter] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [form, setForm] = useState({
    title: '',
    batchId: batchId || '',
    scheduledDate: '',
    scheduledTime: '',
    duration: '60',
    description: ''
  });

  useEffect(() => {
    if (batchId) setForm((f) => ({ ...f, batchId }));
  }, [batchId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = getApiBaseUrl();
      const qs = batchId ? `?batchId=${encodeURIComponent(batchId)}` : '';
      const res = await fetch(`${apiUrl}/api/meetings${qs}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load meetings');
      setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
    } catch (err) {
      setError(err.message || 'Failed to load meetings');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const summaryBatchId =
    batchId || form.batchId || meetings.find((m) => m.batchId)?.batchId || '';

  const loadSummary = useCallback(async () => {
    if (!summaryBatchId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(
        `${apiUrl}/api/meetings/attendance-summary?batchId=${encodeURIComponent(summaryBatchId)}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load attendance summary');
      setSummary(data);
    } catch (err) {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [summaryBatchId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const intimateLowAttendance = async (studentIds = null) => {
    if (!summaryBatchId) return;
    setIntimating(true);
    setError('');
    setMessage('');
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/intimate-low-attendance`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          batchId: summaryBatchId,
          ...(studentIds?.length ? { studentIds } : {})
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send notices');
      setMessage(data.message || `Sent ${data.sent || 0} notice(s)`);
    } catch (err) {
      setError(err.message || 'Failed to intimate students');
    } finally {
      setIntimating(false);
    }
  };

  const intimateSessionAbsentees = async (meetingId) => {
    setIntimating(true);
    setError('');
    setMessage('');
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/intimate-absentees`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to email absentees');
      setMessage(data.message || `Sent ${data.sent || 0} notice(s)`);
    } catch (err) {
      setError(err.message || 'Failed to email absentees');
    } finally {
      setIntimating(false);
    }
  };

  const visible = meetings
    .filter((m) => m.status !== 'cancelled' && m.meetLink)
    .filter((m) => {
      const { phase } = sessionPhase(m, now);
      return phase !== 'ended' || m.needsRecording || m.status === 'completed';
    })
    .sort((a, b) => new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0));

  const needingRecording = visible.filter((m) => sessionPhase(m, now).phase === 'needsRecording');

  const sessionList = visible
    .filter((m) => sessionPhase(m, now).phase !== 'needsRecording')
    .filter((m) => {
      if (sessionBatchFilter && String(m.batchId) !== String(sessionBatchFilter)) return false;
      if (sessionFilter === 'completed') return m.status === 'completed';
      if (sessionFilter === 'upcoming') {
        const { phase } = sessionPhase(m, now);
        return m.status !== 'completed' && phase !== 'ended';
      }
      return true;
    })
    .filter((m) => {
      const q = sessionSearch.trim().toLowerCase();
      if (!q) return true;
      return [m.title, m.course, m.batchName, m.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

  const sessionCounts = {
    all: visible.filter((m) => sessionPhase(m, now).phase !== 'needsRecording').length,
    upcoming: visible.filter((m) => {
      if (sessionPhase(m, now).phase === 'needsRecording') return false;
      const { phase } = sessionPhase(m, now);
      return m.status !== 'completed' && phase !== 'ended';
    }).length,
    completed: visible.filter(
      (m) => sessionPhase(m, now).phase !== 'needsRecording' && m.status === 'completed'
    ).length
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const targetBatch = form.batchId || batchId;
    if (!form.title.trim() || !targetBatch || !form.scheduledDate || !form.scheduledTime) {
      setError('Title, batch, date, and time are required.');
      return;
    }
    setSaving(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title.trim(),
          batchId: targetBatch,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          duration: form.duration,
          description: form.description || '',
          timezone: 'Asia/Kolkata'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to schedule Meet class');
      setMessage('Class scheduled. Students get an email reminder ~15 minutes before start.');
      setForm((f) => ({
        ...f,
        title: '',
        description: '',
        scheduledDate: '',
        scheduledTime: ''
      }));
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this live class? Students will no longer see Join.')) return;
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${id}/cancel`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Cancel failed');
      setMessage('Class cancelled.');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Cancel failed');
    }
  };

  const handleStart = async (m) => {
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${m.id}/start`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to start');
      const link = data.meetLink || data.startUrl || m.meetLink;
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
      setExpandedId(m.id);
      await Promise.all([loadMeetings(), loadAttendance(m.id)]);
      setMessage('Class started. Students who Join are marked Present automatically.');
    } catch (err) {
      setError(err.message || 'Failed to start class');
    }
  };

  const loadAttendance = async (meetingId) => {
    setAttendanceLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/attendance`, {
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load attendance');
      setAttendanceRows(data.attendance || []);
    } catch (err) {
      setError(err.message || 'Attendance load failed');
      setAttendanceRows([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Live roster refresh while attendance panel is open
  useEffect(() => {
    if (!expandedId) return undefined;
    const tick = setInterval(() => {
      loadAttendance(expandedId);
      loadMeetings();
    }, 20000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId, loadMeetings]);

  const toggleAttendancePanel = async (meetingId) => {
    if (expandedId === meetingId) {
      setExpandedId('');
      return;
    }
    setExpandedId(meetingId);
    await loadAttendance(meetingId);
  };

  const saveAttendance = async (meetingId) => {
    setAttendanceSaving(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/attendance`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          attendance: attendanceRows.map((r) => ({
            studentId: r.studentId,
            studentName: r.studentName,
            status: r.status
          }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setMessage('Attendance saved.');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const goUploadRecording = async (m) => {
    setUploadTargetId(m.id);
    fileInputRef.current?.click();
  };

  const generateSessionSummary = async (meetingId) => {
    setSummaryGeneratingId(meetingId);
    setError('');
    setMessage('');
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/generate-summary`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Summary failed');
      setMessage('Session summary generated.');
      setSummaryOpenId(meetingId);
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Summary failed');
    } finally {
      setSummaryGeneratingId('');
    }
  };

  const goUploadMaterial = (m) => {
    setMaterialMeetingId(m.id);
    materialInputRef.current?.click();
  };

  const onMaterialFilePicked = async (e) => {
    const file = e.target.files?.[0];
    const meetingId = materialMeetingId;
    e.target.value = '';
    if (!file || !meetingId) return;
    setUploadingId(meetingId);
    setError('');
    setMessage('');
    try {
      const apiUrl = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('file', file);
      body.append('name', file.name);
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/materials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Material upload failed');
      setMessage('Session material uploaded to Google Drive.');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Material upload failed');
    } finally {
      setUploadingId('');
      setMaterialMeetingId('');
    }
  };

  const onRecordingFilePicked = async (e) => {
    const file = e.target.files?.[0];
    const meetingId = uploadTargetId;
    e.target.value = '';
    if (!file || !meetingId) return;
    setUploadingId(meetingId);
    setError('');
    setMessage('');
    try {
      const apiUrl = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('recording', file);
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/recording`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Drive upload failed');
      setMessage(
        data.driveLink
          ? `Recording saved to Google Drive. Link: ${data.driveLink}`
          : 'Recording uploaded to Google Drive.'
      );
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploadingId('');
      setUploadTargetId('');
    }
  };

  const dismissRecording = async (m) => {
    try {
      const apiUrl = getApiBaseUrl();
      await fetch(`${apiUrl}/api/meetings/${m.id}/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dismissPrompt: true })
      });
      setMessage('Recording prompt dismissed.');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Failed to dismiss');
    }
  };

  return (
    <div className={`live-lobby ${compact ? 'live-lobby--compact' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.mkv"
        style={{ display: 'none' }}
        onChange={onRecordingFilePicked}
      />
      <input
        ref={materialInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv,.md,.rtf,image/*,video/*,.mp4,.mov,.webm"
        style={{ display: 'none' }}
        onChange={onMaterialFilePicked}
      />
      <div className="live-lobby__hero">
        <p className="live-lobby__eyebrow">Sky States · Live class</p>
        <h2>{title}</h2>
        <p>
          Schedule Meet, start the session, and watch attendance update as students join. Upload the
          recording to Google Drive when class ends. Students get a reminder ~15 minutes before start.
        </p>
      </div>

      {summaryBatchId && (
        <section className="live-lobby__card live-lobby__card--summary">
          <div className="live-lobby__card-head">
            <h3>Batch attendance</h3>
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
              onClick={loadSummary}
            >
              Refresh
            </button>
          </div>
          {summaryLoading && !summary ? (
            <p className="live-lobby__muted">Loading join rates…</p>
          ) : !summary ? (
            <p className="live-lobby__muted">Select a batch to see attendance trends.</p>
          ) : (
            <>
              <div className="live-session__stats">
                <span className="live-stat">
                  {summary.sessionsTotal || 0} sessions
                </span>
                <span className="live-stat live-stat--present">
                  Avg join {summary.batchJoinRateAvg ?? 0}%
                </span>
                <span className="live-stat live-stat--absent">
                  {summary.belowThresholdCount || 0} below {summary.threshold}%
                </span>
                {(summary.streakAlertCount || 0) > 0 && (
                  <span className="live-stat live-stat--warn">
                    {summary.streakAlertCount} streak alerts
                  </span>
                )}
              </div>
              <p className="live-attendance__note">
                Students who Join are Present. Trainers can email anyone below {summary.threshold}%
                join rate. Admins are notified after {summary.streakLimit} consecutive misses.
              </p>
              {(summary.students || []).length > 0 && (
                <div className="live-summary-scroll">
                  <table className="live-attendance__table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Join %</th>
                        <th>Streak</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.students || []).slice(0, 40).map((s) => (
                        <tr
                          key={s.studentId}
                          className={s.belowThreshold ? '' : 'live-attendance__row--in'}
                        >
                          <td>
                            {s.studentName}
                            {s.enrollmentNumber ? (
                              <span className="live-lobby__muted"> · {s.enrollmentNumber}</span>
                            ) : null}
                          </td>
                          <td>
                            <span
                              className={`live-stat ${
                                s.belowThreshold ? 'live-stat--absent' : 'live-stat--present'
                              }`}
                            >
                              {s.joinRate}%
                            </span>
                          </td>
                          <td>
                            {s.consecutiveAbsent > 0 ? (
                              <span className={s.streakAlert ? 'live-stat live-stat--warn' : ''}>
                                {s.consecutiveAbsent} miss
                                {s.consecutiveAbsent === 1 ? '' : 'es'}
                              </span>
                            ) : (
                              <span className="live-lobby__muted">—</span>
                            )}
                          </td>
                          <td>
                            {s.belowThreshold && (
                              <button
                                type="button"
                                className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                                disabled={intimating}
                                onClick={() => intimateLowAttendance([s.studentId])}
                              >
                                Intimate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="live-attendance__actions">
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--primary"
                  disabled={intimating || !(summary.belowThresholdCount > 0)}
                  onClick={() => intimateLowAttendance()}
                >
                  {intimating ? 'Sending…' : `Intimate all below ${summary.threshold}%`}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {needingRecording.length > 0 && (
        <section className="live-lobby__card live-lobby__card--recording">
          <h3>Upload recording</h3>
          <ul className="live-lobby__list">
            {needingRecording.map((m) => (
              <li key={`rec-${m.id}`} className="live-session">
                <div className="live-session__top">
                  <div>
                    <h4 className="live-session__title">{m.title}</h4>
                    <p className="live-session__meta">
                      Ended · {m.scheduledDate} {m.scheduledTime} IST · {m.attendanceCount || 0} joined
                    </p>
                  </div>
                  <span className="live-session__badge live-session__badge--soon">Recording due</span>
                </div>
                <div className="live-session__cta">
                  <button
                    type="button"
                    className="live-lobby__btn live-lobby__btn--primary"
                    disabled={uploadingId === m.id}
                    onClick={() => goUploadRecording(m)}
                  >
                    {uploadingId === m.id ? 'Uploading to Drive…' : 'Upload to Google Drive'}
                  </button>
                  <button
                    type="button"
                    className="live-lobby__btn live-lobby__btn--ghost"
                    onClick={() => dismissRecording(m)}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="live-lobby__grid">
        <section className="live-lobby__card live-lobby__card--schedule">
          <div className="live-lobby__card-head">
            <h3>Schedule a class</h3>
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
              onClick={() => setScheduleOpen((o) => !o)}
              aria-expanded={scheduleOpen}
            >
              {scheduleOpen ? 'Hide form' : 'Show form'}
            </button>
          </div>
          {scheduleOpen && (
            <>
              <form className="live-lobby__form live-lobby__form--schedule" onSubmit={handleSchedule}>
                <label className="live-lobby__field--title">
                  Class title
                  <input
                    type="text"
                    placeholder="e.g. SQL joins workshop"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </label>
                {!batchId && (
                  <label className="live-lobby__field--batch">
                    Batch
                    <select
                      value={form.batchId}
                      onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
                      required
                    >
                      <option value="">Select batch</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Date (IST)
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Time (IST)
                  <input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Duration
                  <select
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
                <label className="live-lobby__field--agenda">
                  Agenda (optional)
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What will you cover?"
                  />
                </label>
                <div className="live-lobby__actions">
                  <button
                    type="submit"
                    className="live-lobby__btn live-lobby__btn--primary"
                    disabled={saving}
                  >
                    {saving ? 'Scheduling…' : 'Schedule class'}
                  </button>
                </div>
              </form>
              {error && (
                <p className="live-lobby__alert live-lobby__alert--err" role="alert">
                  {error}
                </p>
              )}
              {message && <p className="live-lobby__alert live-lobby__alert--ok">{message}</p>}
            </>
          )}
        </section>

        <section className="live-lobby__card live-lobby__card--sessions">
          <div className="live-lobby__card-head">
            <h3>Your sessions</h3>
            <span className="live-lobby__muted">
              {sessionList.length} shown
              {sessionCounts.all !== sessionList.length ? ` · ${sessionCounts.all} total` : ''}
            </span>
          </div>

          <div className="live-lobby__sessions-toolbar">
            <div className="live-lobby__chip-row" role="tablist" aria-label="Session status">
              {[
                { id: 'all', label: `All (${sessionCounts.all})` },
                { id: 'upcoming', label: `Upcoming (${sessionCounts.upcoming})` },
                { id: 'completed', label: `Completed (${sessionCounts.completed})` }
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={sessionFilter === chip.id}
                  className={`live-lobby__chip${sessionFilter === chip.id ? ' is-active' : ''}`}
                  onClick={() => setSessionFilter(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {!batchId && batches.length > 0 && (
              <select
                value={sessionBatchFilter}
                onChange={(e) => setSessionBatchFilter(e.target.value)}
                aria-label="Filter by batch"
              >
                <option value="">All batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>
            )}
            <input
              type="search"
              placeholder="Search by title…"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              aria-label="Search sessions"
            />
          </div>

          {loading ? (
            <p className="live-lobby--empty">Loading sessions…</p>
          ) : sessionList.length === 0 ? (
            <div className="live-lobby--empty">
              {sessionCounts.all === 0
                ? 'No upcoming live classes. Schedule one to generate a Meet link for your batch.'
                : 'No sessions match these filters.'}
            </div>
          ) : (
            <ul className="live-lobby__list live-lobby__list--sessions">
              {sessionList.map((m) => {
                  const { phase, minsUntil } = sessionPhase(m, now);
                  const badge =
                    phase === 'live' ? 'live' : phase === 'soon' ? 'soon' : 'scheduled';
                  const badgeLabel =
                    phase === 'live'
                      ? 'Live window'
                      : phase === 'soon'
                        ? 'Starting soon'
                        : m.status === 'completed'
                          ? 'Completed'
                          : 'Scheduled';
                  return (
                    <li key={m.id} className="live-session">
                      <div className="live-session__top">
                        <div>
                          <h4 className="live-session__title">{m.title}</h4>
                          <p className="live-session__meta">
                            {m.scheduledDate} · {m.scheduledTime} IST · {m.duration}
                            {m.batchId && batches.length
                              ? ` · ${batches.find((b) => String(b.id) === String(m.batchId))?.name || ''}`
                              : ''}
                          </p>
                          <p className="live-session__countdown">
                            {formatCountdown(minsUntil, phase)}
                          </p>
                          <div className="live-session__stats">
                            <span className="live-stat live-stat--present">
                              {m.attendanceCount || 0} present
                            </span>
                            <span className="live-stat live-stat--absent">
                              {Math.max(
                                0,
                                (m.attendanceRosterSize || 0) - (m.attendanceCount || 0)
                              )}{' '}
                              absent
                            </span>
                          </div>
                        </div>
                        <span className={`live-session__badge live-session__badge--${badge}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      <div className="live-session__cta">
                        {m.status !== 'completed' && (
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--primary"
                            disabled={!m.meetLink && !m.hasMeetLink}
                            onClick={() => handleStart(m)}
                          >
                            Start class
                          </button>
                        )}
                        <button
                          type="button"
                          className="live-lobby__btn live-lobby__btn--ghost"
                          onClick={() => toggleAttendancePanel(m.id)}
                        >
                          {expandedId === m.id ? 'Hide attendance' : 'Attendance roster'}
                        </button>
                        <button
                          type="button"
                          className="live-lobby__btn live-lobby__btn--ghost"
                          disabled={uploadingId === m.id}
                          onClick={() => goUploadMaterial(m)}
                        >
                          {uploadingId === m.id && materialMeetingId === m.id
                            ? 'Uploading…'
                            : 'Add material'}
                        </button>
                        {(m.status === 'completed' || m.driveFileId || m.sessionSummary) && (
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--ghost"
                            disabled={summaryGeneratingId === m.id}
                            onClick={() => generateSessionSummary(m.id)}
                          >
                            {summaryGeneratingId === m.id
                              ? 'Summarizing…'
                              : m.sessionSummaryStatus === 'ready'
                                ? 'Refresh AI summary'
                                : 'Generate AI summary'}
                          </button>
                        )}
                        {m.sessionSummaryStatus === 'ready' && m.sessionSummary && (
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--ghost"
                            onClick={() =>
                              setSummaryOpenId(summaryOpenId === m.id ? '' : m.id)
                            }
                          >
                            {summaryOpenId === m.id ? 'Hide summary' : 'View summary'}
                          </button>
                        )}
                        {m.status !== 'completed' && m.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="live-lobby__btn live-lobby__btn--danger"
                            onClick={() => handleCancel(m.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      {summaryOpenId === m.id && m.sessionSummary && (
                        <div className="live-attendance" style={{ whiteSpace: 'pre-wrap' }}>
                          <h4 style={{ marginTop: 0 }}>Session summary</h4>
                          <p className="live-lobby__muted" style={{ marginTop: 0 }}>
                            Status: {m.sessionSummaryStatus || 'ready'}
                            {m.sessionSummaryGeneratedAt
                              ? ` · ${new Date(m.sessionSummaryGeneratedAt).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata'
                                })}`
                              : ''}
                          </p>
                          <div>{m.sessionSummary}</div>
                        </div>
                      )}
                      {expandedId === m.id && (
                        <div className="live-attendance">
                          <p className="live-attendance__note">
                            Students who click <strong>Join class</strong> are marked Present
                            automatically. Roster refreshes every 20s while open.
                          </p>
                          {attendanceLoading && attendanceRows.length === 0 ? (
                            <p className="live-lobby__muted">Loading roster…</p>
                          ) : attendanceRows.length === 0 ? (
                            <p className="live-lobby__muted">No students in this batch yet.</p>
                          ) : (
                            <>
                              <div className="live-session__stats live-session__stats--roster">
                                <span className="live-stat live-stat--present">
                                  {attendanceRows.filter((r) => r.status === 'present' || r.status === 'late').length}{' '}
                                  present
                                </span>
                                <span className="live-stat live-stat--absent">
                                  {attendanceRows.filter((r) => r.status === 'absent').length} absent
                                </span>
                              </div>
                              <table className="live-attendance__table">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>How</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendanceRows.map((row) => (
                                    <tr
                                      key={row.studentId}
                                      className={
                                        row.status === 'present' || row.status === 'late'
                                          ? 'live-attendance__row--in'
                                          : ''
                                      }
                                    >
                                      <td>
                                        {row.studentName}
                                        {row.enrollmentNumber ? (
                                          <span className="live-lobby__muted">
                                            {' '}
                                            · {row.enrollmentNumber}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td>
                                        <span
                                          className={`live-source live-source--${row.source || 'none'}`}
                                        >
                                          {row.source === 'join'
                                            ? 'Joined'
                                            : row.source === 'teacher'
                                              ? 'Trainer'
                                              : '—'}
                                        </span>
                                      </td>
                                      <td>
                                        <select
                                          value={row.status}
                                          onChange={(e) => {
                                            const status = e.target.value;
                                            setAttendanceRows((rows) =>
                                              rows.map((r) =>
                                                r.studentId === row.studentId ? { ...r, status } : r
                                              )
                                            );
                                          }}
                                        >
                                          <option value="present">Present</option>
                                          <option value="late">Late</option>
                                          <option value="absent">Absent</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="live-attendance__actions">
                                <button
                                  type="button"
                                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                                  onClick={() => loadAttendance(m.id)}
                                >
                                  Refresh
                                </button>
                                <button
                                  type="button"
                                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                                  disabled={intimating}
                                  onClick={() => intimateSessionAbsentees(m.id)}
                                >
                                  Email absentees
                                </button>
                                <button
                                  type="button"
                                  className="live-lobby__btn live-lobby__btn--primary"
                                  disabled={attendanceSaving}
                                  onClick={() => saveAttendance(m.id)}
                                >
                                  {attendanceSaving ? 'Saving…' : 'Save overrides'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
