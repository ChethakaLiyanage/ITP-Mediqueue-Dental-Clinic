// Timezone utility functions
// This file handles timezone conversions for appointment scheduling

/**
 * Convert a local time string to a proper Date object without UTC conversion
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in HH:MM format (24-hour)
 * @returns {Date} - Date object representing the local time
 */
function createLocalDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    throw new Error('Date and time strings are required');
  }
  
  // Parse the date and time components
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a new Date object with local time (no UTC conversion)
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  console.log(`🔍 Created local datetime: ${dateStr} ${timeStr} -> ${localDate.toISOString()} (${localDate.toLocaleString()})`);
  
  return localDate;
}

/**
 * Extract time from ISO string without timezone conversion
 * @param {string} isoString - ISO date string
 * @returns {string} - Time in HH:MM format
 */
function extractTimeFromISO(isoString) {
  if (!isoString) return '00:00';
  
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format appointment date for display
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} - Formatted date string
 */
function formatAppointmentDate(dateInput) {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting appointment date:', error);
    return 'Invalid Date';
  }
}

/**
 * Check if a date is today
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {boolean} - True if the date is today
 */
function isToday(dateInput) {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const today = new Date();
    
    return date.toDateString() === today.toDateString();
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
}

/**
 * Get timezone offset in minutes
 * @returns {number} - Timezone offset in minutes
 */
function getTimezoneOffset() {
  return new Date().getTimezoneOffset();
}

/**
 * Convert UTC time to local time for display
 * @param {Date|string} utcDate - UTC date
 * @returns {Date} - Local date
 */
function utcToLocal(utcDate) {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate;
}

/**
 * Convert local time to UTC for storage
 * @param {Date|string} localDate - Local date
 * @returns {Date} - UTC date
 */
function localToUTC(localDate) {
  const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
  const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  return utcDate;
}

module.exports = {
  createLocalDateTime,
  extractTimeFromISO,
  formatAppointmentDate,
  isToday,
  getTimezoneOffset,
  utcToLocal,
  localToUTC
};
