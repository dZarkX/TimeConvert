// Simplified Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const timesList = document.getElementById('timesList');
  const timesCount = document.getElementById('timesCount');
  const emptyState = document.getElementById('emptyState');
  const emptyHint = document.getElementById('emptyHint');
  const timesStatus = document.getElementById('timesStatus');
  const highlightToggle = document.getElementById('highlightToggle');
  const ignoreBtn = document.getElementById('ignoreBtn');
  const ignoredPanel = document.getElementById('ignoredPanel');
  const currentDomainEl = document.getElementById('currentDomain');
  const ignoredToggleBtn = document.getElementById('ignoredToggleBtn');
  const ignoredList = document.getElementById('ignoredList');
  const rescanBtn = document.getElementById('rescanBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const supportBtn = document.getElementById('supportBtn');
  const kofiBtn = document.getElementById('kofiBtn');
  const githubBtn = document.getElementById('githubBtn');

  // Cache for loaded messages
  let messagesCache = null;

  const SUPPORT_URL = 'https://buymeacoffee.com/3mon';
  const KOFI_URL = 'https://ko-fi.com/3mon_';
  const GITHUB_URL = 'https://github.com/dZarkX/TimeConvert';

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
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = message;
        } else {
          el.textContent = message;
        }
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

  // Load settings
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { highlightEnabled: true, use24Hour: false, ignoredSites: [], preferredLanguage: 'auto' },
        resolve
      );
    });
  }

  const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  };

  const isRestrictedUrl = (url) => /^(?:chrome|brave|edge|about|chrome-extension):\/\//i.test(String(url || ""));

  const normalizeDomain = (input) => {
    const s = String(input || '').trim();
    if (!s) return '';
    return s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  };

  const getPreferredTab = async () => {
    const res = await sendRuntimeMessage({ type: 'GET_PREFERRED_TAB' });
    if (res?.tabId) return res;
    return { tabId: null, url: null };
  };

  const getTargetTab = async () => {
    const tab = await getActiveTab();
    const preferred = await getPreferredTab();
    const targetTabId = (tab?.id && tab.url && !isRestrictedUrl(tab.url)) ? tab.id : preferred.tabId;
    const targetUrl = (tab?.id && tab.url && !isRestrictedUrl(tab.url)) ? tab.url : preferred.url;
    return { targetTabId: targetTabId || null, targetUrl: targetUrl || null };
  };

  const setStatus = (text, kind = '') => {
    if (!timesStatus) return;
    const localized = chrome.i18n.getMessage(text) || text;
    timesStatus.textContent = localized;
    timesStatus.className = `times-status ${kind}`.trim();
  };

  const setEmptyHintText = (text) => {
    if (!emptyHint) return;
    const localized = chrome.i18n.getMessage(text) || text;
    emptyHint.textContent = localized;
    emptyHint.style.display = 'block';
  };

  // Send message to background
  const sendRuntimeMessage = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(res);
        });
      } catch {
        resolve(null);
      }
    });

  // Send message to content script
  const sendTabMessage = (tabId, msg, options) =>
    new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, msg, options || undefined, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(res);
        });
      } catch (e) {
        reject(e);
      }
    });

  // Inject content script if needed
  const injectContentScript = async (tabId) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["src/scripts/content.js"]
      });
      return true;
    } catch {
      return false;
    }
  };

  const loadIgnoredSites = async () => {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ ignoredSites: [] }, (items) => resolve(items.ignoredSites || []));
      } catch {
        resolve([]);
      }
    });
  };

  const saveIgnoredSites = async (sites) => {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ ignoredSites: sites }, () => resolve());
      } catch {
        resolve();
      }
    });
  };

  const notifyTargetTabSettingsUpdated = async () => {
    const { targetTabId, targetUrl } = await getTargetTab();
    if (!targetTabId || (targetUrl && isRestrictedUrl(targetUrl))) return;
    try {
      await sendTabMessage(targetTabId, { type: 'SETTINGS_UPDATED' });
    } catch {
      // If no content script yet, inject and retry once
      const ok = await injectContentScript(targetTabId);
      if (!ok) return;
      try {
        await sendTabMessage(targetTabId, { type: 'SETTINGS_UPDATED' });
      } catch {
        // ignore
      }
    }
  };

  function createSvgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function createRescanIcon(spinning) {
    const svg = createSvgEl('svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    if (spinning) svg.classList.add('spinning');

    const p1 = createSvgEl('path');
    p1.setAttribute('d', 'M23 4v6h-6');
    const p2 = createSvgEl('path');
    p2.setAttribute('d', 'M1 20v-6h6');
    const p3 = createSvgEl('path');
    p3.setAttribute('d', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15');

    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    return svg;
  }

  function renderIgnoredList(sites, currentDomain) {
    if (!ignoredPanel || !ignoredList || !ignoredToggleBtn || !currentDomainEl) return;

    currentDomainEl.textContent = currentDomain || '—';

    const normalizedSites = (sites || []).map(normalizeDomain).filter(Boolean);
    const uniq = Array.from(new Set(normalizedSites)).sort((a, b) => a.localeCompare(b));

    const isIgnored = currentDomain ? uniq.includes(currentDomain) : false;

    // Localization for toggle button
    ignoredToggleBtn.textContent = isIgnored ?
      (chrome.i18n.getMessage('unignore') || 'Unignore') :
      (chrome.i18n.getMessage('ignoreThisSite') || 'Ignore');

    ignoredToggleBtn.classList.toggle('active', isIgnored);

    ignoredList.replaceChildren();
    if (uniq.length === 0) {
      ignoredList.classList.remove('visible');
      return;
    }

    ignoredList.classList.add('visible');
    uniq.forEach((domain) => {
      const row = document.createElement('div');
      row.className = 'ignored-item';
      const removeText = chrome.i18n.getMessage('remove') || 'Remove';

      const domainSpan = document.createElement('span');
      domainSpan.className = 'domain';
      domainSpan.textContent = domain;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'remove';
      btn.dataset.domain = domain;
      btn.textContent = removeText;

      row.appendChild(domainSpan);
      row.appendChild(btn);
      ignoredList.appendChild(row);
    });

    ignoredList.querySelectorAll('.remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const domain = e.currentTarget?.dataset?.domain;
        if (!domain) return;
        const updated = uniq.filter((d) => d !== domain);
        await saveIgnoredSites(updated);
        renderIgnoredList(updated, currentDomain);
        await notifyTargetTabSettingsUpdated();
        await rescanPage();
      });
    });
  }

  async function getTimesFromPage() {
    const { targetTabId, targetUrl } = await getTargetTab();

    if (!targetTabId) return { ok: false, reason: 'no-tab', times: [] };
    if (targetUrl && isRestrictedUrl(targetUrl)) return { ok: false, reason: 'restricted', times: [] };

    try {
      const res = await sendTabMessage(targetTabId, { type: 'GET_TIMES' });
      const times = res?.times || [];
      return { ok: true, reason: 'page', times };
    } catch {
      const ok = await injectContentScript(targetTabId);
      if (!ok) return { ok: false, reason: 'no-content', times: [] };
      try {
        const res = await sendTabMessage(targetTabId, { type: 'GET_TIMES' });
        const times = res?.times || [];
        return { ok: true, reason: 'injected', times };
      } catch {
        return { ok: false, reason: 'no-response', times: [] };
      }
    }
  }

  async function getTimesFromBackground() {
    const { targetTabId } = await getTargetTab();
    if (!targetTabId) return [];
    const data = await sendRuntimeMessage({ type: 'GET_TAB_DATA', tabId: targetTabId });
    return data?.times || [];
  }

  async function getTimesForPopupList() {
    return await getTimesFromBackground();
  }

  async function toggleHighlights(enabled) {
    const tab = await getActiveTab();
    if (tab?.id && tab.url && !isRestrictedUrl(tab.url)) {
      try {
        await sendTabMessage(tab.id, { type: 'TOGGLE_HIGHLIGHTS', enabled });
      } catch {
        const ok = await injectContentScript(tab.id);
        if (ok) {
          try {
            await sendTabMessage(tab.id, { type: 'TOGGLE_HIGHLIGHTS', enabled });
          } catch { }
        }
      }
    }
    chrome.storage.sync.set({ highlightEnabled: enabled });
  }

  async function rescanPage() {
    rescanBtn.disabled = true;
    rescanBtn.replaceChildren(createRescanIcon(true));

    try {
      const { targetTabId, targetUrl } = await getTargetTab();
      if (targetTabId && (!targetUrl || !isRestrictedUrl(targetUrl))) {
        try {
          await sendTabMessage(targetTabId, { type: 'RESCAN' });
        } catch {
          const ok = await injectContentScript(targetTabId);
          if (ok) {
            try {
              await sendTabMessage(targetTabId, { type: 'RESCAN' });
            } catch { }
          }
        }

        await new Promise((r) => setTimeout(r, 250));
        const list = await getTimesForPopupList();
        renderTimes(list);
        setStatus('connected', 'ok');
      }
    } catch { }

    rescanBtn.disabled = false;
    rescanBtn.replaceChildren(createRescanIcon(false));
  }

  function escapeHtml(text) {
    const s = String(text ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTimes(times) {
    const existingItems = timesList.querySelectorAll('.time-item');
    existingItems.forEach(item => item.remove());

    timesCount.textContent = times.length;

    if (times.length === 0) {
      emptyState.style.display = 'flex';
      if (emptyHint) emptyHint.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    if (emptyHint) emptyHint.style.display = 'none';

    times.forEach((time) => {
      const item = document.createElement('div');
      item.className = 'time-item';

      const convertedEl = document.createElement('div');
      convertedEl.className = 'time-converted';
      convertedEl.textContent = String(time.converted ?? '');

      const originalEl = document.createElement('div');
      originalEl.className = 'time-original';
      originalEl.textContent = String(time.original ?? '');

      item.appendChild(convertedEl);
      item.appendChild(originalEl);

      item.addEventListener('click', async () => {
        const { targetTabId } = await getTargetTab();
        if (!targetTabId) return;

        const frameId = typeof time.frameId === 'number' ? time.frameId : undefined;
        try {
          await sendTabMessage(
            targetTabId,
            { type: 'SCROLL_TO_TIME', timeId: time.id },
            frameId !== undefined ? { frameId } : undefined
          );
        } catch {
          // ignore
        }
      });

      timesList.appendChild(item);
    });
  }

  // Initialize
  localizeUI();
  const settings = await loadSettings();
  highlightToggle.checked = settings.highlightEnabled;

  const { targetUrl } = await getTargetTab();
  const currentDomain = normalizeDomain(targetUrl);
  const ignoredSites = await loadIgnoredSites();
  renderIgnoredList(ignoredSites, currentDomain);

  ignoreBtn?.addEventListener('click', () => {
    ignoredToggleBtn?.click();
  });

  ignoredToggleBtn?.addEventListener('click', async () => {
    const sites = await loadIgnoredSites();
    const uniq = Array.from(new Set((sites || []).map(normalizeDomain).filter(Boolean)));
    if (!currentDomain) return;

    const isIgnored = uniq.includes(currentDomain);
    const updated = isIgnored ? uniq.filter((d) => d !== currentDomain) : [...uniq, currentDomain];
    await saveIgnoredSites(updated);
    renderIgnoredList(updated, currentDomain);
    await notifyTargetTabSettingsUpdated();
    await rescanPage();
  });

  setStatus('checking');
  const result = await getTimesFromPage();
  const list = await getTimesForPopupList();
  renderTimes(list);

  if (result.ok) {
    setStatus('connected', 'ok');
    if (list.length === 0) {
      setEmptyHintText('emptyHint');
    }
  } else {
    if (list.length) {
      setStatus('connected', 'ok'); // Best effort
      setEmptyHintText('emptyHint');
    } else {
      if (result.reason === 'no-tab') {
        setStatus('notConnected', 'err');
      } else if (result.reason === 'restricted') {
        setStatus('restricted', 'err');
        setEmptyHintText('emptyHint');
        rescanBtn.disabled = true;
      } else {
        setStatus('notConnected', 'err');
        setEmptyHintText('emptyHint');
      }
    }
  }

  highlightToggle.addEventListener('change', (e) => {
    toggleHighlights(e.target.checked);
  });

  rescanBtn.addEventListener('click', rescanPage);
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  supportBtn?.addEventListener('click', () => {
    chrome.tabs.create({ url: SUPPORT_URL });
  });

  kofiBtn?.addEventListener('click', () => {
    chrome.tabs.create({ url: KOFI_URL });
  });

  githubBtn?.addEventListener('click', () => {
    chrome.tabs.create({ url: GITHUB_URL });
  });
});
