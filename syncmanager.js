class SyncManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.syncKey = 'synced_analyses';
  }

  async init() {
    if (!chrome.storage || !chrome.storage.sync || !this.storageManager) {
      return;
    }

    chrome.storage.onChanged.addListener(this.handleChange.bind(this));
    await this.syncFromCloud();
  }

  async handleChange(changes, areaName) {
    try {
      if (areaName === 'local' && changes[this.storageManager.STORAGE_KEYS.ANALYSES]) {
        await this.syncToCloud();
      } else if (areaName === 'sync' && changes[this.syncKey]) {
        await this.syncFromCloud();
      }
    } catch (error) {
      console.error('SyncManager change handling failed:', error);
    }
  }

  async syncToCloud() {
    try {
      const data = await this.storageManager.exportData();
      await chrome.storage.sync.set({ [this.syncKey]: data.analyses });
    } catch (error) {
      console.error('SyncManager syncToCloud failed:', error);
    }
  }

  async syncFromCloud() {
    try {
      const result = await chrome.storage.sync.get(this.syncKey);
      if (result[this.syncKey]) {
        await this.storageManager.importData({ analyses: result[this.syncKey] });
      }
    } catch (error) {
      console.error('SyncManager syncFromCloud failed:', error);
    }
  }
}

const syncManager = new SyncManager(typeof window !== 'undefined' ? window.storageManager : null);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncManager;
} else if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
  window.syncManager = syncManager;
}
