class ErrorHandler {
  constructor() {
    this.errors = new Map();
    this.errorListeners = [];
    this.retryableErrorCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_ERROR',
      'SERVER_ERROR',
      'CONNECTION_ERROR'
    ];
    this.errorMessages = {
      'UNKNOWN_ERROR': 'An unexpected error occurred',
      'NETWORK_ERROR': 'Network connection error',
      'TIMEOUT_ERROR': 'Request timed out',
      'RATE_LIMIT_ERROR': 'Rate limit exceeded',
      'SERVER_ERROR': 'Server error occurred',
      'CONNECTION_ERROR': 'Connection failed',
      'UNAUTHORIZED': 'Unauthorized access',
      'FORBIDDEN': 'Access forbidden',
      'API_QUOTA_EXCEEDED': 'API quota exceeded'
    };
  }

  async init() {
    await this.loadStoredErrors();
    this.setupErrorListeners();
    return this;
  }

  setupErrorListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(event.error, { type: 'javascript', source: 'window' });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, { type: 'promise', source: 'unhandled' });
      });
    }
  }

  handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    const errorData = {
      id: errorId,
      timestamp,
      message: error?.message || error || 'Unknown error',
      stack: error?.stack,
      code: error?.code || context.errorCode,
      context: {
        ...context,
        url: window.location?.href,
        userAgent: navigator.userAgent,
        extensionId: chrome?.runtime?.id
      }
    };

    this.errors.set(errorId, errorData);
    this.logError(error, errorData);
    this.notifyErrorListeners(errorData);
    
    if (context.showToUser !== false) {
      const userMessage = this.getErrorMessage(errorData.code) || errorData.message;
      this.showUserError(userMessage);
    }

    this.persistError(errorData);
    return errorId;
  }

  logError(error, details) {
    const logLevel = this.getLogLevel(details.code);
    const logMessage = `[${details.timestamp}] ${logLevel}: ${details.message}`;
    
    console.group(`EntityScout Pro Error - ${details.id}`);
    console.error(logMessage);
    
    if (details.stack) {
      console.error('Stack trace:', details.stack);
    }
    
    console.error('Context:', details.context);
    console.groupEnd();

    if (chrome?.storage?.local) {
      this.storeErrorLog(details);
    }
  }

  showUserError(message, options = {}) {
    const {
      type = 'error',
      duration = 5000,
      dismissible = true,
      actions = []
    } = options;

    if (this.isPopupContext()) {
      this.showPopupError(message, { type, duration, dismissible, actions });
    } else if (this.isContentContext()) {
      this.showContentError(message, { type, duration, dismissible });
    } else {
      this.showNotificationError(message, { type, duration });
    }
  }

  showPopupError(message, options) {
    const errorContainer = document.getElementById('error-container') || this.createErrorContainer();
    const errorElement = this.createErrorElement(message, options);
    
    errorContainer.appendChild(errorElement);
    
    if (options.duration > 0) {
      setTimeout(() => {
        this.removeErrorElement(errorElement);
      }, options.duration);
    }
  }

  showContentError(message, options) {
    chrome.runtime.sendMessage({
      type: 'SHOW_ERROR',
      message,
      options
    });
  }

  showNotificationError(message, options) {
    if (chrome?.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'EntityScout Pro Error',
        message: message.substring(0, 300)
      });
    }
  }

  isRetryableError(error) {
    const errorCode = error?.code || error?.name;
    const statusCode = error?.status || error?.statusCode;
    
    if (this.retryableErrorCodes.includes(errorCode)) {
      return true;
    }
    
    if (statusCode) {
      return statusCode >= 500 || statusCode === 429 || statusCode === 408;
    }
    
    if (error?.message) {
      const retryablePatterns = [
        /network/i,
        /timeout/i,
        /connection/i,
        /temporarily/i,
        /rate limit/i
      ];
      
      return retryablePatterns.some(pattern => pattern.test(error.message));
    }
    
    return false;
  }

  clearError(errorId) {
    if (errorId) {
      this.errors.delete(errorId);
      this.removeStoredError(errorId);
      this.removeErrorFromUI(errorId);
    } else {
      this.errors.clear();
      this.clearStoredErrors();
      this.clearErrorsFromUI();
    }
  }

  getErrorMessage(errorCode) {
    return this.errorMessages[errorCode] || this.errorMessages['UNKNOWN_ERROR'];
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getLogLevel(errorCode) {
    const criticalErrors = ['UNAUTHORIZED', 'FORBIDDEN', 'API_QUOTA_EXCEEDED'];
    const warningErrors = ['RATE_LIMIT_ERROR', 'TIMEOUT_ERROR'];
    
    if (criticalErrors.includes(errorCode)) return 'CRITICAL';
    if (warningErrors.includes(errorCode)) return 'WARNING';
    return 'ERROR';
  }

  isPopupContext() {
    return window.location?.pathname?.includes('popup.html') || 
           document.querySelector('[data-context="popup"]');
  }

  isContentContext() {
    return window.location?.protocol?.includes('http') && 
           !window.location?.pathname?.includes('chrome-extension');
  }

  createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'entityscout-error-container';
    document.body.appendChild(container);
    return container;
  }

  createErrorElement(message, options) {
    const errorEl = document.createElement('div');
    errorEl.className = `entityscout-error entityscout-error--${options.type}`;
    
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    errorEl.appendChild(messageEl);
    
    if (options.dismissible) {
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '?';
      closeBtn.onclick = () => this.removeErrorElement(errorEl);
      errorEl.appendChild(closeBtn);
    }
    
    options.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.onclick = action.handler;
      errorEl.appendChild(btn);
    });
    
    return errorEl;
  }

  removeErrorElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  removeErrorFromUI(errorId) {
    const element = document.querySelector(`[data-error-id="${errorId}"]`);
    if (element) {
      this.removeErrorElement(element);
    }
  }

  clearErrorsFromUI() {
    const container = document.getElementById('error-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  async persistError(errorData) {
    if (chrome?.storage?.local) {
      try {
        const stored = await chrome.storage.local.get('errors');
        const errors = stored.errors || [];
        errors.push(errorData);
        
        if (errors.length > 100) {
          errors.splice(0, errors.length - 100);
        }
        
        await chrome.storage.local.set({ errors });
      } catch (err) {
        console.warn('Failed to persist error:', err);
      }
    }
  }

  async loadStoredErrors() {
    if (chrome?.storage?.local) {
      try {
        const stored = await chrome.storage.local.get('errors');
        const errors = stored.errors || [];
        errors.forEach(error => this.errors.set(error.id, error));
      } catch (err) {
        console.warn('Failed to load stored errors:', err);
      }
    }
  }

  async removeStoredError(errorId) {
    if (chrome?.storage?.local) {
      try {
        const stored = await chrome.storage.local.get('errors');
        const errors = (stored.errors || []).filter(err => err.id !== errorId);
        await chrome.storage.local.set({ errors });
      } catch (err) {
        console.warn('Failed to remove stored error:', err);
      }
    }
  }

  async clearStoredErrors() {
    if (chrome?.storage?.local) {
      try {
        await chrome.storage.local.remove('errors');
      } catch (err) {
        console.warn('Failed to clear stored errors:', err);
      }
    }
  }

  async storeErrorLog(errorData) {
    try {
      const stored = await chrome.storage.local.get('errorLogs');
      const logs = stored.errorLogs || [];
      
      logs.push({
        id: errorData.id,
        timestamp: errorData.timestamp,
        level: this.getLogLevel(errorData.code),
        message: errorData.message,
        context: errorData.context
      });
      
      if (logs.length > 500) {
        logs.splice(0, logs.length - 500);
      }
      
      await chrome.storage.local.set({ errorLogs: logs });
    } catch (err) {
      console.warn('Failed to store error log:', err);
    }
  }

  notifyErrorListeners(errorData) {
    this.errorListeners.forEach(listener => {
      try {
        listener(errorData);
      } catch (err) {
        console.warn('Error listener failed:', err);
      }
    });
  }

  addErrorListener(listener) {
    this.errorListeners.push(listener);
  }

  removeErrorListener(listener) {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  getErrors() {
    return Array.from(this.errors.values());
  }

  getError(errorId) {
    return this.errors.get(errorId);
  }
}

const errorHandler = new ErrorHandler().init();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}