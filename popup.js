class PopupManager {
  constructor() {
    this.isAnalyzing = false;
    this.currentProgress = 0;
    this.ENTITY_DISPLAY_LIMIT = 50;
    this.elements = {};
    
    this.init();
  }

  async init() {
    await this.initializeElements();
    this.setupEventListeners();
    await this.loadStoredData();
    this.setupMessageListener();
  }

  async initializeElements() {
    this.elements = {
      urlInput: document.getElementById('urlInput'),
      submitBtn: document.getElementById('submitBtn'),
      progressContainer: document.getElementById('progressContainer'),
      progressBar: document.querySelector('.progress-bar'),
      progressText: document.getElementById('progressText'),
      resultsContainer: document.getElementById('resultsContainer'),
      entitiesList: document.getElementById('entitiesList'),
      entityCount: document.getElementById('entityCount'),
      dashboardBtn: document.getElementById('dashboardBtn'),
      errorMessage: document.getElementById('errorMessage')
    };
  }

  setupEventListeners() {
    if (this.elements.submitBtn) {
      this.elements.submitBtn.addEventListener('click', () => this.handleAnalysis());
    }
    
    if (this.elements.dashboardBtn) {
      this.elements.dashboardBtn.addEventListener('click', () => this.openDashboard());
    }
    
    if (this.elements.urlInput) {
      this.elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleAnalysis();
        }
      });
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'PROGRESS_UPDATE':
          this.displayProgress(message.progress);
          break;
        case 'ANALYSIS_COMPLETE':
          this.showResults(message.entities);
          break;
        case 'ANALYSIS_ERROR':
          this.showError(message.error);
          this.updateUI('error');
          break;
      }
    });
  }

  async handleAnalysis() {
    const url = this.elements.urlInput?.value?.trim();
    
    if (!this.validateUrl(url)) {
      this.showError('Please enter a valid URL');
      return;
    }

    if (this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.updateUI('analyzing');
    this.clearErrors();

    try {
      await chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        url: url
      });
    } catch (error) {
      console.error('Analysis request failed:', error);
      this.showError('Failed to start analysis. Please try again.');
      this.updateUI('error');
      this.isAnalyzing = false;
    }
  }

  displayProgress(progress) {
    this.currentProgress = Math.max(0, Math.min(100, progress));
    
    if (this.elements && this.elements.progressBar) {
      this.elements.progressBar.style.width = `${this.currentProgress}%`;
      this.elements.progressBar.setAttribute('aria-valuenow', this.currentProgress);
    }
    
    if (this.elements && this.elements.progressText) {
      this.elements.progressText.textContent = `${this.currentProgress}%`;
    }
  }

  showResults(entities) {
    if (!entities || !Array.isArray(entities)) {
      this.showError('No entities found in analysis');
      this.updateUI('error');
      return;
    }

    this.storeResults(entities);
    this.renderEntities(entities);
    this.updateUI('completed');
    this.isAnalyzing = false;
  }

  renderEntities(entities) {
    if (!this.elements || !this.elements.entitiesList) return;

    const sortedEntities = entities
      .sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0))
      .slice(0, this.ENTITY_DISPLAY_LIMIT);

    this.elements.entitiesList.innerHTML = '';

    if (this.elements.entityCount) {
      this.elements.entityCount.textContent = `${sortedEntities.length} entities found`;
    }

    sortedEntities.forEach(entity => {
      const entityElement = this.createEntityElement(entity);
      this.elements.entitiesList.appendChild(entityElement);
    });
  }

  createEntityElement(entity) {
    const div = document.createElement('div');
    div.className = 'entity-item';
    
    const confidence = Math.round((entity.confidenceScore || 0) * 100);
    const relevanceLevel = this.getRelevanceLevel(confidence);
    
    div.innerHTML = `
      <div class="entity-header">
        <span class="entity-text" title="${entity.entityText || 'Unknown'}">${entity.entityText || 'Unknown'}</span>
        <span class="confidence-badge ${relevanceLevel}">${confidence}%</span>
      </div>
      <div class="entity-meta">
        <span class="entity-type">${entity.type || 'Unknown'}</span>
        ${entity.wikipediaLink ? `<a href="${entity.wikipediaLink}" target="_blank" class="wiki-link">Wiki</a>` : ''}
      </div>
    `;
    
    return div;
  }

  getRelevanceLevel(confidence) {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  }

  async openDashboard() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      this.showError('Unable to open dashboard. Please try again.');
    }
  }

  validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      try {
        const urlWithProtocol = `https://${url}`;
        new URL(urlWithProtocol);
        if (this.elements && this.elements.urlInput) {
          this.elements.urlInput.value = urlWithProtocol;
        }
        return true;
      } catch {
        return false;
      }
    }
  }

  updateUI(state) {
    this.hideAllSections();
    
    switch (state) {
      case 'idle':
        this.setSubmitButton('Analyze', false);
        break;
        
      case 'analyzing':
        this.setSubmitButton('Analyzing...', true);
        this.showSection('progressContainer');
        this.displayProgress(0);
        break;
        
      case 'completed':
        this.setSubmitButton('Analyze', false);
        this.showSection('resultsContainer');
        this.showSection('dashboardBtn');
        break;
        
      case 'error':
        this.setSubmitButton('Analyze', false);
        this.isAnalyzing = false;
        break;
    }
  }

  hideAllSections() {
    if (!this.elements) return;
    
    ['progressContainer', 'resultsContainer', 'dashboardBtn'].forEach(section => {
      if (this.elements[section]) {
        this.elements[section].style.display = 'none';
      }
    });
  }

  showSection(section) {
    if (this.elements && this.elements[section]) {
      this.elements[section].style.display = 'block';
    }
  }

  setSubmitButton(text, disabled) {
    if (this.elements && this.elements.submitBtn) {
      this.elements.submitBtn.textContent = text;
      this.elements.submitBtn.disabled = disabled;
    }
  }

  showError(message) {
    if (this.elements && this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
      this.elements.errorMessage.style.display = 'block';
    }
  }

  clearErrors() {
    if (this.elements && this.elements.errorMessage) {
      this.elements.errorMessage.style.display = 'none';
      this.elements.errorMessage.textContent = '';
    }
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['lastAnalysis', 'lastUrl']);
      
      if (result.lastUrl && this.elements && this.elements.urlInput) {
        this.elements.urlInput.value = result.lastUrl;
      }
      
      if (result.lastAnalysis && result.lastAnalysis.entities) {
        this.showResults(result.lastAnalysis.entities);
      }
    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }

  async storeResults(entities) {
    try {
      const analysisData = {
        entities: entities,
        timestamp: Date.now(),
        url: this.elements && this.elements.urlInput ? this.elements.urlInput.value : ''
      };
      
      await chrome.storage.local.set({
        lastAnalysis: analysisData,
        lastUrl: this.elements && this.elements.urlInput ? this.elements.urlInput.value : ''
      });
    } catch (error) {
      console.error('Failed to store results:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});