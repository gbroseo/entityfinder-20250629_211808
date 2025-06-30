class ExportManager {
  constructor() {
    this.supportedFormats = ['csv', 'json', 'pdf'];
  }

  async exportToCsv(data) {
    try {
      const validatedData = this.validateExportData(data);
      const formattedData = this.formatDataForExport(validatedData);
      
      const headers = ['Entity', 'Type', 'Confidence Score', 'Relevance Score', 'URL', 'Timestamp'];
      const csvContent = [
        headers.join(','),
        ...formattedData.map(row => [
          `"${this.escapeCsvField(row.entity)}"`,
          `"${this.escapeCsvField(row.type)}"`,
          row.confidenceScore,
          row.relevanceScore || 0,
          `"${this.escapeCsvField(row.url)}"`,
          `"${row.timestamp}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = this.generateFileName('csv', validatedData[0]?.url);
      
      await this.downloadFile(blob, filename);
      return { success: true, filename, recordCount: formattedData.length };
    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  async exportToJson(data) {
    try {
      const validatedData = this.validateExportData(data);
      const formattedData = this.formatDataForExport(validatedData);
      
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: formattedData.length,
          format: 'json',
          version: '1.0'
        },
        entities: formattedData
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const filename = this.generateFileName('json', validatedData[0]?.url);
      
      await this.downloadFile(blob, filename);
      return { success: true, filename, recordCount: formattedData.length };
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  async exportToPdf(data) {
    try {
      if (!window.jspdf) {
        throw new Error('jsPDF library is not loaded. Please ensure the PDF export library is available.');
      }

      const validatedData = this.validateExportData(data);
      const formattedData = this.formatDataForExport(validatedData);
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;
      
      doc.setFontSize(16);
      doc.text('EntityScout Pro - Analysis Report', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
      doc.text(`Total Entities: ${formattedData.length}`, pageWidth - 60, yPosition);
      yPosition += 15;
      
      const tableData = formattedData.map(row => [
        this.truncateText(row.entity, 25),
        this.truncateText(row.type, 15),
        row.confidenceScore.toFixed(2),
        (row.relevanceScore || 0).toFixed(2),
        this.truncateText(row.url, 30)
      ]);
      
      doc.autoTable({
        head: [['Entity', 'Type', 'Confidence', 'Relevance', 'URL']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: margin, right: margin }
      });
      
      const pdfBlob = new Blob([doc.output('blob')], { type: 'application/pdf' });
      const filename = this.generateFileName('pdf', validatedData[0]?.url);
      
      await this.downloadFile(pdfBlob, filename);
      return { success: true, filename, recordCount: formattedData.length };
    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  generateFileName(format, url = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const domain = url ? new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-') : 'entities';
    return `entityscout-${domain}-${timestamp}.${format}`;
  }

  formatDataForExport(entities) {
    return entities.map(entity => ({
      entity: entity.matchedText || entity.entity || '',
      type: entity.type || entity.freebaseTypes?.[0] || 'Unknown',
      confidenceScore: parseFloat(entity.confidenceScore || entity.confidence || 0),
      relevanceScore: parseFloat(entity.relevanceScore || entity.salience || 0),
      url: entity.url || '',
      timestamp: entity.timestamp || new Date().toISOString(),
      wikipediaLink: entity.wikipediaLink || '',
      wikiDataId: entity.wikiDataId || ''
    })).sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  async downloadFile(blob, filename) {
    try {
      let downloadCompleted = false;
      
      if (chrome?.downloads?.download) {
        const url = URL.createObjectURL(blob);
        
        const downloadId = await chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        });
        
        const cleanup = () => {
          if (!downloadCompleted) {
            downloadCompleted = true;
            URL.revokeObjectURL(url);
          }
        };
        
        if (chrome.downloads.onChanged) {
          const listener = (delta) => {
            if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
              chrome.downloads.onChanged.removeListener(listener);
              cleanup();
            }
          };
          chrome.downloads.onChanged.addListener(listener);
        }
        
        setTimeout(cleanup, 10000);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        downloadCompleted = true;
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  validateExportData(data) {
    if (!data) {
      throw new Error('No data provided for export');
    }
    
    if (!Array.isArray(data)) {
      throw new Error('Export data must be an array');
    }
    
    if (data.length === 0) {
      throw new Error('No entities to export');
    }
    
    if (data.length > 10000) {
      throw new Error('Too many entities to export (max 10,000)');
    }
    
    const validEntities = data.filter(entity => 
      entity && 
      typeof entity === 'object' && 
      (entity.matchedText || entity.entity)
    );
    
    if (validEntities.length === 0) {
      throw new Error('No valid entities found in data');
    }
    
    return validEntities;
  }

  escapeCsvField(field) {
    if (typeof field !== 'string') {
      field = String(field || '');
    }
    return field.replace(/"/g, '""');
  }

  truncateText(text, maxLength) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }

  async exportData(data, format) {
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    
    switch (format) {
      case 'csv':
        return await this.exportToCsv(data);
      case 'json':
        return await this.exportToJson(data);
      case 'pdf':
        return await this.exportToPdf(data);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  getExportPreview(data, format, maxRows = 5) {
    try {
      const validatedData = this.validateExportData(data);
      const formattedData = this.formatDataForExport(validatedData).slice(0, maxRows);
      
      return {
        format,
        totalRecords: validatedData.length,
        previewRecords: formattedData.length,
        preview: formattedData,
        estimatedSize: this.estimateFileSize(validatedData, format)
      };
    } catch (error) {
      console.error('Export preview failed:', error);
      return null;
    }
  }

  estimateFileSize(data, format) {
    const avgEntitySize = {
      csv: 100,
      json: 200,
      pdf: 150
    };
    
    const baseSize = {
      csv: 100,
      json: 500,
      pdf: 5000
    };
    
    const estimatedBytes = baseSize[format] + (data.length * avgEntitySize[format]);
    
    if (estimatedBytes < 1024) {
      return `${estimatedBytes} B`;
    } else if (estimatedBytes < 1048576) {
      return `${(estimatedBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(estimatedBytes / 1048576).toFixed(1)} MB`;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
} else if (typeof window !== 'undefined') {
  window.ExportManager = ExportManager;
}