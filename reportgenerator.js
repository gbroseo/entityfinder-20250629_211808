class ReportGenerator {
    constructor() {
        this.chartColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
            '#C44569', '#F8B500', '#778CA3', '#2C2C54', '#40407A'
        ];
    }

    async generateReport(data, options = {}) {
        try {
            const formattedData = this.formatReportData(data);
            const report = {
                metadata: {
                    title: options.title || 'EntityScout Pro Analysis Report',
                    generatedAt: new Date().toISOString(),
                    url: data.url || '',
                    totalEntities: formattedData.entities.length,
                    averageConfidence: this.calculateAverageConfidence(formattedData.entities)
                },
                summary: this.createSummarySection(formattedData.entities),
                detailed: this.createDetailedSection(formattedData.entities),
                charts: this.createChartsSection(formattedData),
                recommendations: this.addRecommendations(formattedData),
                rawData: options.includeRaw ? formattedData : null
            };

            if (options.autoSave) {
                await this.saveReport(report, options.format || 'json');
            }

            return report;
        } catch (error) {
            console.error('Error generating report:', error);
            throw new Error(`Report generation failed: ${error.message}`);
        }
    }

    createSummarySection(entities) {
        const summary = {
            totalEntities: entities.length,
            entityTypes: {},
            topEntities: [],
            confidenceDistribution: {
                high: 0,
                medium: 0,
                low: 0
            }
        };

        entities.forEach(entity => {
            if (!summary.entityTypes[entity.type]) {
                summary.entityTypes[entity.type] = 0;
            }
            summary.entityTypes[entity.type]++;

            if (entity.confidenceScore >= 0.8) {
                summary.confidenceDistribution.high++;
            } else if (entity.confidenceScore >= 0.5) {
                summary.confidenceDistribution.medium++;
            } else {
                summary.confidenceDistribution.low++;
            }
        });

        summary.topEntities = entities
            .sort((a, b) => (b.confidenceScore * b.relevanceScore) - (a.confidenceScore * a.relevanceScore))
            .slice(0, 10)
            .map(entity => ({
                text: entity.text,
                type: entity.type,
                score: Math.round((entity.confidenceScore * entity.relevanceScore) * 100) / 100
            }));

        summary.typeDistribution = Object.entries(summary.entityTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        return summary;
    }

    createDetailedSection(entities) {
        const grouped = this.groupEntitiesByType(entities);
        const detailed = {};

        Object.entries(grouped).forEach(([type, typeEntities]) => {
            detailed[type] = {
                count: typeEntities.length,
                averageConfidence: this.calculateAverageConfidence(typeEntities),
                entities: typeEntities
                    .sort((a, b) => b.confidenceScore - a.confidenceScore)
                    .map(entity => ({
                        text: entity.text,
                        confidenceScore: Math.round(entity.confidenceScore * 100) / 100,
                        relevanceScore: Math.round(entity.relevanceScore * 100) / 100,
                        mentions: entity.mentions || 1,
                        wikipediaLink: entity.wikipediaLink || null,
                        wikidata: entity.wikidata || null,
                        positions: entity.positions || []
                    }))
            };
        });

        return detailed;
    }

    createChartsSection(data) {
        return {
            entityTypeDistribution: this.createTypeDistributionChart(data.entities),
            confidenceScoreDistribution: this.createConfidenceDistributionChart(data.entities),
            topEntitiesChart: this.createTopEntitiesChart(data.entities),
            entityMentionsChart: this.createEntityMentionsChart(data.entities),
            confidenceVsRelevanceScatter: this.createScatterChart(data.entities)
        };
    }

    createTypeDistributionChart(entities) {
        const typeCount = {};
        entities.forEach(entity => {
            typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;
        });

        const sortedTypes = Object.entries(typeCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            type: 'doughnut',
            data: {
                labels: sortedTypes.map(([type]) => type),
                datasets: [{
                    data: sortedTypes.map(([,count]) => count),
                    backgroundColor: this.chartColors.slice(0, sortedTypes.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Entity Type Distribution'
                    }
                }
            }
        };
    }

    createConfidenceDistributionChart(entities) {
        const bins = Array(10).fill(0);
        entities.forEach(entity => {
            const binIndex = Math.min(Math.floor(entity.confidenceScore * 10), 9);
            bins[binIndex]++;
        });

        return {
            type: 'bar',
            data: {
                labels: bins.map((_, i) => `${i * 10}-${(i + 1) * 10}%`),
                datasets: [{
                    label: 'Entity Count',
                    data: bins,
                    backgroundColor: '#4ECDC4',
                    borderColor: '#45B7D1',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Confidence Score Distribution'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Entities'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Confidence Score Range'
                        }
                    }
                }
            }
        };
    }

    createTopEntitiesChart(entities) {
        const topEntities = entities
            .sort((a, b) => (b.confidenceScore * b.relevanceScore) - (a.confidenceScore * a.relevanceScore))
            .slice(0, 15);

        return {
            type: 'bar',
            data: {
                labels: topEntities.map(e => e.text.length > 20 ? e.text.substring(0, 20) + '...' : e.text),
                datasets: [{
                    label: 'Combined Score',
                    data: topEntities.map(e => Math.round((e.confidenceScore * e.relevanceScore) * 100) / 100),
                    backgroundColor: '#FF6B6B',
                    borderColor: '#FF4757',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 15 Entities by Combined Score'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Combined Score (Confidence ? Relevance)'
                        }
                    }
                }
            }
        };
    }

    createEntityMentionsChart(entities) {
        const mentionData = entities
            .filter(e => e.mentions && e.mentions > 1)
            .sort((a, b) => b.mentions - a.mentions)
            .slice(0, 10);

        return {
            type: 'bar',
            data: {
                labels: mentionData.map(e => e.text.length > 15 ? e.text.substring(0, 15) + '...' : e.text),
                datasets: [{
                    label: 'Mentions',
                    data: mentionData.map(e => e.mentions),
                    backgroundColor: '#96CEB4',
                    borderColor: '#6FBF73',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Most Frequently Mentioned Entities'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Mentions'
                        }
                    }
                }
            }
        };
    }

    createScatterChart(entities) {
        const scatterData = entities.map(entity => ({
            x: entity.confidenceScore,
            y: entity.relevanceScore,
            label: entity.text
        }));

        return {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Entities',
                    data: scatterData,
                    backgroundColor: '#FECA57',
                    borderColor: '#FF9F43',
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Confidence vs Relevance Score'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw.label}: (${context.raw.x.toFixed(2)}, ${context.raw.y.toFixed(2)})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Confidence Score'
                        },
                        min: 0,
                        max: 1
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Relevance Score'
                        },
                        min: 0,
                        max: 1
                    }
                }
            }
        };
    }

    addRecommendations(analysis) {
        const recommendations = [];
        const entities = analysis.entities;
        
        if (entities.length === 0) {
            recommendations.push({
                type: 'warning',
                priority: 'high',
                title: 'No Entities Found',
                description: 'No semantic entities were extracted from this content.',
                action: 'Review the content quality and ensure it contains substantive information.'
            });
            return recommendations;
        }

        const avgConfidence = this.calculateAverageConfidence(entities);
        if (avgConfidence < 0.6) {
            recommendations.push({
                type: 'warning',
                priority: 'medium',
                title: 'Low Average Confidence',
                description: `Average entity confidence is ${(avgConfidence * 100).toFixed(1)}%.`,
                action: 'Consider improving content clarity and using more specific terminology.'
            });
        }

        const highConfidenceEntities = entities.filter(e => e.confidenceScore >= 0.8);
        if (highConfidenceEntities.length < entities.length * 0.3) {
            recommendations.push({
                type: 'info',
                priority: 'medium',
                title: 'Few High-Confidence Entities',
                description: `Only ${highConfidenceEntities.length} out of ${entities.length} entities have high confidence.`,
                action: 'Focus on the highest-confidence entities for SEO optimization.'
            });
        }

        const typeCount = {};
        entities.forEach(e => typeCount[e.type] = (typeCount[e.type] || 0) + 1);
        const dominantType = Object.entries(typeCount).sort(([,a], [,b]) => b - a)[0];
        
        if (dominantType && dominantType[1] > entities.length * 0.5) {
            recommendations.push({
                type: 'info',
                priority: 'low',
                title: 'Entity Type Concentration',
                description: `${dominantType[1]} entities (${((dominantType[1]/entities.length)*100).toFixed(1)}%) are of type "${dominantType[0]}".`,
                action: 'Consider diversifying content to include more entity types for broader topical coverage.'
            });
        }

        const topEntity = entities.sort((a, b) => (b.confidenceScore * b.relevanceScore) - (a.confidenceScore * a.relevanceScore))[0];
        if (topEntity) {
            recommendations.push({
                type: 'success',
                priority: 'high',
                title: 'Primary Topic Entity',
                description: `"${topEntity.text}" appears to be the primary topic entity.`,
                action: 'Ensure this entity is well-represented in title tags, headings, and key content areas.'
            });
        }

        const linkedEntities = entities.filter(e => e.wikipediaLink || e.wikidata);
        if (linkedEntities.length > entities.length * 0.3) {
            recommendations.push({
                type: 'success',
                priority: 'medium',
                title: 'Good Entity Linking',
                description: `${linkedEntities.length} entities have knowledge base links.`,
                action: 'Leverage these well-known entities for structured data and internal linking opportunities.'
            });
        }

        return recommendations;
    }

    formatReportData(data) {
        if (!data || !data.entities) {
            return { entities: [], metadata: {} };
        }

        const formattedEntities = data.entities.map(entity => ({
            text: entity.text || '',
            type: entity.type || 'Unknown',
            confidenceScore: Math.min(Math.max(entity.confidenceScore || 0, 0), 1),
            relevanceScore: Math.min(Math.max(entity.relevanceScore || 0, 0), 1),
            mentions: entity.mentions || 1,
            wikipediaLink: entity.wikipediaLink || null,
            wikidata: entity.wikidata || null,
            positions: Array.isArray(entity.positions) ? entity.positions : [],
            freebaseTypes: Array.isArray(entity.freebaseTypes) ? entity.freebaseTypes : []
        }));

        return {
            entities: formattedEntities,
            metadata: {
                url: data.url || '',
                analyzedAt: data.analyzedAt || new Date().toISOString(),
                processingTime: data.processingTime || 0,
                ...data.metadata
            }
        };
    }

    async saveReport(report, format = 'json') {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `entityscout-report-${timestamp}`;
            
            let blob, mimeType, extension;

            switch (format.toLowerCase()) {
                case 'json':
                    blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                    mimeType = 'application/json';
                    extension = 'json';
                    break;
                
                case 'csv':
                    const csvContent = this.convertToCSV(report);
                    blob = new Blob([csvContent], { type: 'text/csv' });
                    mimeType = 'text/csv';
                    extension = 'csv';
                    break;
                
                case 'html':
                    const htmlContent = this.convertToHTML(report);
                    blob = new Blob([htmlContent], { type: 'text/html' });
                    mimeType = 'text/html';
                    extension = 'html';
                    break;
                
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            const url = URL.createObjectURL(blob);
            
            if (chrome.downloads) {
                await chrome.downloads.download({
                    url: url,
                    filename: `${filename}.${extension}`,
                    saveAs: true
                });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Error saving report:', error);
            throw new Error(`Failed to save report: ${error.message}`);
        }
    }

    convertToCSV(report) {
        const headers = ['Entity Text', 'Type', 'Confidence Score', 'Relevance Score', 'Mentions', 'Wikipedia Link'];
        const rows = [headers.join(',')];

        if (report.detailed) {
            Object.values(report.detailed).forEach(typeData => {
                typeData.entities.forEach(entity => {
                    const row = [
                        `"${entity.text.replace(/"/g, '""')}"`,
                        entity.type || '',
                        entity.confidenceScore || 0,
                        entity.relevanceScore || 0,
                        entity.mentions || 1,
                        `"${entity.wikipediaLink || ''}"`
                    ];
                    rows.push(row.join(','));
                });
            });
        }

        return rows.join('\n');
    }

    convertToHTML(report) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.metadata.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .entity { background: #f4f4f4; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .score { font-weight: bold; color: #007acc; }
        .recommendation { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; border-left: 4px solid #28a745; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .info { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.metadata.title}</h1>
        <p>Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
        <p>URL: ${report.metadata.url}</p>
        <p>Total Entities: ${report.metadata.totalEntities}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="entity">
            <strong>High Confidence:</strong> ${report.summary.confidenceDistribution.high} entities<br>
            <strong>Medium Confidence:</strong> ${report.summary.confidenceDistribution.medium} entities<br>
            <strong>Low Confidence:</strong> ${report.summary.confidenceDistribution.low} entities
        </div>
        
        <h3>Top Entities</h3>
        <table>
            <tr><th>Entity</th><th>Type</th><th>Score</th></tr>
            ${report.summary.topEntities.map(entity => 
                `<tr><td>${entity.text}</td><td>${entity.type}</td><td class="score">${entity.score}</td></tr>`
            ).join('')}
        </table>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        ${report.recommendations.map(rec => 
            `<div class="recommendation ${rec.type}">
                <strong>${rec.title}</strong><br>
                ${rec.description}<br>
                <em>Action: ${rec.action}</em>
            </div>`
        ).join('')}
    </div>
</body>
</html>`;
    }

    groupEntitiesByType(entities) {
        return entities.reduce((groups, entity) => {
            const type = entity.type || 'Unknown';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(entity);
            return groups;
        }, {});
    }

    calculateAverageConfidence(entities) {
        if (entities.length === 0) return 0;
        const sum = entities.reduce((acc, entity) => acc + (entity.confidenceScore || 0), 0);
        return sum / entities.length;
    }
}

const reportGenerator = new ReportGenerator();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportGenerator;
} else {
    window.ReportGenerator = ReportGenerator;
}