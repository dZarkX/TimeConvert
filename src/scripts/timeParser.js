// Time parsing and conversion module
import { 
  TIMEZONE_DATA, 
  getTimezoneOffset, 
  parseUtcOffset,
  getTimezoneAbbreviations 
} from './timezones.js';

// Build regex pattern for time detection
function buildTimePattern() {
  const tzAbbreviations = getTimezoneAbbreviations().join('|');
  
  // Time formats:
  // 12-hour: 5PM, 5:00PM, 5:00 PM, 05:00PM, 5:00:00PM
  // 24-hour: 17:00, 17:00:00
  // With timezone: 5PM CET, 17:00 UTC+2, etc.
  
  const timePatterns = [
    // 12-hour format with AM/PM
    `(1[0-2]|0?[1-9])(?:[:.]([0-5][0-9]))?(?:[:.]([0-5][0-9]))?\\s*(AM|PM|am|pm|a\\.m\\.|p\\.m\\.)`,
    // 24-hour format
    `([01]?[0-9]|2[0-3])[:.]([0-5][0-9])(?:[:.]([0-5][0-9]))?`
  ];
  
  const tzPatterns = [
    `(${tzAbbreviations})`,
    `(UTC|GMT)\\s*([+-])\\s*(\\d{1,2})(?::(\\d{2}))?`,
    `(UTC|GMT)`
  ];
  
  // Combined pattern: time + optional space + timezone
  const combinedPattern = `(?:${timePatterns.join('|')})\\s*(?:${tzPatterns.join('|')})?`;
  
  return new RegExp(combinedPattern, 'gi');
}

// Parse a time match into structured data
export function parseTimeMatch(match, fullText) {
  const result = {
    original: match[0],
    hours: 0,
    minutes: 0,
    seconds: 0,
    timezone: null,
    timezoneOffset: null,
    is12Hour: false,
    isPM: false
  };
  
  // Check which pattern matched
  if (match[4]) {
    // 12-hour format (groups 1-4)
    result.hours = parseInt(match[1], 10);
    result.minutes = match[2] ? parseInt(match[2], 10) : 0;
    result.seconds = match[3] ? parseInt(match[3], 10) : 0;
    result.is12Hour = true;
    result.isPM = /pm|p\.m\./i.test(match[4]);
    
    // Convert to 24-hour
    if (result.isPM && result.hours !== 12) {
      result.hours += 12;
    } else if (!result.isPM && result.hours === 12) {
      result.hours = 0;
    }
  } else if (match[5] !== undefined) {
    // 24-hour format (groups 5-7)
    result.hours = parseInt(match[5], 10);
    result.minutes = match[6] ? parseInt(match[6], 10) : 0;
    result.seconds = match[7] ? parseInt(match[7], 10) : 0;
  }
  
  // Parse timezone
  if (match[8]) {
    // Timezone abbreviation
    result.timezone = match[8].toUpperCase();
    result.timezoneOffset = getTimezoneOffset(result.timezone);
  } else if (match[9]) {
    // UTC/GMT with offset
    const sign = match[10] === '-' ? -1 : 1;
    const hours = match[11] ? parseInt(match[11], 10) : 0;
    const minutes = match[12] ? parseInt(match[12], 10) / 60 : 0;
    result.timezoneOffset = sign * (hours + minutes);
    result.timezone = `${match[9]}${match[10] || '+'}${match[11] || '0'}${match[12] ? ':' + match[12] : ''}`;
  } else if (match[13]) {
    // Plain UTC/GMT
    result.timezone = match[13].toUpperCase();
    result.timezoneOffset = 0;
  }
  
  return result;
}

// Convert time from one timezone to another
export function convertTime(parsedTime, targetOffset) {
  if (parsedTime.timezoneOffset === null) {
    return null;
  }
  
  const sourceOffset = parsedTime.timezoneOffset;
  const diffHours = targetOffset - sourceOffset;
  
  let totalMinutes = parsedTime.hours * 60 + parsedTime.minutes + (diffHours * 60);
  
  // Handle day overflow
  let dayOffset = 0;
  while (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    dayOffset--;
  }
  while (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    dayOffset++;
  }
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return {
    hours: newHours,
    minutes: newMinutes,
    seconds: parsedTime.seconds,
    dayOffset: dayOffset
  };
}

// Format time for display
export function formatTime(hours, minutes, seconds, use24Hour = false, showSeconds = false) {
  if (use24Hour) {
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return showSeconds ? `${timeStr}:${seconds.toString().padStart(2, '0')}` : timeStr;
  }
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}`;
  return showSeconds ? `${timeStr}:${seconds.toString().padStart(2, '0')} ${period}` : `${timeStr} ${period}`;
}

// Main function to find all times on page
export function findTimesInText(text) {
  const pattern = buildTimePattern();
  const results = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const parsed = parseTimeMatch(match, text);
    
    // Only include if we found a timezone
    if (parsed.timezoneOffset !== null) {
      results.push({
        ...parsed,
        index: match.index,
        length: match[0].length
      });
    }
  }
  
  return results;
}

// Simplified pattern for content script (no module imports)
export function getTimePatternString() {
  const tzAbbreviations = getTimezoneAbbreviations().join('|');
  return `(?:(?:(1[0-2]|0?[1-9])(?:[:.]([0-5][0-9]))?(?:[:.]([0-5][0-9]))?\\s*(AM|PM|am|pm|a\\.m\\.|p\\.m\\.))|(?:([01]?[0-9]|2[0-3])[:.]([0-5][0-9])(?:[:.]([0-5][0-9]))?))\\s*(?:(${tzAbbreviations})|(UTC|GMT)\\s*([+-])\\s*(\\d{1,2})(?::(\\d{2}))?|(UTC|GMT))`;
}
