/**
 * Timezone utilities — schedule source of truth is IST (Asia/Kolkata).
 * Converts to US zones (EST/CST/PST/MST) via Intl where possible.
 */

const ZONE_MAP = {
  IST: 'Asia/Kolkata',
  EST: 'America/New_York',
  CST: 'America/Chicago',
  PST: 'America/Los_Angeles',
  MST: 'America/Denver'
};

/**
 * Parse a clock time that may be 24h ("14:30") or 12h ("10:00 AM" / "10:00AM").
 * Strips trailing timezone tokens like IST.
 * @returns {{ hours: number, minutes: number } | null}
 */
export function safeParseTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  let cleaned = timeString.trim()
    .replace(/\b(IST|EST|EDT|CST|CDT|PST|PDT|MST|MDT)\b/gi, '')
    .trim();

  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const parts = cleaned.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(String(parts[1]).replace(/\D.*/, ''), 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/**
 * Split ranges like "10:00 AM - 11:00 AM" or "10:00-11:00".
 */
export function parseTimeRange(timeRange) {
  if (!timeRange || typeof timeRange !== 'string') {
    return { startTime: '', endTime: '' };
  }

  const normalized = timeRange.replace(/\b(IST|EST|EDT|CST|CDT|PST|PDT|MST|MDT)\b/gi, '').trim();
  const parts = normalized.split(/\s*-\s*/);
  if (parts.length < 2) {
    return { startTime: '', endTime: '' };
  }

  return {
    startTime: parts[0].trim(),
    endTime: parts.slice(1).join('-').trim()
  };
}

function format12Hour(hours24, minutes) {
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let h = hours24 % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Convert an IST wall-clock time to another IANA zone using today's calendar date in IST.
 */
export function convertIstToUsTimezone(istTime, timezone) {
  if (!istTime || !timezone) return '';

  const parsed = safeParseTime(istTime);
  if (!parsed) return '';

  const iana = ZONE_MAP[timezone] || ZONE_MAP.EST;

  try {
    const now = new Date();
    // Build an absolute Instant: interpret hours/minutes as Asia/Kolkata today
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(
      istFormatter.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    const y = parts.year;
    const m = parts.month;
    const d = parts.day;
    const hh = String(parsed.hours).padStart(2, '0');
    const mm = String(parsed.minutes).padStart(2, '0');

    // Approximate: IST is UTC+5:30 with no DST
    const utcMs = Date.parse(`${y}-${m}-${d}T${hh}:${mm}:00+05:30`);
    if (Number.isNaN(utcMs)) return '';

    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return targetFormatter.format(new Date(utcMs)).replace(/\u202f/g, ' ');
  } catch (err) {
    console.warn('[TimezoneUtils] convertIstToUsTimezone failed', err);
    return '';
  }
}

export function isDaylightSavingTime(date = new Date()) {
  try {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const std = Math.max(
      getZoneOffsetMinutes('America/New_York', jan),
      getZoneOffsetMinutes('America/New_York', jul)
    );
    return getZoneOffsetMinutes('America/New_York', date) < std;
  } catch {
    return false;
  }
}

function getZoneOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit'
  });
  const tzName = dtf.formatToParts(date).find(p => p.type === 'timeZoneName')?.value || '';
  const match = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/i);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2] || '0', 10);
  return hours * 60 + Math.sign(hours || 1) * mins;
}

export function getTimezoneAbbreviation(timezone, date = new Date()) {
  const iana = ZONE_MAP[timezone];
  if (!iana) return timezone;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'short'
    }).formatToParts(date);
    return parts.find(p => p.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}

/** Legacy offset helper retained for callers; prefer Intl path above. */
export function getUsTimezoneOffset(timezone) {
  const isDST = isDaylightSavingTime();
  const offsets = {
    EST: isDST ? -570 : -630,
    CST: isDST ? -630 : -690,
    PST: isDST ? -750 : -810,
    MST: isDST ? -690 : -750
  };
  return offsets[timezone] || -630;
}

export function convertIstRangeToUsTimezones(istStartTime, istEndTime) {
  const timezones = ['EST', 'CST', 'PST', 'MST'];
  const result = {};
  timezones.forEach(timezone => {
    const abbreviation = getTimezoneAbbreviation(timezone);
    const startTime = convertIstToUsTimezone(istStartTime, timezone);
    const endTime = convertIstToUsTimezone(istEndTime, timezone);
    result[timezone] = {
      abbreviation,
      startTime,
      endTime,
      range: startTime && endTime ? `${startTime} - ${endTime} ${abbreviation}` : ''
    };
  });
  return result;
}

export function formatTimeWithTimezone(time, timezone) {
  if (!time || !timezone) return time;
  return `${time} ${timezone}`;
}

/**
 * Convert IST start/end (any common format) to a labeled US zone range string.
 */
export function convertIstRangeToZone(startTime, endTime, timezone) {
  if (!startTime || !endTime || !timezone) return '';

  if (!['EST', 'CST', 'PST', 'MST'].includes(timezone)) return '';

  // Allow callers to pass a full range in startTime alone
  let start = startTime;
  let end = endTime;
  if (!safeParseTime(start) && String(startTime).includes('-')) {
    const parsed = parseTimeRange(startTime);
    start = parsed.startTime;
    end = parsed.endTime || end;
  }

  const convertedStart = convertIstToUsTimezone(start, timezone);
  const convertedEnd = convertIstToUsTimezone(end, timezone);
  if (!convertedStart || !convertedEnd) return '';

  const abbreviation = getTimezoneAbbreviation(timezone);
  return `${convertedStart} - ${convertedEnd} ${abbreviation}`;
}

/**
 * Format an IST time for display (normalizes to 12h).
 */
export function formatIstDisplay(timeString) {
  const parsed = safeParseTime(timeString);
  if (!parsed) return timeString || '';
  return `${format12Hour(parsed.hours, parsed.minutes)} IST`;
}

export function formatIstRangeDisplay(timeRange) {
  const { startTime, endTime } = parseTimeRange(timeRange);
  if (!startTime || !endTime) return timeRange || '';
  const start = safeParseTime(startTime);
  const end = safeParseTime(endTime);
  if (!start || !end) return timeRange;
  return `${format12Hour(start.hours, start.minutes)} - ${format12Hour(end.hours, end.minutes)} IST`;
}
