(function() {
    const ignoredElementsSet = new Set();
    let pageReadyCheckInterval;
    let maxReadyCheckAttempts = 10;
    let readyCheckAttempts = 0;

    function extractContent() {
        const content = {
            url: window.location.href,
            title: document.title || '',
            text: scrapeText(),
            metaTags: getMetaTags(),
            structuredData: getStructuredData(),
            timestamp: new Date().toISOString()
        };
        return content;
    }

    function scrapeText() {
        const elementsToExtract = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'article', 'main', 'section',
            '[role="main"]', '.content', '#content'
        ];

        const elementsToIgnore = [
            'script', 'style', 'nav', 'header', 'footer',
            'aside', '.nav', '.navigation', '.menu',
            '.sidebar', '.advertisement', '.ad'
        ];

        if (ignoredElementsSet.size === 0) {
            elementsToIgnore.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => ignoredElementsSet.add(element));
            });
        }

        let textContent = '';

        elementsToExtract.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                let shouldIgnore = false;
                let currentElement = element;
                
                while (currentElement && currentElement !== document.body) {
                    if (ignoredElementsSet.has(currentElement)) {
                        shouldIgnore = true;
                        break;
                    }
                    currentElement = currentElement.parentElement;
                }

                if (!shouldIgnore) {
                    const text = element.textContent || '';
                    if (text.trim()) {
                        textContent += text + ' ';
                    }
                }
            });
        });

        if (!textContent.trim()) {
            textContent = document.body ? document.body.textContent || '' : '';
        }

        return cleanContent(textContent);
    }

    function getMetaTags() {
        const metaTags = {};
        
        const metaSelectors = [
            { selector: 'meta[name="description"]', key: 'description' },
            { selector: 'meta[name="keywords"]', key: 'keywords' },
            { selector: 'meta[name="author"]', key: 'author' },
            { selector: 'meta[property="og:title"]', key: 'ogTitle' },
            { selector: 'meta[property="og:description"]', key: 'ogDescription' },
            { selector: 'meta[property="og:image"]', key: 'ogImage' },
            { selector: 'meta[property="og:url"]', key: 'ogUrl' },
            { selector: 'meta[name="twitter:title"]', key: 'twitterTitle' },
            { selector: 'meta[name="twitter:description"]', key: 'twitterDescription' },
            { selector: 'meta[name="twitter:image"]', key: 'twitterImage' }
        ];

        metaSelectors.forEach(({ selector, key }) => {
            const element = document.querySelector(selector);
            if (element) {
                const content = element.getAttribute('content');
                if (content && content.trim()) {
                    metaTags[key] = content.trim();
                }
            }
        });

        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink && canonicalLink.href) {
            metaTags.canonical = canonicalLink.href;
        }

        return metaTags;
    }

    function getStructuredData() {
        const structuredData = [];
        
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '');
                if (data && typeof data === 'object') {
                    structuredData.push(data);
                }
            } catch (error) {
                console.warn('Failed to parse JSON-LD structured data:', error);
            }
        });

        const microdataItems = document.querySelectorAll('[itemscope]');
        microdataItems.forEach(item => {
            try {
                const itemType = item.getAttribute('itemtype');
                if (itemType) {
                    const microdataObj = {
                        '@type': itemType.split('/').pop(),
                        '@context': 'http://schema.org'
                    };
                    
                    const properties = item.querySelectorAll('[itemprop]');
                    properties.forEach(prop => {
                        const propName = prop.getAttribute('itemprop');
                        const propValue = prop.getAttribute('content') || prop.textContent || '';
                        if (propName && propValue.trim()) {
                            microdataObj[propName] = propValue.trim();
                        }
                    });
                    
                    structuredData.push(microdataObj);
                }
            } catch (error) {
                console.warn('Failed to parse microdata:', error);
            }
        });

        return structuredData;
    }

    function cleanContent(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/\s+/g, ' ')
            .replace(/[\r\n\t]/g, ' ')
            .replace(/[^\w\s\-.,;:!?'"()]/g, ' ')
            .trim()
            .substring(0, 50000);
    }

    function sendContentToBackground(content) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'contentExtracted',
                data: content
            }).catch(error => {
                console.warn('Failed to send content to background script:', error);
            });
        }
    }

    function handleScrapeRequest() {
        try {
            const content = extractContent();
            sendContentToBackground(content);
        } catch (error) {
            console.error('Error during content extraction:', error);
            sendContentToBackground({
                error: 'Content extraction failed',
                url: window.location.href,
                timestamp: new Date().toISOString()
            });
        }
    }

    function isPageReady() {
        if (document.readyState !== 'complete') {
            return false;
        }

        const hasMainContent = document.querySelector('main, [role="main"], article, .content, #content');
        const hasEnoughText = document.body && document.body.textContent && document.body.textContent.trim().length > 100;
        
        return hasMainContent && hasEnoughText;
    }

    function checkPageReadyness() {
        if (isPageReady()) {
            if (pageReadyCheckInterval) {
                clearInterval(pageReadyCheckInterval);
            }
            handleScrapeRequest();
        } else {
            readyCheckAttempts++;
            if (readyCheckAttempts >= maxReadyCheckAttempts) {
                if (pageReadyCheckInterval) {
                    clearInterval(pageReadyCheckInterval);
                }
                handleScrapeRequest();
            }
        }
    }

    function initializeContentExtraction() {
        readyCheckAttempts = 0;
        
        if (isPageReady()) {
            handleScrapeRequest();
        } else {
            pageReadyCheckInterval = setInterval(checkPageReadyness, 500);
        }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'extractContent') {
                handleScrapeRequest();
                sendResponse({ status: 'started' });
                return true;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentExtraction);
    } else {
        initializeContentExtraction();
    }

    window.EntityScoutContentScript = {
        extractContent,
        scrapeText,
        getMetaTags,
        getStructuredData,
        handleScrapeRequest
    };

})();