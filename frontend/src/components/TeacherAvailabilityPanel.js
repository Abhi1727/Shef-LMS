import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

const DAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' }
];

export default function TeacherAvailabilityPanel() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [inClass, setInClass] = useState(false);
  const [liveClassTitle, setLiveClassTitle] = useState('');
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setIsAvailable(Boolean(data.isAvailable));
      setInClass(Boolean(data.inClass));
      setLiveClassTitle(data.liveClass?.title || '');
      setWindows(Array.isArray(data.weeklyAvailability) ? data.weeklyAvailability : []);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // No polling — availability is rarely changed and not a core LMS feature.
  }, [load]);

  const windowFor = (day) => windows.find((w) => Number(w.day) === day);

  const toggleDay = (day) => {
    const existing = windowFor(day);
    if (existing) {
      setWindows((ws) => ws.filter((w) => Number(w.day) !== day));
    } else {
      setWindows((ws) => [
        ...ws,
        { day, startTime: '10:00', endTime: '18:00', timezone: 'Asia/Kolkata' }
      ]);
    }
  };

  const updateTime = (day, field, value) => {
    setWindows((ws) =>
      ws.map((w) => (Number(w.day) === day ? { ...w, [field]: value } : w))
    );
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/availability`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ weeklyAvailability: windows })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setWindows(data.weeklyAvailability || windows);
      setMessage('Weekly availability saved.');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePresence = async () => {
    if (inClass) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/availability`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAvailable: !isAvailable })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setIsAvailable(Boolean(data.isAvailable));
      setInClass(Boolean(data.inClass));
      setLiveClassTitle(data.liveClass?.title || '');
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  return (
    <div className="live-lobby">
      <div className="live-lobby__hero">
        <p className="live-lobby__eyebrow">Sky States · Availability</p>
        <h2>When you teach</h2>
        <p>
          Live status for admins. Starting a Meet marks you <strong>In class</strong> automatically.
          When you are not in a session, toggle Available / Unavailable anytime — you do not need to
          set this in advance.
        </p>
      </div>

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>Live now (admin view)</h3>
          <label className={`ss-toggle ${inClass ? 'is-class' : isAvailable ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={inClass || isAvailable}
              disabled={inClass}
              onChange={togglePresence}
            />
            <span className="ss-toggle__track" aria-hidden="true" />
            <span className="ss-toggle__label">
              {inClass ? 'In class' : isAvailable ? 'Available' : 'Unavailable'}
            </span>
          </label>
        </div>
        <p className="live-attendance__note" style={{ marginBottom: 0 }}>
          {inClass
            ? `You are in Meet now${liveClassTitle ? ` · ${liveClassTitle}` : ''}. Admins see In class until you end the session.`
            : 'Toggle anytime while you are not in Meet. This is live status — not a schedule you set before class.'}
        </p>
      </section>

      <section className="live-lobby__card" style={{ marginTop: '1rem' }}>
        <div className="live-lobby__card-head">
          <h3>Usual teaching hours (optional)</h3>
          <button
            type="button"
            className="live-lobby__btn live-lobby__btn--primary"
            disabled={saving || loading}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save hours'}
          </button>
        </div>
        <p className="live-attendance__note">
          Optional reference only. Admins use the live toggle and In class from Meet, not these hours.
        </p>
        {loading ? (
          <p className="live-lobby--empty">Loading…</p>
        ) : (
          <ul className="live-lobby__list">
            {DAYS.map(({ day, label }) => {
              const w = windowFor(day);
              return (
                <li key={day} className="live-session">
                  <div className="live-session__top">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(w)}
                        onChange={() => toggleDay(day)}
                      />
                      <strong>{label}</strong>
                    </label>
                    {w ? (
                      <div className="live-lobby__row" style={{ maxWidth: 280 }}>
                        <input
                          type="time"
                          value={w.startTime || '10:00'}
                          onChange={(e) => updateTime(day, 'startTime', e.target.value)}
                        />
                        <input
                          type="time"
                          value={w.endTime || '18:00'}
                          onChange={(e) => updateTime(day, 'endTime', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="live-lobby__muted">Off</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="live-lobby__alert live-lobby__alert--err">{error}</p>}
        {message && <p className="live-lobby__alert live-lobby__alert--ok">{message}</p>}
      </section>
    </div>
  );
}
