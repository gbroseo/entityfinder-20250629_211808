let debounceTimer;

async function initOptions() {
    try {
        await loadOptions();
        setupEventListeners();
        await updateSubscriptionInfo();
        
        // Test connection on load if API key exists
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey) {
            await testApiConnection();
        }
    } catch (error) {
        console.error('Failed to initialize options:', error);
        showNotification('Failed to load settings', 'error');
    }
}

function setupEventListeners() {
    try {
        // Save button
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveOptions);
        }
        
        // Test connection button
        const testConnection = document.getElementById('testConnection');
        if (testConnection) {
            testConnection.addEventListener('click', testApiConnection);
        }
        
        // Reset settings button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetSettings);
        }
        
        // Auto-save on input changes with debouncing
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(saveOptions, 1000);
                });
                
                input.addEventListener('change', saveOptions);
            }
        });
        
        // API key validation on blur
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('blur', (e) => {
                validateApiKey(e.target.value);
            });
        }
        
        // Advanced settings toggle
        const advancedToggle = document.getElementById('advancedToggle');
        if (advancedToggle) {
            advancedToggle.addEventListener('click', toggleAdvancedSettings);
        }
    } catch (error) {
        console.error('Failed to setup event listeners:', error);
    }
}

async function saveOptions() {
    try {
        const options = {
            apiKey: document.getElementById('apiKey')?.value.trim() || '',
            requestsPerDay: parseInt(document.getElementById('requestsPerDay')?.value) || 100,
            confidenceThreshold: parseFloat(document.getElementById('confidenceThreshold')?.value) || 0.5,
            maxEntitiesPerPage: parseInt(document.getElementById('maxEntitiesPerPage')?.value) || 50,
            autoAnalyze: document.getElementById('autoAnalyze')?.checked || false,
            darkMode: document.getElementById('darkMode')?.checked || false,
            notifications: document.getElementById('notifications')?.checked || true,
            saveHistory: document.getElementById('saveHistory')?.checked || true,
            exportFormat: document.getElementById('exportFormat')?.value || 'csv',
            rateLimitDelay: parseInt(document.getElementById('rateLimitDelay')?.value) || 1000,
            retryAttempts: parseInt(document.getElementById('retryAttempts')?.value) || 3,
            enableLogging: document.getElementById('enableLogging')?.checked || false,
            customCategories: (document.getElementById('customCategories')?.value || '').split('\n').filter(cat => cat.trim()),
            excludedDomains: (document.getElementById('excludedDomains')?.value || '').split('\n').filter(domain => domain.trim()),
            lastUpdated: Date.now()
        };
        
        // Validate required fields
        if (!options.apiKey) {
            showNotification('API Key is required', 'error');
            if (document.getElementById('apiKey')) {
                document.getElementById('apiKey').focus();
            }
            return false;
        }
        
        if (!validateApiKey(options.apiKey)) {
            showNotification('Invalid API Key format', 'error');
            if (document.getElementById('apiKey')) {
                document.getElementById('apiKey').focus();
            }
            return false;
        }
        
        // Validate numeric ranges
        if (options.confidenceThreshold < 0 || options.confidenceThreshold > 1) {
            showNotification('Confidence threshold must be between 0 and 1', 'error');
            return false;
        }
        
        if (options.maxEntitiesPerPage < 1 || options.maxEntitiesPerPage > 200) {
            showNotification('Max entities per page must be between 1 and 200', 'error');
            return false;
        }
        
        // Save to chrome storage
        await chrome.storage.sync.set(options);
        
        // Apply dark mode immediately
        if (options.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Update usage tracking
        await updateUsageStats();
        
        showNotification('Settings saved successfully', 'success');
        
        // Send message to background script about settings change
        try {
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                options: options
            });
        } catch (error) {
            console.error('Failed to send settings update message:', error);
        }
        
        return true;
    } catch (error) {
        console.error('Failed to save options:', error);
        showNotification('Failed to save settings', 'error');
        return false;
    }
}

async function loadOptions() {
    try {
        const defaultOptions = {
            apiKey: '',
            requestsPerDay: 100,
            confidenceThreshold: 0.5,
            maxEntitiesPerPage: 50,
            autoAnalyze: true,
            darkMode: false,
            notifications: true,
            saveHistory: true,
            exportFormat: 'csv',
            rateLimitDelay: 1000,
            retryAttempts: 3,
            enableLogging: false,
            customCategories: [],
            excludedDomains: []
        };
        
        const stored = await chrome.storage.sync.get(defaultOptions);
        
        // Populate form fields
        if (document.getElementById('apiKey')) {
            document.getElementById('apiKey').value = stored.apiKey || '';
        }
        if (document.getElementById('requestsPerDay')) {
            document.getElementById('requestsPerDay').value = stored.requestsPerDay;
        }
        if (document.getElementById('confidenceThreshold')) {
            document.getElementById('confidenceThreshold').value = stored.confidenceThreshold;
        }
        if (document.getElementById('maxEntitiesPerPage')) {
            document.getElementById('maxEntitiesPerPage').value = stored.maxEntitiesPerPage;
        }
        if (document.getElementById('autoAnalyze')) {
            document.getElementById('autoAnalyze').checked = stored.autoAnalyze;
        }
        if (document.getElementById('darkMode')) {
            document.getElementById('darkMode').checked = stored.darkMode;
        }
        if (document.getElementById('notifications')) {
            document.getElementById('notifications').checked = stored.notifications;
        }
        if (document.getElementById('saveHistory')) {
            document.getElementById('saveHistory').checked = stored.saveHistory;
        }
        if (document.getElementById('exportFormat')) {
            document.getElementById('exportFormat').value = stored.exportFormat;
        }
        if (document.getElementById('rateLimitDelay')) {
            document.getElementById('rateLimitDelay').value = stored.rateLimitDelay;
        }
        if (document.getElementById('retryAttempts')) {
            document.getElementById('retryAttempts').value = stored.retryAttempts;
        }
        if (document.getElementById('enableLogging')) {
            document.getElementById('enableLogging').checked = stored.enableLogging;
        }
        if (document.getElementById('customCategories')) {
            document.getElementById('customCategories').value = (stored.customCategories || []).join('\n');
        }
        if (document.getElementById('excludedDomains')) {
            document.getElementById('excludedDomains').value = (stored.excludedDomains || []).join('\n');
        }
        
        // Apply dark mode
        if (stored.darkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Update confidence threshold display
        if (document.getElementById('confidenceValue')) {
            document.getElementById('confidenceValue').textContent = stored.confidenceThreshold;
        }
        
    } catch (error) {
        console.error('Failed to load options:', error);
        showNotification('Failed to load settings', 'error');
    }
}

function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
        updateValidationStatus('apiKey', false, 'API Key is required');
        return false;
    }
    
    // TextRazor API key format validation (typically 40 characters alphanumeric)
    const apiKeyPattern = /^[a-zA-Z0-9]{32,50}$/;
    
    if (!apiKeyPattern.test(key.trim())) {
        updateValidationStatus('apiKey', false, 'Invalid API Key format');
        return false;
    }
    
    updateValidationStatus('apiKey', true, 'Valid format');
    return true;
}

async function testApiConnection() {
    const testButton = document.getElementById('testConnection');
    const apiKey = document.getElementById('apiKey')?.value.trim();
    
    if (!apiKey) {
        showNotification('Please enter an API key first', 'warning');
        return;
    }
    
    if (!validateApiKey(apiKey)) {
        showNotification('Please enter a valid API key', 'error');
        return;
    }
    
    try {
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = 'Testing...';
        }
        
        // Make a test request to TextRazor API
        const response = await fetch('https://api.textrazor.com/account', {
            method: 'GET',
            headers: {
                'X-TextRazor-Key': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        if (response.ok) {
            const accountInfo = await response.json();
            showNotification('API connection successful!', 'success');
            
            // Update account info display
            if (accountInfo.requestsRemaining !== undefined && document.getElementById('requestsRemaining')) {
                document.getElementById('requestsRemaining').textContent = accountInfo.requestsRemaining.toLocaleString();
            }
            
            updateValidationStatus('apiKey', true, 'Connection verified');
            
            // Save the validated API key
            await saveOptions();
            
        } else if (response.status === 401) {
            showNotification('Invalid API key', 'error');
            updateValidationStatus('apiKey', false, 'Authentication failed');
        } else if (response.status === 403) {
            showNotification('API key does not have required permissions', 'error');
            updateValidationStatus('apiKey', false, 'Insufficient permissions');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('API connection test failed:', error);
        showNotification(`Connection failed: ${error.message}`, 'error');
        updateValidationStatus('apiKey', false, 'Connection failed');
    } finally {
        if (testButton) {
            testButton.disabled = false;
            testButton.textContent = 'Test Connection';
        }
    }
}

async function updateSubscriptionInfo() {
    const apiKey = document.getElementById('apiKey')?.value.trim();
    
    if (!apiKey || !validateApiKey(apiKey)) {
        return;
    }
    
    try {
        const response = await fetch('https://api.textrazor.com/account', {
            method: 'GET',
            headers: {
                'X-TextRazor-Key': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        if (response.ok) {
            const accountInfo = await response.json();
            
            // Update subscription display
            if (document.getElementById('planType')) {
                document.getElementById('planType').textContent = accountInfo.plan || 'Free';
            }
            if (document.getElementById('requestsRemaining')) {
                document.getElementById('requestsRemaining').textContent = 
                    (accountInfo.requestsRemaining || 0).toLocaleString();
            }
            if (document.getElementById('requestsPerDay')) {
                document.getElementById('requestsPerDay').max = accountInfo.dailyRequestsLimit || 500;
            }
            
            // Update usage statistics
            const usageStats = await chrome.storage.local.get(['dailyUsage', 'lastResetDate']);
            const today = new Date().toDateString();
            
            if (usageStats.lastResetDate !== today) {
                await chrome.storage.local.set({
                    dailyUsage: 0,
                    lastResetDate: today
                });
                if (document.getElementById('requestsUsed')) {
                    document.getElementById('requestsUsed').textContent = '0';
                }
            } else {
                if (document.getElementById('requestsUsed')) {
                    document.getElementById('requestsUsed').textContent = 
                        (usageStats.dailyUsage || 0).toLocaleString();
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to update subscription info:', error);
    }
}

async function resetSettings() {
    const confirmed = confirm(
        'Are you sure you want to reset all settings to default values? This action cannot be undone.'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Clear all stored settings
        await chrome.storage.sync.clear();
        await chrome.storage.local.clear();
        
        // Reload default values
        await loadOptions();
        
        showNotification('Settings have been reset to defaults', 'success');
        
        // Send message to background script about settings change
        try {
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                options: {}
            });
        } catch (error) {
            console.error('Failed to send settings reset message:', error);
        }
        
        // Refresh subscription info
        setTimeout(updateSubscriptionInfo, 1000);
        
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showNotification('Failed to reset settings', 'error');
    }
}

async function updateUsageStats() {
    try {
        const stats = await chrome.storage.local.get(['totalAnalyses', 'successfulAnalyses', 'failedAnalyses']);
        
        if (document.getElementById('totalAnalyses')) {
            document.getElementById('totalAnalyses').textContent = (stats.totalAnalyses || 0).toLocaleString();
        }
        if (document.getElementById('successfulAnalyses')) {
            document.getElementById('successfulAnalyses').textContent = (stats.successfulAnalyses || 0).toLocaleString();
        }
        if (document.getElementById('failedAnalyses')) {
            document.getElementById('failedAnalyses').textContent = (stats.failedAnalyses || 0).toLocaleString();
        }
        
        const successRate = stats.totalAnalyses > 0 ? 
            ((stats.successfulAnalyses || 0) / stats.totalAnalyses * 100).toFixed(1) : '0';
        if (document.getElementById('successRate')) {
            document.getElementById('successRate').textContent = `${successRate}%`;
        }
        
    } catch (error) {
        console.error('Failed to update usage stats:', error);
    }
}

function updateValidationStatus(fieldId, isValid, message) {
    const field = document.getElementById(fieldId);
    const feedback = document.getElementById(`${fieldId}Feedback`);
    
    if (feedback) {
        feedback.textContent = message;
        feedback.className = `validation-feedback ${isValid ? 'valid' : 'invalid'}`;
    }
    
    if (field) {
        field.classList.toggle('valid', isValid);
        field.classList.toggle('invalid', !isValid);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notifications') || document.body;
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
    
    // Add click to dismiss
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
}

function toggleAdvancedSettings() {
    const advancedSection = document.getElementById('advancedSettings');
    const toggleButton = document.getElementById('advancedToggle');
    
    if (!advancedSection || !toggleButton) {
        return;
    }
    
    const isHidden = advancedSection.style.display === 'none' || !advancedSection.style.display;
    
    if (isHidden) {
        advancedSection.style.display = 'block';
        toggleButton.textContent = 'Hide Advanced Settings';
        toggleButton.setAttribute('aria-expanded', 'true');
    } else {
        advancedSection.style.display = 'none';
        toggleButton.textContent = 'Show Advanced Settings';
        toggleButton.setAttribute('aria-expanded', 'false');
    }
}

// Update confidence threshold display
document.addEventListener('DOMContentLoaded', () => {
    const confidenceSlider = document.getElementById('confidenceThreshold');
    const confidenceValue = document.getElementById('confidenceValue');
    
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.addEventListener('input', (e) => {
            confidenceValue.textContent = parseFloat(e.target.value).toFixed(2);
        });
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initOptions);

// Handle extension messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REFRESH_SUBSCRIPTION_INFO') {
        updateSubscriptionInfo();
    } else if (message.type === 'UPDATE_USAGE_STATS') {
        updateUsageStats();
    }
});