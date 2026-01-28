// Settings page script
document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const timezoneModeRadios = document.querySelectorAll('input[name="timezoneMode"]');
  const manualTimezoneSelect = document.getElementById('manualTimezoneSelect');
  const timezoneSelect = document.getElementById('timezoneSelect');
  const use24Hour = document.getElementById('use24Hour');
  const highlightColor = document.getElementById('highlightColor');
  const highlightColorText = document.getElementById('highlightColorText');
  const highlightTextColor = document.getElementById('highlightTextColor');
  const highlightTextColorText = document.getElementById('highlightTextColorText');
  const highlightEnabled = document.getElementById('highlightEnabled');
  const highlightPreview = document.getElementById('highlightPreview');
  const detectedTimezone = document.getElementById('detectedTimezone');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');

  // Default settings
  const defaultSettings = {
    targetTimezone: 'auto',
    targetOffset: null,
    use24Hour: false,
    highlightColor: '#ffeb3b',
    highlightTextColor: '#000000',
    highlightEnabled: true
  };

  // Show detected timezone
  function showDetectedTimezone() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '';
    detectedTimezone.textContent = `${tz} (UTC${sign}${offset})`;
  }

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
    highlightPreview.style.backgroundColor = highlightColor.value;
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
    
    // Colors
    highlightColor.value = settings.highlightColor;
    highlightColorText.value = settings.highlightColor;
    highlightTextColor.value = settings.highlightTextColor;
    highlightTextColorText.value = settings.highlightTextColor;
    
    // Highlight enabled
    highlightEnabled.checked = settings.highlightEnabled;
    
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
      highlightColor: highlightColor.value,
      highlightTextColor: highlightTextColor.value,
      highlightEnabled: highlightEnabled.checked
    };
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

  // Color input sync
  highlightColor.addEventListener('input', () => {
    highlightColorText.value = highlightColor.value;
    updatePreview();
  });

  highlightColorText.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(highlightColorText.value)) {
      highlightColor.value = highlightColorText.value;
      updatePreview();
    }
  });

  highlightTextColor.addEventListener('input', () => {
    highlightTextColorText.value = highlightTextColor.value;
    updatePreview();
  });

  highlightTextColorText.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(highlightTextColorText.value)) {
      highlightTextColor.value = highlightTextColorText.value;
      updatePreview();
    }
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
    });
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    await notifyContentScripts();
    showToast('Settings saved successfully!');
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
