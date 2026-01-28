// Timezone database with UTC offsets and common abbreviations
export const TIMEZONE_DATA = {
  // UTC
  'UTC': { offset: 0, name: 'Coordinated Universal Time' },
  'GMT': { offset: 0, name: 'Greenwich Mean Time' },
  
  // Europe
  'CET': { offset: 1, name: 'Central European Time' },
  'CEST': { offset: 2, name: 'Central European Summer Time' },
  'WET': { offset: 0, name: 'Western European Time' },
  'WEST': { offset: 1, name: 'Western European Summer Time' },
  'EET': { offset: 2, name: 'Eastern European Time' },
  'EEST': { offset: 3, name: 'Eastern European Summer Time' },
  'BST': { offset: 1, name: 'British Summer Time' },
  'IST': { offset: 1, name: 'Irish Standard Time' },
  'MSK': { offset: 3, name: 'Moscow Standard Time' },
  
  // North America
  'EST': { offset: -5, name: 'Eastern Standard Time' },
  'EDT': { offset: -4, name: 'Eastern Daylight Time' },
  'CST': { offset: -6, name: 'Central Standard Time' },
  'CDT': { offset: -5, name: 'Central Daylight Time' },
  'MST': { offset: -7, name: 'Mountain Standard Time' },
  'MDT': { offset: -6, name: 'Mountain Daylight Time' },
  'PST': { offset: -8, name: 'Pacific Standard Time' },
  'PDT': { offset: -7, name: 'Pacific Daylight Time' },
  'AKST': { offset: -9, name: 'Alaska Standard Time' },
  'AKDT': { offset: -8, name: 'Alaska Daylight Time' },
  'HST': { offset: -10, name: 'Hawaii Standard Time' },
  
  // Asia
  'JST': { offset: 9, name: 'Japan Standard Time' },
  'KST': { offset: 9, name: 'Korea Standard Time' },
  'CST_CHINA': { offset: 8, name: 'China Standard Time' },
  'HKT': { offset: 8, name: 'Hong Kong Time' },
  'SGT': { offset: 8, name: 'Singapore Time' },
  'IST_INDIA': { offset: 5.5, name: 'India Standard Time' },
  'PKT': { offset: 5, name: 'Pakistan Standard Time' },
  'ICT': { offset: 7, name: 'Indochina Time' },
  'WIB': { offset: 7, name: 'Western Indonesian Time' },
  'WITA': { offset: 8, name: 'Central Indonesian Time' },
  'WIT': { offset: 9, name: 'Eastern Indonesian Time' },
  'PHT': { offset: 8, name: 'Philippine Time' },
  
  // Australia & Pacific
  'AEST': { offset: 10, name: 'Australian Eastern Standard Time' },
  'AEDT': { offset: 11, name: 'Australian Eastern Daylight Time' },
  'ACST': { offset: 9.5, name: 'Australian Central Standard Time' },
  'ACDT': { offset: 10.5, name: 'Australian Central Daylight Time' },
  'AWST': { offset: 8, name: 'Australian Western Standard Time' },
  'NZST': { offset: 12, name: 'New Zealand Standard Time' },
  'NZDT': { offset: 13, name: 'New Zealand Daylight Time' },
  
  // South America
  'BRT': { offset: -3, name: 'Brasília Time' },
  'ART': { offset: -3, name: 'Argentina Time' },
  'CLT': { offset: -4, name: 'Chile Standard Time' },
  'CLST': { offset: -3, name: 'Chile Summer Time' },
  'PET': { offset: -5, name: 'Peru Time' },
  'COT': { offset: -5, name: 'Colombia Time' },
  
  // Africa
  'CAT': { offset: 2, name: 'Central Africa Time' },
  'EAT': { offset: 3, name: 'East Africa Time' },
  'WAT': { offset: 1, name: 'West Africa Time' },
  'SAST': { offset: 2, name: 'South African Standard Time' },
  
  // Middle East
  'AST': { offset: 3, name: 'Arabia Standard Time' },
  'IRST': { offset: 3.5, name: 'Iran Standard Time' },
  'IDT': { offset: 3, name: 'Israel Daylight Time' },
  'TRT': { offset: 3, name: 'Turkey Time' },
  'GST': { offset: 4, name: 'Gulf Standard Time' }
};

// UTC offset patterns like UTC+2, GMT-5, etc.
export const UTC_OFFSET_PATTERN = /UTC|GMT\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i;

// Get all timezone abbreviations for regex
export function getTimezoneAbbreviations() {
  return Object.keys(TIMEZONE_DATA);
}

// Get timezone offset in hours
export function getTimezoneOffset(tz) {
  const upperTz = tz.toUpperCase();
  if (TIMEZONE_DATA[upperTz]) {
    return TIMEZONE_DATA[upperTz].offset;
  }
  return null;
}

// Get timezone full name
export function getTimezoneName(tz) {
  const upperTz = tz.toUpperCase();
  if (TIMEZONE_DATA[upperTz]) {
    return TIMEZONE_DATA[upperTz].name;
  }
  return tz;
}

// Parse UTC offset string like "UTC+2" or "GMT-5:30"
export function parseUtcOffset(offsetStr) {
  const match = offsetStr.match(UTC_OFFSET_PATTERN);
  if (match) {
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) / 60 : 0;
    return sign * (hours + minutes);
  }
  return 0;
}

// Get user's local timezone offset in hours
export function getLocalTimezoneOffset() {
  return -new Date().getTimezoneOffset() / 60;
}

// Get user's timezone name
export function getLocalTimezoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Format timezone offset as string
export function formatTimezoneOffset(offset) {
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}
