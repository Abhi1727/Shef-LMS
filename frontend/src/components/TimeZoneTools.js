import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import {
  COMMON_TIME_ZONES,
  SCHOOL_TIME_ZONE,
  detectBrowserTimeZone,
  formatDayIn,
  formatTimeIn,
  getViewerTimeZone,
  hasManualTimeZone,
  instantFromZonedTime,
  setViewerTimeZoneOverride,
  upcomingLocalTimeShift,
  zoneAbbreviation,
  zoneLabel
} from '../utils/viewerTime';
import './TimeZoneTools.css';

/** Current viewer zone; re-renders when the user changes it anywhere in the app. */
export function useViewerTimeZone() {
  const [tz, setTz] = useState(getViewerTimeZone);
  useEffect(() => {
    const onChange = () => setTz(getViewerTimeZone());
    window.addEventListener('lms-timezone-change', onChange);
    return () => window.removeEventListener('lms-timezone-change', onChange);
  }, []);
  return tz;
}

let syncedThisSession = false;

function saveTimeZone(body) {
  const token = localStorage.getItem('token');
  if (!token) return Promise.resolve(null);
  return fetch(`${getApiBaseUrl()}/api/auth/timezone`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** Keep the profile zone in step with the browser for users who stay logged in for weeks. */
function useSyncDetectedTimeZone() {
  useEffect(() => {
    if (syncedThisSession || hasManualTimeZone()) return;
    syncedThisSession = true;
    const detected = detectBrowserTimeZone();
    if (detected) saveTimeZone({ timezone: detected, manual: false });
  }, []);
}

function zoneOptions(current) {
  const detected = detectBrowserTimeZone();
  const ids = [...new Set([detected, current, ...COMMON_TIME_ZONES.map((z) => z.id)].filter(Boolean))];
  return ids.map((id) => ({ id, label: `${zoneLabel(id)} (${zoneAbbreviation(id)})` }));
}

/** "Class times are shown in US Eastern (EST) · Change" */
export function TimeZoneBar({ compact = false }) {
  useSyncDetectedTimeZone();
  const tz = useViewerTimeZone();
  const [editing, setEditing] = useState(false);
  const isManual = hasManualTimeZone();
  const options = useMemo(() => zoneOptions(tz), [tz]);

  const choose = (value) => {
    if (value === 'auto') {
      setViewerTimeZoneOverride('');
      saveTimeZone({ timezone: '', manual: false }).then(() =>
        saveTimeZone({ timezone: detectBrowserTimeZone(), manual: false })
      );
    } else {
      setViewerTimeZoneOverride(value);
      saveTimeZone({ timezone: value, manual: true });
    }
    setEditing(false);
  };

  return (
    <div className={`tz-bar${compact ? ' tz-bar--compact' : ''}`}>
      <span className="tz-bar__icon" aria-hidden="true">🕒</span>
      {editing ? (
        <select
          className="tz-bar__select"
          autoFocus
          value={isManual ? tz : 'auto'}
          onChange={(e) => choose(e.target.value)}
          onBlur={() => setEditing(false)}
        >
          <option value="auto">Automatic ({zoneLabel(detectBrowserTimeZone() || SCHOOL_TIME_ZONE)})</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <span>
          Times shown in <strong>{zoneLabel(tz)} ({zoneAbbreviation(tz)})</strong>
          {isManual ? '' : ' · detected from your device'}
        </span>
      )}
      {!editing && (
        <button type="button" className="tz-bar__change" onClick={() => setEditing(true)}>
          Change
        </button>
      )}
    </div>
  );
}

/** Warns before a daylight-saving switch moves the student's local class time. */
export function DstNotice({ schedule }) {
  const tz = useViewerTimeZone();
  const shift = useMemo(() => upcomingLocalTimeShift(schedule, { tz }), [schedule, tz]);
  if (!shift) return null;
  return (
    <div className="tz-dst" role="status">
      <strong>Clock change ahead:</strong> from <strong>{shift.dayLabel}</strong> your class starts at{' '}
      <strong>{shift.after}</strong> instead of {shift.before}. Your local clocks change; the class time in India
      stays the same.
    </div>
  );
}

const CALC_ZONES = [
  SCHOOL_TIME_ZONE,
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles'
];

function todayIn(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/** Pick a date + time in any zone and see it in IST and every US zone (DST-correct for that date). */
export function TimeZoneCalculator({ defaultFromZone = SCHOOL_TIME_ZONE }) {
  const viewerTz = useViewerTimeZone();
  const [fromZone, setFromZone] = useState(defaultFromZone);
  const [date, setDate] = useState(() => todayIn(defaultFromZone));
  const [time, setTime] = useState('17:30');

  const zones = useMemo(() => [...new Set([viewerTz, ...CALC_ZONES])], [viewerTz]);
  const instant = useMemo(() => instantFromZonedTime(date, time, fromZone), [date, time, fromZone]);

  return (
    <div className="tz-calc">
      <div className="tz-calc__head">
        <h3>Time calculator</h3>
        <p>Convert a class time between India and US time zones. Daylight saving is applied for the date you pick.</p>
      </div>
      <div className="tz-calc__inputs">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>
          In
          <select value={fromZone} onChange={(e) => setFromZone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {zoneLabel(z)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {instant ? (
        <ul className="tz-calc__results">
          {zones.map((z) => (
            <li key={z} className={z === viewerTz ? 'is-you' : ''}>
              <span className="tz-calc__zone">
                {zoneLabel(z)}
                {z === viewerTz ? ' (you)' : ''}
              </span>
              <span className="tz-calc__time">
                {formatTimeIn(instant, z)} {zoneAbbreviation(z, instant)}
              </span>
              <span className="tz-calc__day">{formatDayIn(instant, z)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tz-calc__empty">Pick a date and time.</p>
      )}
    </div>
  );
}
