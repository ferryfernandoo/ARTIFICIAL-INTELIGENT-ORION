/**
 * Document Manager Service
 * Handles document operations, saving, loading, and AI integration
 */

class DocumentManager {
  constructor() {
    this.apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  }

  // Save document to backend
  async saveDocument(document) {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(document)
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  // Load document from backend
  async loadDocument(documentId) {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/${documentId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      return await response.json();
    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }

  // List user's documents
  async listDocuments() {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/list`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to list documents');
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing documents:', error);
      return [];
    }
  }

  // Delete document
  async deleteDocument(documentId) {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Export document in different formats
  async exportDocument(document, format) {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document, format })
      });

      if (!response.ok) {
        throw new Error('Failed to export document');
      }

      // Get blob from response
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error exporting document:', error);
      throw error;
    }
  }

  // Generate AI content for document
  async generateAiContent(prompt, documentType) {
    try {
      const response = await fetch(`${this.apiBase}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt, documentType })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI content');
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating AI content:', error);
      throw error;
    }
  }

  // Share document with users
  async shareDocument(documentId, emails) {
    try {
      const response = await fetch(`${this.apiBase}/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails })
      });

      if (!response.ok) {
        throw new Error('Failed to share document');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sharing document:', error);
      throw error;
    }
  }

  // Get document statistics
  getDocumentStats(content, type) {
    let stats = {
      type,
      timestamp: new Date().toISOString(),
      wordCount: 0,
      characterCount: 0,
      lineCount: 0
    };

    if (type === 'docx') {
      const text = Array.isArray(content)
        ? content.map(p => p.text || '').join(' ')
        : String(content);
      stats.characterCount = text.length;
      stats.wordCount = text.split(/\s+/).filter(w => w).length;
      stats.lineCount = text.split('\n').length;
    } else if (type === 'pptx') {
      const text = Array.isArray(content)
        ? content.map(s => (s.title || '') + ' ' + (s.content || '')).join(' ')
        : String(content);
      stats.characterCount = text.length;
      stats.wordCount = text.split(/\s+/).filter(w => w).length;
      stats.slideCount = Array.isArray(content) ? content.length : 0;
    } else if (type === 'excel') {
      const cellCount = Array.isArray(content)
        ? content.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 1), 0)
        : 0;
      stats.cellCount = cellCount;
      stats.rowCount = Array.isArray(content) ? content.length : 0;
    }

    return stats;
  }

  // Create document template
  createTemplate(type, templateName) {
    const templates = {
      docx: {
        article: [
          { id: 1, type: 'paragraph', text: 'Title' },
          { id: 2, type: 'paragraph', text: 'Introduction' },
          { id: 3, type: 'paragraph', text: 'Body' },
          { id: 4, type: 'paragraph', text: 'Conclusion' }
        ],
        report: [
          { id: 1, type: 'paragraph', text: 'Executive Summary' },
          { id: 2, type: 'paragraph', text: 'Introduction' },
          { id: 3, type: 'paragraph', text: 'Findings' },
          { id: 4, type: 'paragraph', text: 'Recommendations' }
        ],
        letter: [
          { id: 1, type: 'paragraph', text: 'Date' },
          { id: 2, type: 'paragraph', text: 'Recipient Address' },
          { id: 3, type: 'paragraph', text: 'Dear Sir/Madam,' },
          { id: 4, type: 'paragraph', text: 'Body' },
          { id: 5, type: 'paragraph', text: 'Sincerely,' }
        ]
      },
      pptx: {
        business: [
          { id: 1, type: 'slide', title: 'Title Slide', content: 'Company Name & Presentation Title', notes: '' },
          { id: 2, type: 'slide', title: 'Agenda', content: 'Overview of topics', notes: '' },
          { id: 3, type: 'slide', title: 'Key Points', content: 'Main discussion points', notes: '' },
          { id: 4, type: 'slide', title: 'Conclusion', content: 'Summary and next steps', notes: '' }
        ]
      },
      excel: {
        budget: [
          ['Category', 'January', 'February', 'March', 'Total'],
          ['Revenue', '', '', '', ''],
          ['Expenses', '', '', '', ''],
          ['Profit', '', '', '', '']
        ],
        inventory: [
          ['Item', 'Quantity', 'Unit Price', 'Total Value', 'Reorder Level'],
          ['', '', '', '', '']
        ]
      }
    };

    return templates[type]?.[templateName] || [];
  }
}

export const documentManager = new DocumentManager();
export default documentManager;
