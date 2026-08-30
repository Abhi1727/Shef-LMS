import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import { liveJoinUrl, livePlatformLabel, trainerLivePlatform } from '../utils/liveJoinUrl';
import { openLiveClassSession } from '../utils/openLiveClassSession';
import { formatLiveClassCountdown, getLiveClassSessionPhase } from '../utils/liveClassSessionPhase';
import LiveClassPlatformPicker from './LiveClassPlatformPicker';
import './LiveClassStudio.css';
import './MeetLiveClasses.css';

function sessionPhase(meeting, now = Date.now()) {
  return getLiveClassSessionPhase(meeting, now, { forTrainer: true });
}

function formatCountdown(minsUntil, phase) {
  return formatLiveClassCountdown(minsUntil, phase, { forTrainer: true });
}

export default function MeetLiveClassesPanel({
  batchId = '',
  batches = [],
  compact = false,
  studioLayout = false,
  batchSchedule = null,
  title = 'Live classes',
  batchLabel: batchLabelProp = '',
  conferenceProvider: conferenceProviderProp = ''
}) {
  const apiUrl = getApiBaseUrl();
  const [trainerPlatform, setTrainerPlatform] = useState(
    conferenceProviderProp === 'zoom' ? 'zoom' : conferenceProviderProp === 'meet' ? 'meet' : ''
  );
  const [selectedPlatform, setSelectedPlatform] = useState('meet');
  const [hostProfile, setHostProfile] = useState({ name: '', email: '' });
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
  const [syncingRecordings, setSyncingRecordings] = useState(false);
  const fileInputRef = React.useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryGeneratingId, setSummaryGeneratingId] = useState('');
  const [summaryOpenId, setSummaryOpenId] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [intimating, setIntimating] = useState(false);
  const [materialMeetingId, setMaterialMeetingId] = useState('');
  const materialInputRef = React.useRef(null);
  const [meetEnabled, setMeetEnabled] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('all'); // all | upcoming | completed
  const [sessionBatchFilter, setSessionBatchFilter] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [form, setForm] = useState({
    title: '',
    batchId: batchId || '',
    scheduledDate: '',
    scheduledTime: '',
    description: '',
    unassigned: false
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

  useEffect(() => {
    const hasLive = meetings.some((m) => m.status === 'live');
    if (!hasLive) return undefined;
    const tick = setInterval(() => loadMeetings(), 45000);
    return () => clearInterval(tick);
  }, [meetings, loadMeetings]);

  useEffect(() => {
    if (conferenceProviderProp === 'zoom' || conferenceProviderProp === 'meet') {
      setTrainerPlatform(conferenceProviderProp);
      setSelectedPlatform(conferenceProviderProp);
    }
    fetch(`${apiUrl}/api/auth/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (!(conferenceProviderProp === 'zoom' || conferenceProviderProp === 'meet')) {
          const p = data?.user?.conferenceProvider;
          if (p === 'zoom' || p === 'meet') {
            setTrainerPlatform(p);
            setSelectedPlatform(p);
          }
        }
        if (data?.user) {
          setHostProfile({
            name: data.user.name || '',
            email: data.user.email || ''
          });
        }
      })
      .catch(() => {});
    fetch(`${apiUrl}/api/meetings/status`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.enabled === 'boolean') {
          setMeetEnabled(data.enabled);
          if (!data.enabled) {
            setTrainerPlatform((prev) => (prev === 'meet' ? 'zoom' : prev));
            setSelectedPlatform((prev) => (prev === 'meet' ? 'zoom' : prev));
          }
        }
      })
      .catch(() => {});
  }, [apiUrl, conferenceProviderProp]);

  const platformName = trainerLivePlatform(trainerPlatform || selectedPlatform || 'meet');
  const usesZoom = (trainerPlatform || selectedPlatform) === 'zoom';
  const batchLabel =
    batchLabelProp ||
    batches.find((b) => String(b.id) === String(batchId || form.batchId))?.name ||
    '';

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
    .filter((m) => {
      if (m.status === 'cancelled') return false;
      if (m.hasJoinLink || m.meetLink || m.zoomLink) return true;
      return m.status === 'scheduled' || m.status === 'live';
    })
    .filter((m) => {
      const { phase } = sessionPhase(m, now);
      return phase !== 'ended' || m.needsRecording || m.status === 'completed';
    })
    .sort((a, b) => new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0));

  const needingRecording = visible.filter((m) => sessionPhase(m, now).phase === 'needsRecording');

  const activeLive = visible.find((m) => sessionPhase(m, now).phase === 'live');
  const nextSession =
    activeLive ||
    visible.find((m) => {
      const { phase } = sessionPhase(m, now);
      return m.status !== 'completed' && (phase === 'live' || phase === 'soon' || phase === 'scheduled');
    });
  const upcomingScheduled = visible.filter((m) => {
    if (m.status === 'completed' || m.id === nextSession?.id) return false;
    const { phase, canStart } = sessionPhase(m, now);
    return canStart || phase === 'scheduled' || phase === 'soon';
  });
  const studioSplit = studioLayout && Boolean(activeLive || nextSession);

  const sessionList = visible
    .filter((m) => sessionPhase(m, now).phase !== 'needsRecording')
    .filter((m) => {
      if (sessionBatchFilter === 'unassigned') {
        if (m.batchId) return false;
      } else if (sessionBatchFilter && String(m.batchId) !== String(sessionBatchFilter)) {
        return false;
      }
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
    if (!targetBatch || !form.scheduledDate || !form.scheduledTime) {
      setError('Batch, date, and time are required to schedule a class.');
      return;
    }
    const title =
      form.title.trim() ||
      `${batches.find((b) => String(b.id) === String(targetBatch))?.name || batchLabel || 'Batch'} — Live class`;
    setSaving(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          batchId: targetBatch,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          description: form.description || '',
          timezone: 'Asia/Kolkata',
          conferenceProvider: trainerPlatform || selectedPlatform || 'zoom'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to schedule class');
      setMessage('Class scheduled. It appears below — you can start it anytime before the scheduled time.');
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

  const handleInstantMeet = async ({ fromHero = false } = {}) => {
    setMessage('');
    setError('');
    const targetBatch = form.batchId || batchId;
    const batchName =
      batches.find((b) => String(b.id) === String(targetBatch))?.name || batchLabel || '';
    const title =
      form.title.trim() ||
      (batchName ? `${batchName} — Live class` : fromHero ? 'Live class' : '');
    if (!targetBatch) {
      setError('Select a batch first.');
      return;
    }
    setSaving(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          batchId: targetBatch,
          startNow: true,
          description: form.description || '',
          timezone: 'Asia/Kolkata',
          conferenceProvider: trainerPlatform || selectedPlatform || 'zoom'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to start class');
      const meeting = data.meeting || data;
      const link = liveJoinUrl(meeting, {
        host: true
      }) || liveJoinUrl(data.meetLink || data.startUrl, { host: true });
      const provider = selectedPlatform || trainerPlatform || 'meet';
      if (provider === 'zoom' && meeting.id) {
        openLiveClassSession({
          meetingId: meeting.id,
          joinUrl: link,
          embedded: Boolean(data.embedded && data.sdk),
          conferenceProvider: 'zoom',
          host: true,
          joinPayload: data.embedded && data.sdk ? data : null,
          preferWorkspace: true,
          userName: data.sdk?.userName || ''
        });
      } else if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
      setMessage(
        (data.closedPreviousSessions?.length
          ? `Closed ${data.closedPreviousSessions.length} previous session(s). `
          : '') +
          (usesZoom
            ? 'Class started in Zoom Workspace. End the class when finished so recording can sync to Classroom.'
            : 'Class started. End the class when finished.')
      );
      setForm((f) => ({ ...f, title: '', description: '' }));
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Failed to create instant meeting');
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

  const handleEndClass = async (m) => {
    if (!window.confirm('End this class? Students will no longer see Join. Recording will sync to Classroom.')) {
      return;
    }
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${m.id}/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dismissPrompt: false })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to end class');
      setMessage('Class ended. Recording sync will run automatically (usually 15–60 min).');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Failed to end class');
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
      const meeting = data.meeting || data;
      const link = liveJoinUrl(meeting, { host: true }) ||
        liveJoinUrl(data.meetLink || data.startUrl || m, { host: true });
      const provider = meeting.conferenceProvider || m.conferenceProvider || trainerPlatform || 'meet';
      if (provider === 'zoom' && (meeting.id || m.id)) {
        openLiveClassSession({
          meetingId: meeting.id || m.id,
          joinUrl: link,
          embedded: Boolean(data.embedded && data.sdk),
          conferenceProvider: 'zoom',
          host: true,
          joinPayload: data.embedded && data.sdk ? data : null,
          preferWorkspace: true,
          userName: data.sdk?.userName || ''
        });
      } else if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
      setExpandedId(m.id);
      await Promise.all([loadMeetings(), loadAttendance(m.id)]);
      setMessage(
        (data.closedPreviousSessions?.length
          ? `Closed ${data.closedPreviousSessions.length} previous session(s). `
          : '') +
          (data.message ||
            (provider === 'zoom'
              ? 'Opening Zoom Workspace as host…'
              : 'Class started.'))
      );
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

  const syncRecordings = async (meetingId = '') => {
    setSyncingRecordings(true);
    setError('');
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/sync-recordings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(meetingId ? { meetingId } : {})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to sync recordings');
      setMessage(data.message || 'Recording sync finished.');
      await loadMeetings();
    } catch (err) {
      setError(err.message || 'Failed to sync recordings');
    } finally {
      setSyncingRecordings(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleStartNow = () => {
    if (!batchId && !form.batchId) {
      setError('Select a batch first.');
      return;
    }
    handleInstantMeet({ fromHero: true });
  };

  return (
    <div
      className={`live-studio ${compact ? 'live-studio--compact' : ''}${
        studioLayout
          ? ` live-studio--trainer-studio${studioSplit ? ' live-studio--trainer-studio-split' : ''}`
          : ''
      }`}
    >
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

      {(trainerPlatform || conferenceProviderProp) && (
        <div className="live-studio-trainer__start">
        <LiveClassPlatformPicker
          selectedPlatform={selectedPlatform}
          onSelect={setSelectedPlatform}
          trainerPlatform={trainerPlatform || conferenceProviderProp || 'zoom'}
          meetEnabled={meetEnabled}
          batchLabel={batchLabel}
          classTitle={form.title}
          onClassTitleChange={(value) => setForm((f) => ({ ...f, title: value }))}
          scheduledDate={form.scheduledDate}
          scheduledTime={form.scheduledTime}
          description={form.description}
          onFieldChange={handleFieldChange}
          hostName={hostProfile.name}
          hostEmail={hostProfile.email}
          saving={saving}
          onStartNow={handleStartNow}
          onSchedule={handleSchedule}
          showBatchSelect={!batchId}
          batches={batches}
          batchId={form.batchId}
          onBatchChange={(id) => setForm((f) => ({ ...f, batchId: id }))}
          simplified={studioLayout}
        />
        </div>
      )}

      {studioLayout && activeLive && (
        <section className="live-studio-live-bar live-studio-trainer__next">
          <div className="live-studio-live-bar__main">
            <span className="live-studio-badge live-studio-badge--live">Live</span>
            <h3>{activeLive.title}</h3>
            <p className="live-studio-session__meta">
              {activeLive.scheduledDate} · {activeLive.scheduledTime} IST
            </p>
          </div>
          <div className="live-studio-live-bar__cta">
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--primary"
              onClick={() => handleStart(activeLive)}
            >
              Open Zoom
            </button>
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--danger"
              onClick={() => handleEndClass(activeLive)}
            >
              End class
            </button>
          </div>
        </section>
      )}

      {studioLayout && !activeLive && nextSession && (
        <section className="live-studio-next-session live-studio-trainer__next">
          <div className="live-studio-next-session__card">
            <div className="live-studio-next-session__main">
              <div className="live-studio-next-session__head">
                <h3>{nextSession.title}</h3>
                {sessionPhase(nextSession, now).phase === 'live' ? (
                  <span className="live-studio-badge live-studio-badge--live">Live</span>
                ) : sessionPhase(nextSession, now).phase === 'soon' ? (
                  <span className="live-studio-badge live-studio-badge--soon">Soon</span>
                ) : (
                  <span className="live-studio-badge live-studio-badge--scheduled">Scheduled</span>
                )}
              </div>
              <p className="live-studio-session__meta">
                {nextSession.scheduledDate} · {nextSession.scheduledTime} IST
                {nextSession.status === 'completed' && nextSession.duration
                  ? ` · ${nextSession.duration}`
                  : ''}
              </p>
              <p className="live-studio-session__meta live-studio-session__meta--hint">
                {formatCountdown(sessionPhase(nextSession, now).minsUntil, sessionPhase(nextSession, now).phase)}
              </p>
            </div>
            <div className="live-studio-next-session__cta">
              <button
                type="button"
                className="live-lobby__btn live-lobby__btn--primary"
                onClick={() => handleStart(nextSession)}
              >
                {sessionPhase(nextSession, now).phase === 'live' ? 'Open class' : 'Start class now'}
              </button>
            </div>
          </div>
        </section>
      )}

      {studioLayout && upcomingScheduled.length > 0 && (
        <section className="live-studio-sessions live-studio-trainer__sessions live-studio-trainer__sessions--studio">
          <div className="live-studio-sessions__head">
            <h3>More scheduled classes</h3>
          </div>
          <ul className="live-lobby__list live-lobby__list--sessions">
            {upcomingScheduled.map((m) => {
              const { phase, minsUntil } = sessionPhase(m, now);
              return (
                <li key={m.id} className="live-session">
                  <div className="live-session__top">
                    <div>
                      <h4 className="live-session__title">{m.title}</h4>
                      <p className="live-session__meta">
                        {m.scheduledDate} · {m.scheduledTime} IST
                      </p>
                      <p className="live-session__countdown">{formatCountdown(minsUntil, phase)}</p>
                    </div>
                    <span className="live-session__badge live-session__badge--scheduled">Scheduled</span>
                  </div>
                  <div className="live-session__cta">
                    <button
                      type="button"
                      className="live-lobby__btn live-lobby__btn--primary"
                      onClick={() => handleStart(m)}
                    >
                      Start class now
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!studioLayout && nextSession && (
        <section className="live-studio-next-session live-studio-trainer__next">
          <p className="live-studio-section-num">2. Next live session</p>
          <div className="live-studio-next-session__card">
            <div className="live-studio-next-session__main">
              <div className="live-studio-next-session__head">
                <h3>{nextSession.title}</h3>
                {sessionPhase(nextSession, now).phase === 'live' && (
                  <span className="live-studio-badge live-studio-badge--live">Live</span>
                )}
              </div>
              <p className="live-studio-session__meta">
                {nextSession.scheduledDate} · {nextSession.scheduledTime} IST
                {nextSession.status === 'completed' && nextSession.duration
                  ? ` · ${nextSession.duration}`
                  : ''}
                {batchLabel ? ` · ${batchLabel}` : ''}
              </p>
              <p className="live-studio-session__meta">
                {usesZoom ? 'Live on Zoom' : livePlatformLabel(nextSession)}
              </p>
            </div>
            <div className="live-studio-next-session__cta">
              <button
                type="button"
                className="live-lobby__btn live-lobby__btn--primary"
                onClick={() => handleStart(nextSession)}
              >
                Join live session
              </button>
            </div>
          </div>
        </section>
      )}

      {(error || message) && (
        <div className="live-studio-trainer__alerts" style={{ marginBottom: '1rem' }}>
          {error && (
            <div className="live-studio__alert live-studio__alert--err" role="alert">
              {error}
            </div>
          )}
          {message && <div className="live-studio__alert live-studio__alert--ok">{message}</div>}
        </div>
      )}

      {!studioLayout && summaryBatchId && (
        <section className="live-lobby__card live-lobby__card--summary live-studio-trainer__attendance">
          <p className="live-studio-section-num">5. Batch attendance</p>
          <div className="live-lobby__card-head">
            <h3>Attendance summary</h3>
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

      {!studioLayout && needingRecording.length > 0 && (
        <section className="live-lobby__card live-lobby__card--recording live-studio-trainer__recordings">
          <p className="live-studio-section-num">4. Recordings</p>
          <div className="live-lobby__card-head">
            <h3>Classroom recordings</h3>
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
              disabled={syncingRecordings}
              onClick={() => syncRecordings()}
            >
              {syncingRecordings
                ? 'Syncing…'
                : usesZoom
                  ? 'Sync Zoom → YouTube'
                  : 'Sync from Meet'}
            </button>
          </div>
          <p className="live-lobby__muted">
            {usesZoom
              ? 'Zoom cloud recordings are archived to Drive, then uploaded to YouTube for Classroom. Auto-import runs every 10 minutes.'
              : 'Auto-import runs every 10 minutes. Manual upload is only needed if Meet did not record.'}
          </p>
          <ul className="live-lobby__list">
            {needingRecording.length === 0 ? (
              <li className="live-lobby--empty">
                {usesZoom
                  ? 'No recordings pending. After class ends, cloud recording syncs automatically.'
                  : 'No recordings pending.'}
              </li>
            ) : (
            needingRecording.map((m) => (
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
                    className="live-lobby__btn live-lobby__btn--ghost"
                    disabled={syncingRecordings}
                    onClick={() => syncRecordings(m.id)}
                  >
                    {usesZoom ? 'Sync recording' : 'Pull from Meet'}
                  </button>
                  <button
                    type="button"
                    className="live-lobby__btn live-lobby__btn--primary"
                    disabled={uploadingId === m.id}
                    onClick={() => goUploadRecording(m)}
                  >
                    {uploadingId === m.id ? 'Uploading to Drive…' : 'Upload file'}
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
            ))
            )}
          </ul>
        </section>
      )}

      {!studioLayout && (
      <section className={`live-studio-sessions live-studio-trainer__sessions`}>
        <p className="live-studio-section-num">3. Your sessions</p>
        <div className="live-studio-sessions__head">
            <h3>Session history</h3>
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
                <option value="unassigned">Unassigned (no batch)</option>
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
                  const { phase, minsUntil, canStart } = sessionPhase(m, now);
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
                            {m.scheduledDate} · {m.scheduledTime} IST
                            {m.duration && m.status === 'completed' ? ` · ${m.duration}` : ''}
                            {m.skipRecordingUpload || !m.batchId
                              ? ' · No batch · recording not uploaded'
                              : m.batchId && batches.length
                                ? ` · ${batches.find((b) => String(b.id) === String(m.batchId))?.name || ''}`
                                : ''}
                          </p>
                          <p className="live-session__countdown">
                            {formatCountdown(minsUntil, phase)}
                          </p>
                          {!(!m.batchId || m.skipRecordingUpload) && (
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
                          )}
                        </div>
                          <span className={`live-session__badge live-session__badge--${badge}`}>
                            {badgeLabel}
                          </span>
                          <span className="live-session__badge live-session__badge--platform">
                            {livePlatformLabel(m)}
                          </span>
                      </div>
                      <div className="live-session__cta">
                        {m.status !== 'completed' && (phase === 'live' || canStart || phase === 'scheduled' || phase === 'soon') && (
                          <>
                            <button
                              type="button"
                              className="live-lobby__btn live-lobby__btn--primary"
                              onClick={() => handleStart(m)}
                            >
                              {phase === 'live' ? 'Open in Zoom' : 'Start class now'}
                            </button>
                            {phase === 'live' && (
                              <button
                                type="button"
                                className="live-lobby__btn live-lobby__btn--danger"
                                onClick={() => handleEndClass(m)}
                              >
                                End class
                              </button>
                            )}
                          </>
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
      )}

      {activeLive && !studioLayout && (
        <section className="live-studio-end-session live-studio-trainer__end" aria-label="End current class">
          <p>
            <strong>End session</strong> — Click below when class is finished. Recording will sync to
            Classroom automatically.
          </p>
          <button
            type="button"
            className="live-studio-end-session__btn"
            onClick={() => handleEndClass(activeLive)}
          >
            End session
          </button>
        </section>
      )}
    </div>
  );
}
