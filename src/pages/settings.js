// Settings script
document.addEventListener('DOMContentLoaded', async () => {
  const versionNumber = document.getElementById('versionNumber');
  const timezoneSelect = document.getElementById('timezoneSelect');
  const manualTimezoneSelect = document.getElementById('manualTimezoneSelect');
  const timezoneModeRadios = document.querySelectorAll('input[name="timezoneMode"]');
  const use24Hour = document.getElementById('use24Hour');
  const autoConvertOnLoad = document.getElementById('autoConvertOnLoad');
  const displayMode = document.getElementById('displayMode');
  const resultIncludeUtcOffset = document.getElementById('resultIncludeUtcOffset');
  const resultIncludeDayOffset = document.getElementById('resultIncludeDayOffset');
  const resultIncludeSourceTz = document.getElementById('resultIncludeSourceTz');
  const showCountdown = document.getElementById('showCountdown');
  const enableDateDetection = document.getElementById('enableDateDetection');
  const enableNlpDetection = document.getElementById('enableNlpDetection');
  const enableContextTimezone = document.getElementById('enableContextTimezone');
  const scanMode = document.getElementById('scanMode');
  const maxConversions = document.getElementById('maxConversions');
  const highlightColor = document.getElementById('highlightColor');
  const highlightColorText = document.getElementById('highlightColorText');
  const highlightTextColor = document.getElementById('highlightTextColor');
  const highlightTextColorText = document.getElementById('highlightTextColorText');
  const highlightPreview = document.getElementById('highlightPreview');
  const highlightEnabled = document.getElementById('highlightEnabled');
  const highlightTextOnly = document.getElementById('highlightTextOnly');
  const convertedHighlightColor = document.getElementById('convertedHighlightColor');
  const convertedHighlightColorText = document.getElementById('convertedHighlightColorText');
  const convertedHighlightTextColor = document.getElementById('convertedHighlightTextColor');
  const convertedHighlightTextColorText = document.getElementById('convertedHighlightTextColorText');
  const newIgnoredSite = document.getElementById('newIgnoredSite');
  const addIgnoredSite = document.getElementById('addIgnoredSite');
  const ignoredSitesList = document.getElementById('ignoredSitesList');
  const preferredLanguage = document.getElementById('preferredLanguage');
  const detectedTimezone = document.getElementById('detectedTimezone');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');
  const toastMessage = toast.querySelector('.toast-message');

  // Inline Test Panel
  const inlineTestRunBtn = document.getElementById('inlineTestRunBtn');
  const inlineTestClearBtn = document.getElementById('inlineTestClearBtn');
  const inlineTestSurface = document.getElementById('inlineTestSurface');
  const inlineTestStatus = document.getElementById('inlineTestStatus');
  const inlineTestCount = document.getElementById('inlineTestCount');

  // Cache for loaded messages
  let messagesCache = null;

  function setLocalizedContent(el, message) {
    if (!el || !message) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = message;
      return;
    }

    // Some strings include basic markup like <strong>...</strong>.
    // Avoid innerHTML assignment: parse and whitelist only TEXT + STRONG tags.
    if (/<\s*strong\b/i.test(message)) {
      try {
        const parsed = new DOMParser().parseFromString(`<div>${message}</div>`, 'text/html');
        const container = parsed.body.firstElementChild;
        const nodes = [];
        for (const node of Array.from(container.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            nodes.push(document.createTextNode(node.nodeValue || ''));
          } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toLowerCase() === 'strong') {
            const strong = document.createElement('strong');
            strong.textContent = node.textContent || '';
            nodes.push(strong);
          } else {
            // Drop any other nodes for safety.
          }
        }
        el.replaceChildren(...nodes);
        return;
      } catch {
        // fall back to plain text
      }
    }

    el.textContent = message;
  }

  // Localization helper
  async function localizeUI() {
    const settings = await new Promise(r => chrome.storage.sync.get({ preferredLanguage: 'auto' }, r));
    const lang = settings.preferredLanguage;

    if (lang !== 'auto' && !messagesCache) {
      try {
        const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
        messagesCache = await response.json();
      } catch (e) {
        console.error('Failed to load locale:', lang, e);
      }
    }

    function getMsg(key, placeholders) {
      if (messagesCache && messagesCache[key]) {
        let msg = messagesCache[key].message;
        if (placeholders) {
          placeholders.forEach((p, i) => {
            msg = msg.replace(`$${i + 1}`, p);
          });
        }
        return msg;
      }
      return chrome.i18n.getMessage(key, placeholders);
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const message = getMsg(key);
      if (message) {
        setLocalizedContent(el, message);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const message = getMsg(key);
      if (message) {
        el.title = message;
      }
    });
  }

  // Load version
  if (versionNumber) {
    versionNumber.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  // Show status to user
  function showStatus(message, isError = false) {
    toastMessage.textContent = message;
    toast.className = `toast visible ${isError ? 'error' : ''}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 2500);
  }

  // Update preview (shows original-state colors only; converted state is in separate UI)
  function updatePreview() {
    if (!highlightPreview) return;
    if (highlightTextOnly.checked) {
      highlightPreview.style.backgroundColor = 'transparent';
      highlightPreview.style.color = highlightTextColor.value;
    } else {
      highlightPreview.style.backgroundColor = highlightColor.value;
      highlightPreview.style.color = highlightTextColor.value;
    }
  }

  // Load settings
  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get({
      targetTimezone: 'auto',
      targetOffset: null,
      use24Hour: false,
      autoConvertOnLoad: false,
      displayMode: 'toggle',
      resultIncludeUtcOffset: true,
      resultIncludeDayOffset: true,
      resultIncludeSourceTz: false,
      showCountdown: false,
      enableDateDetection: false,
      enableNlpDetection: false,
      enableContextTimezone: false,
      scanMode: 'auto',
      maxConversions: 25,
      highlightColor: '#ffeb3b',
      highlightTextColor: '#000000',
      highlightEnabled: true,
      highlightTextOnly: false,
      convertedHighlightColor: '#4CAF50',
      convertedHighlightTextColor: '#ffffff',
      ignoredSites: [],
      preferredLanguage: 'auto'
    }, resolve);
  });

  // Set UI values
  if (settings.targetTimezone === 'auto') {
    document.querySelector('input[name="timezoneMode"][value="auto"]').checked = true;
    manualTimezoneSelect.style.display = 'none';
  } else {
    document.querySelector('input[name="timezoneMode"][value="manual"]').checked = true;
    manualTimezoneSelect.style.display = 'block';
    timezoneSelect.value = settings.targetOffset;
  }

  use24Hour.checked = settings.use24Hour;
  autoConvertOnLoad.checked = settings.autoConvertOnLoad;
  displayMode.value = settings.displayMode;
  resultIncludeUtcOffset.checked = settings.resultIncludeUtcOffset;
  resultIncludeDayOffset.checked = settings.resultIncludeDayOffset;
  resultIncludeSourceTz.checked = settings.resultIncludeSourceTz;
  if (showCountdown) showCountdown.checked = settings.showCountdown === true;
  enableDateDetection.checked = settings.enableDateDetection;
  if (enableNlpDetection) enableNlpDetection.checked = settings.enableNlpDetection;
  if (enableContextTimezone) enableContextTimezone.checked = settings.enableContextTimezone;
  scanMode.value = settings.scanMode;
  maxConversions.value = settings.maxConversions;
  highlightColor.value = settings.highlightColor;
  highlightColorText.value = settings.highlightColor;
  highlightTextColor.value = settings.highlightTextColor;
  highlightTextColorText.value = settings.highlightTextColor;
  highlightEnabled.checked = settings.highlightEnabled;
  highlightTextOnly.checked = settings.highlightTextOnly;
  if (convertedHighlightColor) {
    convertedHighlightColor.value = settings.convertedHighlightColor || '#4CAF50';
    convertedHighlightColorText.value = settings.convertedHighlightColor || '#4CAF50';
  }
  if (convertedHighlightTextColor) {
    convertedHighlightTextColor.value = settings.convertedHighlightTextColor || '#ffffff';
    convertedHighlightTextColorText.value = settings.convertedHighlightTextColor || '#ffffff';
  }
  preferredLanguage.value = settings.preferredLanguage;

  updatePreview();

  // Handle detected timezone
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localOffset = -new Date().getTimezoneOffset() / 60;
  const sign = localOffset >= 0 ? '+' : '-';
  detectedTimezone.textContent = `${localTz} (UTC${sign}${Math.abs(localOffset)})`;

  // Render ignored sites
  function renderIgnoredSites(sites) {
    ignoredSitesList.replaceChildren();
    sites.forEach((site, index) => {
      const item = document.createElement('div');
      item.className = 'ignored-site-item';

      const urlSpan = document.createElement('span');
      urlSpan.className = 'site-url';
      urlSpan.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-site';
      removeBtn.dataset.index = String(index);
      removeBtn.type = 'button';
      removeBtn.textContent = chrome.i18n.getMessage('remove') || 'Remove';

      item.appendChild(urlSpan);
      item.appendChild(removeBtn);
      ignoredSitesList.appendChild(item);
    });

    ignoredSitesList.querySelectorAll('.remove-site').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const newSites = [...sites];
        newSites.splice(idx, 1);
        chrome.storage.sync.set({ ignoredSites: newSites }, () => {
          renderIgnoredSites(newSites);
          showStatus(chrome.i18n.getMessage('settingsSaved') || 'Settings saved');
        });
      });
    });
  }

  renderIgnoredSites(settings.ignoredSites);

  // Auto-save logic
  function saveSettings() {
    const isAuto = document.querySelector('input[name="timezoneMode"][value="auto"]').checked;
    const newSettings = {
      targetTimezone: isAuto ? 'auto' : 'manual',
      targetOffset: isAuto ? null : parseFloat(timezoneSelect.value),
      use24Hour: use24Hour.checked,
      autoConvertOnLoad: autoConvertOnLoad.checked,
      displayMode: displayMode.value,
      resultIncludeUtcOffset: resultIncludeUtcOffset.checked,
      resultIncludeDayOffset: resultIncludeDayOffset.checked,
      resultIncludeSourceTz: resultIncludeSourceTz.checked,
      showCountdown: showCountdown ? showCountdown.checked : false,
      enableDateDetection: enableDateDetection.checked,
      enableNlpDetection: enableNlpDetection ? enableNlpDetection.checked : false,
      enableContextTimezone: enableContextTimezone ? enableContextTimezone.checked : false,
      scanMode: scanMode.value,
      maxConversions: parseInt(maxConversions.value) || 0,
      highlightColor: highlightColor.value,
      highlightTextColor: highlightTextColor.value,
      highlightEnabled: highlightEnabled.checked,
      highlightTextOnly: highlightTextOnly.checked,
      convertedHighlightColor: convertedHighlightColor?.value || '#4CAF50',
      convertedHighlightTextColor: convertedHighlightTextColor?.value || '#ffffff',
      preferredLanguage: preferredLanguage.value
    };

    chrome.storage.sync.set(newSettings, () => {
      updatePreview();
      // Inform all tabs that settings changed
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          try {
            chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' });
          } catch (e) { }
        });
      });
    });
  }

  // Event Listeners for auto-save
  [use24Hour, autoConvertOnLoad, displayMode, resultIncludeUtcOffset,
    resultIncludeDayOffset, resultIncludeSourceTz, showCountdown, enableDateDetection,
    enableNlpDetection, enableContextTimezone, scanMode, maxConversions, highlightColor, highlightTextColor,
    highlightEnabled, highlightTextOnly, convertedHighlightColor, convertedHighlightTextColor, timezoneSelect, preferredLanguage].forEach(el => {
      if (!el) return;
      el.addEventListener('change', async () => {
        if (el === preferredLanguage) {
          messagesCache = null; // Clear cache to reload
          await localizeUI();
        }
        saveSettings();
      });
    });

  timezoneModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      manualTimezoneSelect.style.display = e.target.value === 'manual' ? 'block' : 'none';
      saveSettings();
    });
  });

  // Color inputs sync
  highlightColor.addEventListener('input', (e) => {
    highlightColorText.value = e.target.value;
    updatePreview();
  });
  highlightColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
      highlightColor.value = e.target.value;
      updatePreview();
      saveSettings();
    }
  });

  highlightTextColor.addEventListener('input', (e) => {
    highlightTextColorText.value = e.target.value;
    updatePreview();
  });
  highlightTextColorText.addEventListener('input', (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
      highlightTextColor.value = e.target.value;
      updatePreview();
      saveSettings();
    }
  });

  if (convertedHighlightColor) {
    convertedHighlightColor.addEventListener('input', (e) => {
      convertedHighlightColorText.value = e.target.value;
      saveSettings();
    });
    convertedHighlightColor.addEventListener('change', saveSettings);
  }
  if (convertedHighlightColorText) {
    convertedHighlightColorText.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        convertedHighlightColor.value = e.target.value;
        saveSettings();
      }
    });
  }
  if (convertedHighlightTextColor) {
    convertedHighlightTextColor.addEventListener('input', (e) => {
      convertedHighlightTextColorText.value = e.target.value;
      saveSettings();
    });
    convertedHighlightTextColor.addEventListener('change', saveSettings);
  }
  if (convertedHighlightTextColorText) {
    convertedHighlightTextColorText.addEventListener('input', (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        convertedHighlightTextColor.value = e.target.value;
        saveSettings();
      }
    });
  }

  // Presets (set both on-page and converted colors when data-converted-* present)
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      highlightColor.value = btn.dataset.bg;
      highlightColorText.value = btn.dataset.bg;
      highlightTextColor.value = btn.dataset.text;
      highlightTextColorText.value = btn.dataset.text;
      if (btn.dataset.convertedBg && convertedHighlightColor) {
        convertedHighlightColor.value = btn.dataset.convertedBg;
        convertedHighlightColorText.value = btn.dataset.convertedBg;
      }
      if (btn.dataset.convertedText && convertedHighlightTextColor) {
        convertedHighlightTextColor.value = btn.dataset.convertedText;
        convertedHighlightTextColorText.value = btn.dataset.convertedText;
      }
      updatePreview();
      saveSettings();
      showStatus(chrome.i18n.getMessage('settingsSaved') || 'Settings saved');
    });
  });

  // Ignored sites
  addIgnoredSite.addEventListener('click', () => {
    const site = newIgnoredSite.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (site) {
      chrome.storage.sync.get({ ignoredSites: [] }, (items) => {
        const sites = items.ignoredSites || [];
        if (!sites.includes(site)) {
          const newSites = [...sites, site];
          chrome.storage.sync.set({ ignoredSites: newSites }, () => {
            renderIgnoredSites(newSites);
            newIgnoredSite.value = '';
            showStatus(chrome.i18n.getMessage('settingsSaved') || 'Settings saved');
          });
        }
      });
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmReset') || 'Are you sure you want to restore defaults?')) {
      chrome.storage.sync.clear(() => {
        window.location.reload();
      });
    }
  });

  // Inline Test Panel logic - simplified version of content.js detection
  inlineTestRunBtn?.addEventListener('click', () => {
    inlineTestStatus.textContent = chrome.i18n.getMessage('scanning') || 'scanning...';
    inlineTestCount.textContent = '0';
    
    // Get colors from current settings
    const bgColor = highlightColor?.value || '#ffeb3b';
    const textColor = highlightTextColor?.value || '#000000';
    const isTextOnly = highlightTextOnly?.checked || false;
    
    // Clear previous highlights first
    const surface = inlineTestSurface;
    const existingHighlights = surface.querySelectorAll('.tz-converter-highlight');
    existingHighlights.forEach(h => {
      const parent = h.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(h.textContent), h);
      }
    });
    
    // Simple regex for testing
    const SIMPLE_PATTERN = /\b(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*[A-Z]{2,5}(?:\s*[+-]\d{1,4})?)\b/gi;
    
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    let foundCount = 0;
    
    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      if (!text || !/\d/.test(text)) return;
      
      const matches = [...text.matchAll(SIMPLE_PATTERN)];
      if (matches.length === 0) return;
      
      const parent = textNode.parentElement;
      if (!parent) return;
      
      // Skip if already highlighted
      if (parent.closest('.tz-converter-highlight')) return;
      
      // Create document fragment for replacement
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach(match => {
        const [fullMatch] = match;
        const start = match.index;
        const end = start + fullMatch.length;
        
        // Add text before match
        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, start)));
        }
        
        // Create highlight span with user's colors
        const highlight = document.createElement('span');
        highlight.className = 'tz-converter-highlight';
        
        if (isTextOnly) {
          highlight.style.cssText = `color: ${textColor}; padding: 2px 4px; cursor: pointer; font-weight: bold;`;
        } else {
          highlight.style.cssText = `background-color: ${bgColor}; color: ${textColor}; padding: 2px 4px; border-radius: 3px; cursor: pointer;`;
        }
        
        highlight.textContent = fullMatch;
        highlight.title = chrome.i18n.getMessage('detectedTime') || 'Detected time!';
        
        fragment.appendChild(highlight);
        lastIndex = end;
        foundCount++;
      });
      
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace text node with highlighted content
      parent.replaceChild(fragment, textNode);
    });
    
    inlineTestStatus.textContent = chrome.i18n.getMessage('done') || 'done';
    inlineTestCount.textContent = foundCount.toString();
  });

  // Clear test highlights
  inlineTestClearBtn?.addEventListener('click', () => {
    const surface = inlineTestSurface;
    const highlights = surface.querySelectorAll('.tz-converter-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      }
    });
    inlineTestStatus.textContent = 'idle';
    inlineTestCount.textContent = '0';
  });

  // Finalize
  localizeUI();
});
