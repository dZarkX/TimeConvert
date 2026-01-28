// Content script - runs on every page to detect times
(function() {
  'use strict';

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

  const TZ_ABBREVS = Object.keys(TIMEZONE_DATA).join('|');
  
  // Build comprehensive time pattern
  const TIME_PATTERN = new RegExp(
    `(?:` +
      // 12-hour format: 5PM, 5:00PM, 5:00 PM, etc.
      `(1[0-2]|0?[1-9])(?:[:.]([0-5][0-9]))?(?:[:.]([0-5][0-9]))?\\s*(AM|PM|am|pm|a\\.m\\.|p\\.m\\.)` +
    `|` +
      // 24-hour format: 17:00, 17:00:00
      `([01]?[0-9]|2[0-3])[:.]([0-5][0-9])(?:[:.]([0-5][0-9]))?` +
    `)` +
    `\\s*` +
    `(?:` +
      // Timezone abbreviation
      `(${TZ_ABBREVS})` +
    `|` +
      // UTC/GMT with offset: UTC+2, GMT-5:30
      `(UTC|GMT)\\s*([+-])\\s*(\\d{1,2})(?::(\\d{2}))?` +
    `|` +
      // Plain UTC/GMT
      `(UTC|GMT)` +
    `)`,
    'gi'
  );

  let foundTimes = [];
  let highlightEnabled = true;
  let settings = {
    targetTimezone: 'auto',
    targetOffset: null,
    use24Hour: false,
    highlightColor: '#ffeb3b',
    highlightTextColor: '#000000',
    showOriginal: true
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
    const result = {
      original: match[0],
      hours: 0,
      minutes: 0,
      seconds: 0,
      timezone: null,
      offset: null
    };

    // 12-hour format
    if (match[4]) {
      result.hours = parseInt(match[1], 10);
      result.minutes = match[2] ? parseInt(match[2], 10) : 0;
      result.seconds = match[3] ? parseInt(match[3], 10) : 0;
      const isPM = /pm|p\.m\./i.test(match[4]);
      
      if (isPM && result.hours !== 12) result.hours += 12;
      else if (!isPM && result.hours === 12) result.hours = 0;
    }
    // 24-hour format
    else if (match[5] !== undefined) {
      result.hours = parseInt(match[5], 10);
      result.minutes = match[6] ? parseInt(match[6], 10) : 0;
      result.seconds = match[7] ? parseInt(match[7], 10) : 0;
    }

    // Timezone abbreviation
    if (match[8]) {
      result.timezone = match[8].toUpperCase();
      result.offset = TIMEZONE_DATA[result.timezone];
    }
    // UTC/GMT with offset
    else if (match[9]) {
      const sign = match[10] === '-' ? -1 : 1;
      const hours = match[11] ? parseInt(match[11], 10) : 0;
      const minutes = match[12] ? parseInt(match[12], 10) / 60 : 0;
      result.offset = sign * (hours + minutes);
      result.timezone = `${match[9]}${match[10] || '+'}${hours}${match[12] ? ':' + match[12] : ''}`;
    }
    // Plain UTC/GMT
    else if (match[13]) {
      result.timezone = match[13].toUpperCase();
      result.offset = 0;
    }

    return result;
  }

  // Convert time to target timezone
  function convertTime(parsed, targetOffset) {
    if (parsed.offset === null) return null;

    const diffHours = targetOffset - parsed.offset;
    let totalMinutes = parsed.hours * 60 + parsed.minutes + (diffHours * 60);

    let dayOffset = 0;
    while (totalMinutes < 0) {
      totalMinutes += 24 * 60;
      dayOffset--;
    }
    while (totalMinutes >= 24 * 60) {
      totalMinutes -= 24 * 60;
      dayOffset++;
    }

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: Math.round(totalMinutes % 60),
      seconds: parsed.seconds,
      dayOffset
    };
  }

  // Format time for display
  function formatTime(hours, minutes, use24Hour = false) {
    if (use24Hour) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
    if (dayOffset === 1) return ' (+1 day)';
    if (dayOffset === -1) return ' (-1 day)';
    return ` (${dayOffset > 0 ? '+' : ''}${dayOffset} days)`;
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

  // Walk through text nodes and find times
  function findTimesInNode(node, times) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      let match;
      TIME_PATTERN.lastIndex = 0;

      while ((match = TIME_PATTERN.exec(text)) !== null) {
        const parsed = parseMatch(match);
        if (parsed.offset !== null) {
          const targetOffset = getTargetOffset();
          const converted = convertTime(parsed, targetOffset);
          
          if (converted) {
            const convertedStr = formatTime(converted.hours, converted.minutes, settings.use24Hour) + 
                               ' ' + formatOffset(targetOffset) + 
                               getDayOffsetText(converted.dayOffset);
            
            times.push({
              id: `tz-${Date.now()}-${times.length}`,
              node: node,
              start: match.index,
              end: match.index + match[0].length,
              original: match[0],
              originalParsed: parsed,
              converted: convertedStr,
              convertedParsed: converted
            });
          }
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip script, style, and already processed elements
      const tagName = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe', 'textarea', 'input'].includes(tagName)) {
        return;
      }
      if (node.classList && node.classList.contains('tz-converter-highlight')) {
        return;
      }

      for (const child of node.childNodes) {
        findTimesInNode(child, times);
      }
    }
  }

  // Scan page for times
  function scanPage() {
    foundTimes = [];
    findTimesInNode(document.body, foundTimes);
    return foundTimes;
  }

  // Apply highlights to found times
  function applyHighlights() {
    if (!highlightEnabled) return;

    // Process in reverse order to maintain correct positions
    const sortedTimes = [...foundTimes].sort((a, b) => {
      if (a.node === b.node) {
        return b.start - a.start;
      }
      return 0;
    });

    // Group by node
    const nodeGroups = new Map();
    for (const time of sortedTimes) {
      if (!nodeGroups.has(time.node)) {
        nodeGroups.set(time.node, []);
      }
      nodeGroups.get(time.node).push(time);
    }

    // Process each node
    for (const [node, times] of nodeGroups) {
      if (!node || !node.parentNode) continue;

      // Sort times by position (descending) for this node
      times.sort((a, b) => b.start - a.start);

      for (const time of times) {
        try {
          // Re-check if node is still valid
          if (!time.node || !time.node.parentNode || !time.node.textContent) continue;
          
          const text = time.node.textContent;
          
          // Verify the time text is still at expected position
          const expectedText = text.substring(time.start, time.end);
          if (expectedText !== time.original) continue;
          
          const before = text.substring(0, time.start);
          const timeText = text.substring(time.start, time.end);
          const after = text.substring(time.end);

          const fragment = document.createDocumentFragment();
          
          if (before) {
            fragment.appendChild(document.createTextNode(before));
          }

          const highlight = document.createElement('span');
          highlight.className = 'tz-converter-highlight';
          highlight.dataset.tzOriginal = time.original;
          highlight.dataset.tzConverted = time.converted;
          highlight.dataset.tzId = time.id;
          highlight.textContent = timeText;
          highlight.title = `Click to see: ${time.converted}`;
          highlight.style.cssText = `
            background-color: ${settings.highlightColor};
            color: ${settings.highlightTextColor};
            padding: 1px 4px;
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s ease;
          `;
          
          fragment.appendChild(highlight);

          if (after) {
            fragment.appendChild(document.createTextNode(after));
          }

          time.node.parentNode.replaceChild(fragment, time.node);
        } catch (e) {
          // Silently ignore errors - node may have been modified
        }
      }
    }
  }

  // Remove all highlights
  function removeHighlights() {
    const highlights = document.querySelectorAll('.tz-converter-highlight');
    highlights.forEach(el => {
      const text = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(text, el);
    });
  }

  // Update highlight styles without removing them
  function updateHighlightStyles() {
    const highlights = document.querySelectorAll('.tz-converter-highlight');
    highlights.forEach(el => {
      el.style.backgroundColor = settings.highlightColor;
      el.style.color = settings.highlightTextColor;
    });
  }

  // Toggle highlight for a specific time
  function toggleTimeDisplay(element) {
    const original = element.dataset.tzOriginal;
    const converted = element.dataset.tzConverted;
    const isShowingConverted = element.dataset.tzShowConverted === 'true';

    if (isShowingConverted) {
      element.textContent = original;
      element.dataset.tzShowConverted = 'false';
      element.title = `Click to see: ${converted}`;
    } else {
      element.textContent = converted;
      element.dataset.tzShowConverted = 'true';
      element.title = `Click to see original: ${original}`;
    }
  }

  // Handle click on highlights
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('tz-converter-highlight')) {
      toggleTimeDisplay(e.target);
    }
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
        resolve(settings);
        return;
      }
      
      try {
        if (!isExtensionContextValid() || !chrome.storage?.sync) {
          resolve(settings);
          return;
        }
        
        chrome.storage.sync.get({
          targetTimezone: 'auto',
          targetOffset: null,
          use24Hour: false,
          highlightColor: '#ffeb3b',
          highlightTextColor: '#000000',
          highlightEnabled: true,
          showOriginal: true
        }, (items) => {
          // Check flag first (fastest)
          if (contextInvalidated) {
            resolve(settings);
            return;
          }
          try {
            // Check for chrome.runtime.lastError
            if (chrome.runtime?.lastError) {
              console.log('[TZ Converter] Error loading settings:', chrome.runtime.lastError);
              resolve(settings);
              return;
            }
            console.log('[TZ Converter] Loaded settings from storage:', items);
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

  // Send times to background script
  function notifyBackground(times) {
    if (contextInvalidated || !isExtensionContextValid()) return;
    
    try {
      chrome.runtime.sendMessage({
        type: 'TIMES_FOUND',
        data: {
          count: times.length,
          times: times.map(t => ({
            id: t.id,
            original: t.original,
            converted: t.converted,
            timezone: t.originalParsed.timezone
          }))
        }
      }).catch(() => {
        contextInvalidated = true;
      });
    } catch (e) {
      contextInvalidated = true;
    }
  }

  // Initialize
  async function init() {
    await loadSettings();
    
    // Initial scan
    const times = scanPage();
    
    if (times.length > 0) {
      notifyBackground(times);
      
      if (highlightEnabled) {
        applyHighlights();
      }
    }

    // Listen for messages from popup/background
    if (!contextInvalidated && isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          // Check if context is still valid before processing
          if (contextInvalidated) return;
          
          try {
            switch (message.type) {
              case 'GET_TIMES':
                sendResponse({ times: foundTimes.map(t => ({
                  id: t.id,
                  original: t.original,
                  converted: t.converted,
                  timezone: t.originalParsed.timezone
                }))});
                break;
                
              case 'RESCAN':
                removeHighlights();
                loadSettings().then(() => {
                  const newTimes = scanPage();
                  notifyBackground(newTimes);
                  if (highlightEnabled) {
                    applyHighlights();
                  }
                  sendResponse({ times: newTimes.length });
                });
                return true; // Async response
                
              case 'TOGGLE_HIGHLIGHTS':
                highlightEnabled = message.enabled;
                if (highlightEnabled) {
                  applyHighlights();
                } else {
                  removeHighlights();
                }
                sendResponse({ success: true });
                break;
                
              case 'SETTINGS_UPDATED':
                loadSettings().then(() => {
                  console.log('[TZ Converter] Settings updated:', settings.highlightColor, settings.highlightTextColor);
                  // Just update styles if highlights exist, otherwise rescan
                  const existingHighlights = document.querySelectorAll('.tz-converter-highlight');
                  console.log('[TZ Converter] Found highlights:', existingHighlights.length);
                  if (existingHighlights.length > 0) {
                    if (highlightEnabled) {
                      updateHighlightStyles();
                      console.log('[TZ Converter] Styles updated');
                    } else {
                      removeHighlights();
                    }
                  } else if (highlightEnabled) {
                    const newTimes = scanPage();
                    notifyBackground(newTimes);
                    applyHighlights();
                  }
                  sendResponse({ success: true });
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
                break;
            }
          } catch (e) {
            contextInvalidated = true;
          }
        });
      } catch (e) {
        contextInvalidated = true;
      }
    }

    // Observe DOM changes for dynamic content
    const observer = new MutationObserver((mutations) => {
      // Skip if context is invalidated
      if (contextInvalidated) return;
      
      let shouldRescan = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && 
                !node.classList?.contains('tz-converter-highlight')) {
              shouldRescan = true;
              break;
            }
          }
        }
        if (shouldRescan) break;
      }
      
      if (shouldRescan) {
        // Debounce rescan
        clearTimeout(window.tzConverterRescanTimeout);
        window.tzConverterRescanTimeout = setTimeout(() => {
          if (contextInvalidated) return;
          removeHighlights();
          const times = scanPage();
          notifyBackground(times);
          if (highlightEnabled) {
            applyHighlights();
          }
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
