/**
 * Viewer-local class times.
 *
 * Batch slots are defined in IST (Asia/Kolkata, no daylight saving). Every viewer sees them in their
 * own zone; Intl applies the right DST offset for each specific date, so US students' local time
 * correctly moves one hour when US clocks change.
 */

export const SCHOOL_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Zones offered in the time calculator. */
export const COMMON_TIME_ZONES = [
  { id: 'America/New_York', label: 'US Eastern' },
  { id: 'America/Chicago', label: 'US Central' },
  { id: 'America/Denver', label: 'US Mountain' },
  { id: 'America/Phoenix', label: 'Arizona' },
  { id: 'America/Los_Angeles', label: 'US Pacific' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'Pacific/Honolulu', label: 'Hawaii' },
  { id: 'America/Toronto', label: 'Canada Eastern' },
  { id: 'Europe/London', label: 'UK' },
  { id: 'Asia/Kolkata', label: 'India' }
];

export function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function detectBrowserTimeZone() {
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tz = raw === 'Asia/Calcutta' ? SCHOOL_TIME_ZONE : raw;
    return isValidTimeZone(tz) ? tz : '';
  } catch {
    return '';
  }
}

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null') || {};
  } catch {
    return {};
  }
}

/** This device's zone > last saved profile zone > IST. */
export function getViewerTimeZone() {
  try {
    const manual = typeof localStorage !== 'undefined' ? localStorage.getItem('manual_timezone') : null;
    const candidates = [manual, detectBrowserTimeZone(), storedUser().timezone];
    return candidates.find(isValidTimeZone) || SCHOOL_TIME_ZONE;
  } catch {
    return SCHOOL_TIME_ZONE;
  }
}

export function setViewerTimeZone(tz) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!tz || tz === 'auto') {
      localStorage.removeItem('manual_timezone');
    } else if (isValidTimeZone(tz)) {
      localStorage.setItem('manual_timezone', tz);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lms_tz_changed'));
    }
  } catch (e) {
    console.warn('Could not set viewer timezone:', e);
  }
}

export function isManualTimeZoneSet() {
  try {
    return Boolean(typeof localStorage !== 'undefined' && localStorage.getItem('manual_timezone'));
  } catch {
    return false;
  }
}

export function isIstViewer(tz = getViewerTimeZone()) {
  return zoneOffsetMinutes(tz, new Date()) === 330;
}

/** "EST", "PDT", "IST"… for the given instant (DST-aware). */
export function zoneAbbreviation(tz, date = new Date()) {
  if (tz === SCHOOL_TIME_ZONE || tz === 'Asia/Calcutta') return 'IST';
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || tz;
  } catch {
    return tz;
  }
}

export function zoneLabel(tz) {
  const known = COMMON_TIME_ZONES.find((z) => z.id === tz);
  if (known) return known.label;
  return String(tz || '').split('/').pop().replace(/_/g, ' ');
}

function zoneOffsetMinutes(tz, date) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value || '';
    const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const mins = Number(m[2]) * 60 + Number(m[3] || 0);
    return m[1] === '-' ? -mins : mins;
  } catch {
    return 0;
  }
}

function clean(s) {
  return String(s).replace(/\u202f/g, ' ');
}

export function formatTimeIn(date, tz = getViewerTimeZone()) {
  if (!date) return '';
  return clean(
    new Date(date).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

export function formatDayIn(date, tz = getViewerTimeZone(), { withDate = true } = {}) {
  if (!date) return '';
  return clean(
    new Date(date).toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'short',
      ...(withDate ? { month: 'short', day: 'numeric' } : {})
    })
  );
}

/** "Sat, Nov 7 · 7:00 – 9:00 AM EST" in the viewer's own zone. */
export function formatClassWhen(start, end, { tz = getViewerTimeZone(), withDate = true, includeZone = true } = {}) {
  if (!start) return '';
  const s = new Date(start);
  const day = formatDayIn(s, tz, { withDate });
  const abbr = includeZone ? ` ${zoneAbbreviation(tz, s)}` : '';
  if (!end) return `${day} · ${formatTimeIn(s, tz)}${abbr}`;
  return `${day} · ${formatTimeIn(s, tz)} – ${formatTimeIn(end, tz)}${abbr}`;
}

function parseClock(text) {
  if (!text) return null;
  const cleaned = String(text)
    .trim()
    .replace(/[()]/g, '')
    .replace(/\b(IST|EST|EDT|CST|CDT|PST|PDT|MST|MDT|UTC|GMT)\b/gi, '')
    .trim();
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** IST weekly slot → { days: ['sat','sun'], start: minutes, end: minutes } (end may pass midnight). */
export function parseIstSlot(schedule) {
  if (!schedule) return null;
  let rawDays = String(schedule.days || '').trim();
  if (/weekend/i.test(rawDays)) {
    rawDays = 'sat, sun';
  } else if (/weekday/i.test(rawDays)) {
    rawDays = 'mon, tue, wed, thu, fri';
  } else if (/mon\s*-\s*fri/i.test(rawDays) || /monday\s*to\s*friday/i.test(rawDays)) {
    rawDays = 'mon, tue, wed, thu, fri';
  } else if (/mon\s*-\s*thu/i.test(rawDays) || /monday\s*to\s*thursday/i.test(rawDays)) {
    rawDays = 'mon, tue, wed, thu';
  } else if (/mon\s*-\s*sat/i.test(rawDays) || /monday\s*to\s*saturday/i.test(rawDays)) {
    rawDays = 'mon, tue, wed, thu, fri, sat';
  }
  const days = rawDays
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((d) => d.slice(0, 3))
    .filter((d) => DAY_KEYS.includes(d));
  const [from, to] = String(schedule.time || '')
    .replace(/[()]/g, '')
    .replace(/\b(IST)\b/gi, '')
    .split(/\s*[-–—]\s*|\s+to\s+/i);
  const start = parseClock(from);
  let end = parseClock(to);
  if (!days.length || start == null) return null;
  if (end == null) end = start + 60;
  if (end <= start) end += 24 * 60;
  return { days: [...new Set(days)], start, end };
}

/** Instant for an IST wall-clock time on the IST calendar day containing `istDayMs`. */
function istInstant(istMidnightUtcMs, minutes) {
  return new Date(istMidnightUtcMs + minutes * 60 * 1000);
}

/**
 * Next `count` class occurrences of an IST weekly slot from `from`, as real instants.
 * Each item: { start: Date, end: Date }.
 */
export function upcomingSlotOccurrences(schedule, { from = new Date(), count = 6, horizonDays = 60 } = {}) {
  const slot = parseIstSlot(schedule);
  if (!slot) return [];
  const fromMs = new Date(from).getTime();
  const istNow = new Date(fromMs + IST_OFFSET_MS);
  const istMidnight = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS;
  const out = [];
  for (let i = -1; i <= horizonDays && out.length < count; i += 1) {
    const dayStart = istMidnight + i * DAY_MS;
    const istWeekday = DAY_KEYS[new Date(dayStart + IST_OFFSET_MS).getUTCDay()];
    if (!slot.days.includes(istWeekday)) continue;
    const start = istInstant(dayStart, slot.start);
    const end = istInstant(dayStart, slot.end);
    if (end.getTime() <= fromMs) continue;
    out.push({ start, end });
  }
  return out;
}

/**
 * Weekly slot described in the viewer's zone, with the days converted too:
 * IST "Sun, Mon · 4:00 – 6:00 AM" → "Sat, Sun · 5:30 – 7:30 PM" for a US Eastern viewer.
 */
export function describeWeeklySlot(schedule, { tz = getViewerTimeZone(), from = new Date() } = {}) {
  const occ = upcomingSlotOccurrences(schedule, { from, count: 7 });
  if (!occ.length) return null;
  const first = occ[0];
  const sameTime = occ.filter(
    (o) => formatTimeIn(o.start, tz) === formatTimeIn(first.start, tz) && formatTimeIn(o.end, tz) === formatTimeIn(first.end, tz)
  );
  const weekOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [...new Set(sameTime.map((o) => formatDayIn(o.start, tz, { withDate: false })))].sort(
    (a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b)
  );
  // Read "Sun, Mon" as a weekend-into-Monday pair rather than "Mon, Sun".
  if (days.includes('Sun') && days.includes('Mon') && !days.includes('Sat')) {
    days.unshift(days.splice(days.indexOf('Sun'), 1)[0]);
  }
  const abbr = zoneAbbreviation(tz, first.start);
  return {
    days: days.join(', '),
    time: `${formatTimeIn(first.start, tz)} – ${formatTimeIn(first.end, tz)} ${abbr}`,
    next: first,
    text: `${days.join(', ')} · ${formatTimeIn(first.start, tz)} – ${formatTimeIn(first.end, tz)} ${abbr}`
  };
}

/**
 * If the viewer's local class time changes within `withinDays` (a DST switch in their zone),
 * return { date, before, after } describing it; otherwise null. IST viewers never shift.
 */
export function upcomingLocalTimeShift(schedule, { tz = getViewerTimeZone(), from = new Date(), withinDays = 14 } = {}) {
  const occ = upcomingSlotOccurrences(schedule, { from, count: 20, horizonDays: withinDays + 7 });
  if (occ.length < 2) return null;
  const limit = new Date(from).getTime() + withinDays * DAY_MS;
  const key = (o) => formatTimeIn(o.start, tz);
  const baseline = key(occ[0]);
  const changed = occ.find((o) => o.start.getTime() <= limit && key(o) !== baseline);
  if (!changed) return null;
  return {
    date: changed.start,
    before: baseline,
    after: key(changed),
    dayLabel: formatDayIn(changed.start, tz)
  };
}

/** Convert a wall-clock time in one zone to an instant (handles DST via two-pass offset). */
export function instantFromZonedTime(dateStr, timeStr, tz) {
  const [y, mo, d] = String(dateStr).split('-').map(Number);
  const minutes = parseClock(timeStr);
  if (!y || !mo || !d || minutes == null) return null;
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  let ms = guess - zoneOffsetMinutes(tz, new Date(guess)) * 60000;
  ms = guess - zoneOffsetMinutes(tz, new Date(ms)) * 60000;
  return new Date(ms);
}
