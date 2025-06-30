importScripts('storagemanager.js', 'syncmanager.js');

let quotaUsage = 0;
let apiKey = '';
let isProcessing = false;

async function init() {
  try {
    const result = await chrome.storage.sync.get(['apiKey', 'quotaUsage']);
    apiKey = result.apiKey || '';
    quotaUsage = result.quotaUsage || 0;

    if (!apiKey) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    }

    if (typeof syncManager !== 'undefined') {
      await syncManager.init();
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'processUrl':
      if (!isProcessing) {
        processUrl(request.url, sender.tab.id);
        sendResponse({ status: 'processing' });
      } else {
        sendResponse({ status: 'busy' });
      }
      break;
      
    case 'getQuotaUsage':
      sendResponse({ quota: quotaUsage });
      break;
      
    case 'updateApiKey':
      apiKey = request.apiKey;
      chrome.storage.sync.set({ apiKey: apiKey });
      if (apiKey) {
        chrome.action.setBadgeText({ text: '' });
      }
      sendResponse({ status: 'updated' });
      break;
      
    case 'getProcessingStatus':
      sendResponse({ isProcessing: isProcessing });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true;
}

async function processUrl(url, tabId) {
  if (!apiKey) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: 'API key not configured'
    });
    return;
  }
  
  if (quotaUsage >= 500) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: 'Daily quota exceeded'
    });
    return;
  }
  
  isProcessing = true;
  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#0066cc' });
  
  try {
    const response = await fetch('https://api.textrazor.com/', {
      method: 'POST',
      headers: {
        'X-TextRazor-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        extractors: 'entities,topics,phrases',
        url: url,
        cleanup: 'true',
        cleanup.mode: 'cleanHTML',
        cleanup.returnCleaned: 'true'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    handleApiResponse(data, tabId);
    
  } catch (error) {
    console.error('Processing error:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: 'Failed to analyze URL: ' + error.message
    });
  } finally {
    isProcessing = false;
    chrome.action.setBadgeText({ text: '' });
  }
}

function handleApiResponse(data, tabId) {
  if (!data.response || !data.response.entities) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: 'No entities found'
    });
    return;
  }
  
  quotaUsage++;
  chrome.storage.sync.set({ quotaUsage: quotaUsage });
  
  const entities = data.response.entities
    .filter(entity => entity.confidenceScore >= 0.5)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 50)
    .map(entity => ({
      text: entity.entityId,
      type: entity.type || 'Unknown',
      confidence: Math.round(entity.confidenceScore * 100),
      relevance: Math.round(entity.relevanceScore * 100),
      mentions: entity.matchedText || []
    }));
  
  const topics = (data.response.topics || [])
    .filter(topic => topic.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(topic => ({
      label: topic.label,
      score: Math.round(topic.score * 100),
      wikiLink: topic.wikiLink
    }));
  
  const phrases = (data.response.phrases || [])
    .filter(phrase => phrase.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(phrase => ({
      text: phrase.phrase,
      score: Math.round(phrase.score * 100)
    }));
  
  const processedData = {
    entities: entities,
    topics: topics,
    phrases: phrases,
    metadata: {
      totalEntities: entities.length,
      averageConfidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length || 0,
      processingTime: new Date().toISOString(),
      quotaRemaining: 500 - quotaUsage
    }
  };
  
  chrome.storage.local.set({
    [`analysis_${Date.now()}`]: {
      url: data.response.cleanedText ? data.response.url : 'Unknown',
      timestamp: Date.now(),
      data: processedData
    }
  });
  
  chrome.tabs.sendMessage(tabId, {
    action: 'showResults',
    data: processedData
  });
}

function onInstalled() {
  chrome.storage.local.clear();
  chrome.storage.sync.set({
    quotaUsage: 0,
    lastReset: Date.now()
  });
  
  setupAlarms();
  init();
  
  chrome.contextMenus.create({
    id: 'analyzeEntity',
    title: 'Analyze with EntityScout Pro',
    contexts: ['page', 'link']
  });
}

function setupAlarms() {
  chrome.alarms.create('dailyQuotaReset', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60
  });
  
  chrome.alarms.create('quotaCheck', {
    delayInMinutes: 1,
    periodInMinutes: 60
  });
}

function handleQuotaCheck(alarm) {
  switch (alarm.name) {
    case 'dailyQuotaReset':
      quotaUsage = 0;
      chrome.storage.sync.set({
        quotaUsage: 0,
        lastReset: Date.now()
      });
      chrome.action.setBadgeText({ text: '' });
      break;
      
    case 'quotaCheck':
      if (quotaUsage >= 450) {
        chrome.action.setBadgeText({ text: '?' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff9900' });
      } else if (quotaUsage >= 500) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
      }
      break;
  }
}

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleQuotaCheck);
chrome.runtime.onInstalled.addListener(onInstalled);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeEntity') {
    const url = info.linkUrl || info.pageUrl;
    if (url) {
      processUrl(url, tab.id);
    }
  }
});

init();