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
      setWindows(Array.isArray(data.weeklyAvailability) ? data.weeklyAvailability : []);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
          Set your status and weekly teaching windows for admins. Students do not see this.
        </p>
      </div>

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>Availability (admin view)</h3>
          <label className={`ss-toggle ${isAvailable ? 'is-on' : ''}`}>
            <input type="checkbox" checked={isAvailable} onChange={togglePresence} />
            <span className="ss-toggle__track" aria-hidden="true" />
            <span className="ss-toggle__label">{isAvailable ? 'Available' : 'Unavailable'}</span>
          </label>
        </div>
        <p className="live-attendance__note" style={{ marginBottom: 0 }}>
          Admins use this to know when you are free. Separate from weekly teaching windows below.
        </p>
      </section>

      <section className="live-lobby__card" style={{ marginTop: '1rem' }}>
        <div className="live-lobby__card-head">
          <h3>Weekly teaching windows (IST)</h3>
          <button
            type="button"
            className="live-lobby__btn live-lobby__btn--primary"
            disabled={saving || loading}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
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
