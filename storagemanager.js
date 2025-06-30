class StorageManager {
  constructor() {
    this.storage = chrome.storage;
    this.initialized = false;
    this.STORAGE_KEYS = {
      ANALYSES: 'entity_analyses',
      SETTINGS: 'user_settings',
      METADATA: 'app_metadata'
    };
    this.DEFAULT_SETTINGS = {
      confidenceThreshold: 0.5,
      maxEntities: 50,
      dataRetention: 30,
      autoCleanup: true,
      exportFormat: 'json'
    };
  }

  async init() {
    try {
      await this.ensureStorageStructure();
      this.initialized = true;
      
      if (this.DEFAULT_SETTINGS.autoCleanup) {
        await this.cleanupExpiredData();
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  async ensureStorageStructure() {
    const result = await this.storage.get([
      this.STORAGE_KEYS.ANALYSES,
      this.STORAGE_KEYS.SETTINGS,
      this.STORAGE_KEYS.METADATA
    ]);

    const updates = {};

    if (!result[this.STORAGE_KEYS.ANALYSES]) {
      updates[this.STORAGE_KEYS.ANALYSES] = {};
    }

    if (!result[this.STORAGE_KEYS.SETTINGS]) {
      updates[this.STORAGE_KEYS.SETTINGS] = { ...this.DEFAULT_SETTINGS };
    }

    if (!result[this.STORAGE_KEYS.METADATA]) {
      updates[this.STORAGE_KEYS.METADATA] = {
        version: '1.0.0',
        created: Date.now(),
        totalAnalyses: 0
      };
    }

    if (Object.keys(updates).length > 0) {
      await this.storage.set(updates);
    }
  }

  async saveAnalysis(url, entities, metadata = {}) {
    await this.ensureInitialized();

    try {
      const analysisId = this.generateId();
      const timestamp = Date.now();
      const normalizedUrl = this.normalizeUrl(url);

      const analysis = {
        id: analysisId,
        url: normalizedUrl,
        originalUrl: url,
        entities: this.sanitizeEntities(entities),
        metadata: {
          ...metadata,
          entityCount: entities.length,
          version: '1.0.0'
        },
        timestamp,
        created: timestamp,
        updated: timestamp
      };

      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      if (!analyses[normalizedUrl]) {
        analyses[normalizedUrl] = [];
      }

      analyses[normalizedUrl].push(analysis);
      analyses[normalizedUrl].sort((a, b) => b.timestamp - a.timestamp);

      if (analyses[normalizedUrl].length > 10) {
        analyses[normalizedUrl] = analyses[normalizedUrl].slice(0, 10);
      }

      await this.storage.set({ [this.STORAGE_KEYS.ANALYSES]: analyses });
      await this.updateMetadata({ totalAnalyses: 1 });

      return analysisId;
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw new Error(`Storage save failed: ${error.message}`);
    }
  }

  async getAnalysis(url) {
    await this.ensureInitialized();

    try {
      const normalizedUrl = this.normalizeUrl(url);
      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      const urlAnalyses = analyses[normalizedUrl];
      return urlAnalyses && urlAnalyses.length > 0 ? urlAnalyses[0] : null;
    } catch (error) {
      console.error('Failed to get analysis:', error);
      return null;
    }
  }

  async getAllAnalyses() {
    await this.ensureInitialized();

    try {
      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      const allAnalyses = [];
      for (const urlAnalyses of Object.values(analyses)) {
        if (Array.isArray(urlAnalyses)) {
          allAnalyses.push(...urlAnalyses);
        }
      }

      return allAnalyses.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get all analyses:', error);
      return [];
    }
  }

  async deleteAnalysis(id) {
    await this.ensureInitialized();

    try {
      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      let deleted = false;
      for (const [url, urlAnalyses] of Object.entries(analyses)) {
        if (Array.isArray(urlAnalyses)) {
          const initialLength = urlAnalyses.length;
          analyses[url] = urlAnalyses.filter(analysis => analysis.id !== id);
          
          if (analyses[url].length < initialLength) {
            deleted = true;
            if (analyses[url].length === 0) {
              delete analyses[url];
            }
            break;
          }
        }
      }

      if (deleted) {
        await this.storage.set({ [this.STORAGE_KEYS.ANALYSES]: analyses });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      return false;
    }
  }

  async getHistoricalData(url) {
    await this.ensureInitialized();

    try {
      const normalizedUrl = this.normalizeUrl(url);
      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      const urlAnalyses = analyses[normalizedUrl] || [];
      return urlAnalyses.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get historical data:', error);
      return [];
    }
  }

  async updateSettings(settings) {
    await this.ensureInitialized();

    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      
      this.validateSettings(newSettings);

      await this.storage.set({ [this.STORAGE_KEYS.SETTINGS]: newSettings });
      return newSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error(`Settings update failed: ${error.message}`);
    }
  }

  async getSettings() {
    await this.ensureInitialized();

    try {
      const result = await this.storage.get(this.STORAGE_KEYS.SETTINGS);
      return { ...this.DEFAULT_SETTINGS, ...(result[this.STORAGE_KEYS.SETTINGS] || {}) };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  async exportData() {
    await this.ensureInitialized();

    try {
      const [analyses, settings, metadata] = await Promise.all([
        this.getAllAnalyses(),
        this.getSettings(),
        this.getMetadata()
      ]);

      return {
        analyses,
        settings,
        metadata,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(data) {
    await this.ensureInitialized();

    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data format');
      }

      const updates = {};

      if (data.analyses && Array.isArray(data.analyses)) {
        const analysesMap = {};
        for (const analysis of data.analyses) {
          const normalizedUrl = this.normalizeUrl(analysis.url);
          if (!analysesMap[normalizedUrl]) {
            analysesMap[normalizedUrl] = [];
          }
          analysesMap[normalizedUrl].push(analysis);
        }
        updates[this.STORAGE_KEYS.ANALYSES] = analysesMap;
      }

      if (data.settings && typeof data.settings === 'object') {
        updates[this.STORAGE_KEYS.SETTINGS] = { ...this.DEFAULT_SETTINGS, ...data.settings };
      }

      await this.storage.set(updates);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      await this.storage.clear();
      await this.ensureStorageStructure();
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  async getStorageUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
      return {
        used: usage,
        total: quota,
        percentage: Math.round((usage / quota) * 100)
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  async updateMetadata(updates) {
    try {
      const result = await this.storage.get(this.STORAGE_KEYS.METADATA);
      const metadata = result[this.STORAGE_KEYS.METADATA] || {};
      
      const newMetadata = { ...metadata, ...updates };
      if (updates.totalAnalyses) {
        newMetadata.totalAnalyses = (metadata.totalAnalyses || 0) + updates.totalAnalyses;
      }
      newMetadata.lastUpdated = Date.now();

      await this.storage.set({ [this.STORAGE_KEYS.METADATA]: newMetadata });
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  }

  async getMetadata() {
    try {
      const result = await this.storage.get(this.STORAGE_KEYS.METADATA);
      return result[this.STORAGE_KEYS.METADATA] || {};
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return {};
    }
  }

  async cleanupExpiredData() {
    try {
      const settings = await this.getSettings();
      const retentionDays = settings.dataRetention || 30;
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      const result = await this.storage.get(this.STORAGE_KEYS.ANALYSES);
      const analyses = result[this.STORAGE_KEYS.ANALYSES] || {};

      let hasChanges = false;
      for (const [url, urlAnalyses] of Object.entries(analyses)) {
        if (Array.isArray(urlAnalyses)) {
          const filtered = urlAnalyses.filter(analysis => analysis.timestamp > cutoffTime);
          if (filtered.length !== urlAnalyses.length) {
            if (filtered.length === 0) {
              delete analyses[url];
            } else {
              analyses[url] = filtered;
            }
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await this.storage.set({ [this.STORAGE_KEYS.ANALYSES]: analyses });
      }
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`.toLowerCase();
    } catch (error) {
      return url.toLowerCase();
    }
  }

  generateId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeEntities(entities) {
    if (!Array.isArray(entities)) return [];
    
    return entities.map(entity => ({
      id: entity.id || '',
      matchedText: String(entity.matchedText || ''),
      freebaseTypes: Array.isArray(entity.freebaseTypes) ? entity.freebaseTypes : [],
      confidenceScore: Number(entity.confidenceScore) || 0,
      wikiLink: entity.wikiLink || '',
      type: entity.type || 'unknown'
    }));
  }

  validateSettings(settings) {
    const errors = [];

    if (settings.confidenceThreshold !== undefined) {
      if (typeof settings.confidenceThreshold !== 'number' || 
          settings.confidenceThreshold < 0 || settings.confidenceThreshold > 1) {
        errors.push('confidenceThreshold must be a number between 0 and 1');
      }
    }

    if (settings.maxEntities !== undefined) {
      if (!Number.isInteger(settings.maxEntities) || settings.maxEntities < 1 || settings.maxEntities > 1000) {
        errors.push('maxEntities must be an integer between 1 and 1000');
      }
    }

    if (settings.dataRetention !== undefined) {
      if (!Number.isInteger(settings.dataRetention) || settings.dataRetention < 1 || settings.dataRetention > 365) {
        errors.push('dataRetention must be an integer between 1 and 365 days');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid settings: ${errors.join(', ')}`);
    }
  }
}

const storageManager = new StorageManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.storageManager = storageManager;
}