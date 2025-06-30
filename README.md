# EntityFinder Chrome Extension

A comprehensive Chrome extension for automated competitive SEO analysis through semantic entity extraction. EntityScout Pro integrates with TextRazor API to analyze competitor websites, extract entities with confidence scores, and provide actionable SEO insights through an intuitive dashboard interface.

## ? Overview

EntityScout Pro is designed for SEO professionals, content marketers, and competitive analysts who need to understand the semantic landscape of competitor websites. By leveraging advanced entity extraction technology, the extension provides deep insights into content themes, topic relevance, and semantic relationships that drive search engine rankings.

### Key Features

- **Automated Entity Extraction**: Scrapes and analyzes competitor websites using TextRazor API
- **Semantic Analysis**: Identifies entities with confidence scores and Wikipedia linking
- **Interactive Dashboard**: Visual analytics with charts, filters, and historical comparisons
- **Multi-format Export**: Export analysis results to CSV, JSON, and PDF formats
- **Historical Tracking**: Save and compare analyses over time
- **Automatic Sync**: Analyses are synced across devices via Chrome storage
- **Real-time Progress**: Live updates during content processing
- **Advanced Filtering**: Sort and filter entities by type, confidence, and relevance
- **Bulk Analysis**: Process multiple URLs simultaneously (Premium feature)
- **API Quota Management**: Built-in rate limiting and usage tracking

## ? Requirements

- Chrome Browser (Version 88+)
- TextRazor API Key ([Get one here](https://www.textrazor.com/))
- Active internet connection

## ? Installation

### From Chrome Web Store
1. Visit the Chrome Web Store
2. Search for "EntityScout Pro"
3. Click "Add to Chrome"
4. Follow the installation prompts

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project directory
5. The extension will appear in your browser toolbar

## ?? Configuration

1. **API Setup**:
   - Click the extension icon in your toolbar
   - Go to "Options" or "Settings"
   - Enter your TextRazor API key
   - Test the connection to verify setup

2. **Subscription Settings**:
   - Configure your subscription tier
   - Set analysis preferences
   - Adjust export options

## ? Usage

### Basic Analysis
1. Click the EntityScout Pro extension icon
2. Enter a competitor's URL in the input field
3. Click "Analyze" to start the extraction process
4. View real-time progress as content is processed
5. Review results in the popup or open the full dashboard

### Advanced Dashboard
1. Click "Open Dashboard" from the popup
2. Access detailed entity analysis with:
   - Interactive charts and visualizations
   - Advanced filtering and sorting options
   - Historical comparison tools
   - Export capabilities

### Export Results
1. Select entities you want to export
2. Choose format (CSV, JSON, PDF)
3. Click "Export" to download the file
4. Use exported data in your SEO tools and reports

### Historical Analysis
1. All analyses are automatically saved
2. Access previous analyses from the dashboard
3. Compare entity changes over time
4. Track competitor content evolution

## ? Project Structure

### Core Components

| Component | Description |
|-----------|-------------|
| **manifest.json** | Chrome Extension Manifest V3 configuration |
| **background.js** | Service worker for API communication and messaging |
| **contentscript.js** | Injected script for website content extraction |

### User Interface

| Component | Description |
|-----------|-------------|
| **popup.html/js/css** | Main extension popup interface |
| **options.html/js/css** | Settings and configuration page |
| **dashboard.html/js/css** | Advanced analytics dashboard |

### Core Modules

| Module | Purpose |
|--------|---------|
| **apimanager.js** | TextRazor and Wikipedia API integration |
| **entityprocessor.js** | Entity data processing and confidence scoring |
| **storagemanager.js** | Chrome Storage API wrapper for persistence |
| **exportmanager.js** | Multi-format export functionality |

### Utility Modules

| Module | Purpose |
|--------|---------|
| **utils.js** | Common utility functions and helpers |
| **constants.js** | Application constants and configuration |
| **errorhandler.js** | Centralized error handling and logging |
| **ratelimiter.js** | API rate limiting and quota management |
| **progresstracker.js** | Real-time progress tracking |

### Visualization Components

| Component | Description |
|-----------|-------------|
| **chartmanager.js** | Chart creation and data visualization |
| **filtermanager.js** | Entity filtering and sorting logic |
| **reportgenerator.js** | Comprehensive report generation |

## ? Dependencies

### External APIs
- **TextRazor API**: Semantic entity extraction and analysis
- **Wikipedia API**: Entity linking and additional context

### Chrome APIs
- **Chrome Storage API**: Data persistence and settings
- **Chrome Runtime API**: Extension messaging and lifecycle
- **Chrome Tabs API**: Website interaction and content injection

### Built-in Libraries
- Chart.js (for visualizations)
- CSS Grid and Flexbox (for responsive layouts)

## ?? Development

### Architecture Overview
The extension follows Chrome Manifest V3 architecture with:
- **Service Worker**: Background processing and API management
- **Content Scripts**: Website content extraction
- **Popup Interface**: Quick analysis and results
- **Options Page**: Configuration management
- **Dashboard**: Advanced analytics and visualization

### Data Flow
```
User Input ? Content Extraction ? API Processing ? Entity Analysis ? Dashboard Display ? Export
```

1. User enters competitor URL
2. Content script extracts website content
3. Background worker processes with TextRazor API
4. Entity processor analyzes and enriches data
5. Results displayed in dashboard with visualizations
6. User can export or save for historical comparison

### Error Handling
- Comprehensive error catching and user-friendly messaging
- Automatic retry logic for API failures
- Rate limiting to prevent quota exceeded errors
- Graceful degradation for network issues

## ? Features in Detail

### Entity Extraction
- Identifies people, organizations, locations, concepts
- Confidence scoring for each entity
- Wikipedia linking for additional context
- Relationship mapping between entities

### Dashboard Analytics
- Interactive charts showing entity distribution
- Confidence score visualizations
- Historical trend analysis
- Comparative analysis tools

### Export Capabilities
- **CSV**: Spreadsheet-compatible format for analysis
- **JSON**: Machine-readable format for developers
- **PDF**: Professional reports for presentations

## ? Privacy & Security

- No data is stored on external servers
- All analysis data remains local to your browser
- API communications are encrypted
- User settings are stored securely using Chrome Storage API

## ? Support

For technical support, feature requests, or bug reports:
- Create an issue in this repository
- Contact support through the Chrome Web Store
- Visit our documentation site

## ? License

This project is licensed under the MIT License - see the LICENSE file for details.

## ? Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**EntityScout Pro** - Empowering SEO professionals with semantic intelligence for competitive analysis.