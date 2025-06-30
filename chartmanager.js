class ChartManager {
    constructor() {
        this.charts = new Map();
        this.chartjsLoaded = false;
    }

    async loadChartJS() {
        if (this.chartjsLoaded) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
            script.onload = () => {
                this.chartjsLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createEntityChart(data, container) {
        const chartId = `entity-chart-${Date.now()}`;
        const canvas = this.createCanvas(chartId, container);

        const chartData = {
            labels: data.map(item => this.truncateLabel(item.text)),
            datasets: [{
                label: 'Relevance Score',
                data: data.map(item => (item.relevanceScore * 100).toFixed(1)),
                backgroundColor: this.generateColors(data.length, 0.7),
                borderColor: this.generateColors(data.length, 1),
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Entities by Relevance',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                const index = tooltipItems[0].dataIndex;
                                return data[index].text;
                            },
                            afterLabel: (tooltipItem) => {
                                const index = tooltipItem.dataIndex;
                                const entity = data[index];
                                return [
                                    `Type: ${entity.type}`,
                                    `Confidence: ${(entity.confidenceScore * 100).toFixed(1)}%`,
                                    `Wiki Link: ${entity.wikiLink ? 'Yes' : 'No'}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        },
                        title: {
                            display: true,
                            text: 'Relevance Score (%)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                }
            }
        };

        const chart = new Chart(canvas.getContext('2d'), config);
        this.charts.set(chartId, chart);
        return chartId;
    }

    createConfidenceChart(entities) {
        const chartId = `confidence-chart-${Date.now()}`;
        
        const confidenceRanges = {
            'High (80-100%)': 0,
            'Medium (60-80%)': 0,
            'Low (40-60%)': 0,
            'Very Low (0-40%)': 0
        };

        entities.forEach(entity => {
            const confidence = entity.confidenceScore * 100;
            if (confidence >= 80) confidenceRanges['High (80-100%)']++;
            else if (confidence >= 60) confidenceRanges['Medium (60-80%)']++;
            else if (confidence >= 40) confidenceRanges['Low (40-60%)']++;
            else confidenceRanges['Very Low (0-40%)']++;
        });

        const chartData = {
            labels: Object.keys(confidenceRanges),
            datasets: [{
                data: Object.values(confidenceRanges),
                backgroundColor: [
                    '#10b981', // Green
                    '#f59e0b', // Yellow
                    '#ef4444', // Red
                    '#6b7280'  // Gray
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        const config = {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Entity Confidence Distribution',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} entities (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        const container = document.getElementById('confidence-chart-container') || 
                         document.querySelector('.chart-container');
        const canvas = this.createCanvas(chartId, container);
        const chart = new Chart(canvas.getContext('2d'), config);
        this.charts.set(chartId, chart);
        return chartId;
    }

    createTypeDistributionChart(entities) {
        const chartId = `type-distribution-chart-${Date.now()}`;
        
        const typeCount = entities.reduce((acc, entity) => {
            acc[entity.type] = (acc[entity.type] || 0) + 1;
            return acc;
        }, {});

        const sortedTypes = Object.entries(typeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const chartData = {
            labels: sortedTypes.map(([type]) => this.formatEntityType(type)),
            datasets: [{
                label: 'Entity Count',
                data: sortedTypes.map(([, count]) => count),
                backgroundColor: this.generateColors(sortedTypes.length, 0.7),
                borderColor: this.generateColors(sortedTypes.length, 1),
                borderWidth: 2
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: {
                    title: {
                        display: true,
                        text: 'Entity Type Distribution',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = entities.length;
                                const percentage = ((context.parsed.x / total) * 100).toFixed(1);
                                return `${context.parsed.x} entities (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Entities'
                        }
                    }
                }
            }
        };

        const container = document.getElementById('type-distribution-container') || 
                         document.querySelector('.chart-container');
        const canvas = this.createCanvas(chartId, container);
        const chart = new Chart(canvas.getContext('2d'), config);
        this.charts.set(chartId, chart);
        return chartId;
    }

    createTimelineChart(historicalData) {
        const chartId = `timeline-chart-${Date.now()}`;
        
        if (!historicalData || historicalData.length === 0) {
            console.warn('No historical data provided for timeline chart');
            return null;
        }

        const sortedData = historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const datasets = [];
        const metrics = ['totalEntities', 'avgConfidence', 'uniqueTypes'];
        const colors = ['#3b82f6', '#10b981', '#f59e0b'];

        metrics.forEach((metric, index) => {
            if (sortedData.some(d => d[metric] !== undefined)) {
                datasets.push({
                    label: this.formatMetricLabel(metric),
                    data: sortedData.map(d => ({
                        x: d.date,
                        y: metric === 'avgConfidence' ? (d[metric] * 100).toFixed(1) : d[metric]
                    })),
                    borderColor: colors[index],
                    backgroundColor: colors[index] + '20',
                    fill: false,
                    tension: 0.1,
                    yAxisID: metric === 'avgConfidence' ? 'y1' : 'y'
                });
            }
        });

        const config = {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Entity Analysis Timeline',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                day: 'MMM DD',
                                week: 'MMM DD',
                                month: 'MMM YYYY'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Confidence (%)'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        };

        const container = document.getElementById('timeline-container') || 
                         document.querySelector('.chart-container');
        const canvas = this.createCanvas(chartId, container);
        const chart = new Chart(canvas.getContext('2d'), config);
        this.charts.set(chartId, chart);
        return chartId;
    }

    updateChart(chartId, newData) {
        const chart = this.charts.get(chartId);
        if (!chart) {
            console.error(`Chart with ID ${chartId} not found`);
            return false;
        }

        try {
            if (newData.labels) chart.data.labels = newData.labels;
            if (newData.datasets) chart.data.datasets = newData.datasets;
            
            chart.update('active');
            return true;
        } catch (error) {
            console.error('Error updating chart:', error);
            return false;
        }
    }

    destroyChart(chartId) {
        const chart = this.charts.get(chartId);
        if (chart) {
            chart.destroy();
            this.charts.delete(chartId);
            
            const canvas = document.getElementById(chartId);
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            return true;
        }
        return false;
    }

    exportChart(chartId, format = 'png') {
        const chart = this.charts.get(chartId);
        if (!chart) {
            console.error(`Chart with ID ${chartId} not found`);
            return null;
        }

        try {
            const canvas = chart.canvas;
            let dataUrl;

            switch (format.toLowerCase()) {
                case 'png':
                    dataUrl = canvas.toDataURL('image/png');
                    break;
                case 'jpg':
                case 'jpeg':
                    dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                    break;
                case 'webp':
                    dataUrl = canvas.toDataURL('image/webp', 0.95);
                    break;
                default:
                    dataUrl = canvas.toDataURL('image/png');
            }

            const link = document.createElement('a');
            link.download = `entityscout-chart-${chartId}.${format}`;
            link.href = dataUrl;
            link.click();
            
            return dataUrl;
        } catch (error) {
            console.error('Error exporting chart:', error);
            return null;
        }
    }

    createCanvas(chartId, container) {
        if (!container) {
            throw new Error('Container element not found');
        }

        const canvas = document.createElement('canvas');
        canvas.id = chartId;
        canvas.style.maxHeight = '400px';
        canvas.style.width = '100%';
        
        if (container.querySelector('canvas')) {
            container.replaceChild(canvas, container.querySelector('canvas'));
        } else {
            container.appendChild(canvas);
        }
        
        return canvas;
    }

    generateColors(count, alpha = 1) {
        const colors = [
            `rgba(59, 130, 246, ${alpha})`,   // Blue
            `rgba(16, 185, 129, ${alpha})`,   // Green
            `rgba(245, 158, 11, ${alpha})`,   // Yellow
            `rgba(239, 68, 68, ${alpha})`,    // Red
            `rgba(139, 92, 246, ${alpha})`,   // Purple
            `rgba(236, 72, 153, ${alpha})`,   // Pink
            `rgba(14, 165, 233, ${alpha})`,   // Light Blue
            `rgba(34, 197, 94, ${alpha})`,    // Light Green
            `rgba(251, 146, 60, ${alpha})`,   // Orange
            `rgba(168, 85, 247, ${alpha})`    // Violet
        ];

        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    truncateLabel(text, maxLength = 20) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatEntityType(type) {
        return type.split(/(?=[A-Z])/).join(' ').replace(/^\w/, c => c.toUpperCase());
    }

    formatMetricLabel(metric) {
        const labels = {
            totalEntities: 'Total Entities',
            avgConfidence: 'Average Confidence (%)',
            uniqueTypes: 'Unique Types'
        };
        return labels[metric] || metric;
    }

    destroyAllCharts() {
        this.charts.forEach((chart, chartId) => {
            this.destroyChart(chartId);
        });
    }

    getChart(chartId) {
        return this.charts.get(chartId);
    }

    getAllCharts() {
        return Array.from(this.charts.keys());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
} else {
    window.ChartManager = ChartManager;
}