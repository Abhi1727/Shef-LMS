/**
 * Timezone utility functions for handling Zoom API timestamps
 * Ensures consistent timezone parsing and formatting across the application
 */

/**
 * Parses Zoom API timestamp (UTC) and returns a consistent local date string
 * @param {string} zoomTimestamp - Zoom API timestamp in ISO format (e.g., "2024-01-15T10:30:00Z")
 * @returns {string} Local date string in YYYY-MM-DD format
 */
function parseZoomTimestamp(zoomTimestamp) {
  if (!zoomTimestamp) return '';
  
  try {
    // Create Date object from Zoom UTC timestamp
    const utcDate = new Date(zoomTimestamp);
    
    // Check if date is valid
    if (isNaN(utcDate.getTime())) {
      console.warn('[TimezoneUtils] Invalid Zoom timestamp:', zoomTimestamp);
      return '';
    }
    
    // Convert to local date string (YYYY-MM-DD format)
    const localDateString = utcDate.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Kolkata' // Use IST timezone for consistency
    });
    
    return localDateString;
  } catch (error) {
    console.error('[TimezoneUtils] Error parsing Zoom timestamp:', error);
    return '';
  }
}

/**
 * Formats a date string for consistent display across frontend
 * @param {string} dateString - Date string in various formats
 * @returns {string} Formatted date string or original string if parsing fails
 */
function formatDisplayDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata' // Use IST timezone for consistency
    });
  } catch (error) {
    console.error('[TimezoneUtils] Error formatting display date:', error);
    return dateString;
  }
}

/**
 * Validates if a date string is a valid Zoom timestamp
 * @param {string} timestamp - Timestamp to validate
 * @returns {boolean} True if valid Zoom timestamp format
 */
function isValidZoomTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') return false;
  
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes('T') && (timestamp.includes('Z') || timestamp.includes('+'));
  } catch (error) {
    return false;
  }
}

/**
 * Converts Zoom timestamp to ISO string with consistent timezone handling
 * @param {string} zoomTimestamp - Zoom API timestamp
 * @returns {string} ISO string or empty string if invalid
 */
function zoomTimestampToISO(zoomTimestamp) {
  if (!zoomTimestamp) return '';
  
  try {
    const date = new Date(zoomTimestamp);
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString();
  } catch (error) {
    console.error('[TimezoneUtils] Error converting Zoom timestamp to ISO:', error);
    return '';
  }
}

module.exports = {
  parseZoomTimestamp,
  formatDisplayDate,
  isValidZoomTimestamp,
  zoomTimestampToISO
};
