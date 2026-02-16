// Background script for Firefox (Manifest V2)
// Firefox-specific implementation to avoid Chrome API compatibility issues

const DEBUG = false;

// tabId -> { frames: Map<frameId, {count, times}>, merged: {count, times} }
const tabState = new Map();

// Track the most recent "normal" tab (non-restricted URL) so that popup can
// show real page results even when the active tab is settings / chrome://.
let lastNormalTab = { tabId: null, url: null };

const tabsQuery = (queryInfo) =>
  new Promise((resolve) => {
    try {
      browser.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
    } catch {
      resolve([]);
    }
  });

const tabsGet = (tabId) =>
  new Promise((resolve) => {
    try {
      browser.tabs.get(tabId, (tab) => {
        if (browser.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(tab || null);
      });
    } catch {
      resolve(null);
    }
  });

const safeBrowserCall = (fn, ...args) =>
  new Promise((resolve) => {
    try {
      fn(...args, () => resolve());
    } catch {
      resolve();
    }
  });

const uniqKey = (t) => `${t.original}|${t.converted}|${t.timezone || ""}`;

const mergeFrames = (frames) => {
  const uniq = new Set();
  const times = [];

  for (const [frameId, data] of frames.entries()) {
    if (!data || !Array.isArray(data.times)) continue;
    for (const t of data.times) {
      const k = uniqKey(t);
      if (uniq.has(k)) continue;
      uniq.add(k);
      // Preserve frame id so popup can scroll to correct frame.
      times.push({ ...t, frameId });
    }
  }

  return { count: times.length, times };
};

const isRestrictedUrl = (url) =>
  /^(?:chrome|brave|edge|about|chrome-extension):\/\//i.test(String(url || ""));

function maybeRememberNormalTab(tab) {
  try {
    if (!tab?.id) return;
    if (!tab.url || isRestrictedUrl(tab.url)) return;
    lastNormalTab = { tabId: tab.id, url: tab.url };
  } catch {
    // ignore
  }
}

async function updateBadge(tabId, count) {
  // Badge updates are best-effort; tabs can disappear at any moment.
  const text = count > 0 ? String(count) : "";

  // Firefox doesn't support setBadgeText, setBadgeBackgroundColor, setTitle in the same way
  try {
    if (browser.browserAction) {
      await safeBrowserCall(browser.browserAction.setBadgeText, { tabId, text });
      
      if (count > 0) {
        await safeBrowserCall(browser.browserAction.setBadgeBackgroundColor, { tabId, color: "#4CAF50" });
        await safeBrowserCall(browser.browserAction.setTitle, {
          tabId,
          title: browser.i18n.getMessage('badgeFound', [String(count)])
        });
      } else {
        await safeBrowserCall(browser.browserAction.setTitle, {
          tabId,
          title: browser.i18n.getMessage('badgeNone')
        });
      }
    }
  } catch (e) {
    if (DEBUG) console.error('[TimeZone Converter] Badge update failed:', e);
  }
}

function createContextMenus() {
  try {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: 'tz-convert-on-page',
        title: browser.i18n.getMessage('convertOnPage'),
        contexts: ['page', 'selection'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
    });
  } catch (e) {
    if (DEBUG) console.error('[TimeZone Converter] Context menu creation failed:', e);
  }
}

// Message handling
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'getTabState':
      sendResponse({ tabState: tabState.get(tabId) || { count: 0, times: [] } });
      break;

    case 'updateBadge':
      updateBadge(tabId, message.count);
      break;

    case 'getSettings':
      browser.storage.sync.get({
        highlightColor: '#ffeb3b',
        highlightTextColor: '#000000',
        convertedHighlightColor: '#4CAF50',
        convertedHighlightTextColor: '#ffffff',
        showCountdown: false,
        displayMode: 'toggle',
        timezone: 'auto',
        language: 'auto',
        timeFormat: '12h'
      }, sendResponse);
      break;

    case 'saveSettings':
      browser.storage.sync.set(message.settings, () => {
        sendResponse({ success: !browser.runtime.lastError });
      });
      return true; // Keep message channel open for async response

    case 'openSettings':
      browser.runtime.openOptionsPage();
      break;

    case 'rememberNormalTab':
      maybeRememberNormalTab(sender.tab);
      break;

    default:
      if (DEBUG) console.warn('[TimeZone Converter] Unknown message type:', message.type);
  }

  return true; // Keep message channel open for async responses
});

// Tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    maybeRememberNormalTab(tab);
  }
});

// Tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
  maybeRememberNormalTab({ id: activeInfo.tabId });
});

// Tab removal
browser.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

// Extension startup
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open settings page on first install
    browser.runtime.openOptionsPage();
  }
  
  createContextMenus();
});

// Context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tz-convert-on-page') {
    // Send message to content script to convert all times on page
    browser.tabs.sendMessage(tab.id, { type: 'convertAllTimes' });
  }
});

console.log('[TimeZone Converter] Firefox background script loaded');
