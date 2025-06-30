class APIManager {
  constructor() {
    this.baseUrl = 'https://api.textrazor.com';
    this.wikipediaBaseUrl = 'https://en.wikipedia.org/api/rest_v1';
    this.apiKey = null;
    this.maxRetries = 3;
    this.rateLimitDelay = 1000;
    this.quotaUsage = {
      used: 0,
      limit: 0,
      resetDate: null
    };
  }

  async initialize(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Valid API key is required');
    }

    this.apiKey = apiKey.trim();
    
    const isValid = await this.validateApiKey(apiKey);
    if (!isValid) {
      throw new Error('Invalid API key');
    }
    await this.getQuotaUsage();
    return true;
  }

  async analyzeText(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('API key not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text content is required');
    }

    const requestData = {
      url: `${this.baseUrl}/`,
      method: 'POST',
      headers: {
        'X-TextRazor-Key': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        text: text,
        extractors: options.extractors || 'entities,topics,relations',
        entities: options.entities || 'true', 
        entities_confidence: options.confidence || '0.5',
        entities_dbpedia: options.dbpedia || 'true',
        entities_freebase: options.freebase || 'true',
        cleanup_mode: options.cleanup || 'cleanHTML',
        cleanup_return_cleaned: 'true',
        cleanup_return_raw: 'false'
      })
    };

    return await this.retryRequest(requestData);
  }

  async getWikipediaInfo(entityId) {
    if (!entityId) {
      throw new Error('Entity ID is required');
    }

    const cleanId = entityId.replace('http://dbpedia.org/resource/', '');
    
    try {
      const response = await fetch(`${this.wikipediaBaseUrl}/page/summary/${encodeURIComponent(cleanId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        title: data.title,
        description: data.extract,
        url: data.content_urls?.desktop?.page,
        thumbnail: data.thumbnail?.source,
        type: data.type
      };
    } catch (error) {
      console.warn(`Failed to fetch Wikipedia info for ${entityId}:`, error);
      return null;
    }
  }

  async validateApiKey(key) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/account/`, {
        method: 'GET',
        headers: {
          'X-TextRazor-Key': key.trim()
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.quotaUsage = {
          used: data.requestsUsed || 0,
          limit: data.requestsLimit || 0,
          resetDate: data.planEnds || null
        };
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  async handleRateLimit() {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 10000);
  }

  async retryRequest(requestData, attempt = 1) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      });

      if (response.status === 429) {
        if (attempt <= this.maxRetries) {
          await this.handleRateLimit();
          return this.retryRequest(requestData, attempt + 1);
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      if (response.status === 403) {
        throw new Error('API quota exceeded or invalid API key');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      this.rateLimitDelay = 1000;
      
      const data = await response.json();
      
      this.quotaUsage.used += 1;
      
      return {
        success: true,
        data: data.response || data,
        quota: this.quotaUsage
      };

    } catch (error) {
      if (attempt <= this.maxRetries && 
          (error.name === 'TypeError' || error.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return this.retryRequest(requestData, attempt + 1);
      }
      
      throw error;
    }
  }

  async getQuotaUsage() {
    if (!this.apiKey) {
      throw new Error('API key not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/account/`, {
        method: 'GET',
        headers: {
          'X-TextRazor-Key': this.apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.quotaUsage = {
          used: data.requestsUsed || 0,
          limit: data.requestsLimit || 0,
          resetDate: data.planEnds || null,
          percentage: data.requestsLimit ? 
            Math.round((data.requestsUsed / data.requestsLimit) * 100) : 0
        };
        
        return this.quotaUsage;
      }
      
      throw new Error(`Failed to fetch quota: ${response.status}`);
    } catch (error) {
      console.error('Error fetching quota usage:', error);
      throw error;
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  isInitialized() {
    return this.apiKey !== null;
  }

  reset() {
    this.apiKey = null;
    this.rateLimitDelay = 1000;
    this.quotaUsage = {
      used: 0,
      limit: 0,
      resetDate: null
    };
  }
}

const apiManager = new APIManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIManager;
}