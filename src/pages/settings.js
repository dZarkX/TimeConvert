// Settings page script
document.addEventListener('DOMContentLoaded', async () => {
  const DEBUG = false;

  // Elements
  const timezoneModeRadios = document.querySelectorAll('input[name="timezoneMode"]');
  const manualTimezoneSelect = document.getElementById('manualTimezoneSelect');
  const timezoneSelect = document.getElementById('timezoneSelect');
  const use24Hour = document.getElementById('use24Hour');
  const autoConvertOnLoad = document.getElementById('autoConvertOnLoad');
  const displayMode = document.getElementById('displayMode');
  const resultIncludeUtcOffset = document.getElementById('resultIncludeUtcOffset');
  const resultIncludeDayOffset = document.getElementById('resultIncludeDayOffset');
  const resultIncludeSourceTz = document.getElementById('resultIncludeSourceTz');
  const enableDateDetection = document.getElementById('enableDateDetection');
  const scanMode = document.getElementById('scanMode');
  const maxConversions = document.getElementById('maxConversions');
  const highlightColor = document.getElementById('highlightColor');
  const highlightColorText = document.getElementById('highlightColorText');
  const highlightTextColor = document.getElementById('highlightTextColor');
  const highlightTextColorText = document.getElementById('highlightTextColorText');
  const highlightEnabled = document.getElementById('highlightEnabled');
  const highlightTextOnly = document.getElementById('highlightTextOnly');
  const highlightPreview = document.getElementById('highlightPreview');
  const detectedTimezone = document.getElementById('detectedTimezone');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');
  const newIgnoredSite = document.getElementById('newIgnoredSite');
  const addIgnoredSite = document.getElementById('addIgnoredSite');
  const ignoredSitesList = document.getElementById('ignoredSitesList');

  // Inline test panel elements
  const inlineTestSurface = document.getElementById('inlineTestSurface');
  const inlineTestRunBtn = document.getElementById('inlineTestRunBtn');
  const inlineTestClearBtn = document.getElementById('inlineTestClearBtn');
  const inlineTestStatus = document.getElementById('inlineTestStatus');
  const inlineTestCount = document.getElementById('inlineTestCount');

  // Default settings
  const defaultSettings = {
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
    highlightEnabled: true,
    highlightTextOnly: false,
    maxConversions: 25,
    ignoredSites: []
  };

  // Show detected timezone
  function showDetectedTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '';
    detectedTimezone.textContent = `${tz} (UTC${sign}${offset})`;
  }

  // Autosave (debounced)
  let autosaveTimer = null;
  const scheduleAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        const settings = getSettingsFromUI();
        await saveSettings(settings);
        await notifyContentScripts();
        showToast('Saved');
      } catch {
        showToast('Could not save settings', 'error');
      }
    }, 350);
  };

  // Load settings from storage
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(defaultSettings, (items) => {
        resolve(items);
      });
    });
  }

  // Save settings to storage
  async function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, () => {
        resolve();
      });
    });
  }

  // Update preview
  function updatePreview() {
    const textOnly = !!highlightTextOnly?.checked;
    highlightPreview.style.backgroundColor = textOnly ? 'transparent' : highlightColor.value;
    highlightPreview.style.color = highlightTextColor.value;
  }

  // Show toast notification
  function showToast(message, type = 'success') {
    const toastMessage = toast.querySelector('.toast-message');
    toastMessage.textContent = message;
    toast.className = `toast ${type} visible`;
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }

  // Apply settings to UI
  function applySettingsToUI(settings) {
    // Timezone mode
    const mode = settings.targetTimezone === 'auto' ? 'auto' : 'manual';
    document.querySelector(`input[name="timezoneMode"][value="${mode}"]`).checked = true;
    manualTimezoneSelect.style.display = mode === 'manual' ? 'block' : 'none';
    
    if (settings.targetOffset !== null) {
      timezoneSelect.value = settings.targetOffset.toString();
    }
    
    // Time format
    use24Hour.checked = settings.use24Hour;

    // Auto conversion
    autoConvertOnLoad.checked = !!settings.autoConvertOnLoad;

    // Display mode
    if (displayMode) displayMode.value = settings.displayMode || 'toggle';

    // Result format
    if (resultIncludeUtcOffset) resultIncludeUtcOffset.checked = settings.resultIncludeUtcOffset !== false;
    if (resultIncludeDayOffset) resultIncludeDayOffset.checked = settings.resultIncludeDayOffset !== false;
    if (resultIncludeSourceTz) resultIncludeSourceTz.checked = !!settings.resultIncludeSourceTz;

    // Date detection
    if (enableDateDetection) enableDateDetection.checked = !!settings.enableDateDetection;

    // Scan mode
    if (scanMode) scanMode.value = settings.scanMode || 'auto';
    
    // Performance settings
    maxConversions.value = settings.maxConversions || 25;
    
    // Colors
    highlightColor.value = settings.highlightColor;
    highlightColorText.value = settings.highlightColor;
    highlightTextColor.value = settings.highlightTextColor;
    highlightTextColorText.value = settings.highlightTextColor;
    
    // Highlight enabled
    highlightEnabled.checked = settings.highlightEnabled;

    // Highlight style
    highlightTextOnly.checked = !!settings.highlightTextOnly;
    
    // Ignored sites
    renderIgnoredSites(settings.ignoredSites || []);
    
    // Update preview
    updatePreview();
  }

  // Get settings from UI
  function getSettingsFromUI() {
    const mode = document.querySelector('input[name="timezoneMode"]:checked').value;
    
    return {
      targetTimezone: mode,
      targetOffset: mode === 'manual' ? parseFloat(timezoneSelect.value) : null,
      use24Hour: use24Hour.checked,
      autoConvertOnLoad: autoConvertOnLoad.checked,
      displayMode: displayMode ? displayMode.value : 'toggle',
      resultIncludeUtcOffset: !!resultIncludeUtcOffset?.checked,
      resultIncludeDayOffset: !!resultIncludeDayOffset?.checked,
      resultIncludeSourceTz: !!resultIncludeSourceTz?.checked,
      enableDateDetection: !!enableDateDetection?.checked,
      scanMode: scanMode ? scanMode.value : 'auto',
      maxConversions: parseInt(maxConversions.value) || 25,
      highlightColor: highlightColor.value,
      highlightTextColor: highlightTextColor.value,
      highlightEnabled: highlightEnabled.checked,
      highlightTextOnly: highlightTextOnly.checked,
      ignoredSites: getIgnoredSitesFromUI()
    };
  }

  // Get ignored sites from UI
  function getIgnoredSitesFromUI() {
    const siteItems = ignoredSitesList.querySelectorAll('.ignored-site-item');
    const sites = [];
    siteItems.forEach(item => {
      const domain = item.querySelector('.site-domain').textContent;
      sites.push(domain);
    });
    return sites;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Render ignored sites list
  function renderIgnoredSites(sites) {
    ignoredSitesList.innerHTML = '';
    
    if (sites.length === 0) {
      ignoredSitesList.innerHTML = '<div class="empty-sites">No ignored sites</div>';
      return;
    }
    
    sites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'ignored-site-item';
      const escapedSite = escapeHtml(site);
      // Use original site for data attribute (safe as it's from our own data)
      // but escape HTML for display
      item.innerHTML = `
        <span class="site-domain">${escapedSite}</span>
        <button class="remove-btn" data-site="${site.replace(/"/g, '&quot;')}">Remove</button>
      `;
      ignoredSitesList.appendChild(item);
    });
    
    // Add remove event listeners
    ignoredSitesList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const site = e.target.dataset.site;
        removeIgnoredSite(site);
      });
    });
  }

  // Add ignored site
  function handleAddIgnoredSite() {
    const site = newIgnoredSite.value.trim();
    if (!site) {
      showToast('Please enter a domain name', 'error');
      return;
    }
    
    // Clean up domain format
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    if (!cleanSite) {
      showToast('Invalid domain name', 'error');
      return;
    }
    
    const currentSites = getIgnoredSitesFromUI();
    if (currentSites.includes(cleanSite)) {
      showToast('Site already ignored', 'error');
      return;
    }
    
    currentSites.push(cleanSite);
    renderIgnoredSites(currentSites);
    newIgnoredSite.value = '';
    showToast(`Added ${cleanSite} to ignored sites`);
    scheduleAutosave();
  }

  // Remove ignored site
  function removeIgnoredSite(site) {
    const currentSites = getIgnoredSitesFromUI();
    const filteredSites = currentSites.filter(s => s !== site);
    renderIgnoredSites(filteredSites);
    showToast(`Removed ${site} from ignored sites`);
    scheduleAutosave();
  }

  // Notify content scripts of settings change
  async function notifyContentScripts() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' });
      } catch (e) {
        // Tab might not have content script
      }
    }
  }

  // Event listeners
  timezoneModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      manualTimezoneSelect.style.display = e.target.value === 'manual' ? 'block' : 'none';
    });
  });

  // ------------------------------
  // Inline test panel highlighter
  // ------------------------------
  const TIME_SEP = "[:.\\u2024\\u00B7]"; // : . ․ ·
  const WS = "[\\s\\u00A0\\u202F]";
  const AMPM = "(?:[AaPp]\\.?\\s*[Mm]\\.?)";

  // Minimal timezone list for inline demo detection (mirrors content.js)
  const TIMEZONE_DATA = {
    'UTC': 0, 'GMT': 0,
    'CET': 1, 'CEST': 2, 'WET': 0, 'WEST': 1, 'EET': 2, 'EEST': 3, 'BST': 1, 'MSK': 3,
    'EST': -5, 'EDT': -4, 'ET': -5,
    'CST': -6, 'CDT': -5, 'CT': -6,
    'MST': -7, 'MDT': -6, 'MT': -7,
    'PST': -8, 'PDT': -7, 'PT': -8,
    'AKST': -9, 'AKDT': -8, 'HST': -10,
    'JST': 9, 'KST': 9, 'HKT': 8, 'SGT': 8, 'ICT': 7, 'PHT': 8,
    'AEST': 10, 'AEDT': 11, 'ACST': 9.5, 'ACDT': 10.5, 'AWST': 8, 'NZST': 12, 'NZDT': 13,
    'BRT': -3, 'ART': -3, 'CLT': -4, 'CLST': -3,
    'CAT': 2, 'EAT': 3, 'WAT': 1, 'SAST': 2,
    'AST': 3, 'GST': 4, 'TRT': 3
  };

  const TZ_ABBREVS = Object.keys(TIMEZONE_DATA)
    .filter(k => k !== 'UTC' && k !== 'GMT')
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const TZ_PART = `(?:(?:UTC|GMT)(?:${WS}*[+-]${WS}*\\d{1,2}(?:(?::?\\d{2}))?)?|${TZ_ABBREVS})`;

  const INLINE_TIME_PATTERN = new RegExp(
    [
      "\\b(?:",
      `(?<h12>1[0-2]|0?[1-9])(?:${TIME_SEP}(?<m12>[0-5]\\d))?(?:${TIME_SEP}(?<s12>[0-5]\\d))?${WS}*(?<ampm>${AMPM})`,
      "|",
      `(?<h24>[01]?\\d|2[0-3])(?:${TIME_SEP}(?<m24>[0-5]\\d))?(?:${TIME_SEP}(?<s24>[0-5]\\d))?`,
      ")",
      `${WS}*`,
      `(?<tz>${TZ_PART})`,
      "\\b"
    ].join(""),
    "gi"
  );

  function getLocalOffset() {
    return -new Date().getTimezoneOffset() / 60;
  }

  function getTargetOffsetFromUI() {
    const mode = document.querySelector('input[name="timezoneMode"]:checked')?.value || 'auto';
    if (mode === 'manual') return parseFloat(timezoneSelect.value);
    return getLocalOffset();
  }

  function formatOffset(offset) {
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  function getDayOffsetText(dayOffset) {
    if (dayOffset === 0) return '';
    if (dayOffset === 1) return ' (+1 day)';
    if (dayOffset === -1) return ' (-1 day)';
    return ` (${dayOffset > 0 ? '+' : ''}${dayOffset} days)`;
  }

  function convertTime(parsed, targetOffset) {
    if (parsed.offset === null) return null;
    const diffMinutes = Math.round((targetOffset - parsed.offset) * 60);
    const totalMinutes = (parsed.hours * 60) + parsed.minutes + diffMinutes;
    const dayOffset = Math.floor(totalMinutes / 1440);
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    return { hours: Math.floor(normalized / 60), minutes: normalized % 60, dayOffset };
  }

  function formatTime(hours, minutes, use24Hour) {
    if (use24Hour) return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  }

  function parseMatch(match) {
    const g = match.groups || {};
    const result = { hours: 0, minutes: 0, seconds: 0, timezone: null, offset: null };

    const tzRaw = (g.tz || "").trim();
    if (!tzRaw) return result;

    const tzUpper = tzRaw.toUpperCase().replace(/\s+/g, "");
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
      return result;
    }

    if (g.h12) {
      let hours = parseInt(g.h12, 10);
      const minutes = g.m12 ? parseInt(g.m12, 10) : 0;
      const isPM = /p/i.test(g.ampm || "");
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      result.hours = hours;
      result.minutes = minutes;
      return result;
    }

    if (g.h24) {
      result.hours = parseInt(g.h24, 10);
      result.minutes = g.m24 ? parseInt(g.m24, 10) : 0;
      return result;
    }

    return result;
  }

  function setInlineTestStatus(statusText, count) {
    if (inlineTestStatus) inlineTestStatus.textContent = statusText;
    if (inlineTestCount) inlineTestCount.textContent = String(count ?? 0);
  }

  function resetInlineTestSurface() {
    if (!inlineTestSurface) return;
    const original = inlineTestSurface.dataset.originalHtml;
    if (original) {
      inlineTestSurface.innerHTML = original;
      setInlineTestStatus('reset', 0);
    }
  }

  function highlightInlineTestSurface() {
    if (!inlineTestSurface) return;

    // Store original content once
    if (!inlineTestSurface.dataset.originalHtml) {
      inlineTestSurface.dataset.originalHtml = inlineTestSurface.innerHTML;
    } else {
      // Always start from clean base to avoid nesting highlights
      inlineTestSurface.innerHTML = inlineTestSurface.dataset.originalHtml;
    }

    const use24 = !!use24Hour?.checked;
    const bg = highlightColor?.value || '#ffeb3b';
    const fg = highlightTextColor?.value || '#000000';
    const textOnly = !!highlightTextOnly?.checked;
    const targetOffset = getTargetOffsetFromUI();

    let count = 0;

    const walker = document.createTreeWalker(
      inlineTestSurface,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.nodeValue;
          if (!text || text.length < 4) return NodeFilter.FILTER_REJECT;
          if (!/\d/.test(text)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName?.toLowerCase?.() || '';
          if (['script', 'style', 'noscript', 'textarea', 'input', 'select', 'option'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.tz-converter-highlight')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

    for (const node of nodesToProcess) {
      const text = node.nodeValue || '';
      INLINE_TIME_PATTERN.lastIndex = 0;
      let match;
      const matches = [];

      while ((match = INLINE_TIME_PATTERN.exec(text)) !== null) {
        const parsed = parseMatch(match);
        if (parsed.offset === null) continue;
        matches.push({ index: match.index, len: match[0].length, raw: match[0], parsed });
      }

      if (matches.length === 0) continue;

      const parent = node.parentNode;
      if (!parent) continue;

      const frag = document.createDocumentFragment();
      let last = 0;

      for (const m of matches) {
        const start = m.index;
        const end = m.index + m.len;
        if (start < last) continue;

        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));

        const span = document.createElement('span');
        span.className = 'tz-converter-highlight';
        span.style.setProperty('background-color', textOnly ? 'transparent' : bg, 'important');
        span.style.setProperty('color', fg, 'important');
        span.textContent = text.slice(start, end);

        const converted = convertTime(m.parsed, targetOffset);
        if (converted) {
          const convertedStr = `${formatTime(converted.hours, converted.minutes, use24)} ${formatOffset(targetOffset)}${getDayOffsetText(converted.dayOffset)}`;
          span.title = `${m.raw} → ${convertedStr}`;
          span.dataset.tzOriginal = m.raw;
          span.dataset.tzConverted = convertedStr;
          span.dataset.tzShowConverted = 'false';
        }

        frag.appendChild(span);
        last = end;
        count++;
      }

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      parent.replaceChild(frag, node);
    }

    setInlineTestStatus('highlighted', count);
  }

  // Add ignored site
  addIgnoredSite.addEventListener('click', handleAddIgnoredSite);
  
  // Enter key for adding site
  newIgnoredSite.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddIgnoredSite();
    }
  });

  // Color input sync
  highlightColor.addEventListener('input', () => {
    highlightColorText.value = highlightColor.value;
    updatePreview();
    // Live-update inline demo styles if already highlighted
    if (inlineTestSurface?.querySelector('.tz-converter-highlight')) highlightInlineTestSurface();
    scheduleAutosave();
  });

  highlightColorText.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(highlightColorText.value)) {
      highlightColor.value = highlightColorText.value;
      updatePreview();
      scheduleAutosave();
    }
  });

  highlightTextColor.addEventListener('input', () => {
    highlightTextColorText.value = highlightTextColor.value;
    updatePreview();
    // Live-update inline demo styles if already highlighted
    if (inlineTestSurface?.querySelector('.tz-converter-highlight')) highlightInlineTestSurface();
    scheduleAutosave();
  });

  highlightTextColorText.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(highlightTextColorText.value)) {
      highlightTextColor.value = highlightTextColorText.value;
      updatePreview();
      scheduleAutosave();
    }
  });

  highlightTextOnly.addEventListener('change', () => {
    updatePreview();
    if (inlineTestSurface?.querySelector('.tz-converter-highlight')) highlightInlineTestSurface();
    scheduleAutosave();
  });

  // Color presets
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const bg = btn.dataset.bg;
      const text = btn.dataset.text;
      
      highlightColor.value = bg;
      highlightColorText.value = bg;
      highlightTextColor.value = text;
      highlightTextColorText.value = text;
      
      updatePreview();
      if (inlineTestSurface?.querySelector('.tz-converter-highlight')) highlightInlineTestSurface();
      scheduleAutosave();
    });
  });

  // Autosave for general inputs (checkbox/select/radio/number)
  const autosaveElements = [
    ...timezoneModeRadios,
    timezoneSelect,
    use24Hour,
    autoConvertOnLoad,
    displayMode,
    resultIncludeUtcOffset,
    resultIncludeDayOffset,
    resultIncludeSourceTz,
    enableDateDetection,
    scanMode,
    maxConversions,
    highlightEnabled
  ].filter(Boolean);

  autosaveElements.forEach((el) => {
    el.addEventListener('change', () => {
      // Keep UI in sync
      if (el === timezoneSelect || (el?.name === 'timezoneMode')) {
        const mode = document.querySelector('input[name="timezoneMode"]:checked')?.value;
        manualTimezoneSelect.style.display = mode === 'manual' ? 'block' : 'none';
      }
      updatePreview();
      scheduleAutosave();
    });

    // Inputs like number should also autosave on input
    if (el?.tagName === 'INPUT' && el.type === 'number') {
      el.addEventListener('input', scheduleAutosave);
    }
  });

  // Inline test panel buttons
  if (inlineTestSurface) {
    // Capture initial content so Reset works even if user never clicked Highlight
    inlineTestSurface.dataset.originalHtml = inlineTestSurface.innerHTML;
    setInlineTestStatus('idle', 0);
  }

  inlineTestRunBtn?.addEventListener('click', () => {
    try {
      highlightInlineTestSurface();
    } catch (e) {
      setInlineTestStatus('error', 0);
      if (DEBUG) console.error('[Inline Test] highlight error:', e);
    }
  });

  inlineTestClearBtn?.addEventListener('click', () => {
    try {
      resetInlineTestSurface();
    } catch (e) {
      setInlineTestStatus('error', 0);
      if (DEBUG) console.error('[Inline Test] reset error:', e);
    }
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await saveSettings(defaultSettings);
      applySettingsToUI(defaultSettings);
      await notifyContentScripts();
      showToast('Settings reset to defaults');
    }
  });

  // Initialize
  showDetectedTimezone();
  const settings = await loadSettings();
  applySettingsToUI(settings);
  
  // Show version from manifest
  const versionEl = document.getElementById('versionNumber');
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = 'v' + manifest.version;
  }
});
