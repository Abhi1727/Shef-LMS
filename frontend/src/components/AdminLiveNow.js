import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import { formatTimeIn, zoneAbbreviation } from '../utils/viewerTime';
import { useViewerTimeZone } from './TimeZoneTools';
import './AdminLiveNow.css';

const POLL_MS = 30000;

function minutesSince(iso, now) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : Math.max(0, Math.round((now - t) / 60000));
}

function formatElapsed(mins) {
  if (mins == null) return '';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Cards for classes running right now, each with a "Join as admin" button. */
export default function AdminLiveNow({ onJoin, joiningId = '', title = 'Live now' }) {
  const tz = useViewerTimeZone();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/live-now`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load live classes');
      setClasses(data.liveClasses || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load live classes');
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section className="admin-live" aria-live="polite">
      <header className="admin-live__head">
        <div>
          <h3 className="admin-live__title">
            {classes.length > 0 && <span className="admin-live__pulse" aria-hidden="true" />}
            {title} <span className="admin-live__count">{loading ? '…' : classes.length}</span>
          </h3>
          <p className="admin-live__sub">
            Join as admin opens the class in a new tab as a participant. It does not mark attendance or affect the
            trainer.
          </p>
        </div>
        <button type="button" className="admin-live__refresh" onClick={load} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && <p className="admin-live__error">{error}</p>}

      {!loading && !error && classes.length === 0 && (
        <p className="admin-live__empty">No class is live right now. This list refreshes every 30 seconds.</p>
      )}

      {classes.length > 0 && (
        <div className="admin-live__grid">
          {classes.map((c) => {
            const mins = minutesSince(c.startedAt, now);
            const joining = joiningId === c.id;
            return (
              <article key={c.id} className="admin-live__card">
                <div className="admin-live__card-top">
                  <span className="admin-live__badge">Live</span>
                  <span className="admin-live__provider">{c.provider === 'zoom' ? 'Zoom' : 'Google Meet'}</span>
                </div>
                <h4 className="admin-live__card-title" title={c.title}>{c.title}</h4>
                <p className="admin-live__trainer">{c.teacherName || 'Trainer'}</p>
                {c.batchNames.length > 0 && (
                  <p className="admin-live__batches" title={c.batchNames.join(', ')}>
                    {c.batchNames.length > 1 ? `Combined: ${c.batchNames.join(' + ')}` : c.batchNames[0]}
                  </p>
                )}
                <dl className="admin-live__stats">
                  <div>
                    <dt>Started</dt>
                    <dd>{c.startedAt ? `${formatTimeIn(c.startedAt, tz)} ${zoneAbbreviation(tz, new Date(c.startedAt))}` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Running</dt>
                    <dd>{formatElapsed(mins) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>
                      {c.joinedCount}
                      {c.rosterCount ? ` / ${c.rosterCount}` : ''}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="admin-live__join"
                  disabled={joining}
                  onClick={() => onJoin(c.id)}
                >
                  {joining ? 'Opening…' : 'Join as admin'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
