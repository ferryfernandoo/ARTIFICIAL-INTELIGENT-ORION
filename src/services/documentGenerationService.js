/**
 * Document Generation Service
 * Handles document generation requests from the chat interface
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class DocumentGenerationService {
  /**
   * Generate a Word document
   */
  static async generateWord(content, title = 'Generated Document') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/generate/word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, title })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate Word document');
      }

      return await response.json();
    } catch (err) {
      console.error('[DocGen] Word generation error:', err);
      throw err;
    }
  }

  /**
   * Generate an Excel spreadsheet
   */
  static async generateExcel(content, title = 'Generated Spreadsheet') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/generate/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, title })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate Excel document');
      }

      return await response.json();
    } catch (err) {
      console.error('[DocGen] Excel generation error:', err);
      throw err;
    }
  }

  /**
   * Download file
   */
  static downloadFile(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Open file in new tab (for viewer)
   */
  static viewFile(url) {
    window.open(url, '_blank');
  }

  /**
   * Parse user request to detect document generation commands
   */
  static parseDocumentCommand(userMessage) {
    const wordPatterns = [
      /buat (laporan|dokumen|file word|document)/i,
      /generate (word|docx|document)/i,
      /tulis (laporan|dokumen)/i,
      /buatkan.*word/i,
      /word document/i
    ];

    const excelPatterns = [
      /buat (spreadsheet|excel|tabel|file excel)/i,
      /generate (excel|xlsx|spreadsheet)/i,
      /buat.*tabel/i,
      /buatkan.*excel/i,
      /excel.*spreadsheet/i
    ];

    for (const pattern of wordPatterns) {
      if (pattern.test(userMessage)) {
        return { type: 'word', title: this.extractTitle(userMessage) };
      }
    }

    for (const pattern of excelPatterns) {
      if (pattern.test(userMessage)) {
        return { type: 'excel', title: this.extractTitle(userMessage) };
      }
    }

    return null;
  }

  /**
   * Extract document title from user message
   */
  static extractTitle(message) {
    // Try to find title after common patterns
    const titlePatterns = [
      /tentang\s+(.+?)(?:\.|$)/i,
      /dengan\s+judul\s+(.+?)(?:\.|$)/i,
      /untuk\s+(.+?)(?:\.|$)/i,
      /tentang\s+"(.+?)"/i
    ];

    for (const pattern of titlePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Generated Document';
  }

  /**
   * Format AI response to indicate document is being generated
   */
  static createGeneratingMessage(fileType) {
    const emoji = fileType === 'word' ? '📄' : '📊';
    return `${emoji} Membuat ${fileType === 'word' ? 'Word document' : 'Excel spreadsheet'}...`;
  }
}

export default DocumentGenerationService;
