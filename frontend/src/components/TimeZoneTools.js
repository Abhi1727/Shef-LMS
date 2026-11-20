import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import {
  SCHOOL_TIME_ZONE,
  detectBrowserTimeZone,
  formatDayIn,
  formatTimeIn,
  getViewerTimeZone,
  setViewerTimeZone,
  isManualTimeZoneSet,
  instantFromZonedTime,
  upcomingLocalTimeShift,
  zoneAbbreviation,
  zoneLabel
} from '../utils/viewerTime';
import './TimeZoneTools.css';

export { setViewerTimeZone, isManualTimeZoneSet };

/** The viewer's zone, detected from device or overridden by user. Listens for live changes. */
export function useViewerTimeZone() {
  const [tz, setTz] = useState(getViewerTimeZone);

  useEffect(() => {
    const onTzChange = () => setTz(getViewerTimeZone());
    window.addEventListener('lms_tz_changed', onTzChange);
    return () => window.removeEventListener('lms_tz_changed', onTzChange);
  }, []);

  return tz;
}

let syncedThisSession = false;

/** Keep the profile zone (used for reminder emails) in step with the device for users who stay logged in. */
export function useSyncDetectedTimeZone() {
  useEffect(() => {
    if (syncedThisSession) return;
    syncedThisSession = true;
    const detected = detectBrowserTimeZone();
    const token = localStorage.getItem('token');
    if (!detected || !token) return;
    fetch(`${getApiBaseUrl()}/api/auth/timezone`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: detected, manual: false })
    }).catch(() => { });
  }, []);
}

/** Warns before a daylight-saving switch moves the student's local class time. */
export function DstNotice({ schedule }) {
  const tz = useViewerTimeZone();
  const shift = useMemo(() => upcomingLocalTimeShift(schedule, { tz }), [schedule, tz]);
  if (!shift) return null;
  return (
    <div className="tz-dst" role="status">
      <strong>Clock change ahead:</strong> from <strong>{shift.dayLabel}</strong> your class starts at{' '}
      <strong>{shift.after}</strong> instead of {shift.before}, because daylight saving time changes in your
      area.
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
