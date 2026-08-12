import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

const SEGMENTS = ['All', 'Healthy', 'Passive', 'Unengaged'];

function segmentClass(seg) {
  if (seg === 'Healthy') return 'live-stat live-stat--present';
  if (seg === 'Passive') return 'live-stat live-stat--warn';
  if (seg === 'Unengaged') return 'live-stat live-stat--absent';
  return 'live-stat';
}

export default function TeacherAttendanceHub() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [intimating, setIntimating] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [expanded, setExpanded] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/attendance-overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load overview');
      setRows(data.batches || []);
    } catch (err) {
      setError(err.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const c = r.engagementCounts || {};
        acc.Healthy += c.Healthy || 0;
        acc.Passive += c.Passive || 0;
        acc.Unengaged += c.Unengaged || 0;
        return acc;
      },
      { Healthy: 0, Passive: 0, Unengaged: 0 }
    );
  }, [rows]);

  const intimateBatch = async (batchId, mode = 'engagement') => {
    setIntimating(`${batchId}:${mode}`);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/meetings/intimate-low-attendance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchId, mode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send notices');
      alert(data.message || `Sent ${data.sent || 0} notice(s)`);
    } catch (err) {
      setError(err.message || 'Intimate failed');
    } finally {
      setIntimating('');
    }
  };

  const filteredStudents = (students = []) => {
    if (segmentFilter === 'All') return students;
    return students.filter((s) => s.engagement === segmentFilter);
  };

  return (
    <div className="live-lobby">
      <div className="live-lobby__hero">
        <p className="live-lobby__eyebrow">Sky States · Attendance</p>
        <h2>Engagement & attendance</h2>
        <p>
          Healthy / Passive / Unengaged across your batches. Nudge Passive or Unengaged students,
          or open a batch workspace for session-level roster and materials.
        </p>
      </div>

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>All batches</h3>
          <div className="live-session__cta">
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              aria-label="Filter engagement segment"
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s === 'All'
                    ? `All segments (${totals.Healthy + totals.Passive + totals.Unengaged})`
                    : `${s} (${totals[s] || 0})`}
                </option>
              ))}
            </select>
            <button type="button" className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm" onClick={load}>
              Refresh
            </button>
          </div>
        </div>
        {loading ? (
          <p className="live-lobby--empty">Loading attendance…</p>
        ) : error ? (
          <p className="live-lobby__alert live-lobby__alert--err">{error}</p>
        ) : rows.length === 0 ? (
          <div className="live-lobby--empty">No batches assigned yet.</div>
        ) : (
          <div className="live-summary-scroll" style={{ maxHeight: 'none' }}>
            <table className="live-attendance__table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Sessions</th>
                  <th>Avg join</th>
                  <th>Healthy</th>
                  <th>Passive</th>
                  <th>Unengaged</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = r.engagementCounts || {};
                  const nudgeCount = (c.Passive || 0) + (c.Unengaged || 0);
                  const students = filteredStudents(r.students);
                  const isOpen = expanded === r.batchId;
                  return (
                    <React.Fragment key={r.batchId}>
                      <tr>
                        <td>
                          <strong>{r.batchName || r.batchId}</strong>
                          <div className="live-lobby__muted">{r.course}</div>
                        </td>
                        <td>{r.sessionsTotal}</td>
                        <td>
                          <span
                            className={`live-stat ${
                              r.batchJoinRateAvg < (r.threshold || 70)
                                ? 'live-stat--absent'
                                : 'live-stat--present'
                            }`}
                          >
                            {r.batchJoinRateAvg}%
                          </span>
                        </td>
                        <td>
                          <span className={segmentClass('Healthy')}>{c.Healthy || 0}</span>
                        </td>
                        <td>
                          <span className={segmentClass('Passive')}>{c.Passive || 0}</span>
                        </td>
                        <td>
                          <span className={segmentClass('Unengaged')}>{c.Unengaged || 0}</span>
                        </td>
                        <td>
                          <div className="live-session__cta">
                            <button
                              type="button"
                              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                              onClick={() => setExpanded(isOpen ? '' : r.batchId)}
                            >
                              {isOpen ? 'Hide' : 'Students'}
                            </button>
                            <button
                              type="button"
                              className="live-lobby__btn live-lobby__btn--primary live-lobby__btn--sm"
                              onClick={() =>
                                navigate(`/teacher/batch/${r.batchId}`, {
                                  state: { from: 'teacher-batches', activeView: 'attendance' }
                                })
                              }
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                              disabled={intimating.startsWith(r.batchId) || nudgeCount === 0}
                              onClick={() => intimateBatch(r.batchId, 'engagement')}
                            >
                              {intimating === `${r.batchId}:engagement` ? 'Sending…' : 'Nudge'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7}>
                            {students.length === 0 ? (
                              <div className="live-lobby--empty">No students in this filter.</div>
                            ) : (
                              <table className="live-attendance__table">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Join %</th>
                                    <th>Engagement</th>
                                    <th>Streak</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {students.map((s) => (
                                    <tr key={s.studentId}>
                                      <td>
                                        <strong>{s.studentName}</strong>
                                        <div className="live-lobby__muted">{s.email}</div>
                                      </td>
                                      <td>{s.joinRate}%</td>
                                      <td>
                                        <span className={segmentClass(s.engagement)}>{s.engagement}</span>
                                      </td>
                                      <td>{s.consecutiveAbsent || 0}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
