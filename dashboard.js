class Dashboard {
    constructor() {
        this.entities = [];
        this.filteredEntities = [];
        this.historicalData = [];
        this.charts = {};
        this.currentFilters = {
            type: 'all',
            confidence: 0,
            source: 'all',
            dateRange: 'all'
        };
        this.currentSort = {
            field: 'dateAdded',
            direction: 'desc'
        };
    }

    init() {
        this.initializeCharts();
        this.setupEventListeners();
        this.loadDashboardData();
    }

    setupEventListeners() {
        // Filter event listeners
        const typeFilter = document.getElementById('type-filter');
        const confidenceFilter = document.getElementById('confidence-filter');
        const sourceFilter = document.getElementById('source-filter');
        const dateFilter = document.getElementById('date-filter');
        
        if (typeFilter) typeFilter.addEventListener('change', (e) => this.handleFilterChange('type', e.target.value));
        if (confidenceFilter) confidenceFilter.addEventListener('change', (e) => this.handleFilterChange('confidence', parseInt(e.target.value)));
        if (sourceFilter) sourceFilter.addEventListener('change', (e) => this.handleFilterChange('source', e.target.value));
        if (dateFilter) dateFilter.addEventListener('change', (e) => this.handleFilterChange('dateRange', e.target.value));

        // Sort event listeners
        const sortField = document.getElementById('sort-field');
        const sortDirection = document.getElementById('sort-direction');
        
        if (sortField) sortField.addEventListener('change', (e) => this.handleSortChange(e.target.value));
        if (sortDirection) sortDirection.addEventListener('click', () => this.toggleSortDirection());

        // Action button listeners
        const refreshBtn = document.getElementById('refresh-btn');
        const exportBtn = document.getElementById('export-btn');
        const historicalToggle = document.getElementById('historical-toggle');
        
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshData());
        if (exportBtn) exportBtn.addEventListener('click', (e) => this.showExportMenu(e));
        if (historicalToggle) historicalToggle.addEventListener('change', (e) => this.toggleHistoricalComparison(e.target.checked));
    }

    initializeCharts() {
        // Entity distribution chart
        const distributionCtx = document.getElementById('entity-distribution-chart').getContext('2d');
        this.charts.distribution = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Confidence score chart
        const confidenceCtx = document.getElementById('confidence-chart').getContext('2d');
        this.charts.confidence = new Chart(confidenceCtx, {
            type: 'bar',
            data: {
                labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
                datasets: [{
                    label: 'Entity Count',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Trend chart
        const trendCtx = document.getElementById('trend-chart').getContext('2d');
        this.charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async loadDashboardData() {
        try {
            this.showLoadingState();
            
            const [entitiesResult, historicalResult] = await Promise.all([
                chrome.storage.local.get(['entities', 'scrapedData']),
                chrome.storage.local.get(['historicalData'])
            ]);

            this.entities = entitiesResult.entities || [];
            this.historicalData = historicalResult.historicalData || [];
            
            // Merge with scraped data if available
            if (entitiesResult.scrapedData) {
                this.entities = this.mergeEntityData(this.entities, entitiesResult.scrapedData);
            }

            this.filteredEntities = [...this.entities];
            this.displayEntities(this.filteredEntities);
            this.updateSummaryStats();
            this.updateCharts();
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    mergeEntityData(existingEntities, scrapedData) {
        const mergedEntities = [...existingEntities];
        
        scrapedData.forEach(scraped => {
            if (scraped.entities) {
                scraped.entities.forEach(entity => {
                    const existingIndex = mergedEntities.findIndex(e => 
                        e.name === entity.name && e.source === scraped.url
                    );
                    
                    if (existingIndex >= 0) {
                        mergedEntities[existingIndex] = {
                            ...mergedEntities[existingIndex],
                            ...entity,
                            lastUpdated: new Date().toISOString()
                        };
                    } else {
                        mergedEntities.push({
                            ...entity,
                            source: scraped.url,
                            dateAdded: new Date().toISOString()
                        });
                    }
                });
            }
        });
        
        return mergedEntities;
    }

    displayEntities(entities) {
        const container = document.getElementById('entities-table-body');
        
        if (!entities || entities.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-gray-500 py-8">
                        No entities found. Start by analyzing competitor websites.
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = entities.map(entity => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-entity-id="${entity.id}">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <span class="font-medium text-gray-900">${this.escapeHtml(entity.name)}</span>
                        <span class="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-${this.getTypeColor(entity.type)}-100 text-${this.getTypeColor(entity.type)}-800">
                            ${entity.type}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-20 bg-gray-200 rounded-full h-2 mr-3">
                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${entity.confidence}%"></div>
                        </div>
                        <span class="text-sm text-gray-600">${entity.confidence.toFixed(1)}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <a href="${entity.source}" target="_blank" class="text-blue-600 hover:underline">
                        ${this.truncateUrl(entity.source)}
                    </a>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${entity.frequency || 1}
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${this.formatDate(entity.dateAdded)}
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="dashboard.viewEntityDetails('${entity.id}')">
                        View
                    </button>
                    <button class="text-red-600 hover:text-red-900" onclick="dashboard.removeEntity('${entity.id}')">
                        Remove
                    </button>
                </td>
            </tr>
        `).join('');

        // Add click handlers for entity rows
        container.querySelectorAll('tr[data-entity-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.matches('button, a')) {
                    this.viewEntityDetails(row.dataset.entityId);
                }
            });
        });
    }

    handleFilterChange(filterType, value) {
        this.currentFilters[filterType] = value;
        this.applyFilters();
        this.displayEntities(this.filteredEntities);
        this.updateSummaryStats();
        this.updateCharts();
    }

    applyFilters() {
        this.filteredEntities = this.entities.filter(entity => {
            // Type filter
            if (this.currentFilters.type !== 'all' && entity.type !== this.currentFilters.type) {
                return false;
            }

            // Confidence filter
            if (entity.confidence < this.currentFilters.confidence) {
                return false;
            }

            // Source filter
            if (this.currentFilters.source !== 'all' && entity.source !== this.currentFilters.source) {
                return false;
            }

            // Date range filter
            if (this.currentFilters.dateRange !== 'all') {
                const entityDate = new Date(entity.dateAdded);
                const now = new Date();
                const daysAgo = this.getDateRangeInDays(this.currentFilters.dateRange);
                const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
                
                if (entityDate < cutoffDate) {
                    return false;
                }
            }

            return true;
        });

        this.applySorting();
    }

    getDateRangeInDays(range) {
        switch (range) {
            case 'today': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case '3months': return 90;
            default: return Infinity;
        }
    }

    handleSortChange(sortField, direction = this.currentSort.direction) {
        this.currentSort.field = sortField;
        this.currentSort.direction = direction;
        this.applySorting();
        this.displayEntities(this.filteredEntities);
        this.updateSortUI();
    }

    applySorting() {
        this.filteredEntities.sort((a, b) => {
            let comparison = 0;
            
            switch (this.currentSort.field) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'confidence':
                    comparison = (a.confidence || 0) - (b.confidence || 0);
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
                case 'frequency':
                    comparison = (a.frequency || 1) - (b.frequency || 1);
                    break;
                case 'dateAdded':
                    comparison = new Date(a.dateAdded) - new Date(b.dateAdded);
                    break;
                default:
                    comparison = 0;
            }
            
            return this.currentSort.direction === 'asc' ? comparison : -comparison;
        });
    }

    toggleSortDirection() {
        const newDirection = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        this.handleSortChange(this.currentSort.field, newDirection);
    }

    updateSortUI() {
        const sortField = document.getElementById('sort-field');
        const sortDirection = document.getElementById('sort-direction');
        
        if (sortField) sortField.value = this.currentSort.field;
        if (sortDirection) {
            sortDirection.innerHTML = this.currentSort.direction === 'asc' ? '?' : '?';
            sortDirection.title = `Sort ${this.currentSort.direction === 'asc' ? 'Descending' : 'Ascending'}`;
        }
    }

    showHistoricalComparison() {
        if (this.historicalData.length === 0) {
            this.showMessage('No historical data available yet. Analyze more websites to build trends.', 'info');
            return;
        }

        this.updateTrendChart();
        const section = document.getElementById('historical-section');
        if (section) section.classList.remove('hidden');
    }

    toggleHistoricalComparison(show) {
        const section = document.getElementById('historical-section');
        if (show) {
            this.showHistoricalComparison();
        } else {
            if (section) section.classList.add('hidden');
        }
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');
        const originalText = refreshBtn ? refreshBtn.textContent : '';
        
        if (refreshBtn) {
            refreshBtn.textContent = 'Refreshing...';
            refreshBtn.disabled = true;
        }
        
        try {
            await this.loadDashboardData();
            this.displayEntities(this.filteredEntities);
            this.updateSummaryStats();
            this.showMessage('Dashboard refreshed successfully', 'success');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh dashboard');
        } finally {
            if (refreshBtn) {
                refreshBtn.textContent = originalText;
                refreshBtn.disabled = false;
            }
        }
    }

    showExportMenu(event) {
        const menu = document.getElementById('export-menu');
        if (!menu) return;
        
        const rect = event.target.getBoundingClientRect();
        
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.toggle('hidden');
        
        // Close menu when clicking outside
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.classList.add('hidden');
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    async handleExport(format) {
        const exportMenu = document.getElementById('export-menu');
        if (exportMenu) exportMenu.classList.add('hidden');
        
        try {
            const dataToExport = {
                entities: this.filteredEntities,
                exportDate: new Date().toISOString(),
                filters: this.currentFilters,
                summary: this.getSummaryStats()
            };

            let exportData;
            let filename;
            let mimeType;

            switch (format) {
                case 'csv':
                    exportData = this.generateCSV(dataToExport.entities);
                    filename = `entities_export_${this.formatDateForFilename()}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                case 'json':
                    exportData = JSON.stringify(dataToExport, null, 2);
                    filename = `entities_export_${this.formatDateForFilename()}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'xlsx':
                    exportData = await this.generateExcel(dataToExport);
                    filename = `entities_export_${this.formatDateForFilename()}.xlsx`;
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            this.downloadFile(exportData, filename, mimeType);
            this.showMessage(`Data exported successfully as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError(`Failed to export data as ${format.toUpperCase()}`);
        }
    }

    generateCSV(entities) {
        const headers = ['Name', 'Type', 'Confidence', 'Source', 'Frequency', 'Date Added'];
        const rows = entities.map(entity => [
            `"${entity.name.replace(/"/g, '""')}"`,
            entity.type,
            entity.confidence,
            entity.source,
            entity.frequency || 1,
            entity.dateAdded
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    async generateExcel(data) {
        // Simple Excel generation using SheetJS if available
        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(data.entities);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Entities');
            return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        } else {
            // Fallback to CSV if XLSX not available
            return this.generateCSV(data.entities);
        }
    }

    downloadFile(data, filename, mimeType) {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    updateCharts() {
        this.updateDistributionChart();
        this.updateConfidenceChart();
        this.updateTrendChart();
    }

    updateDistributionChart() {
        if (!this.charts.distribution) return;
        
        const typeDistribution = this.filteredEntities.reduce((acc, entity) => {
            acc[entity.type] = (acc[entity.type] || 0) + 1;
            return acc;
        }, {});

        this.charts.distribution.data.labels = Object.keys(typeDistribution);
        this.charts.distribution.data.datasets[0].data = Object.values(typeDistribution);
        this.charts.distribution.update();
    }

    updateConfidenceChart() {
        if (!this.charts.confidence) return;
        
        const confidenceRanges = [0, 0, 0, 0, 0];
        
        this.filteredEntities.forEach(entity => {
            const confidence = entity.confidence;
            if (confidence <= 20) confidenceRanges[0]++;
            else if (confidence <= 40) confidenceRanges[1]++;
            else if (confidence <= 60) confidenceRanges[2]++;
            else if (confidence <= 80) confidenceRanges[3]++;
            else confidenceRanges[4]++;
        });

        this.charts.confidence.data.datasets[0].data = confidenceRanges;
        this.charts.confidence.update();
    }

    updateTrendChart() {
        if (!this.charts.trend || this.historicalData.length === 0) return;

        const trendData = this.processHistoricalData();
        
        this.charts.trend.data.labels = trendData.labels;
        this.charts.trend.data.datasets = trendData.datasets;
        this.charts.trend.update();
    }

    processHistoricalData() {
        const dataByDate = {};
        const entityTypes = new Set();

        this.historicalData.forEach(record => {
            const date = record.date.split('T')[0];
            if (!dataByDate[date]) dataByDate[date] = {};
            
            record.entities.forEach(entity => {
                entityTypes.add(entity.type);
                dataByDate[date][entity.type] = (dataByDate[date][entity.type] || 0) + 1;
            });
        });

        const sortedDates = Object.keys(dataByDate).sort();
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
        
        const datasets = Array.from(entityTypes).map((type, index) => ({
            label: type,
            data: sortedDates.map(date => dataByDate[date][type] || 0),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            tension: 0.1
        }));

        return {
            labels: sortedDates,
            datasets
        };
    }

    updateSummaryStats() {
        const stats = this.getSummaryStats();
        
        const totalEl = document.getElementById('total-entities');
        const avgEl = document.getElementById('avg-confidence');
        const sourcesEl = document.getElementById('unique-sources');
        const recentEl = document.getElementById('recent-entities');
        
        if (totalEl) totalEl.textContent = stats.totalEntities;
        if (avgEl) avgEl.textContent = `${stats.avgConfidence.toFixed(1)}%`;
        if (sourcesEl) sourcesEl.textContent = stats.uniqueSources;
        if (recentEl) recentEl.textContent = stats.recentEntities;
    }

    getSummaryStats() {
        const totalEntities = this.filteredEntities.length;
        const avgConfidence = totalEntities > 0 
            ? this.filteredEntities.reduce((sum, entity) => sum + entity.confidence, 0) / totalEntities 
            : 0;
        const uniqueSources = new Set(this.filteredEntities.map(entity => entity.source)).size;
        
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const recentEntities = this.filteredEntities.filter(entity => 
            new Date(entity.dateAdded) >= yesterday
        ).length;

        return {
            totalEntities,
            avgConfidence,
            uniqueSources,
            recentEntities
        };
    }

    viewEntityDetails(entityId) {
        const entity = this.entities.find(e => e.id === entityId);
        if (!entity) return;

        // Create and show modal with entity details
        this.showEntityModal(entity);
    }

    showEntityModal(entity) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">${this.escapeHtml(entity.name)}</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-3">
                        <div><strong>Type:</strong> ${entity.type}</div>
                        <div><strong>Confidence:</strong> ${entity.confidence.toFixed(1)}%</div>
                        <div><strong>Source:</strong> <a href="${entity.source}" target="_blank" class="text-blue-600 hover:underline">${entity.source}</a></div>
                        <div><strong>Frequency:</strong> ${entity.frequency || 1}</div>
                        <div><strong>Date Added:</strong> ${this.formatDate(entity.dateAdded)}</div>
                        ${entity.description ? `<div><strong>Description:</strong> ${this.escapeHtml(entity.description)}</div>` : ''}
                        ${entity.categories ? `<div><strong>Categories:</strong> ${entity.categories.join(', ')}</div>` : ''}
                    </div>
                    <div class="mt-6 flex justify-end space-x-3">
                        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Close
                        </button>
                        <button onclick="dashboard.removeEntity('${entity.id}'); this.closest('.fixed').remove()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                            Remove Entity
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async removeEntity(entityId) {
        if (!confirm('Are you sure you want to remove this entity?')) return;

        try {
            this.entities = this.entities.filter(entity => entity.id !== entityId);
            await chrome.storage.local.set({ entities: this.entities });
            
            this.applyFilters();
            this.displayEntities(this.filteredEntities);
            this.updateSummaryStats();
            this.updateCharts();
            
            this.showMessage('Entity removed successfully', 'success');
        } catch (error) {
            console.error('Error removing entity:', error);
            this.showError('Failed to remove entity');
        }
    }

    // Utility methods
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    getTypeColor(type) {
        const colors = {
            'Person': 'blue',
            'Organization': 'green',
            'Location': 'purple',
            'Product': 'yellow',
            'Event': 'red',
            'default': 'gray'
        };
        return colors[type] || colors.default;
    }

    truncateUrl(url, maxLength = 40) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    formatDateForFilename() {
        return new Date().toISOString().split('T')[0].replace(/-/g, '');
    }

    showLoadingState() {
        const content = document.getElementById('dashboard-content');
        const spinner = document.getElementById('loading-spinner');
        if (content) content.classList.add('opacity-50');
        if (spinner) spinner.classList.remove('hidden');
    }

    hideLoadingState() {
        const content = document.getElementById('dashboard-content');
        const spinner = document.getElementById('loading-spinner');
        if (content) content.classList.remove('opacity-50');
        if (spinner) spinner.classList.add('hidden');
    }

    showMessage(message, type = 'info') {
        const alertDiv = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' 
                      : type === 'error' ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-blue-100 border-blue-400 text-blue-700';
        
        alertDiv.className = `fixed top-4 right-4 border px-4 py-3 rounded z-50 ${bgColor}`;
        alertDiv.innerHTML = `
            ${message}
            <button onclick="this.parentElement.remove()" class="ml-4 font-bold">?</button>
        `;
        
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
    window.dashboard = dashboard;
    dashboard.init();
});