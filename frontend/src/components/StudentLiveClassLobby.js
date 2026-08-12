import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

function sessionPhase(meeting, now = Date.now()) {
  const start = meeting.scheduledStart
    ? new Date(meeting.scheduledStart).getTime()
    : new Date(`${meeting.scheduledDate}T${meeting.scheduledTime || '00:00'}`).getTime();
  const end = meeting.scheduledEnd
    ? new Date(meeting.scheduledEnd).getTime()
    : start + 60 * 60 * 1000;
  if (Number.isNaN(start)) return { phase: 'unknown', minsUntil: null, canJoin: false };
  const minsUntil = Math.round((start - now) / 60000);
  const canJoin = now >= start - 15 * 60 * 1000 && now <= end + 30 * 60 * 1000;
  if (now > end + 30 * 60 * 1000) return { phase: 'ended', minsUntil, canJoin: false };
  if (minsUntil <= 0 && now <= end) return { phase: 'live', minsUntil, canJoin };
  if (minsUntil > 0 && minsUntil <= 15) return { phase: 'soon', minsUntil, canJoin };
  if (minsUntil > 15) return { phase: 'scheduled', minsUntil, canJoin: false };
  return { phase: 'live', minsUntil, canJoin };
}

function formatCountdown(minsUntil, phase) {
  if (phase === 'ended') return 'Session ended';
  if (minsUntil === null || minsUntil === undefined) return '';
  if (minsUntil <= 0) return 'Class is in session — join to be marked present';
  if (minsUntil < 60) return `Starts in ${minsUntil} min`;
  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  return `Starts in ${h}h ${m}m`;
}

export default function StudentLiveClassLobby({ compact = false }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load live classes');
      const list = (data.meetings || []).filter(
        (m) => m.status !== 'cancelled' && m.status !== 'completed' && (m.hasMeetLink || m.meetLink)
      );
      setMeetings(list);
    } catch (err) {
      setError(err.message || 'Failed to load');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = meetings
    .filter((m) => sessionPhase(m, now).phase !== 'ended')
    .sort((a, b) => new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0));

  const handleJoin = async (m) => {
    setJoiningId(m.id);
    setJoinNote('');
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${m.id}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to join');
      const link = data.meetLink || data.joinUrl;
      if (!link) throw new Error('Meet link unavailable. Ask your trainer to start the class.');
      setJoinNote(
        data.markedPresent
          ? 'You’re marked present for this session. Opening Google Meet…'
          : 'Opening Google Meet…'
      );
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'Join failed');
    } finally {
      setJoiningId('');
    }
  };

  return (
    <div className={`live-lobby live-lobby--student ${compact ? 'live-lobby--compact' : ''}`}>
      <div className="live-lobby__hero">
        <p className="live-lobby__eyebrow">Sky States · Live class</p>
        <h2>Join your live session</h2>
        <p>
          Join with one click when class opens. Attendance is marked <strong>Present</strong> the moment
          you join — Meet opens in a new tab.
        </p>
      </div>

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>Upcoming for your batch</h3>
          <button type="button" className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm" onClick={load}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="live-lobby--empty">Checking your schedule…</p>
        ) : error ? (
          <p className="live-lobby__alert live-lobby__alert--err">{error}</p>
        ) : visible.length === 0 ? (
          <div className="live-lobby--empty">
            No live class is scheduled for your batch right now. Check back when your trainer posts one.
          </div>
        ) : (
          <ul className="live-lobby__list">
            {visible.map((m) => {
              const { phase, minsUntil, canJoin } = sessionPhase(m, now);
              const badge = phase === 'live' ? 'live' : phase === 'soon' ? 'soon' : 'scheduled';
              const badgeLabel =
                phase === 'live' ? 'In session' : phase === 'soon' ? 'Starting soon' : 'Scheduled';
              return (
                <li key={m.id} className={`live-session live-session--${badge}`}>
                  <div className="live-session__top">
                    <div>
                      <h4 className="live-session__title">{m.title}</h4>
                      <p className="live-session__meta">
                        {m.scheduledDate} · {m.scheduledTime} IST · {m.duration}
                        {m.teacherName ? ` · ${m.teacherName}` : ''}
                      </p>
                      <p className="live-session__countdown">{formatCountdown(minsUntil, phase)}</p>
                    </div>
                    <span className={`live-session__badge live-session__badge--${badge}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <div className="live-session__cta">
                    <button
                      type="button"
                      className="live-lobby__btn live-lobby__btn--primary"
                      disabled={joiningId === m.id || !canJoin}
                      onClick={() => handleJoin(m)}
                      title={
                        canJoin
                          ? 'Join Meet and mark yourself present'
                          : 'Join opens 15 minutes before class start'
                      }
                    >
                      {joiningId === m.id
                        ? 'Joining…'
                        : canJoin
                          ? 'Join class · Mark present'
                          : 'Opens 15 min before'}
                    </button>
                  </div>
                  {canJoin && (
                    <p className="live-lobby__hint">
                      Joining records your attendance as Present for this class.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {joinNote && <p className="live-lobby__alert live-lobby__alert--ok">{joinNote}</p>}
      </section>
    </div>
  );
}
