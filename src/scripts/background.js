// Background service worker
const tabData = new Map();

// Update badge for a tab
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({ tabId, text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' });
    chrome.action.setTitle({ tabId, title: `TimeZone Converter - ${count} time(s) found` });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'TimeZone Converter - No times found' });
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TIMES_FOUND' && sender.tab) {
    const tabId = sender.tab.id;
    tabData.set(tabId, message.data);
    updateBadge(tabId, message.data.count);
  }
  return false;
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabData.delete(tabId);
});

// Reset badge when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabData.delete(tabId);
    updateBadge(tabId, 0);
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      targetTimezone: 'auto',
      targetOffset: null,
      use24Hour: false,
      highlightColor: '#ffeb3b',
      highlightTextColor: '#000000',
      highlightEnabled: true,
      showOriginal: true,
      autoConvert: false,
      donateUrl: 'https://buymeacoffee.com/3mon'
    });
    
    // Open settings page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/pages/settings.html')
    });
  }
});

// Get times for current tab (called from popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_DATA') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const data = tabData.get(tabs[0].id) || { count: 0, times: [] };
        sendResponse(data);
      } else {
        sendResponse({ count: 0, times: [] });
      }
    });
    return true; // Async response
  }
});
