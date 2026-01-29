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

  const SUPPORT_URL = 'https://buymeacoffee.com/3mon';
  const KOFI_URL = 'https://ko-fi.com/3mon_';
  const GITHUB_URL = 'https://github.com/dZarkX/TimeConvert';

  // Load settings
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { highlightEnabled: true, use24Hour: false, ignoredSites: [] },
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
    timesStatus.textContent = text;
    timesStatus.className = `times-status ${kind}`.trim();
  };

  const setEmptyHintText = (text) => {
    if (!emptyHint) return;
    emptyHint.textContent = text;
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
        // chrome.tabs.sendMessage(tabId, message, options?, callback)
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

  function renderIgnoredList(sites, currentDomain) {
    if (!ignoredPanel || !ignoredList || !ignoredToggleBtn || !currentDomainEl) return;

    currentDomainEl.textContent = currentDomain || '—';

    const normalizedSites = (sites || []).map(normalizeDomain).filter(Boolean);
    const uniq = Array.from(new Set(normalizedSites)).sort((a, b) => a.localeCompare(b));

    const isIgnored = currentDomain ? uniq.includes(currentDomain) : false;
    ignoredToggleBtn.textContent = isIgnored ? 'Unignore' : 'Ignore';
    ignoredToggleBtn.classList.toggle('active', isIgnored);

    ignoredList.innerHTML = '';
    if (uniq.length === 0) {
      ignoredList.classList.remove('visible');
      return;
    }

    ignoredList.classList.add('visible');
    uniq.forEach((domain) => {
      const row = document.createElement('div');
      row.className = 'ignored-item';
      row.innerHTML = `
        <span class="domain">${domain}</span>
        <button type="button" class="remove" data-domain="${domain}">Remove</button>
      `;
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

    // Ask the content script directly (top-frame) - used mainly as a "connected" signal.
    try {
      const res = await sendTabMessage(targetTabId, { type: 'GET_TIMES' });
      const times = res?.times || [];
      return { ok: true, reason: 'page', times };
    } catch {
      // Try injecting and retrying once
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

  // Fallback: get last-known data from background (badge pipeline)
  async function getTimesFromBackground() {
    const { targetTabId } = await getTargetTab();
    if (!targetTabId) return [];
    const data = await sendRuntimeMessage({ type: 'GET_TAB_DATA', tabId: targetTabId });
    return data?.times || [];
  }

  // Primary source of truth for the popup list:
  // background merges TIMES_FOUND from all frames, while GET_TIMES is frame-local.
  async function getTimesForPopupList() {
    return await getTimesFromBackground();
  }

  // Toggle highlights
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
          } catch {}
        }
      }
    }
    chrome.storage.sync.set({ highlightEnabled: enabled });
  }

  // Rescan page
  async function rescanPage() {
    rescanBtn.disabled = true;
    rescanBtn.innerHTML = '<svg class="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';

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
            } catch {}
          }
        }

        // Wait briefly for scan to complete then pull merged results from background
        await new Promise((r) => setTimeout(r, 250));
        const list = await getTimesForPopupList();
        renderTimes(list);
        setStatus('connected', 'ok');
      }
    } catch {}

    rescanBtn.disabled = false;
    rescanBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Render times list
  function renderTimes(times) {
    // Always clear existing items first, otherwise a later "0 results" render
    // would show "No times found" while old items remain visible.
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
      item.innerHTML = `
        <div class="time-converted">${escapeHtml(time.converted)}</div>
        <div class="time-original">${escapeHtml(time.original)}</div>
      `;
      
      item.addEventListener('click', async () => {
        const { targetTabId } = await getTargetTab();
        if (!targetTabId) return;

        // If time came from a subframe, target it explicitly.
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
  const settings = await loadSettings();
  highlightToggle.checked = settings.highlightEnabled;

  // Ignored sites UI
  const { targetUrl } = await getTargetTab();
  const currentDomain = normalizeDomain(targetUrl);
  const ignoredSites = await loadIgnoredSites();
  renderIgnoredList(ignoredSites, currentDomain);

  ignoreBtn?.addEventListener('click', () => {
    // Small UX: clicking the icon focuses the same toggle action
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

  // Prefer direct-from-page data (strongest signal extension is working)
  setStatus('checking…');
  const result = await getTimesFromPage();
  const list = await getTimesForPopupList();
  renderTimes(list);

  if (result.ok) {
    setStatus(result.reason === 'injected' ? 'connected (injected)' : 'connected', 'ok');
    if (list.length === 0) {
      setEmptyHintText('No times detected on this page. Try pages with “8PM CET” or press Rescan.');
    }
  } else {
    // If we couldn't talk to the page, show fallback from background (best-effort)
    if (list.length) {
      setStatus('fallback (background)', 'warn');
      setEmptyHintText('Showing last known results from the background. Press Rescan to refresh.');
    } else {
      if (result.reason === 'no-tab') {
        setStatus('no target tab', 'err');
        setEmptyHintText('Open a webpage tab and reopen the popup.');
      } else if (result.reason === 'restricted') {
        setStatus('restricted page', 'err');
        setEmptyHintText('This page is restricted by Chrome (e.g. chrome://). Open a normal website to use the extension.');
        rescanBtn.disabled = true;
      } else if (result.reason === 'no-content') {
        setStatus('not connected', 'err');
        setEmptyHintText('Could not connect to the page. Try reloading the page, then press Rescan.');
      } else {
        setStatus('not connected', 'err');
        setEmptyHintText('Could not connect to the page. Try reloading the page or press Rescan.');
      }
    }
  }

  // Event listeners
  highlightToggle.addEventListener('change', (e) => {
    toggleHighlights(e.target.checked);
  });
  
  rescanBtn.addEventListener('click', rescanPage);
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  supportBtn?.addEventListener('click', () => {
    try {
      chrome.tabs.create({ url: SUPPORT_URL });
    } catch {
      // ignore
    }
  });

  kofiBtn?.addEventListener('click', () => {
    try {
      chrome.tabs.create({ url: KOFI_URL });
    } catch {
      // ignore
    }
  });

  githubBtn?.addEventListener('click', () => {
    try {
      chrome.tabs.create({ url: GITHUB_URL });
    } catch {
      // ignore
    }
  });
});
