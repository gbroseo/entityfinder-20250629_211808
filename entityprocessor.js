class EntityProcessor {
  constructor() {
    this.confidenceWeights = {
      relevanceScore: 0.3,
      confidenceScore: 0.4,
      dbpediaScore: 0.2,
      freebaseScore: 0.1
    };
    
    this.wikipediaCache = new Map();
    this.rateLimiter = {
      requests: 0,
      lastReset: Date.now(),
      maxRequests: 50,
      windowMs: 60000
    };
  }

  async processEntities(rawEntities) {
    try {
      const normalizedEntities = this.normalizeEntities(rawEntities);
      const entitiesWithConfidence = normalizedEntities.map(entity => ({
        ...entity,
        calculatedConfidence: this.calculateConfidenceScore(entity)
      }));

      const enrichedEntities = await this.enrichWithWikipedia(entitiesWithConfidence);
      return this.mapEntityRelationships(enrichedEntities);
    } catch (error) {
      console.error('Error processing entities:', error);
      return [];
    }
  }

  normalizeEntities(rawEntities) {
    return rawEntities.map(entity => ({
      id: entity.id || this.generateEntityId(entity),
      text: entity.matchedText || entity.text || '',
      type: entity.type || 'Unknown',
      relevanceScore: parseFloat(entity.relevanceScore) || 0,
      confidenceScore: parseFloat(entity.confidenceScore) || 0,
      dbpediaScore: parseFloat(entity.dbpediaScore) || 0,
      freebaseScore: parseFloat(entity.freebaseScore) || 0,
      wikipediaLink: entity.wikipediaLink || null,
      wikiDataId: entity.wikiDataId || null,
      startingPos: parseInt(entity.startingPos) || 0,
      endingPos: parseInt(entity.endingPos) || 0,
      rawData: entity
    }));
  }

  generateEntityId(entity) {
    const text = entity.matchedText || entity.text || '';
    const type = entity.type || '';
    return btoa(`${text}_${type}_${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
  }

  calculateConfidenceScore(entity) {
    const scores = {
      relevanceScore: Math.min(Math.max(entity.relevanceScore || 0, 0), 1),
      confidenceScore: Math.min(Math.max(entity.confidenceScore || 0, 0), 1),
      dbpediaScore: Math.min(Math.max(entity.dbpediaScore || 0, 0), 1),
      freebaseScore: Math.min(Math.max(entity.freebaseScore || 0, 0), 1)
    };

    let weightedScore = 0;
    let totalWeight = 0;

    Object.entries(scores).forEach(([key, value]) => {
      if (value > 0) {
        weightedScore += value * this.confidenceWeights[key];
        totalWeight += this.confidenceWeights[key];
      }
    });

    const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    let bonusMultiplier = 1;
    if (entity.wikipediaLink) bonusMultiplier += 0.1;
    if (entity.wikiDataId) bonusMultiplier += 0.05;
    if (entity.text && entity.text.length > 1) bonusMultiplier += 0.05;

    return Math.min(baseScore * bonusMultiplier, 1);
  }

  async enrichWithWikipedia(entities) {
    const enrichmentPromises = entities.map(async (entity) => {
      if (entity.wikipediaLink && !this.wikipediaCache.has(entity.wikipediaLink)) {
        try {
          if (this.checkRateLimit()) {
            const wikipediaData = await this.fetchWikipediaData(entity.wikipediaLink);
            this.wikipediaCache.set(entity.wikipediaLink, wikipediaData);
          } else {
            console.warn(`Rate limit exceeded, skipping Wikipedia enrichment for ${entity.text}`);
            this.wikipediaCache.set(entity.wikipediaLink, null);
          }
        } catch (error) {
          console.warn(`Failed to fetch Wikipedia data for ${entity.text}:`, error);
          this.wikipediaCache.set(entity.wikipediaLink, null);
        }
      }

      const cachedData = this.wikipediaCache.get(entity.wikipediaLink);
      return {
        ...entity,
        wikipediaData: cachedData || null,
        description: cachedData?.extract || entity.description || null,
        categories: cachedData?.categories || entity.categories || []
      };
    });

    return Promise.all(enrichmentPromises);
  }

  checkRateLimit() {
    const now = Date.now();
    if (now - this.rateLimiter.lastReset > this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.lastReset = now;
    }

    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      return false;
    }

    this.rateLimiter.requests++;
    return true;
  }

  async fetchWikipediaData(wikipediaLink) {
    const title = this.extractWikipediaTitle(wikipediaLink);
    if (!title) return null;

    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EntityScout Pro/1.0'
        },
        mode: 'cors'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return {
        extract: data.extract,
        thumbnail: data.thumbnail?.source || null,
        pageId: data.pageid,
        categories: data.categories || []
      };
    } catch (error) {
      throw new Error(`Wikipedia API error: ${error.message}`);
    }
  }

  extractWikipediaTitle(wikipediaLink) {
    if (!wikipediaLink) return null;
    const match = wikipediaLink.match(/\/wiki\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  filterEntities(entities, criteria = {}) {
    return entities.filter(entity => {
      if (criteria.minConfidence && entity.calculatedConfidence < criteria.minConfidence) {
        return false;
      }

      if (criteria.maxConfidence && entity.calculatedConfidence > criteria.maxConfidence) {
        return false;
      }

      if (criteria.types && criteria.types.length > 0) {
        if (!criteria.types.includes(entity.type)) {
          return false;
        }
      }

      if (criteria.excludeTypes && criteria.excludeTypes.length > 0) {
        if (criteria.excludeTypes.includes(entity.type)) {
          return false;
        }
      }

      if (criteria.minTextLength && entity.text.length < criteria.minTextLength) {
        return false;
      }

      if (criteria.maxTextLength && entity.text.length > criteria.maxTextLength) {
        return false;
      }

      if (criteria.requireWikipedia && !entity.wikipediaLink) {
        return false;
      }

      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        if (!entity.text.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  sortEntities(entities, sortBy = 'confidence') {
    const sortFunctions = {
      confidence: (a, b) => (b.calculatedConfidence || 0) - (a.calculatedConfidence || 0),
      relevance: (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
      text: (a, b) => a.text.localeCompare(b.text),
      type: (a, b) => a.type.localeCompare(b.type),
      position: (a, b) => (a.startingPos || 0) - (b.startingPos || 0),
      alphabetical: (a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    };

    const sortFunction = sortFunctions[sortBy] || sortFunctions.confidence;
    return [...entities].sort(sortFunction);
  }

  groupEntitiesByType(entities) {
    const grouped = {};
    
    entities.forEach(entity => {
      const type = entity.type || 'Unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(entity);
    });

    Object.keys(grouped).forEach(type => {
      grouped[type] = this.sortEntities(grouped[type], 'confidence');
    });

    return grouped;
  }

  mapEntityRelationships(entities) {
    if (entities.length > 500) {
      return this.optimizedMapEntityRelationships(entities);
    }

    const entitiesWithRelations = entities.map(entity => ({
      ...entity,
      relationships: {
        coOccurrences: [],
        semantic: [],
        positional: []
      }
    }));

    for (let i = 0; i < entitiesWithRelations.length; i++) {
      for (let j = i + 1; j < entitiesWithRelations.length; j++) {
        const entityA = entitiesWithRelations[i];
        const entityB = entitiesWithRelations[j];

        const relationship = this.analyzeEntityRelationship(entityA, entityB);
        
        if (relationship.strength > 0.3) {
          entityA.relationships.coOccurrences.push({
            entityId: entityB.id,
            type: relationship.type,
            strength: relationship.strength
          });
          
          entityB.relationships.coOccurrences.push({
            entityId: entityA.id,
            type: relationship.type,
            strength: relationship.strength
          });
        }

        if (this.areEntitiesNearby(entityA, entityB, 100)) {
          entityA.relationships.positional.push({
            entityId: entityB.id,
            distance: Math.abs(entityA.startingPos - entityB.startingPos)
          });
          
          entityB.relationships.positional.push({
            entityId: entityA.id,
            distance: Math.abs(entityA.startingPos - entityB.startingPos)
          });
        }
      }
    }

    return entitiesWithRelations;
  }

  optimizedMapEntityRelationships(entities) {
    const entitiesWithRelations = entities.map(entity => ({
      ...entity,
      relationships: {
        coOccurrences: [],
        semantic: [],
        positional: []
      }
    }));

    entitiesWithRelations.forEach((entity, i) => {
      const nearbyEntities = entitiesWithRelations.filter((other, j) => 
        i !== j && this.areEntitiesNearby(entity, other, 200)
      );

      nearbyEntities.forEach(other => {
        const relationship = this.analyzeEntityRelationship(entity, other);
        
        if (relationship.strength > 0.3) {
          entity.relationships.coOccurrences.push({
            entityId: other.id,
            type: relationship.type,
            strength: relationship.strength
          });
        }

        if (this.areEntitiesNearby(entity, other, 100)) {
          entity.relationships.positional.push({
            entityId: other.id,
            distance: Math.abs(entity.startingPos - other.startingPos)
          });
        }
      });
    });

    return entitiesWithRelations;
  }

  analyzeEntityRelationship(entityA, entityB) {
    let strength = 0;
    let type = 'cooccurrence';

    if (entityA.type === entityB.type) {
      strength += 0.2;
      type = 'same_type';
    }

    if (this.shareWikipediaCategories(entityA, entityB)) {
      strength += 0.3;
      type = 'semantic';
    }

    if (this.areEntitiesNearby(entityA, entityB, 50)) {
      strength += 0.4;
    }

    const textSimilarity = this.calculateTextSimilarity(entityA.text, entityB.text);
    strength += textSimilarity * 0.3;

    return { strength: Math.min(strength, 1), type };
  }

  shareWikipediaCategories(entityA, entityB) {
    const categoriesA = entityA.categories || [];
    const categoriesB = entityB.categories || [];
    
    if (categoriesA.length === 0 || categoriesB.length === 0) return false;
    
    return categoriesA.some(catA => 
      categoriesB.some(catB => catA.toLowerCase() === catB.toLowerCase())
    );
  }

  areEntitiesNearby(entityA, entityB, maxDistance) {
    const posA = entityA.startingPos || 0;
    const posB = entityB.startingPos || 0;
    return Math.abs(posA - posB) <= maxDistance;
  }

  calculateTextSimilarity(textA, textB) {
    if (!textA || !textB) return 0;
    
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();
    
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.7;
    
    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    const commonWords = wordsA.filter(word => wordsB.includes(word));
    
    if (commonWords.length === 0) return 0;
    
    return (commonWords.length * 2) / (wordsA.length + wordsB.length);
  }

  clearCache() {
    this.wikipediaCache.clear();
  }

  getCacheSize() {
    return this.wikipediaCache.size;
  }

  getEntityStats(entities) {
    const stats = {
      total: entities.length,
      byType: {},
      avgConfidence: 0,
      hasWikipedia: 0,
      hasDescription: 0
    };

    let totalConfidence = 0;

    entities.forEach(entity => {
      const type = entity.type || 'Unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      totalConfidence += entity.calculatedConfidence || 0;
      
      if (entity.wikipediaLink) stats.hasWikipedia++;
      if (entity.description) stats.hasDescription++;
    });

    stats.avgConfidence = entities.length > 0 ? totalConfidence / entities.length : 0;

    return stats;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EntityProcessor;
} else if (typeof window !== 'undefined') {
  window.EntityProcessor = EntityProcessor;
}