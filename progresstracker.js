class ProgressTracker {
  constructor() {
    this.activeTasks = new Map();
    this.progressElements = new Map();
    this.isInitialized = false;
    this.defaultConfig = {
      backgroundColor: '#e0e0e0',
      barColor: '#2196F3',
      textColor: '#333333',
      borderRadius: '4px',
      height: '20px',
      animationDuration: '0.3s'
    };
  }

  init() {
    if (this.isInitialized) {
      return this;
    }

    this.injectStyles();
    this.setupEventListeners();
    this.isInitialized = true;
    return this;
  }

  injectStyles() {
    const existingStyles = document.getElementById('progress-tracker-styles');
    if (existingStyles) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'progress-tracker-styles';
    style.textContent = `
      .progress-tracker-container {
        width: 100%;
        background-color: ${this.defaultConfig.backgroundColor};
        border-radius: ${this.defaultConfig.borderRadius};
        overflow: hidden;
        position: relative;
        height: ${this.defaultConfig.height};
        margin: 8px 0;
      }
      
      .progress-tracker-bar {
        height: 100%;
        background-color: ${this.defaultConfig.barColor};
        width: 0%;
        transition: width ${this.defaultConfig.animationDuration} ease-in-out;
        border-radius: ${this.defaultConfig.borderRadius};
      }
      
      .progress-tracker-text {
        font-size: 12px;
        color: ${this.defaultConfig.textColor};
        margin-top: 4px;
        text-align: center;
      }
      
      .progress-tracker-wrapper {
        display: none;
        padding: 8px;
      }
      
      .progress-tracker-wrapper.visible {
        display: block;
      }
      
      .progress-tracker-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid ${this.defaultConfig.backgroundColor};
        border-top: 2px solid ${this.defaultConfig.barColor};
        border-radius: 50%;
        animation: progress-spin 1s linear infinite;
        display: inline-block;
        margin-right: 8px;
      }
      
      @keyframes progress-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
  }

  setupEventListeners() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          try {
            if (message.type === 'progress_update') {
              this.updateProgress(message.taskId, message.percentage);
            } else if (message.type === 'progress_complete') {
              this.completeProgress(message.taskId);
            } else if (message.type === 'progress_start') {
              this.startProgress(message.taskId);
            }
          } catch (error) {
            console.warn('ProgressTracker: Error handling message:', error);
          }
        });
      }
    } catch (error) {
      console.debug('ProgressTracker: Chrome extension API not available:', error);
    }
  }

  startProgress(taskId, options = {}) {
    if (!taskId) {
      console.error('ProgressTracker: taskId is required');
      return false;
    }

    const task = {
      id: taskId,
      startTime: Date.now(),
      percentage: 0,
      message: options.message || 'Processing...',
      status: 'active',
      ...options
    };

    this.activeTasks.set(taskId, task);
    
    this.progressElements.forEach((wrapper, element) => {
      this.updateProgressDisplay(wrapper, task);
      this.showProgressBar(element);
    });

    this.notifyBackground('progress_started', task);
    return true;
  }

  updateProgress(taskId, percentage, message = null) {
    if (!this.activeTasks.has(taskId)) {
      console.warn(`ProgressTracker: No active task found for ID: ${taskId}`);
      return false;
    }

    const task = this.activeTasks.get(taskId);
    task.percentage = Math.max(0, Math.min(100, percentage));
    task.lastUpdate = Date.now();
    
    if (message) {
      task.message = message;
    }

    this.progressElements.forEach((wrapper, element) => {
      this.updateProgressDisplay(wrapper, task);
    });

    this.notifyBackground('progress_updated', task);
    return true;
  }

  completeProgress(taskId, finalMessage = null) {
    if (!this.activeTasks.has(taskId)) {
      console.warn(`ProgressTracker: No active task found for ID: ${taskId}`);
      return false;
    }

    const task = this.activeTasks.get(taskId);
    task.percentage = 100;
    task.status = 'completed';
    task.completedTime = Date.now();
    task.message = finalMessage || task.message || 'Completed';

    this.progressElements.forEach((wrapper, element) => {
      this.updateProgressDisplay(wrapper, task);
      
      setTimeout(() => {
        this.hideProgressBar(element);
      }, 1500);
    });

    this.notifyBackground('progress_completed', task);
    
    setTimeout(() => {
      this.activeTasks.delete(taskId);
    }, 2000);

    return true;
  }

  showProgressBar(element) {
    if (!element) return false;

    let wrapper = element.querySelector('.progress-tracker-wrapper');
    
    if (!wrapper) {
      wrapper = this.createProgressElement();
      element.appendChild(wrapper);
      this.progressElements.set(element, wrapper);
    }

    wrapper.classList.add('visible');
    return true;
  }

  hideProgressBar(element) {
    if (!element) return false;

    const wrapper = element.querySelector('.progress-tracker-wrapper');
    if (wrapper) {
      wrapper.classList.remove('visible');
    }

    return true;
  }

  setProgressMessage(message, taskId = null) {
    if (taskId && this.activeTasks.has(taskId)) {
      const task = this.activeTasks.get(taskId);
      task.message = message;
      
      this.progressElements.forEach((wrapper, element) => {
        this.updateProgressDisplay(wrapper, task);
      });
    } else {
      this.progressElements.forEach((wrapper, element) => {
        const textElement = wrapper.querySelector('.progress-tracker-text');
        if (textElement) {
          textElement.textContent = message;
        }
      });
    }
  }

  createProgressElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'progress-tracker-wrapper';
    
    const container = document.createElement('div');
    container.className = 'progress-tracker-container';
    
    const bar = document.createElement('div');
    bar.className = 'progress-tracker-bar';
    
    const text = document.createElement('div');
    text.className = 'progress-tracker-text';
    
    container.appendChild(bar);
    wrapper.appendChild(container);
    wrapper.appendChild(text);
    
    return wrapper;
  }

  updateProgressDisplay(wrapper, task) {
    const bar = wrapper.querySelector('.progress-tracker-bar');
    const text = wrapper.querySelector('.progress-tracker-text');
    
    if (bar) {
      bar.style.width = `${task.percentage}%`;
      
      if (task.status === 'completed') {
        bar.style.backgroundColor = '#4CAF50';
      }
    }
    
    if (text) {
      text.textContent = `${task.message} (${Math.round(task.percentage)}%)`;
    }
  }

  notifyBackground(type, data) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: `progress_tracker_${type}`,
          data: data
        }).catch(err => {
          console.debug('ProgressTracker: Background notification failed:', err);
        });
      }
    } catch (error) {
      console.debug('ProgressTracker: Background notification error:', error);
    }
  }

  getActiveTask(taskId) {
    return this.activeTasks.get(taskId);
  }

  getAllActiveTasks() {
    return Array.from(this.activeTasks.values());
  }

  cancelProgress(taskId) {
    if (!this.activeTasks.has(taskId)) return false;

    const task = this.activeTasks.get(taskId);
    task.status = 'cancelled';
    task.message = 'Cancelled';

    this.progressElements.forEach((wrapper, element) => {
      this.hideProgressBar(element);
    });

    this.activeTasks.delete(taskId);
    this.notifyBackground('progress_cancelled', task);
    return true;
  }

  destroy() {
    this.activeTasks.clear();
    this.progressElements.clear();
    
    const styleElement = document.getElementById('progress-tracker-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    document.querySelectorAll('.progress-tracker-wrapper').forEach(el => {
      el.remove();
    });
    
    this.isInitialized = false;
  }
}

const progressTracker = new ProgressTracker().init();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTracker;
}

if (typeof window !== 'undefined') {
  window.ProgressTracker = ProgressTracker;
  window.progressTracker = progressTracker;
}