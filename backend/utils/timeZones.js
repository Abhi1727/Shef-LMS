/** Class times for emails: IST is the school zone; students get their own zone when known. */

const SCHOOL_TIME_ZONE = 'Asia/Kolkata';
const US_ZONES = [
  ['America/New_York', 'Eastern'],
  ['America/Chicago', 'Central'],
  ['America/Denver', 'Mountain'],
  ['America/Los_Angeles', 'Pacific']
];

function validTimeZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return '';
  if (tz === 'Asia/Calcutta') return SCHOOL_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return '';
  }
}

function zoneAbbr(date, tz) {
  if (tz === SCHOOL_TIME_ZONE) return 'IST';
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value || tz
  );
}

function clean(s) {
  return String(s).replace(/\u202f/g, ' ');
}

/** "Sat, Nov 7, 7:00 AM EST" */
function formatInZone(date, tz) {
  const d = new Date(date);
  const text = d.toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${clean(text)} ${zoneAbbr(d, tz)}`;
}

function timeOnly(date, tz) {
  const d = new Date(date);
  return `${clean(d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }))} ${zoneAbbr(d, tz)}`;
}

/**
 * "When" line for one student. Known zone: only their local time.
 * Unknown zone: IST plus every US zone, each DST-correct for that date.
 */
function whenLine(date, studentTz) {
  const tz = validTimeZone(studentTz);
  if (tz) return formatInZone(date, tz);
  const us = US_ZONES.map(([zone]) => timeOnly(date, zone)).join(' / ');
  return `${formatInZone(date, SCHOOL_TIME_ZONE)} · US: ${us}`;
}

module.exports = {
  SCHOOL_TIME_ZONE,
  validTimeZone,
  formatInZone,
  whenLine
};
