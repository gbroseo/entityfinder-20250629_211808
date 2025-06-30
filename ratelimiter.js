class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) {
      return;
    }
    
    this.requests = [];
    this.isInitialized = true;
  }

  checkRateLimit() {
    this.cleanupOldRequests();
    return this.requests.length < this.requestsPerMinute;
  }

  addRequest() {
    const now = Date.now();
    this.requests.push(now);
    this.cleanupOldRequests();
  }

  getWaitTime() {
    if (!this.isInitialized) {
      this.init();
    }
    
    this.cleanupOldRequests();
    
    if (this.requests.length < this.requestsPerMinute) {
      return 0;
    }
    
    const oldestRequest = this.requests[0];
    const timeToWait = 60000 - (Date.now() - oldestRequest);
    return Math.max(0, timeToWait);
  }

  resetLimits() {
    this.requests = [];
  }

  isWithinLimit() {
    if (!this.isInitialized) {
      this.init();
    }
    
    return this.checkRateLimit();
  }

  async scheduleRequest(callback) {
    if (!this.isInitialized) {
      this.init();
    }
    
    const waitTime = this.getWaitTime();
    
    if (waitTime === 0) {
      this.addRequest();
      return await callback();
    }
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          this.addRequest();
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, waitTime);
    });
  }

  cleanupOldRequests() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);
  }

  getCurrentUsage() {
    if (!this.isInitialized) {
      this.init();
    }
    
    this.cleanupOldRequests();
    return {
      used: this.requests.length,
      limit: this.requestsPerMinute,
      remaining: this.requestsPerMinute - this.requests.length
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimiter;
} else if (typeof window !== 'undefined') {
  window.RateLimiter = RateLimiter;
}