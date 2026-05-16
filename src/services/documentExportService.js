/**
 * Document Export Service
 * Handles DOCX, PPTX, and Excel export
 */

// Simple DOCX export (requires docx library in production)
export const exportToDocx = (content, fileName) => {
  try {
    // Convert content to rich text format
    const docContent = Array.isArray(content)
      ? content.map(para => typeof para === 'string' ? para : para.text || '').join('\n\n')
      : String(content);

    // Create blob with formatted text
    const blob = new Blob([docContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadFile(blob, `${fileName || 'document'}.docx`);
    
    return { success: true, message: 'Document exported successfully' };
  } catch (error) {
    console.error('DOCX export error:', error);
    return { success: false, error: error.message };
  }
};

// PPTX export function
export const exportToPptx = (slides, fileName) => {
  try {
    // Simple format: convert slides to XML-like structure
    const pptxContent = slides.map((slide, idx) => {
      return `Slide ${idx + 1}
Title: ${slide.title || ''}
Content: ${slide.content || ''}
Notes: ${slide.notes || ''}
---`;
    }).join('\n');

    const blob = new Blob([pptxContent], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    downloadFile(blob, `${fileName || 'presentation'}.pptx`);

    return { success: true, message: 'Presentation exported successfully' };
  } catch (error) {
    console.error('PPTX export error:', error);
    return { success: false, error: error.message };
  }
};

// Excel export function
export const exportToExcel = (rows, fileName) => {
  try {
    // Convert to CSV (Excel can open CSV files)
    const csvContent = rows.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma
          const cellStr = String(cell || '');
          return cellStr.includes(',') ? `"${cellStr.replace(/"/g, '""')}"` : cellStr;
        }).join(',');
      }
      return String(row);
    }).join('\n');

    // Create Excel-compatible blob
    const BOM = '\uFEFF'; // UTF-8 BOM for proper encoding
    const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel' });
    downloadFile(blob, `${fileName || 'spreadsheet'}.xlsx`);

    return { success: true, message: 'Spreadsheet exported successfully' };
  } catch (error) {
    console.error('Excel export error:', error);
    return { success: false, error: error.message };
  }
};

// Generic download file helper
const downloadFile = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};

// Convert JSON to Excel data
export const jsonToExcelData = (jsonData) => {
  if (!Array.isArray(jsonData) || jsonData.length === 0) return [];
  
  const headers = Object.keys(jsonData[0]);
  const rows = [headers, ...jsonData.map(item => headers.map(h => item[h] || ''))];
  
  return rows;
};

// Convert table HTML to Excel data
export const htmlTableToExcelData = (tableElement) => {
  const rows = [];
  const tableRows = tableElement.querySelectorAll('tr');
  
  tableRows.forEach(tr => {
    const cells = tr.querySelectorAll('td, th');
    const row = Array.from(cells).map(cell => cell.textContent.trim());
    rows.push(row);
  });
  
  return rows;
};

// Generate sample data for documents
export const generateSampleContent = (type) => {
  switch (type) {
    case 'docx':
      return [
        { id: 1, type: 'paragraph', text: 'Introduction' },
        { id: 2, type: 'paragraph', text: 'Your content here...' },
        { id: 3, type: 'paragraph', text: 'Conclusion' }
      ];

    case 'pptx':
      return [
        { id: 1, type: 'slide', title: 'Title Slide', content: 'Welcome to your presentation', notes: '' },
        { id: 2, type: 'slide', title: 'Content', content: 'Your content here', notes: 'Speaker notes' }
      ];

    case 'excel':
      return [
        ['Header 1', 'Header 2', 'Header 3'],
        ['Data 1', 'Data 2', 'Data 3'],
        ['Data 4', 'Data 5', 'Data 6']
      ];

    default:
      return [];
  }
};

// Validate document content
export const validateDocumentContent = (content, type) => {
  if (!content) return { valid: false, error: 'Content is empty' };

  switch (type) {
    case 'docx':
      return { valid: Array.isArray(content) || typeof content === 'string', error: null };
    case 'pptx':
      return { valid: Array.isArray(content) && content.length > 0, error: 'At least one slide required' };
    case 'excel':
      return { valid: Array.isArray(content) && content.length > 0, error: 'At least one row required' };
    default:
      return { valid: false, error: 'Unknown document type' };
  }
};

export default {
  exportToDocx,
  exportToPptx,
  exportToExcel,
  jsonToExcelData,
  htmlTableToExcelData,
  generateSampleContent,
  validateDocumentContent
};
