// Background service worker (MV3 module)

// tabId -> { frames: Map<frameId, {count, times}>, merged: {count, times} }
const tabState = new Map();

const DEBUG = false;

// Track the most recent "normal" tab (non-restricted URL) so the popup can
// show real page results even when the active tab is settings / chrome://.
let lastNormalTab = { tabId: null, url: null };

const tabsQuery = (queryInfo) =>
  new Promise((resolve) => {
    try {
      chrome.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
    } catch {
      resolve([]);
    }
  });

const tabsGet = (tabId) =>
  new Promise((resolve) => {
    try {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(tab || null);
      });
    } catch {
      resolve(null);
    }
  });

const safeChromeCall = (fn, ...args) =>
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

  await safeChromeCall(chrome.action.setBadgeText, { tabId, text });

  if (count > 0) {
    await safeChromeCall(chrome.action.setBadgeBackgroundColor, { tabId, color: "#4CAF50" });
    await safeChromeCall(chrome.action.setTitle, {
      tabId,
      title: chrome.i18n.getMessage('badgeFound', [String(count)])
    });
  } else {
    await safeChromeCall(chrome.action.setTitle, {
      tabId,
      title: chrome.i18n.getMessage('badgeNone')
    });
  }
}

function createContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      try {
        chrome.contextMenus.create({
          id: "convertSelection",
          title: chrome.i18n.getMessage('contextMenuConvert'),
          contexts: ["selection"]
        });
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "convertSelection") return;
  if (!tab?.id) return;

  try {
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "CONVERT_SELECTION",
        selectedText: info.selectionText
      },
      (response) => {
        // Check for errors
        if (chrome.runtime.lastError) {
          // Content script might not be loaded - try injecting it
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["src/scripts/content.js"]
          }).then(() => {
            // Retry after injection
            setTimeout(() => {
              chrome.tabs.sendMessage(
                tab.id,
                {
                  type: "CONVERT_SELECTION",
                  selectedText: info.selectionText
                },
                () => {
                  // Ignore errors on retry
                }
              );
            }, 500);
          }).catch(() => {
            // Ignore injection errors
          });
          return;
        }
        // Success - response received
      }
    );
  } catch (e) {
    // Ignore errors
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle synchronous responses immediately
  if (message.type === "GET_PREFERRED_TAB") {
    try {
      sendResponse({ tabId: lastNormalTab.tabId, url: lastNormalTab.url });
      return false;
    } catch {
      sendResponse({ tabId: null, url: null });
      return false;
    }
  }

  if (message.type === "GET_TAB_DATA") {
    try {
      const tabId = message.tabId;
      let result = { count: 0, times: [] };

      if (typeof tabId === "number") {
        const st = tabState.get(tabId);
        result = st?.merged || { count: 0, times: [] };
      } else {
        // Fallback to active tab - but this is async, so we need to handle it differently
        tabsQuery({ active: true, currentWindow: true }).then((tabs) => {
          const active = tabs?.[0];
          if (active?.id) {
            const st = tabState.get(active.id);
            sendResponse(st?.merged || { count: 0, times: [] });
          } else {
            sendResponse({ count: 0, times: [] });
          }
        });
        return true; // Keep channel open for async response
      }

      sendResponse(result);
      return false; // Synchronous response
    } catch (e) {
      sendResponse({ count: 0, times: [] });
      return false;
    }
  }

  // Handle async messages
  (async () => {
    try {
      if (!message || typeof message !== "object") return;

      if (message.type === "TIMES_FOUND" && sender.tab) {
        const tabId = sender.tab.id;
        const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;

        const st = tabState.get(tabId) || { frames: new Map(), merged: { count: 0, times: [] } };
        st.frames.set(frameId, message.data || { count: 0, times: [] });
        st.merged = mergeFrames(st.frames);
        tabState.set(tabId, st);

        await updateBadge(tabId, st.merged.count);
      }
    } catch (e) {
      // Silently ignore errors
      if (DEBUG) console.debug('[TimeZone Converter] Background error:', e);
    }
  })();

  return true; // Keep channel open for async operations
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  if (lastNormalTab.tabId === tabId) lastNormalTab = { tabId: null, url: null };
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  tabState.delete(tabId);
  updateBadge(tabId, 0);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  // Best-effort: remember last normal tab for popup targeting.
  tabsGet(tabId).then((tab) => maybeRememberNormalTab(tab));
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default settings
    chrome.storage.sync.set({
      targetTimezone: "auto",
      targetOffset: null,
      use24Hour: false,
      autoConvertOnLoad: false,
      displayMode: 'toggle',
      resultIncludeUtcOffset: true,
      resultIncludeDayOffset: true,
      resultIncludeSourceTz: false,
      showCountdown: false,
      enableDateDetection: false,
      scanMode: 'auto',
      highlightColor: "#ffeb3b",
      highlightTextColor: "#000000",
      highlightEnabled: true,
      highlightTextOnly: false,
      convertedHighlightColor: "#4CAF50",
      convertedHighlightTextColor: "#ffffff",
      showOriginal: true,
      maxConversions: 25,
      ignoredSites: []
    });

    createContextMenus();

    chrome.tabs.create({
      url: chrome.runtime.getURL("src/pages/settings.html")
    });
  } else if (details.reason === "update") {
    createContextMenus();
  }
});

chrome.runtime.onStartup?.addListener?.(() => {
  createContextMenus();
});
