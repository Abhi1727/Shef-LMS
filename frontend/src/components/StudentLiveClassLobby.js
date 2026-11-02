import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import { liveJoinUrl, livePlatformLabel } from '../utils/liveJoinUrl';
import { openLiveClassSession } from '../utils/openLiveClassSession';
import { formatLiveClassCountdown, getLiveClassSessionPhase } from '../utils/liveClassSessionPhase';
import { formatClassWhen, istHint } from '../utils/viewerTime';
import { useViewerTimeZone } from './TimeZoneTools';
import './LiveClassStudio.css';

function sessionPhase(meeting, now = Date.now()) {
  return getLiveClassSessionPhase(meeting, now, { forTrainer: false });
}

function formatCountdown(minsUntil, phase) {
  return formatLiveClassCountdown(minsUntil, phase, { forTrainer: false });
}

function formatTimeRange(m, tz) {
  const start = m.scheduledStart ? new Date(m.scheduledStart) : null;
  const end = m.scheduledEnd ? new Date(m.scheduledEnd) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return `${m.scheduledDate || ''} · ${m.scheduledTime || ''} IST · ${m.duration || ''}`.trim();
  }
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  const when = formatClassWhen(start, validEnd, { tz });
  const hint = istHint(start, tz);
  return hint ? `${when} (${hint})` : when;
}

export default function StudentLiveClassLobby({ compact = false }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [now, setNow] = useState(Date.now());
  const tz = useViewerTimeZone();

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
        (m) => m.status !== 'cancelled' && m.status !== 'completed' && (m.hasJoinLink || m.hasMeetLink || m.meetLink || m.zoomLink)
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
    .sort((a, b) => {
      if (a.isPrimaryBatch && !b.isPrimaryBatch) return -1;
      if (!a.isPrimaryBatch && b.isPrimaryBatch) return 1;
      return new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0);
    });

  const featured =
    visible.find((m) => {
      const p = sessionPhase(m, now);
      return (p.phase === 'live' || p.phase === 'soon') && m.isPrimaryBatch;
    }) ||
    visible.find((m) => {
      const p = sessionPhase(m, now);
      return p.phase === 'live' || p.phase === 'soon';
    }) ||
    visible.find((m) => m.isPrimaryBatch) ||
    visible[0];

  const handleJoin = async (m, { preferWorkspace = false } = {}) => {
    setJoiningId(m.id);
    setJoinNote('');
    setError('');
    const platform = m.conferenceProvider === 'zoom' ? 'zoom' : 'meet';
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
      const link = liveJoinUrl(data.meeting || data) || liveJoinUrl(data.meetLink || data.joinUrl);
      const opened = openLiveClassSession({
        meetingId: m.id,
        joinUrl: link,
        embedded: Boolean(data.embedded && data.sdk),
        conferenceProvider: platform,
        host: false,
        joinPayload: data.embedded && data.sdk ? data : null,
        preferWorkspace: preferWorkspace && platform === 'zoom',
        userName: data.sdk?.userName || ''
      });
      if (opened.mode === 'none') {
        throw new Error(
          data.message || 'Join link unavailable. Ask your trainer to start the class.'
        );
      }
      setJoinNote(
        data.message
          ? data.message
          : data.markedPresent
          ? opened.mode === 'workspace' || opened.mode === 'workspace-or-embedded' || opened.mode === 'workspace-or-web'
            ? 'You’re marked present. Opening Zoom Workspace (or classroom in this tab)…'
            : opened.mode === 'embedded'
              ? 'You’re marked present. Opening Sky States Classroom…'
              : `You’re marked present. Opening ${livePlatformLabel({ conferenceProvider: platform })}…`
          : opened.mode === 'workspace' || opened.mode === 'workspace-or-embedded' || opened.mode === 'workspace-or-web'
            ? 'Opening Zoom Workspace (or classroom in this tab)…'
            : opened.mode === 'embedded'
              ? 'Opening Sky States Classroom…'
              : `Opening ${livePlatformLabel({ conferenceProvider: platform })}…`
      );
    } catch (err) {
      setError(err.message || 'Join failed');
    } finally {
      setJoiningId('');
    }
  };

  const featuredPhase = featured ? sessionPhase(featured, now) : null;
  const featuredProvider =
    featured?.conferenceProvider === 'zoom' ||
    (featured?.zoomLink && !featured?.meetLink)
      ? 'zoom'
      : 'meet';
  const isLive = featuredPhase?.phase === 'live' || featuredPhase?.phase === 'soon';

  return (
    <div className={`live-studio ${compact ? 'live-studio--compact' : ''}`}>
      {loading ? (
        <div className="live-studio-empty">Checking your schedule…</div>
      ) : error && !featured ? (
        <div className="live-studio__alert live-studio__alert--err">{error}</div>
      ) : !featured ? (
        <div className={`live-studio-student live-studio-student--empty${compact ? ' live-studio-student--compact' : ''}`}>
          <div className="live-studio-student__main">
            <h3 className="live-studio-student__title">No live class right now</h3>
            <p className="live-studio-student__lede">
              {compact
                ? 'Your trainer’s next session will show here when it’s time to join.'
                : 'When your trainer starts a session, it will appear here. You can also check your schedule for upcoming times.'}
            </p>
          </div>
        </div>
      ) : (
        <article
          className={`live-studio-student${isLive ? ' live-studio-student--live' : ''}${
            compact ? ' live-studio-student--compact' : ''
          }`}
        >
          <div className="live-studio-student__inner">
            <div className="live-studio-student__main">
              {!compact && (
                <p className="live-studio-student__eyebrow">Sky States Classroom</p>
              )}
              <span
                className={`live-studio-badge live-studio-badge--${
                  featuredPhase?.phase === 'live' ? 'live' : featuredPhase?.phase === 'soon' ? 'soon' : 'soon'
                }`}
              >
                {featuredPhase?.phase === 'live'
                  ? 'LIVE NOW'
                  : featuredPhase?.phase === 'soon'
                    ? 'Starting soon'
                    : 'Upcoming'}
              </span>
              <h3 className="live-studio-student__title">{featured.title}</h3>
              <p className="live-studio-session__meta">{formatTimeRange(featured, tz)}</p>
              {featured.teacherName && (
                <p className="live-studio-session__meta live-studio-session__meta--trainer">
                  Trainer: {featured.teacherName}
                </p>
              )}
              <ul className="live-studio-student__checklist">
                {featuredPhase?.phase === 'live' || featuredPhase?.phase === 'soon' ? (
                  <li className="is-highlight">
                    {formatCountdown(featuredPhase?.minsUntil, featuredPhase?.phase)}
                  </li>
                ) : null}
                {!compact && featuredProvider === 'zoom' ? (
                  <li>Sky States Classroom (in LMS) — or Zoom Workspace for remote control</li>
                ) : !compact ? (
                  <li>Join with {livePlatformLabel({ conferenceProvider: featuredProvider })}</li>
                ) : null}
                {!compact && <li>Stable internet recommended</li>}
                {!compact && <li>You join muted — unmute only when asked</li>}
                <li>Entering class marks you Present</li>
              </ul>
              <div className="live-studio-student__join-row">
                <button
                  type="button"
                  className={`live-studio-student__join${featuredProvider === 'zoom' ? ' is-zoom' : ''}`}
                  disabled={joiningId === featured.id || !featuredPhase?.canJoin}
                  onClick={() => handleJoin(featured)}
                >
                  <span className="live-studio-student__join-icon" aria-hidden="true">▶</span>
                  {joiningId === featured.id
                    ? 'Entering…'
                      : featuredPhase?.canJoin
                      ? featuredProvider === 'zoom'
                        ? 'Enter classroom'
                        : 'Join live class'
                      : featured?.status === 'live'
                        ? 'Enter classroom'
                        : 'Opens when trainer starts or 15 min before class'}
                </button>
                {featuredProvider === 'zoom' && featuredPhase?.canJoin ? (
                  <button
                    type="button"
                    className="live-studio-student__join-alt"
                    disabled={joiningId === featured.id}
                    onClick={() => handleJoin(featured, { preferWorkspace: true })}
                  >
                    <span className="live-studio-student__join-icon" aria-hidden="true">📹</span>
                    Open in Zoom app
                  </button>
                ) : null}
              </div>
              {featuredPhase?.canJoin && !compact && (
                <p className="live-studio-student__hint">
                  {featuredProvider === 'zoom'
                    ? 'Default stays in the LMS. Use Open in Zoom app for remote screen control.'
                    : 'Joining records your attendance as Present.'}
                </p>
              )}
            </div>
            {!compact && (
            <div
              className={`live-studio-student__aside${featuredProvider === 'zoom' ? ' is-zoom' : ''}`}
              aria-hidden="true"
            >
              <div className="live-studio-student__stage-label">
                <span className="live-studio-student__stage-brand">Sky States</span>
                <span className="live-studio-student__stage-sub">Live classroom</span>
              </div>
              <div className="live-studio-student__preview">
                <span />
                <span />
                <span />
              </div>
            </div>
            )}
          </div>
        </article>
      )}

      {visible.length > 1 && (
        <section className="live-studio-sessions">
          <div className="live-studio-sessions__head">
            <h3>More upcoming sessions</h3>
            <button type="button" className="live-studio-btn" onClick={load}>
              Refresh
            </button>
          </div>
          {visible
            .filter((m) => m.id !== featured?.id)
            .map((m) => {
              const { phase, minsUntil, canJoin } = sessionPhase(m, now);
              const provider = m.conferenceProvider === 'zoom' ? 'zoom' : 'meet';
              return (
                <div key={m.id} className="live-studio-session">
                  <div className="live-studio-session__row">
                    <div>
                      <h4 className="live-studio-session__title">{m.title}</h4>
                      <p className="live-studio-session__meta">{formatTimeRange(m, tz)}</p>
                      <p className="live-studio-session__meta">
                        {formatCountdown(minsUntil, phase)}
                      </p>
                    </div>
                    <div className="live-studio-badges">
                      <span
                        className={`live-studio-badge live-studio-badge--platform${
                          provider === 'zoom' ? ' is-zoom' : ''
                        }`}
                      >
                        {livePlatformLabel({ conferenceProvider: provider })}
                      </span>
                    </div>
                  </div>
                  <div className="live-studio-session__actions">
                    <button
                      type="button"
                      className="live-studio-btn live-studio-btn--primary"
                      disabled={joiningId === m.id || !canJoin}
                      onClick={() => handleJoin(m)}
                    >
                      {joiningId === m.id ? 'Joining…' : canJoin ? 'Join class' : 'Opens soon'}
                    </button>
                    {provider === 'zoom' && canJoin ? (
                      <button
                        type="button"
                        className="live-studio-btn"
                        disabled={joiningId === m.id}
                        onClick={() => handleJoin(m, { preferWorkspace: true })}
                      >
                        Zoom app
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
        </section>
      )}

      {joinNote && <div className="live-studio__alert live-studio__alert--ok">{joinNote}</div>}
      {error && featured && (
        <div className="live-studio__alert live-studio__alert--err">{error}</div>
      )}
    </div>
  );
}
