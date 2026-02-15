// Simple NLP parser for relative time expressions
// Detects phrases like "in 2 hours", "tomorrow at noon", "end of day"

const DEBUG = false;

// Common time unit patterns
const TIME_UNITS = {
  minute: { patterns: [/min/i], value: 1 },
  minutes: { patterns: [/mins?/i], value: 1 },
  hour: { patterns: [/hour/i], value: 60 },
  hours: { patterns: [/hrs?/i], value: 60 },
  day: { patterns: [/day/i], value: 24 * 60 },
  days: { patterns: [/days?/i], value: 24 * 60 },
  week: { patterns: [/week/i], value: 7 * 24 * 60 },
  weeks: { patterns: [/weeks?/i], value: 7 * 24 * 60 }
};

// Time reference patterns
const TIME_REFERENCES = {
  now: { patterns: [/now/i, /right now/i, /immediately/i], value: 0 },
  later: { patterns: [/later/i, /in a bit/i], value: 5 }, // 5 minutes default
  soon: { patterns: [/soon/i, /shortly/i], value: 15 }, // 15 minutes default
  tomorrow: { patterns: [/tomorrow/i, /tmrw/i], value: 24 * 60 },
  today: { patterns: [/today/i, /tonight/i], value: 0 },
  yesterday: { patterns: [/yesterday/i, /yday/i], value: -24 * 60 },
  'end of day': { patterns: [/end of (the )?day/i, /eod/i, /close of business/i], value: 18 * 60 }, // 6 PM default
  'start of day': { patterns: [/start of (the )?day/i, /sod/i, /beginning of day/i], value: 9 * 60 }, // 9 AM default
  noon: { patterns: [/noon/i, /midday/i], value: 12 * 60 },
  midnight: { patterns: [/midnight/i, /midnight/i], value: 0 },
  morning: { patterns: [/morning/i, /am/i], value: 9 * 60 }, // 9 AM default
  afternoon: { patterns: [/afternoon/i, /pm/i], value: 15 * 60 }, // 3 PM default
  evening: { patterns: [/evening/i], value: 18 * 60 } // 6 PM default
};

// Number patterns
const NUMBER_PATTERNS = [
  /\b(\d+)\b/gi, // direct numbers
  /\b(half|quarter)\b/gi, // fractions
  /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, // written numbers
  /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
  /\b(thirty|forty|fifty|sixty|seventy|eighty|ninety|a hundred)\b/gi
];

const WRITTEN_NUMBERS = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
  'eighty': 80, 'ninety': 90, 'a hundred': 100,
  'half': 0.5, 'quarter': 0.25
};

/**
 * Parse a number from text (handles digits and written numbers)
 */
function parseNumber(text) {
  // Check for direct digits first
  const digitMatch = text.match(/\b(\d+)\b/);
  if (digitMatch) return parseInt(digitMatch[1]);
  
  // Check for written numbers
  for (const [word, value] of Object.entries(WRITTEN_NUMBERS)) {
    if (text.toLowerCase().includes(word)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Extract time from text (e.g., "at 3 PM", "at 15:00")
 */
function extractTimeFromText(text) {
  // Pattern for "at 3 PM", "at 15:00", "at noon", etc.
  const timePatterns = [
    /(?:at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|noon|midnight)?/gi,
    /(?:at|@)?\s*(\d{1,2})\s*(o'clock|oclock)/gi,
    /(?:at|@)?\s*(noon|midnight|morning|afternoon|evening)/gi
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toLowerCase() : null;
      
      // Handle special times
      if (match[3]) {
        if (match[3].toLowerCase() === 'noon') return { hours: 12, minutes: 0 };
        if (match[3].toLowerCase() === 'midnight') return { hours: 0, minutes: 0 };
        if (match[3].toLowerCase() === 'morning' || match[3].toLowerCase() === 'am') {
          if (hours === 12) hours = 0; // 12 AM = 0 hours
        } else if (match[3].toLowerCase() === 'afternoon' || match[3].toLowerCase() === 'pm') {
          if (hours !== 12) hours += 12; // PM to 24h format
        }
      }
      
      return { hours, minutes };
    }
  }
  
  return null;
}

/**
 * Parse relative time expression and return offset in minutes from now
 */
function parseRelativeTime(text) {
  const lowerText = text.toLowerCase().trim();
  if (DEBUG) console.log('[NLP] Parsing:', text);
  
  let totalOffset = 0;
  let timeInfo = null;
  
  // Extract time if present
  timeInfo = extractTimeFromText(lowerText);
  
  // Check for time references
  for (const [refName, refData] of Object.entries(TIME_REFERENCES)) {
    for (const pattern of refData.patterns) {
      if (pattern.test(lowerText)) {
        totalOffset += refData.value;
        if (DEBUG) console.log('[NLP] Found reference:', refName, 'offset:', refData.value);
        break;
      }
    }
  }
  
  // Check for time units with numbers
  for (const [unitName, unitData] of Object.entries(TIME_UNITS)) {
    for (const pattern of unitData.patterns) {
      const matches = lowerText.match(pattern);
      if (matches) {
        // Look for numbers near the unit
        const unitIndex = lowerText.indexOf(matches[0]);
        const beforeText = lowerText.substring(Math.max(0, unitIndex - 10));
        const afterText = lowerText.substring(unitIndex + matches[0].length);
        
        // Try to find number in context
        const number = parseNumber(beforeText + ' ' + afterText) || 
                     parseNumber(beforeText) || 
                     parseNumber(afterText) || 1; // default to 1 if no number found
        
        totalOffset += number * unitData.value;
        if (DEBUG) console.log('[NLP] Found unit:', unitName, 'number:', number, 'offset:', number * unitData.value);
        break;
      }
    }
  }
  
  // Handle special cases
  if (lowerText.includes('next week')) {
    totalOffset += 7 * 24 * 60;
  }
  if (lowerText.includes('last week')) {
    totalOffset -= 7 * 24 * 60;
  }
  
  const result = {
    offset: totalOffset,
    time: timeInfo,
    original: text,
    confidence: calculateConfidence(lowerText, totalOffset, timeInfo)
  };
  
  if (DEBUG) console.log('[NLP] Result:', result);
  return result;
}

/**
 * Calculate confidence score for the parsing result
 */
function calculateConfidence(text, offset, timeInfo) {
  let confidence = 0.5; // base confidence
  
  // Higher confidence if we found a specific time
  if (timeInfo) confidence += 0.3;
  
  // Higher confidence for clear time references
  if (/(tomorrow|today|yesterday|noon|midnight)/i.test(text)) {
    confidence += 0.2;
  }
  
  // Lower confidence for vague expressions
  if (/(later|soon|in a bit)/i.test(text)) {
    confidence -= 0.2;
  }
  
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Convert relative time to absolute time
 */
function convertToAbsoluteTime(relativeTime, baseDate = new Date()) {
  if (!relativeTime || relativeTime.offset === 0 && !relativeTime.time) {
    return null;
  }
  
  const result = new Date(baseDate);
  result.setTime(result.getTime() + (relativeTime.offset * 60 * 1000));
  
  // If we have time info, use it
  if (relativeTime.time) {
    result.setHours(relativeTime.time.hours, relativeTime.time.minutes, 0, 0);
  }
  
  return result;
}

/**
 * Main function to check if text contains relative time expression
 */
function containsRelativeTime(text) {
  const lowerText = text.toLowerCase();
  
  // Quick check for any time-related keywords
  const timeKeywords = [
    ...Object.values(TIME_REFERENCES).flatMap(ref => ref.patterns),
    ...Object.values(TIME_UNITS).flatMap(unit => unit.patterns),
    /in\s+\d+\s+(hour|minute|day|week)/i,
    /(next|last)\s+week/i,
    /at\s+(noon|midnight|morning|afternoon|evening)/i
  ];
  
  return timeKeywords.some(pattern => pattern.test(lowerText));
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseRelativeTime,
    convertToAbsoluteTime,
    containsRelativeTime,
    extractTimeFromText
  };
}
