/**
 * Date utility functions for consistent date formatting across the frontend
 * Ensures consistent timezone handling and display formatting
 */

/**
 * Formats a date string for consistent display across components
 * @param {string|Date} dateInput - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string or fallback text
 */
export function formatDateDisplay(dateInput, options = {}) {
  if (!dateInput) return options.fallback || 'No date';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('[DateUtils] Invalid date input:', dateInput);
      return options.fallback || 'Invalid date';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata' // Use IST timezone for consistency
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    
    return date.toLocaleDateString('en-US', formatOptions);
  } catch (error) {
    console.error('[DateUtils] Error formatting date:', error);
    return options.fallback || 'Date error';
  }
}

/**
 * Formats a date string for display in components that previously used new Date(date).toLocaleDateString()
 * This is a drop-in replacement for the common pattern used across components
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
export function formatDateForComponent(dateInput) {
  return formatDateDisplay(dateInput, {
    fallback: 'No date'
  });
}

/**
 * Formats a date with time for detailed display
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date and time string
 */
export function formatDateTimeDisplay(dateInput) {
  if (!dateInput) return 'No date';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  } catch (error) {
    console.error('[DateUtils] Error formatting datetime:', error);
    return 'Date error';
  }
}

/**
 * Validates if a date string is a valid date
 * @param {string|Date} dateInput - Date to validate
 * @returns {boolean} True if valid date
 */
export function isValidDate(dateInput) {
  if (!dateInput) return false;
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
}

/**
 * Legacy function for backward compatibility
 * Replaces: new Date(dateString).toLocaleDateString()
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date string
 */
export function toLocaleDateString(dateString) {
  return formatDateForComponent(dateString);
}

/**
 * Legacy function for backward compatibility  
 * Replaces: new Date(dateString).toLocaleString()
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date and time string
 */
export function toLocaleString(dateString) {
  return formatDateTimeDisplay(dateString);
}
