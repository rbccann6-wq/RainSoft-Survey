// Time formatting utilities

/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 * @param time24 - Time in "HH:MM" format (e.g., "13:30", "09:00")
 * @returns Time in 12-hour format (e.g., "1:30 PM", "9:00 AM")
 */
export const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  
  const [hours24, minutes] = time24.split(':').map(Number);
  
  if (isNaN(hours24) || isNaN(minutes)) return time24;
  
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12; // Convert 0 to 12, keep 1-11, convert 13-23 to 1-11
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Convert Date object to 12-hour time string
 * @param date - Date object
 * @returns Time in 12-hour format (e.g., "1:30 PM")
 */
export const formatDateTime12Hour = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const hours24 = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Format full date and time in 12-hour format
 * @param date - Date object or ISO string
 * @returns Formatted string (e.g., "1/25/2026, 2:30 PM")
 */
export const formatFullDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const dateStr = dateObj.toLocaleDateString();
  const timeStr = formatDateTime12Hour(dateObj);
  
  return `${dateStr}, ${timeStr}`;
};

/**
 * Convert 12-hour time string to 24-hour format
 * @param time12 - Time in "H:MM AM/PM" format (e.g., "1:30 PM", "9:00 AM")
 * @returns Time in 24-hour format (e.g., "13:30", "09:00")
 */
export const convert12HourTo24Hour = (time12: string): string => {
  if (!time12) return '';
  
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12;
  
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};
