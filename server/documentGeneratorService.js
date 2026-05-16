/**
 * Document Generator Service
 * Handles creation of Word (.docx) and Excel (.xlsx) files
 * Integrates with AI to generate content
 */

import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, AlignmentType, BorderStyle } from 'docx';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const TEMP_DIR = './server/temp-files/documents';

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class DocumentGeneratorService {
  static async generateWordDocument(content, title = 'Generated Document', progressCallback = null) {
    const fileId = uuidv4();
    
    try {
      // Step 1: Initialize Word engine
      if (progressCallback) progressCallback({ step: 1, status: 'Initializing Word engine...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Parse content and structure
      if (progressCallback) progressCallback({ step: 2, status: 'Parsing content...' });
      const sections = this.parseContentToSections(content);
      
      // Step 3: Create document structure
      if (progressCallback) progressCallback({ step: 3, status: 'Creating document structure...' });
      const doc = this.createWordDocument(title, sections);
      
      // Step 4: Render and save
      if (progressCallback) progressCallback({ step: 4, status: 'Writing to file...' });
      const fileName = `document_${fileId}.docx`;
      const filePath = path.join(TEMP_DIR, fileName);
      
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
      
      if (progressCallback) progressCallback({ step: 5, status: 'Complete!', success: true });
      
      console.log(`[DOCGEN] Created Word file: ${fileName}`);
      
      return {
        success: true,
        fileId,
        fileName,
        filePath,
        fileType: 'docx',
        size: buffer.length
      };
    } catch (err) {
      console.error('[DOCGEN] Error generating Word document:', err);
      if (progressCallback) progressCallback({ step: 5, status: `Error: ${err.message}`, success: false });
      throw err;
    }
  }

  static async generateExcelDocument(content, title = 'Generated Spreadsheet', progressCallback = null) {
    const fileId = uuidv4();
    
    try {
      // Step 1: Initialize Excel engine
      if (progressCallback) progressCallback({ step: 1, status: 'Initializing Excel engine...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Parse content and structure
      if (progressCallback) progressCallback({ step: 2, status: 'Parsing data...' });
      const data = this.parseContentToTableData(content);
      
      // Step 3: Create workbook
      if (progressCallback) progressCallback({ step: 3, status: 'Creating spreadsheet...' });
      const workbook = await this.createExcelWorkbook(title, data);
      
      // Step 4: Format and write
      if (progressCallback) progressCallback({ step: 4, status: 'Formatting cells...' });
      const fileName = `spreadsheet_${fileId}.xlsx`;
      const filePath = path.join(TEMP_DIR, fileName);
      
      await workbook.xlsx.writeFile(filePath);
      
      if (progressCallback) progressCallback({ step: 5, status: 'Complete!', success: true });
      
      console.log(`[DOCGEN] Created Excel file: ${fileName}`);
      
      const stats = fs.statSync(filePath);
      return {
        success: true,
        fileId,
        fileName,
        filePath,
        fileType: 'xlsx',
        size: stats.size
      };
    } catch (err) {
      console.error('[DOCGEN] Error generating Excel document:', err);
      if (progressCallback) progressCallback({ step: 5, status: `Error: ${err.message}`, success: false });
      throw err;
    }
  }

  /**
   * Parse content into sections for Word document
   */
  static parseContentToSections(content) {
    // Split by double newline to create paragraphs
    const parts = content.split('\n\n').filter(p => p.trim());
    const sections = [];
    
    parts.forEach(part => {
      const trimmed = part.trim();
      
      // Check if it's a header (starts with # or is all caps)
      if (trimmed.startsWith('#')) {
        const header = trimmed.replace(/^#+\s*/, '');
        sections.push({
          type: 'heading',
          level: trimmed.match(/^#+/)[0].length,
          text: header
        });
      } else if (trimmed.match(/^(\d+\.|[-*])/m)) {
        // It's a list
        sections.push({
          type: 'list',
          items: trimmed.split('\n').map(line => line.replace(/^(\d+\.|[-*])\s*/, '').trim())
        });
      } else {
        // Regular paragraph
        sections.push({
          type: 'paragraph',
          text: trimmed
        });
      }
    });
    
    return sections;
  }

  /**
   * Parse content into table data for Excel
   */
  static parseContentToTableData(content) {
    // Try to detect table structure
    const lines = content.split('\n').filter(l => l.trim());
    const data = [];
    
    // Simple CSV/table parser
    lines.forEach(line => {
      if (line.includes('|')) {
        // Pipe-delimited table
        const row = line.split('|').map(cell => cell.trim()).filter(c => c);
        if (row.length > 0) {
          data.push(row);
        }
      } else if (line.includes(',')) {
        // CSV format
        const row = line.split(',').map(cell => cell.trim());
        if (row.length > 0) {
          data.push(row);
        }
      }
    });
    
    // If no table found, create simple structure
    if (data.length === 0) {
      data.push(['Content']);
      data.push([content]);
    }
    
    return data;
  }

  /**
   * Create Word document structure
   */
  static createWordDocument(title, sections) {
    const paragraphs = [];
    
    // Add title
    paragraphs.push(
      new Paragraph({
        text: title,
        bold: true,
        size: 28,
        spacing: { after: 400 }
      })
    );
    
    // Add creation timestamp
    paragraphs.push(
      new Paragraph({
        text: `Generated: ${new Date().toLocaleString()}`,
        italics: true,
        size: 20,
        spacing: { after: 200 }
      })
    );
    
    // Add sections
    sections.forEach(section => {
      if (section.type === 'heading') {
        paragraphs.push(
          new Paragraph({
            text: section.text,
            bold: true,
            size: 24,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (section.type === 'list') {
        section.items.forEach(item => {
          paragraphs.push(
            new Paragraph({
              text: item,
              bullet: {
                level: 0
              },
              spacing: { after: 100 }
            })
          );
        });
      } else {
        paragraphs.push(
          new Paragraph({
            text: section.text,
            spacing: { after: 200 }
          })
        );
      }
    });
    
    return new Document({
      sections: [{
        children: paragraphs
      }]
    });
  }

  /**
   * Create Excel workbook
   */
  static async createExcelWorkbook(title, data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    
    // Add title row
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add empty row for spacing
    worksheet.addRow([]);
    
    // Add data
    data.forEach((row, idx) => {
      const newRow = worksheet.addRow(row);
      
      // Format header row (first data row)
      if (idx === 0) {
        newRow.font = { bold: true };
        newRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8E8E8' }
        };
      }
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const cellLength = cell.value ? cell.value.toString().length : 10;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });
    
    return workbook;
  }

  /**
   * Get file download URL
   */
  static getDownloadUrl(fileName) {
    return `/api/documents/download/${fileName}`;
  }

  /**
   * Get file viewer URL
   */
  static getViewerUrl(fileName, fileType) {
    if (fileType === 'docx') {
      return `/api/documents/view/docx/${fileName}`;
    } else if (fileType === 'xlsx') {
      return `/api/documents/view/xlsx/${fileName}`;
    }
    return null;
  }

  /**
   * Clean up old files (older than 24 hours)
   */
  static cleanupOldFiles() {
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      
      files.forEach(file => {
        const filePath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > ONE_DAY) {
          fs.unlinkSync(filePath);
          console.log(`[DOCGEN] Cleaned up old file: ${file}`);
        }
      });
    } catch (err) {
      console.error('[DOCGEN] Cleanup error:', err);
    }
  }
}

export default DocumentGeneratorService;
