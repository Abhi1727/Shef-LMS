/**
 * Timezone utility functions for handling daylight saving time conversions
 * between IST and US timezones (EST/EDT, CST/CDT, PST/PDT)
 */

/**
 * Determines if current date is within daylight saving time period
 * DST in US: Second Sunday in March to First Sunday in November
 * @returns {boolean} True if DST is currently active
 */
export function isDaylightSavingTime() {
  const now = new Date();
  const year = now.getFullYear();
  
  // DST starts: Second Sunday in March at 2:00 AM local time
  const dstStart = new Date(year, 2, 1); // March 1st
  dstStart.setDate(dstStart.getDate() + (14 - dstStart.getDay()) % 7 + 7);
  dstStart.setHours(7, 0, 0, 0); // 2:00 AM EST = 7:00 AM UTC
  
  // DST ends: First Sunday in November at 2:00 AM local time
  const dstEnd = new Date(year, 10, 1); // November 1st
  dstEnd.setDate(dstEnd.getDate() + (7 - dstEnd.getDay()) % 7);
  dstEnd.setHours(6, 0, 0, 0); // 2:00 AM EST = 6:00 AM UTC
  
  return now >= dstStart && now < dstEnd;
}

/**
 * Gets the correct timezone offset for US timezones based on DST
 * @param {string} timezone - 'EST', 'CST', 'PST'
 * @returns {number} Offset in minutes from IST
 */
export function getUsTimezoneOffset(timezone) {
  const isDST = isDaylightSavingTime();
  
  const offsets = {
    EST: isDST ? -570 : -630, // EDT: -9h 30m, EST: -10h 30m
    CST: isDST ? -630 : -690, // CDT: -10h 30m, CST: -11h 30m  
    PST: isDST ? -750 : -810  // PDT: -12h 30m, PST: -13h 30m
  };
  
  return offsets[timezone] || -630; // Default to CST offset
}

/**
 * Gets the correct timezone abbreviation based on DST
 * @param {string} timezone - 'EST', 'CST', 'PST'
 * @returns {string} Timezone abbreviation (EST/EDT, CST/CDT, PST/PDT)
 */
export function getTimezoneAbbreviation(timezone) {
  const isDST = isDaylightSavingTime();
  
  const abbreviations = {
    EST: isDST ? 'EDT' : 'EST',
    CST: isDST ? 'CDT' : 'CST',
    PST: isDST ? 'PDT' : 'PST'
  };
  
  return abbreviations[timezone] || timezone;
}

/**
 * Safely parses time string into hours and minutes
 * @param {string} timeString - Time string in "HH:MM" or "H:MM" format
 * @returns {object|null} Object with hours and minutes, or null if invalid
 */
export function safeParseTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }
  
  const parts = timeString.trim().split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  // Validate ranges
  if (isNaN(hours) || isNaN(minutes) || 
      hours < 0 || hours > 23 || 
      minutes < 0 || minutes > 59) {
    return null;
  }
  
  return { hours, minutes };
}

/**
 * Converts IST time range to US timezone with DST awareness
 * @param {string} istTime - IST time in "HH:MM" format
 * @param {string} timezone - Target timezone ('EST', 'CST', 'PST')
 * @returns {string} Converted time in "HH:MM" format
 */
export function convertIstToUsTimezone(istTime, timezone) {
  if (!istTime || !timezone) {
    console.warn('[TimezoneUtils] convertIstToUsTimezone: Missing input', { istTime, timezone });
    return '';
  }
  
  // Safely parse IST time
  const parsedTime = safeParseTime(istTime);
  if (!parsedTime) {
    console.warn('[TimezoneUtils] convertIstToUsTimezone: Invalid time format', istTime);
    return '';
  }
  
  const { hours, minutes } = parsedTime;
  const istDate = new Date();
  istDate.setHours(hours, minutes, 0, 0);
  
  // Get offset and apply it
  const offsetMinutes = getUsTimezoneOffset(timezone);
  const usDate = new Date(istDate.getTime() + offsetMinutes * 60 * 1000);
  
  // Handle date crossing
  let usHours = usDate.getHours();
  const usMinutes = usDate.getMinutes();
  
  // Format 12-hour time
  const period = usHours >= 12 ? 'PM' : 'AM';
  usHours = usHours % 12 || 12;
  
  return `${usHours.toString().padStart(2, '0')}:${usMinutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Converts IST time range to multiple US timezones
 * @param {string} istStartTime - Start time in "HH:MM" format
 * @param {string} istEndTime - End time in "HH:MM" format
 * @returns {Object} Object with converted times for all US timezones
 */
export function convertIstRangeToUsTimezones(istStartTime, istEndTime) {
  const timezones = ['EST', 'CST', 'PST'];
  const result = {};
  
  timezones.forEach(timezone => {
    const abbreviation = getTimezoneAbbreviation(timezone);
    const startTime = convertIstToUsTimezone(istStartTime, timezone);
    const endTime = convertIstToUsTimezone(istEndTime, timezone);
    
    result[timezone] = {
      abbreviation,
      startTime,
      endTime,
      range: `${startTime} - ${endTime} ${abbreviation}`
    };
  });
  
  return result;
}

/**
 * Formats time with timezone abbreviation for display
 * @param {string} time - Time string
 * @param {string} timezone - Timezone abbreviation
 * @returns {string} Formatted time string
 */
export function formatTimeWithTimezone(time, timezone) {
  if (!time || !timezone) return time;
  return `${time} ${timezone}`;
}

/**
 * Converts a time range string to individual start and end times
 * @param {string} timeRange - Time range in "HH:MM - HH:MM" format
 * @returns {Object} Object with startTime and endTime
 */
export function parseTimeRange(timeRange) {
  if (!timeRange || typeof timeRange !== 'string') {
    return { startTime: '', endTime: '' };
  }
  
  const parts = timeRange.split('-');
  if (parts.length !== 2) {
    return { startTime: '', endTime: '' };
  }
  
  return {
    startTime: parts[0].trim(),
    endTime: parts[1].trim()
  };
}

/**
 * Legacy function for backward compatibility
 * @param {string} startTime - Start time in "HH:MM" format
 * @param {string} endTime - End time in "HH:MM" format
 * @param {string} timezone - Target timezone ('EST', 'CST', 'PST')
 * @returns {string} Formatted time range
 */
export function convertIstRangeToZone(startTime, endTime, timezone) {
  if (!startTime || !endTime || !timezone) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Missing input', { startTime, endTime, timezone });
    return '';
  }
  
  // Validate timezone parameter
  if (!['EST', 'CST', 'PST'].includes(timezone)) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Invalid timezone', timezone);
    return '';
  }
  
  const convertedStart = convertIstToUsTimezone(startTime, timezone);
  const convertedEnd = convertIstToUsTimezone(endTime, timezone);
  
  // Check if conversion was successful
  if (!convertedStart || !convertedEnd) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Time conversion failed', { startTime, endTime, timezone, convertedStart, convertedEnd });
    return '';
  }
  
  const abbreviation = getTimezoneAbbreviation(timezone);
  
  return `${convertedStart} - ${convertedEnd} ${abbreviation}`;
}
