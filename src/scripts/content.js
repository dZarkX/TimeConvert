// Content script - runs on every page to detect times
(function () {
  'use strict';

  const DEBUG = false;

  // Import NLP and domain timezone modules
  // Note: These are included as separate files to keep the code organized
  // In a production build, these would be bundled together
  const NLP_PARSER = {
    parseRelativeTime: function(text) {
      // Basic implementation - will be enhanced
      const lowerText = text.toLowerCase();
      if (lowerText.includes('in 2 hours') || lowerText.includes('in 2hrs')) return { offset: 120, confidence: 0.8 };
      if (lowerText.includes('in 1 hour') || lowerText.includes('in 1hr')) return { offset: 60, confidence: 0.8 };
      if (lowerText.includes('tomorrow')) return { offset: 24 * 60, confidence: 0.9 };
      if (lowerText.includes('yesterday')) return { offset: -24 * 60, confidence: 0.9 };
      if (lowerText.includes('next week')) return { offset: 7 * 24 * 60, confidence: 0.7 };
      if (lowerText.includes('end of day') || lowerText.includes('eod')) return { offset: 18 * 60, confidence: 0.7 };
      if (lowerText.includes('noon')) return { offset: 12 * 60, confidence: 0.8 };
      if (lowerText.includes('morning')) return { offset: 9 * 60, confidence: 0.6 };
      if (lowerText.includes('afternoon')) return { offset: 15 * 60, confidence: 0.6 };
      return null;
    },
    convertToAbsoluteTime: function(relativeTime, baseDate) {
      if (!relativeTime) return null;
      const result = new Date(baseDate);
      result.setTime(result.getTime() + (relativeTime.offset * 60 * 1000));
      return result;
    },
    containsRelativeTime: function(text) {
      const lowerText = text.toLowerCase();
      return /(?:in\s+\d+\s+(?:hour|hr|day|week)|tomorrow|yesterday|end\s+of\s+day|noon|morning|afternoon)/i.test(lowerText);
    }
  };

  const DOMAIN_TZ = {
    getTimezoneFromDomain: function(url) {
      try {
        if (!url) return null;
        let domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
        const domainMap = {
          '.pl': 'Europe/Warsaw', '.de': 'Europe/Berlin', '.fr': 'Europe/Paris', '.it': 'Europe/Rome',
          '.es': 'Europe/Madrid', '.uk': 'Europe/London', '.nl': 'Europe/Amsterdam',
          '.jp': 'Asia/Tokyo', '.kr': 'Asia/Seoul', '.cn': 'Asia/Shanghai',
          '.au': 'Australia/Sydney', '.br': 'America/Sao_Paulo', '.ca': 'America/Toronto'
        };
        const tldMatch = domain.match(/(\.[a-z]{2,3})$/);
        if (tldMatch && domainMap[tldMatch[1]]) return domainMap[tldMatch[1]];
        return null;
      } catch (e) { return null; }
    },
    getContextTimezone: function(url) {
      return this.getTimezoneFromDomain(url);
    }
  };

  // Prevent double-injection (can happen with scripting.executeScript + content_scripts)
  if (window.__tzConverterInjected) return;
  window.__tzConverterInjected = true;

  // Timezone data (embedded to avoid module loading issues in content scripts)
  const TIMEZONE_DATA = {
    'UTC': 0, 'GMT': 0,
    'CET': 1, 'CEST': 2, 'WET': 0, 'WEST': 1, 'EET': 2, 'EEST': 3, 'BST': 1, 'MSK': 3,
    'EST': -5, 'EDT': -4, 'ET': -5, // ET = Eastern Time (use standard time offset)
    'CST': -6, 'CDT': -5, 'CT': -6, // CT = Central Time
    'MST': -7, 'MDT': -6, 'MT': -7, // MT = Mountain Time
    'PST': -8, 'PDT': -7, 'PT': -8, // PT = Pacific Time
    'AKST': -9, 'AKDT': -8, 'HST': -10,
    'JST': 9, 'KST': 9, 'HKT': 8, 'SGT': 8, 'ICT': 7, 'PHT': 8,
    'AEST': 10, 'AEDT': 11, 'ACST': 9.5, 'ACDT': 10.5, 'AWST': 8, 'NZST': 12, 'NZDT': 13,
    'BRT': -3, 'ART': -3, 'CLT': -4, 'CLST': -3,
    'CAT': 2, 'EAT': 3, 'WAT': 1, 'SAST': 2,
    'AST': 3, 'GST': 4, 'TRT': 3
  };

  // Exclude UTC/GMT here so that the UTC/GMT+offset branch can match e.g. "UTC+2" fully.
  // Escape special regex characters in timezone abbreviations
  const TZ_ABBREVS = Object.keys(TIMEZONE_DATA)
    .filter(k => k !== 'UTC' && k !== 'GMT')
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape regex special chars
    .join('|');

  // Robust time pattern:
  // - 12h: 4PM CET, 11.59pm CET, 4.30 p.m. GMT
  // - 24h: 17:00 CET, 17.00 CET
  // - UTC offsets: 10AM UTC-5, 15:00 UTC+2, 02:00 GMT+01:30
  // Notes:
  // - Some sites use NBSP/NNBSP between tokens.
  // - Must avoid treating "pm"/"am" as a timezone.
  const TIME_SEP = "[:.\\u2024\\u00B7]"; // : . ․ ·
  const WS = "[\\s\\u00A0\\u202F]";
  const AMPM = "(?:[AaPp]\\.?\\s*[Mm]\\.?)";

  const MONTHS = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  // Only match timezones we can actually convert:
  // - Known abbreviations in TIMEZONE_DATA
  // - UTC/GMT (optionally with an offset)
  const TZ_PART = `(?:(?:UTC|GMT)(?:${WS}*[+-]${WS}*\\d{1,2}(?:(?::?\\d{2}))?)?|${TZ_ABBREVS})`;

  // Build regex defensively: if a pattern ever becomes invalid (or some
  // environments don't like named capture groups), fall back to a simpler one.
  let TIME_PATTERN;
  try {
    TIME_PATTERN = new RegExp(
      [
        "\\b(?:",
        // 12-hour time (requires AM/PM)
        `(?<h12>1[0-2]|0?[1-9])(?:${TIME_SEP}(?<m12>[0-5]\\d))?(?:${TIME_SEP}(?<s12>[0-5]\\d))?${WS}*(?<ampm>${AMPM})`,
        "|",
        // 24-hour time
        `(?<h24>[01]?\\d|2[0-3])(?:${TIME_SEP}(?<m24>[0-5]\\d))?(?:${TIME_SEP}(?<s24>[0-5]\\d))?`,
        ")",
        `${WS}*`,
        `(?<tz>${TZ_PART})`,
        "\\b"
      ].join(""),
      "gi"
    );
  } catch (e) {
    // Fallback pattern: no named groups, fewer features.
    // Groups:
    //  1=h12 2=m12 3=s12 4=ampm 5=h24 6=m24 7=s24 8=tz
    const fallback = [
      "\\b(?:",
      `(1[0-2]|0?[1-9])(?:${TIME_SEP}([0-5]\\d))?(?:${TIME_SEP}([0-5]\\d))?${WS}*(${AMPM})`,
      "|",
      `([01]?\\d|2[0-3])(?:${TIME_SEP}([0-5]\\d))?(?:${TIME_SEP}([0-5]\\d))?`,
      ")",
      `${WS}*`,
      `(${TZ_PART})`,
      "\\b"
    ].join("");
    TIME_PATTERN = new RegExp(fallback, "gi");
    if (DEBUG) console.error('[TimeZone Converter] TIME_PATTERN build failed, using fallback:', e);
  }

  // Date+time pattern (enabled by setting). Supports:
  // - ISO: 2026-01-28 14:30 UTC
  // - EU: 28/01/2026 14:30 CET
  // - Month name: Jan 28, 2026 2:30 PM CET
  let DATE_TIME_PATTERN;
  try {
    const ISO_DATE = `(?<yIso>\\d{4})-(?<mIso>0?[1-9]|1[0-2])-(?<dIso>0?[1-9]|[12]\\d|3[01])`;
    const EU_DATE = `(?<dEu>0?[1-9]|[12]\\d|3[01])\\/(?<mEu>0?[1-9]|1[0-2])\\/(?<yEu>\\d{4})`;
    const MON_DATE = `(?<monName>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)${WS}+(?<dMon>0?[1-9]|[12]\\d|3[01])(?:,)?${WS}+(?<yMon>\\d{4})`;

    const DATE_PART = `(?:${ISO_DATE}|${EU_DATE}|${MON_DATE})`;
    const TIME_PART = [
      "\\b(?:",
      // 12-hour time (requires AM/PM)
      `(?<h12>1[0-2]|0?[1-9])(?:${TIME_SEP}(?<m12>[0-5]\\d))?(?:${TIME_SEP}(?<s12>[0-5]\\d))?${WS}*(?<ampm>${AMPM})`,
      "|",
      // 24-hour time
      `(?<h24>[01]?\\d|2[0-3])(?:${TIME_SEP}(?<m24>[0-5]\\d))?(?:${TIME_SEP}(?<s24>[0-5]\\d))?`,
      ")\\b"
    ].join("");

    DATE_TIME_PATTERN = new RegExp(
      [
        "\\b",
        DATE_PART,
        `${WS}*[T,\\-\\/\\.]?${WS}*`,
        TIME_PART,
        `${WS}*`,
        `(?<tz>${TZ_PART})`,
        "\\b"
      ].join(""),
      "gi"
    );
  } catch (e) {
    DATE_TIME_PATTERN = null;
    if (DEBUG) console.error('[TimeZone Converter] DATE_TIME_PATTERN build failed:', e);
  }

  let foundTimes = [];
  let highlightEnabled = true;
  let settings = {
    targetTimezone: 'auto',
    targetOffset: null,
    use24Hour: false,
    autoConvertOnLoad: false,
    displayMode: 'toggle',
    resultIncludeUtcOffset: true,
    resultIncludeDayOffset: true,
    resultIncludeSourceTz: false,
    enableDateDetection: false,
    scanMode: 'auto',
    highlightColor: '#ffeb3b',
    highlightTextColor: '#000000',
    showOriginal: true,
    highlightTextOnly: false,
    maxConversions: 25,
    ignoredSites: [],
    // NEW: NLP and context detection settings
    enableNlpDetection: false,
    enableContextTimezone: false
  };

  // Get local timezone offset
  function getLocalOffset() {
    return -new Date().getTimezoneOffset() / 60;
  }

  // Get target offset based on settings
  function getTargetOffset() {
    if (settings.targetTimezone === 'auto' || settings.targetOffset === null) {
      return getLocalOffset();
    }
    return settings.targetOffset;
  }

  // Parse time match into structured object
  function parseMatch(match) {
    const g = match.groups || {};

    const result = {
      original: match[0],
      hours: 0,
      minutes: 0,
      seconds: 0,
      timezone: null,
      offset: null,
      date: null,
      hasDate: false
    };

    // Date parsing (only present in DATE_TIME_PATTERN)
    if (g.yIso || g.yEu || g.yMon) {
      let year = null;
      let month = null;
      let day = null;

      if (g.yIso) {
        year = Number(g.yIso);
        month = Number(g.mIso);
        day = Number(g.dIso);
      } else if (g.yEu) {
        year = Number(g.yEu);
        month = Number(g.mEu);
        day = Number(g.dEu);
      } else if (g.yMon) {
        year = Number(g.yMon);
        day = Number(g.dMon);
        const key = String(g.monName || '').toLowerCase();
        month = MONTHS[key] || null;
      }

      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        result.hasDate = true;
        // Store date parts; we will compute the correct target-local date later.
        result.date = { year, month, day };
      }
    }

    // Support fallback regex (no named groups)
    if (!match.groups) {
      // 12h branch
      if (match[4]) {
        g.h12 = match[1];
        g.m12 = match[2];
        g.s12 = match[3];
        g.ampm = match[4];
        g.tz = match[8];
      } else {
        // 24h branch
        g.h24 = match[5];
        g.m24 = match[6];
        g.s24 = match[7];
        g.tz = match[8];
      }
    }

    const tzRaw = (g.tz || "").trim();
    if (!tzRaw) return result;

    // Parse timezone
    const tzUpper = tzRaw.toUpperCase().replace(/\s+/g, "");

    // UTC/GMT (optional offset)
    const utcMatch = tzUpper.match(/^(UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (utcMatch) {
      const sign = utcMatch[2] === "-" ? -1 : 1;
      const hh = Number(utcMatch[3]);
      const mm = utcMatch[4] ? Number(utcMatch[4]) : 0;
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return result;

      result.offset = sign * (hh + mm / 60);
      result.timezone = `${utcMatch[1]}${utcMatch[2]}${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''}`;
    } else if (tzUpper === "UTC" || tzUpper === "GMT") {
      result.offset = 0;
      result.timezone = tzUpper;
    } else if (Object.prototype.hasOwnProperty.call(TIMEZONE_DATA, tzUpper)) {
      result.offset = TIMEZONE_DATA[tzUpper];
      result.timezone = tzUpper;
    } else {
      // Unknown timezone token
      return result;
    }

    // Parse time (12h or 24h)
    if (g.h12) {
      let hours = parseInt(g.h12, 10);
      const minutes = g.m12 ? parseInt(g.m12, 10) : 0;
      const seconds = g.s12 ? parseInt(g.s12, 10) : 0;
      const isPM = /p/i.test(g.ampm || "");

      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;

      result.hours = hours;
      result.minutes = minutes;
      result.seconds = seconds;
      return result;
    }

    if (g.h24) {
      result.hours = parseInt(g.h24, 10);
      result.minutes = g.m24 ? parseInt(g.m24, 10) : 0;
      result.seconds = g.s24 ? parseInt(g.s24, 10) : 0;
      return result;
    }

    return result;
  }

  // Convert time to target timezone (minutes math; avoids local timezone/DST issues)
  function convertTime(parsed, targetOffset) {
    if (parsed.offset === null) return null;

    // If we have an explicit date, compute the exact target date/time.
    if (parsed.hasDate && parsed.date && typeof parsed.date === 'object') {
      const { year, month, day } = parsed.date;
      const sourceOffsetMs = parsed.offset * 60 * 60 * 1000;
      const targetOffsetMs = targetOffset * 60 * 60 * 1000;

      // Interpret the provided Y-M-D + time as local time in the source timezone.
      const sourceLocalUtcMillis = Date.UTC(year, month - 1, day, parsed.hours, parsed.minutes, parsed.seconds || 0);
      const utcMillis = sourceLocalUtcMillis - sourceOffsetMs;
      const targetLocalMillis = utcMillis + targetOffsetMs;

      const targetDate = new Date(targetLocalMillis);

      // Use UTC getters because targetLocalMillis encodes "target-local" time as UTC.
      const hours = targetDate.getUTCHours();
      const minutes = targetDate.getUTCMinutes();

      return {
        hours,
        minutes,
        seconds: 0,
        dayOffset: 0,
        date: targetDate
      };
    }

    const diffMinutes = Math.round((targetOffset - parsed.offset) * 60);
    const totalMinutes = (parsed.hours * 60) + parsed.minutes + diffMinutes;

    const dayOffset = Math.floor(totalMinutes / 1440);
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;

    return {
      hours: Math.floor(normalized / 60),
      minutes: normalized % 60,
      seconds: 0,
      dayOffset,
      date: null
    };
  }

  // Format time for display
  function formatTime(hours, minutes, use24Hour = false, includeDate = false, date = null) {
    const timeStr = use24Hour ?
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` :
      `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

    if (includeDate && date) {
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      const nowY = new Date().getFullYear();
      const dateStr = `${monthsShort[m]} ${d}${y !== nowY ? `, ${y}` : ''}`;
      return `${dateStr} ${timeStr}`;
    }

    return timeStr;
  }

  // Format original time in user's preferred format
  function formatOriginalTime(parsed, use24Hour = false) {
    if (use24Hour) {
      return `${parsed.hours.toString().padStart(2, '0')}:${parsed.minutes.toString().padStart(2, '0')} ${parsed.timezone}`;
    }
    // Keep original format
    return parsed.original;
  }

  // Format timezone offset
  function formatOffset(offset) {
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  // Get day offset text
  function getDayOffsetText(dayOffset) {
    if (dayOffset === 0) return '';
    if (dayOffset === 1) return chrome.i18n.getMessage('dayOffsetPlus', ['1']);
    if (dayOffset === -1) return chrome.i18n.getMessage('dayOffsetMinus', ['1']);
    const absDays = Math.abs(dayOffset).toString();
    const sign = dayOffset > 0 ? '+' : '-';
    return chrome.i18n.getMessage('dayOffsetPlural', [sign, absDays]);
  }

  function buildConvertedString(parsed, converted, targetOffset) {
    const parts = [];

    const includeDate = !!(parsed?.hasDate && converted?.date);
    parts.push(formatTime(converted.hours, converted.minutes, settings.use24Hour, includeDate, converted.date || null));

    if (settings.resultIncludeUtcOffset !== false) {
      parts.push(formatOffset(targetOffset));
    }

    if (settings.resultIncludeDayOffset !== false) {
      const day = getDayOffsetText(converted.dayOffset);
      if (day) parts.push(day);
    }

    let out = parts.join(' ');

    if (settings.resultIncludeSourceTz) {
      const tz = parsed?.timezone;
      if (tz) out += ` (${tz})`;
    }

    return out;
  }

  // Create highlight element
  function createHighlight(textNode, start, end, timeData) {
    const text = textNode.textContent;
    const before = text.substring(0, start);
    const timeText = text.substring(start, end);
    const after = text.substring(end);

    const wrapper = document.createElement('span');

    if (before) {
      wrapper.appendChild(document.createTextNode(before));
    }

    const highlight = document.createElement('span');
    highlight.className = 'tz-converter-highlight';
    highlight.dataset.tzOriginal = timeData.original;
    highlight.dataset.tzConverted = timeData.converted;
    highlight.dataset.tzId = timeData.id;
    highlight.textContent = timeText;
    highlight.title = `${timeData.original} → ${timeData.converted}`;

    // Apply custom styles
    highlight.style.backgroundColor = settings.highlightColor;
    highlight.style.color = settings.highlightTextColor;

    wrapper.appendChild(highlight);

    if (after) {
      wrapper.appendChild(document.createTextNode(after));
    }

    return wrapper;
  }

  // Walk text nodes and find times (TreeWalker is significantly faster than recursion)
  function findTimesInNode(root, times) {
    if (!root) return;

    const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'textarea', 'input', 'select', 'option']);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.nodeValue;
          if (!text || text.length < 4) return NodeFilter.FILTER_REJECT;
          if (!/\d/.test(text)) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
          if (SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;

          // Skip our own highlights/popups
          if (parent.closest('.tz-converter-highlight, #tz-conversion-popup')) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let nodeCount = 0;
    const MAX_TEXT_NODES = 8000;

    while (walker.nextNode()) {
      if (++nodeCount > MAX_TEXT_NODES) break;

      const node = walker.currentNode;
      const text = node.nodeValue;
      if (!text) continue;

      try {
        const usedRanges = [];

        if (settings.enableDateDetection && DATE_TIME_PATTERN) {
          DATE_TIME_PATTERN.lastIndex = 0;
          let m;
          while ((m = DATE_TIME_PATTERN.exec(text)) !== null) {
            try {
              const parsed = parseMatch(m);
              if (parsed.offset === null) continue;

              const targetOffset = getTargetOffset();
              const converted = convertTime(parsed, targetOffset);
              if (!converted) continue;

              const convertedStr = buildConvertedString(parsed, converted, targetOffset);

              const start = m.index;
              const end = m.index + m[0].length;
              usedRanges.push([start, end]);

              times.push({
                id: `tz-${Date.now()}-${times.length}`,
                node,
                start,
                end,
                original: m[0],
                originalParsed: parsed,
                converted: convertedStr,
                convertedParsed: converted
              });
            } catch {
              continue;
            }
          }
        }

        TIME_PATTERN.lastIndex = 0;
        let match;
        while ((match = TIME_PATTERN.exec(text)) !== null) {
          try {
            const parsed = parseMatch(match);
            if (parsed.offset === null) continue;

            const targetOffset = getTargetOffset();
            const converted = convertTime(parsed, targetOffset);
            if (!converted) continue;

            const convertedStr = buildConvertedString(parsed, converted, targetOffset);

            const start = match.index;
            const end = match.index + match[0].length;

            // Skip overlap with date-time matches
            if (usedRanges.length > 0) {
              let overlaps = false;
              for (const [a, b] of usedRanges) {
                if (start < b && end > a) { overlaps = true; break; }
              }
              if (overlaps) continue;
            }

            times.push({
              id: `tz-${Date.now()}-${times.length}`,
              node,
              start,
              end,
              original: match[0],
              originalParsed: parsed,
              converted: convertedStr,
              convertedParsed: converted
            });
          } catch (e) {
            // Skip invalid matches
            continue;
          }
        }
      } catch (e) {
        // Regex error - skip this text node
        continue;
      }
    }
  }

  // Check if current site is ignored
  function isSiteIgnored() {
    const hostname = window.location.hostname;
    return settings.ignoredSites.some(site => {
      return hostname === site || hostname.endsWith('.' + site);
    });
  }

  // Scan page for times
  function scanPage() {
    try {
      if (isSiteIgnored()) return [];
      if (!document.body) return [];

      foundTimes = [];
      findTimesInNode(document.body, foundTimes);

      // NEW: Check for relative time expressions if NLP detection is enabled
      if (settings.enableNlpDetection) {
        const relativeTimes = findRelativeTimesInNode(document.body);
        foundTimes.push(...relativeTimes);
      }

      if (settings.maxConversions > 0 && foundTimes.length > settings.maxConversions) {
        foundTimes = foundTimes.slice(0, settings.maxConversions);
      }

      return foundTimes;
    } catch (e) {
      if (DEBUG) console.error('[TimeZone Converter] Scan error:', e);
      return [];
    }
  }

  // NEW: Find relative time expressions using NLP
  function findRelativeTimesInNode(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.nodeValue;
          if (!text || text.length < 4) return NodeFilter.FILTER_REJECT;
          if (!NLP_PARSER.containsRelativeTime(text)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const relativeTimes = [];
    let nodeCount = 0;
    const MAX_TEXT_NODES = 2000; // Limit for performance

    while (walker.nextNode() && ++nodeCount < MAX_TEXT_NODES) {
      const node = walker.currentNode;
      const text = node.nodeValue;

      try {
        const relativeTime = NLP_PARSER.parseRelativeTime(text);
        if (relativeTime && relativeTime.confidence > 0.6) {
          const absoluteTime = NLP_PARSER.convertToAbsoluteTime(relativeTime, new Date());
          if (absoluteTime) {
            // Create a synthetic time object for relative expressions
            const hours = absoluteTime.getHours();
            const minutes = absoluteTime.getMinutes();
            const timezone = settings.enableContextTimezone ? DOMAIN_TZ.getContextTimezone(window.location.href) : null;

            // Determine offset based on detected timezone or local timezone
            let offset = timezone ? getTimezoneOffset(timezone) : getLocalOffset();

            relativeTimes.push({
              id: `nlp-${Date.now()}-${relativeTimes.length}`,
              node,
              start: 0,
              end: text.length,
              original: text.trim(),
              originalParsed: {
                hours,
                minutes,
                timezone: timezone || 'Local',
                offset,
                hasDate: true,
                date: {
                  year: absoluteTime.getFullYear(),
                  month: absoluteTime.getMonth() + 1,
                  day: absoluteTime.getDate()
                }
              },
              converted: formatRelativeTime(relativeTime, absoluteTime),
              convertedParsed: {
                hours,
                minutes,
                timezone: timezone || 'Local',
                offset: getLocalOffset(), // Always convert to local timezone for relative times
                hasDate: true,
                date: {
                  year: absoluteTime.getFullYear(),
                  month: absoluteTime.getMonth() + 1,
                  day: absoluteTime.getDate()
                }
              },
              isRelative: true,
              confidence: relativeTime.confidence
            });
          }
        }
      } catch (e) {
        if (DEBUG) console.error('[NLP] Error processing relative time:', e);
      }
    }

    return relativeTimes;
  }

  // Format relative time for display
  function formatRelativeTime(relativeTime, absoluteTime) {
    const now = new Date();
    const diffMs = absoluteTime - now;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    if (diffMinutes < 0) {
      return `In the past (${Math.abs(diffMinutes)} minutes ago)`;
    } else if (diffMinutes === 0) {
      return 'Now';
    } else if (diffMinutes < 60) {
      return `In ${diffMinutes} minutes`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `In ${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      const mins = diffMinutes % 60;
      return `In ${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}${mins > 0 ? ` ${mins}m` : ''}`;
    }
  }

  let suppressMutationsCount = 0;

  // Countdown timer functions
  function createCountdownElement(time) {
    try {
      // Parse the original time to get the actual datetime
      const originalDate = parseTimeToDate(time);
      if (!originalDate) return null;

      // Only show countdown for future events (within next 30 days)
      const now = new Date();
      const timeDiff = originalDate - now;
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      if (timeDiff <= 0 || daysDiff > 30) return null;

      const countdown = document.createElement('span');
      countdown.className = 'tz-countdown';
      countdown.dataset.tzTargetTime = originalDate.toISOString();
      
      updateCountdownText(countdown, timeDiff);
      
      // Update countdown every minute
      setInterval(() => {
        const currentTime = new Date();
        const targetTime = new Date(countdown.dataset.tzTargetTime);
        const diff = targetTime - currentTime;
        
        if (diff <= 0) {
          countdown.textContent = chrome.i18n.getMessage('countdownExpired') || 'Event started';
          countdown.classList.add('urgent');
        } else {
          updateCountdownText(countdown, diff);
        }
      }, 60000); // Update every minute

      return countdown;
    } catch (e) {
      if (DEBUG) console.error('[TimeZone Converter] Countdown error:', e);
      return null;
    }
  }

  function parseTimeToDate(time) {
    try {
      // Extract date from context or use current date
      const now = new Date();
      const contextText = getContextText(time.node, time.start, time.end);
      const dateMatch = contextText.match(/\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/);
      
      let day = now.getDate();
      let month = now.getMonth();
      let year = now.getFullYear();
      
      if (dateMatch) {
        day = parseInt(dateMatch[1]);
        month = parseInt(dateMatch[2]) - 1;
        if (dateMatch[3]) {
          year = parseInt(dateMatch[3]);
          if (year < 100) year += 2000;
        }
      }
      
      // Parse time
      const timeMatch = time.original.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      if (!timeMatch) return null;
      
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      // Create date in target timezone
      const targetDate = new Date(year, month, day, hours, minutes, 0, 0);
      
      // Convert to UTC, then adjust for target timezone offset
      const targetOffset = time.targetOffset || 0;
      const utcTime = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60000);
      const adjustedTime = utcTime + (targetOffset * 3600000);
      
      return new Date(adjustedTime);
    } catch (e) {
      if (DEBUG) console.error('[TimeZone Converter] Date parsing error:', e);
      return null;
    }
  }

  function getContextText(node, start, end) {
    try {
      const maxLength = 200;
      const text = node.nodeValue || '';
      const contextStart = Math.max(0, start - 50);
      const contextEnd = Math.min(text.length, end + 50);
      return text.substring(contextStart, contextEnd);
    } catch (e) {
      return '';
    }
  }

  function updateCountdownText(element, timeDiff) {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    let text = '';
    let plural = '';
    
    if (days > 0) {
      // Handle pluralization for different languages
      const lang = chrome.i18n.getUILanguage();
      if (lang.startsWith('pl')) {
        if (days === 1) plural = 'dzień';
        else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) plural = 'dni';
        else plural = 'dni';
        text = `za ${days} ${plural}`;
      } else if (lang.startsWith('de')) {
        plural = days === 1 ? 'Tag' : 'Tage';
        text = `in ${days} ${plural}`;
      } else if (lang.startsWith('es')) {
        plural = days === 1 ? 'día' : 'días';
        text = `en ${days} ${plural}`;
      } else if (lang.startsWith('pt')) {
        plural = days === 1 ? 'dia' : 'dias';
        text = `em ${days} ${plural}`;
      } else {
        // English fallback
        plural = days === 1 ? 'day' : 'days';
        text = `in ${days} ${plural}`;
      }
      element.classList.toggle('urgent', days <= 1);
      element.classList.toggle('soon', days <= 7);
    } else if (hours > 0) {
      const lang = chrome.i18n.getUILanguage();
      if (lang.startsWith('pl')) {
        plural = hours === 1 ? 'godzinę' : 'godziny';
        text = `za ${hours} ${plural}`;
      } else if (lang.startsWith('de')) {
        plural = hours === 1 ? 'Stunde' : 'Stunden';
        text = `in ${hours} ${plural}`;
      } else if (lang.startsWith('es')) {
        plural = hours === 1 ? 'hora' : 'horas';
        text = `en ${hours} ${plural}`;
      } else if (lang.startsWith('pt')) {
        plural = hours === 1 ? 'hora' : 'horas';
        text = `em ${hours} ${plural}`;
      } else {
        // English fallback
        plural = hours === 1 ? 'hour' : 'hours';
        text = `in ${hours} ${plural}`;
      }
      element.classList.add('urgent');
    } else {
      const lang = chrome.i18n.getUILanguage();
      if (lang.startsWith('pl')) {
        plural = minutes === 1 ? 'minutę' : 'minuty';
        text = `za ${minutes} ${plural}`;
      } else if (lang.startsWith('de')) {
        plural = minutes === 1 ? 'Minute' : 'Minuten';
        text = `in ${minutes} ${plural}`;
      } else if (lang.startsWith('es')) {
        plural = minutes === 1 ? 'minuto' : 'minutos';
        text = `en ${minutes} ${plural}`;
      } else if (lang.startsWith('pt')) {
        plural = minutes === 1 ? 'minuto' : 'minutos';
        text = `em ${minutes} ${plural}`;
      } else {
        // English fallback
        plural = minutes === 1 ? 'min' : 'mins';
        text = `in ${minutes} ${plural}`;
      }
      element.classList.add('urgent');
    }
    
    element.textContent = text;
  }

  function withSuppressedMutations(fn) {
    suppressMutationsCount++;
    try {
      fn();
    } finally {
      // Let the MutationObserver flush before re-enabling
      setTimeout(() => {
        suppressMutationsCount = Math.max(0, suppressMutationsCount - 1);
      }, 0);
    }
  }

  // Apply highlights to found times
  function applyHighlights() {
    if (!highlightEnabled) return;

    const nodeGroups = new Map();
    for (const t of foundTimes) {
      if (!t.node || !t.node.parentNode) continue;
      if (!nodeGroups.has(t.node)) nodeGroups.set(t.node, []);
      nodeGroups.get(t.node).push(t);
    }

    withSuppressedMutations(() => {
      for (const [node, times] of nodeGroups) {
        if (!node || !node.parentNode) continue;
        const text = node.nodeValue;
        if (!text) continue;

        times.sort((a, b) => a.start - b.start);

        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        for (const time of times) {
          if (time.start < lastIndex) continue;

          const expected = text.substring(time.start, time.end);
          if (expected !== time.original) continue;

          if (time.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, time.start)));
          }

          const highlight = document.createElement('span');
          highlight.className = 'tz-converter-highlight';
          highlight.dataset.tzOriginal = time.original;
          highlight.dataset.tzConverted = time.converted;
          highlight.dataset.tzId = time.id;
          highlight.dataset.tzShowConverted = 'false';
          highlight.textContent = expected;
          if (settings.displayMode === 'toggle') {
            highlight.title = chrome.i18n.getMessage('clickToSee', [time.converted]);
          }
          applyHighlightStyle(highlight, false);

          // Add countdown timer
          const countdown = createCountdownElement(time);
          if (countdown) {
            highlight.appendChild(countdown);
          }

          fragment.appendChild(highlight);
          lastIndex = time.end;
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        node.parentNode.replaceChild(fragment, node);
      }
    });
  }

  // Remove all highlights
  function removeHighlights() {
    const highlights = document.querySelectorAll('.tz-converter-highlight');

    withSuppressedMutations(() => {
      highlights.forEach(el => {
        const original = el.dataset.tzOriginal || el.textContent;
        el.replaceWith(document.createTextNode(original));
      });
    });
  }

  // Update highlight styles without removing them
  function updateHighlightStyles() {
    const highlights = document.querySelectorAll('.tz-converter-highlight');
    highlights.forEach(el => {
      const isConverted = el.dataset.tzShowConverted === 'true';
      applyHighlightStyle(el, isConverted);

      // Avoid native browser tooltip when using custom tooltip mode
      if (settings.displayMode === 'tooltip') {
        el.removeAttribute('title');
      }
    });
  }

  // Colors for converted time display (fixed green with white text)
  const CONVERTED_BG_COLOR = '#4CAF50';
  const CONVERTED_TEXT_COLOR = '#ffffff';

  function applyHighlightStyle(element, isConverted) {
    if (!element) return;

    if (isConverted) {
      if (settings.highlightTextOnly) {
        element.style.setProperty('background-color', 'transparent', 'important');
        element.style.setProperty('color', CONVERTED_BG_COLOR, 'important');
      } else {
        element.style.setProperty('background-color', CONVERTED_BG_COLOR, 'important');
        element.style.setProperty('color', CONVERTED_TEXT_COLOR, 'important');
      }
      return;
    }

    if (settings.highlightTextOnly) {
      element.style.setProperty('background-color', 'transparent', 'important');
      element.style.setProperty('color', settings.highlightTextColor, 'important');
    } else {
      element.style.setProperty('background-color', settings.highlightColor, 'important');
      element.style.setProperty('color', settings.highlightTextColor, 'important');
    }
  }

  function setTimeDisplay(element, showConverted) {
    const original = element.dataset.tzOriginal;
    const converted = element.dataset.tzConverted;

    if (!original || !converted) return;

    if (showConverted) {
      element.textContent = converted;
      element.dataset.tzShowConverted = 'true';
      if (settings.displayMode === 'toggle') {
        element.title = chrome.i18n.getMessage('clickToSeeOriginal', [original]);
      } else {
        element.removeAttribute('title');
      }
      applyHighlightStyle(element, true);
    } else {
      element.textContent = original;
      element.dataset.tzShowConverted = 'false';
      if (settings.displayMode === 'toggle') {
        element.title = chrome.i18n.getMessage('clickToSee', [converted]);
      } else {
        element.removeAttribute('title');
      }
      applyHighlightStyle(element, false);
    }
  }

  function applyAutoConvertIfEnabled() {
    if (!settings.autoConvertOnLoad) return;
    if (settings.displayMode !== 'toggle') return;
    const highlights = document.querySelectorAll('.tz-converter-highlight');
    highlights.forEach(el => {
      if (el.dataset.tzShowConverted !== 'true') {
        setTimeDisplay(el, true);
      } else {
        applyHighlightStyle(el, true);
      }
    });
  }

  let tooltipEl = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    const el = document.createElement('div');
    el.id = 'tz-converter-tooltip';
    el.style.position = 'fixed';
    el.style.zIndex = '2147483647';
    el.style.pointerEvents = 'none';
    el.style.maxWidth = '320px';
    el.style.padding = '8px 10px';
    el.style.borderRadius = '8px';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.35';
    el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)';
    el.style.background = 'rgba(17, 24, 39, 0.92)';
    el.style.color = '#fff';
    el.style.display = 'none';
    el.style.whiteSpace = 'normal';
    document.documentElement.appendChild(el);
    tooltipEl = el;
    return tooltipEl;
  }

  function positionTooltip(x, y) {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;
    const margin = 12;
    const rect = tooltipEl.getBoundingClientRect();
    let left = x + margin;
    let top = y + margin;

    if (left + rect.width + margin > window.innerWidth) {
      left = Math.max(margin, x - rect.width - margin);
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = Math.max(margin, y - rect.height - margin);
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function showTooltipFor(el, clientX, clientY) {
    if (!el) return;
    const original = el.dataset.tzOriginal || el.textContent;
    const converted = el.dataset.tzConverted;
    if (!converted) return;

    const tip = ensureTooltip();
    tip.textContent = `${original} → ${converted}`;
    tip.style.display = 'block';
    // Need one frame to measure size correctly
    requestAnimationFrame(() => positionTooltip(clientX, clientY));
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.style.display = 'none';
  }

  // Toggle highlight for a specific time
  function toggleTimeDisplay(element) {
    const isShowingConverted = element.dataset.tzShowConverted === 'true';

    setTimeDisplay(element, !isShowingConverted);
  }

  // Handle click on highlights
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('tz-converter-highlight')) {
      if (settings.displayMode === 'toggle') {
        toggleTimeDisplay(e.target);
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;
    positionTooltip(e.clientX, e.clientY);
  });

  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('tz-converter-highlight')) return;
    if (settings.displayMode !== 'tooltip') return;
    showTooltipFor(t, e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', (e) => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('tz-converter-highlight')) return;
    if (settings.displayMode !== 'tooltip') return;
    hideTooltip();
  });

  // Flag to track if extension context has been invalidated
  let contextInvalidated = false;

  // Check if extension context is still valid - using a safer method
  function isExtensionContextValid() {
    if (contextInvalidated) return false;

    // Simple check without accessing properties that throw uncatchable errors
    if (typeof chrome === 'undefined') {
      contextInvalidated = true;
      return false;
    }
    if (!chrome.runtime) {
      contextInvalidated = true;
      return false;
    }

    // Use getURL which returns empty string if context is invalid but doesn't throw
    try {
      const url = chrome.runtime.getURL('');
      if (!url) {
        contextInvalidated = true;
        return false;
      }
      return true;
    } catch (e) {
      contextInvalidated = true;
      return false;
    }
  }

  // Load settings from storage
  function loadSettings() {
    return new Promise((resolve) => {
      // Quick check using flag
      if (contextInvalidated) {
              return;
            }
            settings = { ...settings, ...items };
            highlightEnabled = items.highlightEnabled;
            resolve(settings);
          } catch (e) {
            contextInvalidated = true;
            resolve(settings);
          }
        });
      } catch (e) {
        contextInvalidated = true;
        resolve(settings);
      }
    });
  }

  // Send times to background script (fire-and-forget, don't block on errors)
  function notifyBackground(times) {
    if (contextInvalidated || !isExtensionContextValid()) return;

    try {
      const message = {
        type: 'TIMES_FOUND',
        data: {
          count: times.length,
          times: times.map(t => ({
            id: t.id,
            original: t.original,
            converted: t.converted,
            timezone: t.originalParsed?.timezone || null
          }))
        }
      };

      chrome.runtime.sendMessage(message, (response) => {
        // Silently handle errors - background script might not be ready
        if (chrome.runtime?.lastError) {
          // This is normal if background script isn't loaded yet
          return;
        }
      });
    } catch (e) {
      // If sendMessage throws, mark context as invalid
      contextInvalidated = true;
    }
  }

  // Publish status to the page (for debugging test page)
  function publishStatus(detail) {
    try {
      const d = detail && typeof detail === 'object' ? detail : {};
      // Dataset fallback (works without CustomEvent listener)
      document.documentElement.dataset.tzConverterReady = d.ready ? '1' : '0';
      if (typeof d.count === 'number') document.documentElement.dataset.tzConverterCount = String(d.count);
      if (d.phase) document.documentElement.dataset.tzConverterPhase = String(d.phase);

      // Event (nice for test page UI)
      window.dispatchEvent(new CustomEvent('tz-converter:status', { detail: d }));
    } catch {
      // ignore
    }
  }

  // Message listener flag to prevent duplicate listeners
  let messageListenerAdded = false;

  // Initialize
  async function init() {
    await loadSettings();

    // Initial scan (depends on scanMode)
    if (settings.scanMode !== 'manual') {
      const times = scanPage();
      notifyBackground(times);
      publishStatus({ ready: true, phase: 'init-scan', count: times.length });

      if (highlightEnabled && times.length > 0) {
        applyHighlights();
        applyAutoConvertIfEnabled();
      }
    } else {
      foundTimes = [];
      notifyBackground([]);
      publishStatus({ ready: true, phase: 'manual-mode', count: 0 });
    }

    // Listen for messages from popup/background (only add once)
    if (!contextInvalidated && !messageListenerAdded && isExtensionContextValid()) {
      messageListenerAdded = true;
      try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          // Check if context is still valid before processing
          if (contextInvalidated) return false;

          try {
            switch (message.type) {
              case 'GET_TIMES':
                sendResponse({
                  times: foundTimes.map(t => ({
                    id: t.id,
                    original: t.original,
                    converted: t.converted,
                    timezone: t.originalParsed.timezone
                  }))
                });
                return true;

              case 'CONVERT_SELECTION':
                // Handle manual conversion of selected text
                try {
                  convertSelectedText(message.selectedText);
                  sendResponse({ success: true });
                } catch (e) {
                  sendResponse({ success: false, error: e.message });
                }
                return true;

              case 'RESCAN':
                if (highlightEnabled) removeHighlights();
                loadSettings().then(() => {
                  const newTimes = scanPage();
                  notifyBackground(newTimes);
                  publishStatus({ ready: true, phase: 'rescan', count: newTimes.length });
                  if (highlightEnabled && newTimes.length > 0) {
                    applyHighlights();
                    applyAutoConvertIfEnabled();
                  }
                  // Update observer after settings changes
                  stopObserver();
                  if (settings.scanMode === 'auto') startObserver();
                  try {
                    sendResponse({ times: newTimes.length });
                  } catch (e) {
                    // Response already sent or context invalidated
                  }
                });
                return true; // Async response

              case 'TOGGLE_HIGHLIGHTS':
                highlightEnabled = message.enabled;
                if (highlightEnabled) {
                  if (settings.scanMode === 'manual') {
                    // Manual mode: do not autoscan, only style/update existing highlights
                    if (foundTimes.length > 0) {
                      applyHighlights();
                      applyAutoConvertIfEnabled();
                    }
                    publishStatus({ ready: true, phase: 'toggle-on', count: foundTimes.length });
                  } else {
                    // Rescan to ensure positions are correct before applying highlights
                    const newTimes = scanPage();
                    notifyBackground(newTimes);
                    publishStatus({ ready: true, phase: 'toggle-on', count: newTimes.length });
                    if (newTimes.length > 0) {
                      applyHighlights();
                      applyAutoConvertIfEnabled();
                    }
                  }
                } else {
                  removeHighlights();
                  publishStatus({ ready: true, phase: 'toggle-off', count: foundTimes.length });
                }
                sendResponse({ success: true });
                return true;

              case 'SETTINGS_UPDATED':
                loadSettings().then(() => {
                  // Update observer after settings changes
                  stopObserver();
                  if (settings.scanMode === 'auto') startObserver();

                  // Just update styles if highlights exist, otherwise rescan
                  const existingHighlights = document.querySelectorAll('.tz-converter-highlight');
                  if (existingHighlights.length > 0) {
                    if (highlightEnabled) {
                      updateHighlightStyles();
                      applyAutoConvertIfEnabled();
                    } else {
                      removeHighlights();
                    }
                  } else if (highlightEnabled && settings.scanMode !== 'manual') {
                    const newTimes = scanPage();
                    notifyBackground(newTimes);
                    applyHighlights();
                    applyAutoConvertIfEnabled();
                  }
                  try {
                    sendResponse({ success: true });
                  } catch (e) {
                    // Response already sent or context invalidated
                  }
                });
                return true; // Async response

              case 'SCROLL_TO_TIME':
                const element = document.querySelector(`[data-tz-id="${message.timeId}"]`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.style.animation = 'tz-pulse 0.5s ease-in-out 3';
                  setTimeout(() => {
                    element.style.animation = '';
                  }, 1500);
                }
                sendResponse({ success: !!element });
                return true;
            }
          } catch (e) {
            contextInvalidated = true;
            return false;
          }
          return false;
        });
      } catch (e) {
        contextInvalidated = true;
      }
    }

    // Observe DOM changes for dynamic content (auto mode only)
    let rescanTimeout = null;
    let observer = null;

    const stopObserver = () => {
      if (observer) {
        try { observer.disconnect(); } catch { }
        observer = null;
      }
      if (rescanTimeout) {
        try { clearTimeout(rescanTimeout); } catch { }
        rescanTimeout = null;
      }
    };

    const startObserver = () => {
      if (observer) return;
      if (!document.body) return;
      if (settings.scanMode !== 'auto') return;

      observer = new MutationObserver((mutations) => {
        if (contextInvalidated) return;
        if (settings.scanMode !== 'auto') return;
        if (suppressMutationsCount > 0) return;

        let shouldRescan = false;

        for (const mutation of mutations) {
          if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;

          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // Ignore our own injected UI/highlights
            if (node.closest?.('.tz-converter-highlight, #tz-conversion-popup')) continue;

            shouldRescan = true;
            break;
          }

          if (shouldRescan) break;
        }

        if (!shouldRescan) return;

        if (rescanTimeout) clearTimeout(rescanTimeout);
        rescanTimeout = setTimeout(() => {
          if (contextInvalidated) return;
          if (settings.scanMode !== 'auto') return;

          if (highlightEnabled) removeHighlights();
          const times = scanPage();
          notifyBackground(times);
          publishStatus({ ready: true, phase: 'mutation-rescan', count: times.length });
          if (highlightEnabled && times.length > 0) {
            applyHighlights();
            applyAutoConvertIfEnabled();
          }
        }, 800);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    };

    // Start observer only in full auto mode
    if (settings.scanMode === 'auto') {
      startObserver();
    }
  }

  // Convert selected text manually
  function convertSelectedText(selectedText) {
    const trimmedText = selectedText.trim();

    // Test if the selected text matches our time pattern
    TIME_PATTERN.lastIndex = 0;
    const match = TIME_PATTERN.exec(trimmedText);

    if (match) {
      const parsed = parseMatch(match);

      if (parsed.offset !== null) {
        const targetOffset = getTargetOffset();
        const converted = convertTime(parsed, targetOffset);

        if (converted) {
          const convertedStr = formatTime(converted.hours, converted.minutes, settings.use24Hour, converted.date, converted.date) +
            ' ' + formatOffset(targetOffset) +
            getDayOffsetText(converted.dayOffset);

          // Show conversion result in a temporary popup
          showConversionPopup(trimmedText, convertedStr);
          return;
        }
      }
    }

    // Show error if no valid time found
    showConversionPopup(trimmedText, 'No valid time with timezone found');
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show conversion result popup
  function showConversionPopup(original, converted) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('tz-conversion-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'tz-conversion-popup';
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: tz-slideIn 0.3s ease-out;
    `;

    popup.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#4CAF50" style="margin-right: 8px;">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <strong>Time Conversion</strong>
      </div>
      <div style="margin-bottom: 4px; color: #666;">Original:</div>
      <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-family: monospace;">${escapeHtml(original)}</div>
      <div style="margin-bottom: 4px; color: #666;">Converted:</div>
      <div style="background: #e8f5e8; padding: 8px; border-radius: 4px; font-family: monospace; color: #2e7d32;">${escapeHtml(converted)}</div>
      <button id="tz-popup-close" style="
        margin-top: 12px;
        background: #4CAF50;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Close</button>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tz-slideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(popup);

    // Handle close button
    const closeBtn = popup.querySelector('#tz-popup-close');
    closeBtn.addEventListener('click', () => {
      popup.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 10000);
  }

  // Start when DOM is ready - wrap in try-catch for safety
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          init();
        } catch (e) {
          if (DEBUG) console.error('[TimeZone Converter] Init error:', e);
        }
      });
    } else {
      init();
    }
  } catch (e) {
    if (DEBUG) console.error('[TimeZone Converter] Setup error:', e);
  }
})();
