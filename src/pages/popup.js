// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const timesList = document.getElementById('timesList');
  const timesCount = document.getElementById('timesCount');
  const emptyState = document.getElementById('emptyState');
  const highlightToggle = document.getElementById('highlightToggle');
  const rescanBtn = document.getElementById('rescanBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const currentTimezone = document.getElementById('currentTimezone');
  const donateLink = document.getElementById('donateLink');

  // Get current timezone
  function displayCurrentTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '';
    currentTimezone.textContent = `${tz} (UTC${sign}${offset})`;
  }

  // Load settings
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        highlightEnabled: true,
        donateUrl: 'https://buymeacoffee.com/3mon',
        use24Hour: false
      }, resolve);
    });
  }

  // Format time based on settings
  function formatTimeDisplay(timeStr, use24Hour) {
    if (!use24Hour) return timeStr;
    
    // Convert AM/PM format to 24-hour
    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const seconds = ampmMatch[3] || '';
      const period = ampmMatch[4].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes}${seconds ? ':' + seconds : ''}`;
      return timeStr.replace(ampmMatch[0], timeFormatted);
    }
    return timeStr;
  }

  // Render times list
  function renderTimes(times, use24Hour = false) {
    timesCount.textContent = times.length;
    
    if (times.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    
    emptyState.style.display = 'none';
    
    // Clear existing items (except empty state)
    const existingItems = timesList.querySelectorAll('.time-item');
    existingItems.forEach(item => item.remove());
    
    times.forEach((time, index) => {
      const item = document.createElement('div');
      item.className = 'time-item';
      item.dataset.timeId = time.id;
      
      // Format times based on user preference
      const originalDisplay = formatTimeDisplay(time.original, use24Hour);
      const convertedDisplay = formatTimeDisplay(time.converted, use24Hour);
      
      item.innerHTML = `
        <div class="time-original">
          <span class="time-label">Original:</span>
          <span class="time-value">${escapeHtml(originalDisplay)}</span>
        </div>
        <div class="time-converted">
          <span class="time-label">Your time:</span>
          <span class="time-value converted">${escapeHtml(convertedDisplay)}</span>
        </div>
        <button class="locate-btn" title="Find on page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
        </button>
      `;
      
      // Click to scroll to time on page
      item.querySelector('.locate-btn').addEventListener('click', () => {
        scrollToTime(time.id);
      });
      
      timesList.appendChild(item);
    });
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Scroll to time on page
  async function scrollToTime(timeId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SCROLL_TO_TIME',
        timeId: timeId
      });
    }
  }

  // Get times from content script
  async function getTimes() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return [];
      
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TIMES' });
      return response?.times || [];
    } catch (e) {
      console.log('Could not get times from page:', e);
      return [];
    }
  }

  // Toggle highlights
  async function toggleHighlights(enabled) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_HIGHLIGHTS',
        enabled: enabled
      });
    }
    chrome.storage.sync.set({ highlightEnabled: enabled });
  }

  // Rescan page
  async function rescanPage() {
    rescanBtn.disabled = true;
    rescanBtn.innerHTML = `
      <svg class="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"></path>
        <path d="M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Scanning...
    `;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
        // Wait a bit for rescan to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        const times = await getTimes();
        const currentSettings = await loadSettings();
        renderTimes(times, currentSettings.use24Hour);
      }
    } catch (e) {
      console.log('Could not rescan page:', e);
    }
    
    rescanBtn.disabled = false;
    rescanBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"></path>
        <path d="M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Rescan
    `;
  }

  // Open settings
  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  // Initialize
  displayCurrentTimezone();
  
  const settings = await loadSettings();
  highlightToggle.checked = settings.highlightEnabled;
  
  // Set donate link
  if (settings.donateUrl) {
    donateLink.href = settings.donateUrl;
    donateLink.target = '_blank';
  }
  
  // Load times
  const times = await getTimes();
  renderTimes(times, settings.use24Hour);

  // Event listeners
  highlightToggle.addEventListener('change', (e) => {
    toggleHighlights(e.target.checked);
  });
  
  rescanBtn.addEventListener('click', rescanPage);
  settingsBtn.addEventListener('click', openSettings);
  
  donateLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: donateLink.href });
  });
});
