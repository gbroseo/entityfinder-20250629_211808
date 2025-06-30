export const API_CONFIG = {
  TEXTRAZOR_BASE_URL: 'https://api.textrazor.com',
  TEXTRAZOR_ENDPOINT: '/v1/entities',
  RATE_LIMIT_DELAY: 1000,
  REQUEST_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  MAX_TEXT_LENGTH: 200000 // TextRazor max text length per request
};

// Entity Analysis Configuration
export const ENTITY_CONFIG = {
  MIN_CONFIDENCE_SCORE: 0.5,
  MIN_RELEVANCE_SCORE: 0.3,
  MAX_ENTITIES_PER_PAGE: 100,
  SUPPORTED_TYPES: [
    'Person',
    'Organization',
    'Location',
    'Product',
    'Technology',
    'Brand',
    'Topic'
  ]
};

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: 'textrazor_api_key',
  ANALYSIS_HISTORY: 'analysis_history',
  USER_SETTINGS: 'user_settings',
  CACHED_ENTITIES: 'cached_entities',
  LAST_ANALYSIS: 'last_analysis_timestamp'
};

// Analysis Status States
export const ANALYSIS_STATUS = {
  IDLE: 'idle',
  SCRAPING: 'scraping',
  ANALYZING: 'analyzing',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_API_KEY: 'Invalid or missing TextRazor API key',
  NETWORK_ERROR: 'Network connection error',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded',
  INVALID_URL: 'Invalid URL provided',
  SCRAPING_FAILED: 'Failed to scrape website content',
  ANALYSIS_FAILED: 'Entity analysis failed',
  STORAGE_ERROR: 'Local storage error',
  CONTENT_TOO_LONG: 'Content exceeds maximum length limit (100KB)'
};

// UI Constants
export const UI_CONFIG = {
  POPUP_WIDTH: 400,
  POPUP_HEIGHT: 600,
  RESULTS_PER_PAGE: 20,
  CHART_COLORS: [
    '#3498db',
    '#e74c3c',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#34495e',
    '#e67e22',
    '#95a5a6',
    '#16a085',
    '#c0392b',
    '#8e44ad',
    '#2980b9',
    '#27ae60',
    '#f1c40f'
  ]
};

// Export Formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  PDF: 'pdf'
};

// Competitor Analysis
export const COMPETITOR_CONFIG = {
  MAX_COMPETITORS: 10,
  COMPARISON_METRICS: [
    'entity_count',
    'confidence_average',
    'relevance_average',
    'unique_entities',
    'topic_coverage'
  ]
};

// Content Extraction - aligned with TextRazor API limits
export const CONTENT_CONFIG = {
  MAX_CONTENT_LENGTH: 100000, // 100KB limit to stay within TextRazor constraints and ensure reliable processing
  EXCLUDED_SELECTORS: [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    '.advertisement',
    '.sidebar'
  ],
  PREFERRED_SELECTORS: [
    'main',
    'article',
    '.content',
    '#content',
    '.post-content'
  ]
};

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Extension Permissions - using activeTab for better security
export const PERMISSIONS = {
  ACTIVE_TAB: 'activeTab',
  STORAGE: 'storage'
};

// Analysis Report Templates
export const REPORT_TEMPLATES = {
  SUMMARY: 'summary',
  DETAILED: 'detailed',
  COMPARISON: 'comparison',
  TRENDING: 'trending'
};

// Cache Settings
export const CACHE_CONFIG = {
  TTL: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  MAX_ENTRIES: 1000,
  CLEANUP_THRESHOLD: 0.8
};

// Chart Color Generation Fallback
export const getChartColor = (index) => {
  if (index < UI_CONFIG.CHART_COLORS.length) {
    return UI_CONFIG.CHART_COLORS[index];
  }
  // Generate colors for indices beyond predefined colors
  const hue = (index * 137.508) % 360; // Golden angle approximation for even distribution
  return `hsl(${hue}, 70%, 50%)`;
};