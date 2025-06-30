class FilterManager {
    constructor() {
        this.defaultFilters = {
            confidence: { min: 0 },
            types: [],
            dateRange: { start: null, end: null },
            relevanceScore: { min: 0 }
        };
        this.activeFilters = { ...this.defaultFilters };
        this.savedPresets = {};
    }

    async init() {
        try {
            const stored = await chrome.storage.local.get(['filterPresets', 'activeFilters']);
            this.savedPresets = stored.filterPresets || {};
            this.activeFilters = stored.activeFilters || { ...this.defaultFilters };
        } catch (error) {
            console.error('FilterManager init error:', error);
            this.activeFilters = { ...this.defaultFilters };
        }
    }

    async applyFilters(data, filters = null) {
        const filtersToApply = filters || this.activeFilters;
        
        if (!data || !Array.isArray(data)) {
            return [];
        }

        let filteredData = [...data];

        // Apply entity-level filters
        if (data.length > 0 && data[0].entities) {
            filteredData = data.map(item => {
                let filteredEntities = item.entities || [];
                filteredEntities = this.applyEntityFilters(filteredEntities, filtersToApply);

                return {
                    ...item,
                    entities: filteredEntities
                };
            });
        } else {
            // Direct entity filtering
            filteredData = this.applyEntityFilters(filteredData, filtersToApply);
        }

        // Apply date filter
        if (filtersToApply.dateRange && (filtersToApply.dateRange.start || filtersToApply.dateRange.end)) {
            filteredData = this.filterByDate(filteredData, filtersToApply.dateRange.start, filtersToApply.dateRange.end);
        }

        // Store active filters
        this.activeFilters = { ...filtersToApply };
        await this.saveActiveFilters();

        return filteredData;
    }

    applyEntityFilters(entities, filters) {
        let filteredEntities = entities || [];

        // Filter by confidence
        if (filters.confidence && filters.confidence.min !== undefined) {
            filteredEntities = this.filterByConfidence(filteredEntities, filters.confidence.min);
        }

        // Filter by type
        if (filters.types && filters.types.length > 0) {
            filteredEntities = this.filterByType(filteredEntities, filters.types);
        }

        // Filter by relevance score
        if (filters.relevanceScore && filters.relevanceScore.min !== undefined) {
            filteredEntities = filteredEntities.filter(entity => 
                (entity.relevanceScore || 0) >= filters.relevanceScore.min
            );
        }

        return filteredEntities;
    }

    filterByConfidence(entities, minConfidence) {
        if (!Array.isArray(entities) || typeof minConfidence !== 'number') {
            return entities || [];
        }

        return entities.filter(entity => {
            const confidence = entity.confidenceScore || entity.confidence || 0;
            return confidence >= minConfidence;
        });
    }

    filterByType(entities, types) {
        if (!Array.isArray(entities) || !Array.isArray(types) || types.length === 0) {
            return entities || [];
        }

        const normalizedTypes = types.map(type => type.toLowerCase());
        
        return entities.filter(entity => {
            const entityType = (entity.type || '').toLowerCase();
            const entityTypes = entity.types ? entity.types.map(t => t.toLowerCase()) : [entityType];
            
            return entityTypes.some(type => normalizedTypes.includes(type));
        });
    }

    filterByDate(data, startDate, endDate) {
        if (!Array.isArray(data)) {
            return data || [];
        }

        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (!start && !end) {
            return data;
        }

        return data.filter(item => {
            const itemDate = this.extractDate(item);
            if (!itemDate) return true;

            const date = new Date(itemDate);
            if (isNaN(date.getTime())) return true;

            if (start && date < start) return false;
            if (end && date > end) return false;
            
            return true;
        });
    }

    extractDate(item) {
        return item.date || 
               item.timestamp || 
               item.createdAt || 
               item.scannedAt || 
               item.lastModified ||
               null;
    }

    async resetFilters() {
        this.activeFilters = { ...this.defaultFilters };
        await this.saveActiveFilters();
        return this.activeFilters;
    }

    async saveFilterPreset(name, filters = null) {
        if (!name || typeof name !== 'string') {
            throw new Error('Preset name is required');
        }

        const filtersToSave = filters || this.activeFilters;
        this.savedPresets[name] = {
            ...filtersToSave,
            savedAt: new Date().toISOString()
        };

        try {
            await chrome.storage.local.set({ filterPresets: this.savedPresets });
            return true;
        } catch (error) {
            console.error('Error saving filter preset:', error);
            throw error;
        }
    }

    async loadFilterPreset(name) {
        if (!name || !this.savedPresets[name]) {
            throw new Error('Preset not found');
        }

        const preset = this.savedPresets[name];
        this.activeFilters = {
            confidence: preset.confidence || this.defaultFilters.confidence,
            types: preset.types || this.defaultFilters.types,
            dateRange: preset.dateRange || this.defaultFilters.dateRange,
            relevanceScore: preset.relevanceScore || this.defaultFilters.relevanceScore
        };

        await this.saveActiveFilters();
        return this.activeFilters;
    }

    async deleteFilterPreset(name) {
        if (!name || !this.savedPresets[name]) {
            throw new Error('Preset not found');
        }

        delete this.savedPresets[name];
        
        try {
            await chrome.storage.local.set({ filterPresets: this.savedPresets });
            return true;
        } catch (error) {
            console.error('Error deleting filter preset:', error);
            throw error;
        }
    }

    getFilterPresets() {
        return { ...this.savedPresets };
    }

    getActiveFilters() {
        return { ...this.activeFilters };
    }

    async saveActiveFilters() {
        try {
            await chrome.storage.local.set({ activeFilters: this.activeFilters });
        } catch (error) {
            console.error('Error saving active filters:', error);
        }
    }

    updateFilter(filterType, value) {
        if (!this.activeFilters[filterType]) {
            this.activeFilters[filterType] = {};
        }

        if (typeof value === 'object' && value !== null) {
            this.activeFilters[filterType] = { ...this.activeFilters[filterType], ...value };
        } else {
            this.activeFilters[filterType] = value;
        }

        this.saveActiveFilters();
    }

    getFilterStats(data) {
        if (!Array.isArray(data)) return {};

        const stats = {
            totalItems: data.length,
            entityTypes: new Set(),
            confidenceRange: { min: 1, max: 0 },
            dateRange: { earliest: null, latest: null }
        };

        data.forEach(item => {
            const entities = item.entities || [item];
            
            entities.forEach(entity => {
                if (entity.type) {
                    stats.entityTypes.add(entity.type);
                }

                const confidence = entity.confidenceScore || entity.confidence;
                if (typeof confidence === 'number') {
                    stats.confidenceRange.min = Math.min(stats.confidenceRange.min, confidence);
                    stats.confidenceRange.max = Math.max(stats.confidenceRange.max, confidence);
                }
            });

            const itemDate = this.extractDate(item);
            if (itemDate) {
                const date = new Date(itemDate);
                if (!isNaN(date.getTime())) {
                    if (!stats.dateRange.earliest || date < stats.dateRange.earliest) {
                        stats.dateRange.earliest = date;
                    }
                    if (!stats.dateRange.latest || date > stats.dateRange.latest) {
                        stats.dateRange.latest = date;
                    }
                }
            }
        });

        stats.entityTypes = Array.from(stats.entityTypes);
        return stats;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
}