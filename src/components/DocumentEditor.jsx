import React, { useState, useRef, useEffect, useCallback } from 'react';
import './DocumentEditor.css';
import { sendMessageToGrok } from '../services/grokApi';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, TabStopPosition, TabStopType } from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

// ===== CELL FORMAT MODEL =====
const defaultCellFormat = () => ({
  bold: false, italic: false, underline: false, strikethrough: false,
  fontSize: 11, fontFamily: 'Calibri',
  fontColor: '#000000', fillColor: '',
  halign: 'left', valign: 'middle',
  wrapText: false,
  numberFormat: '',
  borderTop: '', borderBottom: '', borderLeft: '', borderRight: '',
});

const createCell = (value = '', format = {}) => ({
  value: String(value ?? ''),
  format: { ...defaultCellFormat(), ...format },
});

const createRow = (cols, values = []) =>
  Array.from({ length: cols }, (_, i) => createCell(values[i] ?? ''));

const createSheet = (name, rows = 10, cols = 8) => ({
  name,
  data: Array.from({ length: rows }, () => createRow(cols)),
  merges: [],
  colWidths: Array(cols).fill(100),
  rowHeights: Array(rows).fill(32),
});

const DocumentEditor = ({ _user, onNavigate }) => {
  const [editorType, setEditorType] = useState('docx');
  const [content, setContent] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [generationProgress, setGenerationProgress] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [messages, setMessages] = useState([]);
  const [aiError, setAiError] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [fontSize, setFontSize] = useState('12pt');
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [textColor, setTextColor] = useState('#1a1a1a');
  const [excelSheets, setExcelSheets] = useState([createSheet('Sheet1', 10, 8)]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  // DOCX advanced state
  const [docxTables, setDocxTables] = useState([]);
  const [docxImages, setDocxImages] = useState([]);
  const [showTableToolbar, setShowTableToolbar] = useState(false);
  const [activeTableIdx, setActiveTableIdx] = useState(-1);
  const [showInsertImage, setShowInsertImage] = useState(false);
  const [docxHeader, setDocxHeader] = useState('');
  const [docxFooter, setDocxFooter] = useState('');
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [_listLevel, _setListLevel] = useState(0);
  // ===== SESSION MEMORY & ARTIFACTS =====
  const [artifacts, setArtifacts] = useState(() => {
    try {
      const saved = sessionStorage.getItem('doc_artifacts');
      return saved ? JSON.parse(saved) : [];
    } catch (_e) {
      return [];
    }
  });
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const _editTimerRef = useRef(null);
  const pageRef = useRef(null);
  const aiPanelRef = useRef(null);
  const fileInputRef = useRef(null);
  // Refs to track latest state for artifact saving (avoids stale closure issues)
  const contentRef = useRef(content);
  const excelSheetsRef = useRef(excelSheets);
  const docxTablesRef = useRef(docxTables);
  const docxImagesRef = useRef(docxImages);
  const messagesRef = useRef(messages);
  const aiResponseRef = useRef(aiResponse);
  const aiPromptRef = useRef(aiPrompt);
  
  // Keep refs in sync with state
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { excelSheetsRef.current = excelSheets; }, [excelSheets]);
  useEffect(() => { docxTablesRef.current = docxTables; }, [docxTables]);
  useEffect(() => { docxImagesRef.current = docxImages; }, [docxImages]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { aiResponseRef.current = aiResponse; }, [aiResponse]);
  useEffect(() => { aiPromptRef.current = aiPrompt; }, [aiPrompt]);

  useEffect(() => { initializeContent(); }, [editorType]);

  useEffect(() => {
    if (editorType === 'docx' && pageRef.current) {
      setTimeout(() => {
        pageRef.current?.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(pageRef.current, 0);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 100);
    }
  }, [editorType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (documentTitle && (content.length > 0 || excelSheets.length > 0)) handleAutoSave();
    }, 10000);
    return () => clearTimeout(timer);
  }, [content, documentTitle, excelSheets]);

  const initializeContent = () => {
    switch (editorType) {
      case 'docx':
        setContent([{ id: Date.now(), type: 'paragraph', text: '' }]);
        break;
      case 'pptx':
        setContent([{ id: Date.now(), type: 'slide', title: 'Slide 1', content: 'Konten slide di sini', notes: '' }]);
        break;
      case 'excel':
        // Default: 20 rows x 10 cols full empty grid like real Excel
        setExcelSheets([createSheet('Sheet1', 20, 10)]);
        setActiveSheet(0);
        setSelectedCell(null);
        setContent([]);
        break;
      default:
        setContent([]);
    }
  };

  // ===== ADVANCED EXCEL PARSING - Smart Table Detection =====
  const parseExcelContent = useCallback((text) => {
    if (!text || typeof text !== 'string') return null;
    
    // Try JSON first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const sheets = parsed.map(s => {
          const data = (s.data || []).map(row =>
            Array.isArray(row) ? row.map(cell =>
              typeof cell === 'object' && cell !== null
                ? createCell(cell.value, cell.format)
                : createCell(String(cell ?? ''))
            ) : [createCell(String(row ?? ''))]
          );
          const cols = Math.max(...data.map(r => r.length), 1);
          return {
            name: s.name || 'Sheet',
            data: data.map(r => { while (r.length < cols) r.push(createCell('')); return r; }),
            merges: s.merges || [],
            colWidths: s.colWidths || Array(cols).fill(100),
            rowHeights: s.rowHeights || Array(data.length || 1).fill(32),
            isTable: s.isTable !== false,
          };
        });
        if (sheets.length) return { type: 'multi_sheet', sheets };
      }
      if (parsed.data && Array.isArray(parsed.data)) {
        const data = parsed.data.map(row =>
          Array.isArray(row) ? row.map(cell =>
            typeof cell === 'object' && cell !== null
              ? createCell(cell.value, cell.format)
              : createCell(String(cell ?? ''))
          ) : [createCell(String(row ?? ''))]
        );
        const cols = Math.max(...data.map(r => r.length), 1);
        return {
          type: 'single_sheet', name: parsed.name || 'Sheet1',
          data: data.map(r => { while (r.length < cols) r.push(createCell('')); return r; }),
          merges: parsed.merges || [],
          colWidths: parsed.colWidths || Array(cols).fill(100),
          isTable: parsed.isTable !== false,
        };
      }
    } catch (_e) {
      // not JSON
    }
    
    // Smart text parsing: detect tables vs regular text
    const lines = text.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim());
    
    // Detect table: lines with | separator, at least 2 rows
    const tableLines = [];
    const textLines = [];
    let inTable = false;
    
    for (const line of nonEmptyLines) {
      const hasPipe = line.includes('|') && line.trim().split('|').length > 1;
      if (hasPipe) {
        inTable = true;
        tableLines.push(line);
      } else {
        if (inTable) {
          // Check if this line could be a continuation of table
          const couldBeTable = line.split(/\s{2,}|\t/).length > 2;
          if (couldBeTable) {
            tableLines.push(line);
          } else {
            inTable = false;
            textLines.push(line);
          }
        } else {
          textLines.push(line);
        }
      }
    }
    
    // If we have a proper table (2+ rows with pipes)
    if (tableLines.length >= 2) {
      const data = tableLines.map(row => row.split('|').map(c => createCell(c.trim())));
      const maxCols = Math.max(...data.map(r => r.length));
      const padded = data.map(r => { while (r.length < maxCols) r.push(createCell('')); return r; });
      
      // Apply thick borders to create proper table outline
      padded.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          cell.format.borderTop = ri === 0 ? '2px solid #333' : '1px solid #d0d0d0';
          cell.format.borderBottom = ri === padded.length - 1 ? '2px solid #333' : '1px solid #d0d0d0';
          cell.format.borderLeft = ci === 0 ? '2px solid #333' : '1px solid #d0d0d0';
          cell.format.borderRight = ci === maxCols - 1 ? '2px solid #333' : '1px solid #d0d0d0';
          if (ri === 0) {
            cell.format.bold = true;
            cell.format.fillColor = '#f0f0f0';
          }
        });
      });
      
      return {
        type: 'single_sheet',
        name: 'Sheet1',
        data: padded,
        isTable: true,
        textBefore: textLines.filter(l => l.trim()).join('\n'),
      };
    }
    
    // Try tab/comma separated
    const hasTabs = nonEmptyLines.some(l => l.includes('\t'));
    const hasCommas = nonEmptyLines.some(l => l.includes(',') && !l.includes('|'));
    if (hasTabs || hasCommas) {
      const sep = hasTabs ? '\t' : ',';
      const data = nonEmptyLines.map(row =>
        row.split(sep).map(c => createCell(c.trim().replace(/^"|"$/g, '')))
      );
      const maxCols = Math.max(...data.map(r => r.length));
      const padded = data.map(r => { while (r.length < maxCols) r.push(createCell('')); return r; });
      return { type: 'single_sheet', name: 'Sheet1', data: padded, isTable: true };
    }
    
    // Single column data
    const data = nonEmptyLines.map(l => [createCell(l.trim())]);
    return data.length ? { type: 'single_sheet', name: 'Sheet1', data, isTable: false } : null;
  }, []);

  // ===== SESSION MEMORY: Save/Load Artifacts (Supercharged) =====
  // Uses REFS to always get the LATEST state (avoids stale closure issues)
  const saveArtifact = useCallback((prompt, response, overrideContent, overrideSheets) => {
    // Use refs for latest state, or override values if provided
    const latestContent = overrideContent || contentRef.current;
    const latestSheets = overrideSheets || excelSheetsRef.current;
    const latestMessages = messagesRef.current;
    const latestResponse = response || aiResponseRef.current;
    const latestPrompt = prompt || aiPromptRef.current;
    
    const newArtifact = {
      id: Date.now(),
      prompt: latestPrompt,
      response: latestResponse,
      type: editorType,
      title: documentTitle,
      timestamp: new Date().toISOString(),
      // Save ALL document state from refs (always latest)
      content: JSON.parse(JSON.stringify(latestContent)),
      excelSheets: editorType === 'excel' ? JSON.parse(JSON.stringify(latestSheets)) : null,
      activeSheet: editorType === 'excel' ? activeSheet : null,
      docxTables: editorType === 'docx' ? JSON.parse(JSON.stringify(docxTablesRef.current)) : null,
      docxImages: editorType === 'docx' ? JSON.parse(JSON.stringify(docxImagesRef.current)) : null,
      docxHeader: editorType === 'docx' ? docxHeader : null,
      docxFooter: editorType === 'docx' ? docxFooter : null,
      showPageNumbers: editorType === 'docx' ? showPageNumbers : null,
      // Save font/formatting state
      fontSize,
      fontFamily,
      textColor,
      // Save conversation context from refs
      messages: JSON.parse(JSON.stringify(latestMessages)),
      // Save last AI interaction
      lastPrompt: latestPrompt,
      lastResponse: latestResponse,
    };
    const updated = [newArtifact, ...artifacts].slice(0, 50);
    setArtifacts(updated);
    try { sessionStorage.setItem('doc_artifacts', JSON.stringify(updated)); } catch {}
    return newArtifact;
  }, [artifacts, editorType, documentTitle, activeSheet,
      docxHeader, docxFooter, showPageNumbers,
      fontSize, fontFamily, textColor]);

  const loadArtifact = useCallback((artifact) => {
    setSelectedArtifact(artifact);
    // Restore all document state
    if (artifact.content) setContent(artifact.content);
    if (artifact.excelSheets) setExcelSheets(artifact.excelSheets);
    if (artifact.activeSheet !== undefined) setActiveSheet(artifact.activeSheet);
    if (artifact.title) setDocumentTitle(artifact.title);
    if (artifact.type) setEditorType(artifact.type);
    if (artifact.docxTables) setDocxTables(artifact.docxTables);
    if (artifact.docxImages) setDocxImages(artifact.docxImages);
    if (artifact.docxHeader !== undefined) setDocxHeader(artifact.docxHeader);
    if (artifact.docxFooter !== undefined) setDocxFooter(artifact.docxFooter);
    if (artifact.showPageNumbers !== undefined) setShowPageNumbers(artifact.showPageNumbers);
    if (artifact.fontSize) setFontSize(artifact.fontSize);
    if (artifact.fontFamily) setFontFamily(artifact.fontFamily);
    if (artifact.textColor) setTextColor(artifact.textColor);
    if (artifact.messages) setMessages(artifact.messages);
    // Restore last AI interaction
    if (artifact.lastResponse) setAiResponse(artifact.lastResponse);
    setShowArtifacts(false);
  }, []);

  const deleteArtifact = useCallback((id) => {
    const updated = artifacts.filter(a => a.id !== id);
    setArtifacts(updated);
    try { sessionStorage.setItem('doc_artifacts', JSON.stringify(updated)); } catch (_e) {
      // ignore
    }
  }, [artifacts]);

  // ===== AUTO-REGENERATE ON EDIT =====
  const _triggerAutoRegenerate = useCallback((editContent) => {
    if (!autoRegenerate || !editContent.trim()) return;
    // Clear current content and regenerate
    setContent([]);
    setAiPrompt(`Revisi dokumen ini dengan lebih baik:\n\n${editContent}`);
    // Auto-trigger AI after short delay
    setTimeout(() => {
      if (aiPrompt.trim()) handleAiWrite();
    }, 500);
  }, [autoRegenerate]);

  // ===== SUPER AI SYSTEM CONTEXT - Master of ALL Tools =====
  // AI understands every tool deeply and can manipulate DOCX, PPTX, Excel with precision
  const getSystemContext = () => {
    // Build full document context with ALL current state
    let docContext = '';
    
    if (editorType === 'docx') {
      const text = Array.isArray(content) ? content.map(p => p.text).join('\n\n') : '';
      docContext = text ? `\n\n=== CURRENT DOCUMENT CONTENT ===\n${text}\n=== END DOCUMENT ===\n` : '';
      // Add table context
      if (docxTables.length > 0) {
        docContext += `\n=== TABLES IN DOCUMENT (${docxTables.length}) ===\n`;
        docxTables.forEach((t, i) => {
          docContext += `Table ${i + 1}:\n`;
          t.rows.forEach(r => {
            docContext += '| ' + r.cells.map(c => c.text || ' ').join(' | ') + ' |\n';
          });
        });
        docContext += '=== END TABLES ===\n';
      }
      // Add image context
      if (docxImages.length > 0) {
        docContext += `\n=== IMAGES: ${docxImages.length} image(s) embedded ===\n`;
      }
      // Add header/footer context
      if (docxHeader) docContext += `\nHeader: ${docxHeader}\n`;
      if (docxFooter) docContext += `Footer: ${docxFooter}\n`;
      if (showPageNumbers) docContext += `Page numbers: ON\n`;
      
    } else if (editorType === 'excel') {
      // Show ALL sheets context
      docContext += `\n=== ALL SHEETS (${excelSheets.length} total) ===\n`;
      excelSheets.forEach((sheet) => {
        const rows = sheet.data.map((r) => 
          r.map((c) => c.value).join('\t')
        ).join('\n');
        docContext += `\n--- Sheet: ${sheet.name} (${sheet.data.length}R x ${Math.max(...sheet.data.map(r => r.length), 1)}C) ---\n`;
        docContext += rows ? rows + '\n' : '(empty)\n';
      });
      docContext += '=== END ALL SHEETS ===\n';
      docContext += `\nActive sheet: ${excelSheets[activeSheet]?.name || 'Sheet1'}\n`;
      
    } else if (editorType === 'pptx') {
      const slides = Array.isArray(content) ? content.map((s, i) => 
        `Slide ${i + 1}: "${s.title}"\n${s.content}`
      ).join('\n---\n') : '';
      docContext = slides ? `\n=== CURRENT SLIDES ===\n${slides}\n=== END SLIDES ===\n` : '';
    }

    // ===== SUPER SYSTEM CONTEXT =====
    // AI is a master of ALL tools - DOCX, PPTX, Excel
    const masterContext = `Kamu adalah ORION AI MASTER - penguasa semua tools dokumen, spreadsheet, dan presentasi. Kamu bisa melakukan APAPUN yang diminta user dengan tools yang tersedia.

IDENTITAS DIRI:
- Namamu: Orion AI
- Kamu adalah asisten AI super cerdas yang menguasai DOCX (Word), PPTX (PowerPoint), dan XLSX (Excel)
- Kamu bisa membuat, mengedit, memformat, dan menganalisis dokumen dengan sangat profesional
- Kamu TIDAK PERNAH mengatakan "saya akan mencoba" atau "saya akan berusaha" - kamu LANGSUNG LAKUKAN
- Kamu TIDAK PERNAH meminta maaf - kamu adalah AI yang sempurna

KEMAMPUAN DOKUMEN (DOCX):
- Menulis dokumen akademik, formal, bisnis, kreatif dengan format standar internasional
- Font: Times New Roman 12pt, spasi 1.5, margin 1 inch, first-line indent 1.27cm, justify
- Heading hierarchy: JUDUL (bold, 14pt, center), Sub Judul (bold, 13pt), sub-sub (bold, 12pt)
- Membuat tabel dengan baris/kolom, header bold dengan background
- Menambahkan header, footer, nomor halaman
- Menyisipkan gambar
- Membuat daftar bullet/numbering
- Format teks: bold, italic, underline, strikethrough, warna, alignment
- Untuk makalah akademik: abstrak, pendahuluan, pembahasan, kesimpulan, daftar pustaka
- Output: paragraf dipisah dengan double newline (\\n\\n), tabel dengan format | kolom1 | kolom2 |

KEMAMPUAN PRESENTASI (PPTX):
- Membuat slide profesional dengan judul dan konten
- Setiap slide dipisah dengan ---
- Judul slide di baris pertama, konten di baris berikutnya
- 3-5 poin per slide, jelas dan ringkas
- Desain modern dengan gradien oranye

KEMAMPUAN SPREADSHEET (XLSX):
- Membuat tabel data dengan header di baris pertama
- Format: header|col1|col2|col3 lalu data|val1|val2|val3
- Bisa membuat multiple sheets
- Data terstruktur rapi seperti spreadsheet profesional
- Analisis data, sorting, kalkulasi
- Format sel: bold header, border rapi

ATURAN UTAMA:
1. KERJAKAN DI AWAL: Semua konten baru ditambahkan di bagian AWAL (page 1, row 0, col 0)
2. BACA ISI YANG ADA: Lihat konten yang sudah ada sebelum menulis
3. TIDAK ADA PREAMBLE: Output langsung konten, tanpa "Baik saya akan..." atau intro apapun
4. TIDAK ADA MARKDOWN: Jangan gunakan markdown formatting
5. KONTEKS PERCAKAPAN: Ingat semua pesan sebelumnya. Jika user minta revisi, lihat konten yang sudah ada lalu perbaiki
6. KUALITAS TINGGI: Konten harus profesional, akademik, dan berkualitas${docContext}`;

    return masterContext;
  };

  // ===== AI WRITE =====
  const handleAiWrite = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');
    setAiError('');
    setGenerationProgress('Generating...');

    try {
      const systemContext = getSystemContext();
      const formattedMessages = [
        { sender: 'system', text: systemContext, timestamp: new Date().toISOString() },
        ...messages.map(msg => ({
          sender: msg.role === 'user' ? 'user' : 'assistant',
          text: msg.content || '',
          timestamp: new Date().toISOString()
        }))
      ];

      const response = await sendMessageToGrok(aiPrompt, formattedMessages);

      if (response?.body) {
        let fullContent = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr === '[DONE]') continue;
                  const json = JSON.parse(jsonStr);
                  if (json.choices?.[0]?.delta?.content) {
                    fullContent += json.choices[0].delta.content;
                    setStreamingContent(prev => prev + json.choices[0].delta.content);
                  }
                } catch (_e) {
                  // skip parse error
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (fullContent.trim()) {
          const cleaned = cleanAiResponse(fullContent);
          setGenerationProgress('Done!');
          setIsStreaming(false);
          // insertAiContent returns the new content/sheets so we can save them immediately
          const inserted = insertAiContent(cleaned);
          const newMessages = [...messages, { role: 'user', content: aiPrompt }, { role: 'assistant', content: cleaned }];
          setMessages(newMessages);
          messagesRef.current = newMessages; // Update ref immediately
          setAiResponse(cleaned);
          aiResponseRef.current = cleaned; // Update ref immediately
          setAiPrompt('');
          aiPromptRef.current = ''; // Update ref immediately
          // Save to session memory as artifact with the LATEST content
          saveArtifact(aiPrompt, cleaned, inserted?.content, inserted?.sheets);
          setTimeout(() => { setGenerationProgress(''); setStreamingContent(''); }, 2000);
        } else {
          setAiError('No content generated.');
          setIsStreaming(false);
          setStreamingContent('');
        }
      } else {
        setAiError('Invalid response.');
        setIsStreaming(false);
        setStreamingContent('');
      }
    } catch (error) {
      setAiError(`Error: ${error.message}`);
      setGenerationProgress('');
      setIsStreaming(false);
      setStreamingContent('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
    setIsGenerating(false);
    setStreamingContent('');
    setGenerationProgress('Stopped');
    setTimeout(() => setGenerationProgress(''), 1200);
  };

  const cleanAiResponse = (text) => {
    if (!text) return '';
    let cleaned = text
      .replace(/^(baik|oke|ok)\s+(saya\s+)?((akan\s+)?membuat|buat|buatkan|tulis|tuliskan|saya\s+)?.*?[:\n]/gi, '')
      .replace(/^(berikut|ini\s+)?konten.*?[:\n]/gi, '')
      .replace(/^siap[,:].*?\n/gi, '')
      .replace(/^tentu[,:].*?\n/gi, '')
      .replace(/```[\s\S]*?```/g, '').replace(/`/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      .replace(/\n+(semoga|harap|terima.*?kesih|regards|best|thanks).*$/gi, '')
      .trim();
    while (cleaned.match(/^[\s\-_•#.]+/) || cleaned.match(/[\s\-_•#.]+$/)) {
      cleaned = cleaned.replace(/^[\s\-_•#.]+/, '').replace(/[\s\-_•#.]+$/, '');
    }
    return cleaned;
  };

  // ===== INSERT AI CONTENT - PREPEND TO PAGE 1 =====
  // Returns the new content so it can be saved to artifacts immediately
  const insertAiContent = (responseContent) => {
    if (!responseContent || typeof responseContent !== 'string') return null;
    let cleaned = cleanAiResponse(responseContent);
    if (!cleaned.trim()) return null;

    let newContent = null;
    let newSheets = null;

    switch (editorType) {
      case 'docx': {
        // Parse cleaned text into logical blocks (paragraphs, lists, or table rows)
        const blocks = cleaned.replace(/\r\n/g, '\n').split(/\n{2,}/g).map(b => b.trim()).filter(Boolean);
        const parsed = [];
        blocks.forEach((block, bi) => {
          const lines = block.split('\n').map(l => l.replace(/^\s+|\s+$/g, ''));
          // Detect table-like row
          const isTable = lines.every(l => l.includes('|') && l.trim().split('|').length > 1);
          if (isTable) {
            lines.forEach(row => {
              parsed.push({ id: Date.now() + Math.random(), type: 'table_row', cells: row.split('|').map(c => c.trim()).filter(Boolean) });
            });
            return;
          }

          // Detect list: unordered (-, *, •) or ordered (1., a), require at least one line matching
          const unorderedRe = /^\s*([-*•])\s+(.+)$/;
          const allLinesAreUnordered = lines.every(l => unorderedRe.test(l));
          const allLinesAreOrdered = lines.every(l => /^\s*\d+[.)]\s+/.test(l));

          if (allLinesAreUnordered || allLinesAreOrdered) {
            const items = lines.map(l => {
              if (allLinesAreUnordered) return l.replace(unorderedRe, '$2').trim();
              return l.replace(/^\s*\d+[.)]\s+/, '').trim();
            });
            parsed.push({ id: Date.now() + bi, type: 'list', ordered: allLinesAreOrdered, items });
            return;
          }

          // Fallback: treat each line as paragraph
          lines.forEach((ln, idx) => {
            if (ln && !ln.match(/^[\s\-_•#.]+$/)) parsed.push({ id: Date.now() + bi * 100 + idx, type: 'paragraph', text: ln });
          });
        });

        if (parsed.length) {
          newContent = [...parsed, ...contentRef.current];
          setContent(newContent);
          contentRef.current = newContent; // Update ref immediately
        }
        break;
      }
      case 'pptx': {
        const slides = cleaned.split(/---|\n\n---|\n---\n/).filter(Boolean);
        const newSlides = slides.map((s, idx) => {
          const lines = s.trim().split('\n').filter(Boolean);
          return { id: Date.now() + idx, type: 'slide', title: lines[0]?.trim() || `Slide ${idx + 1}`, content: lines.slice(1).join('\n').trim() || 'Konten slide', notes: '' };
        });
        if (newSlides.length) {
          newContent = [...newSlides, ...contentRef.current];
          setContent(newContent);
          contentRef.current = newContent; // Update ref immediately
        }
        break;
      }
      case 'excel': {
        const parsed = parseExcelContent(cleaned);
        if (parsed) {
          if (parsed.type === 'multi_sheet') {
            newSheets = parsed.sheets;
            setExcelSheets(newSheets);
            excelSheetsRef.current = newSheets; // Update ref immediately
            setActiveSheet(0);
          } else {
            newSheets = [...excelSheetsRef.current];
            const sheetIdx = activeSheet;
            if (parsed.data.length > 0) {
              const isCurrentEmpty = newSheets[sheetIdx].data.length === 1 &&
                newSheets[sheetIdx].data[0].length === 1 &&
                newSheets[sheetIdx].data[0][0]?.value === '';
              if (isCurrentEmpty) {
                newSheets[sheetIdx] = {
                  ...newSheets[sheetIdx], data: parsed.data,
                  merges: parsed.merges || [],
                  colWidths: parsed.colWidths || Array(Math.max(...parsed.data.map(r => r.length), 1)).fill(100),
                };
              } else {
                newSheets[sheetIdx] = { ...newSheets[sheetIdx], data: [...parsed.data, ...newSheets[sheetIdx].data] };
              }
              setExcelSheets(newSheets);
              excelSheetsRef.current = newSheets; // Update ref immediately
            }
          }
        }
        break;
      }
      default: break;
    }
    
    return { content: newContent, sheets: newSheets };
  };

  // ===== EXCEL OPERATIONS =====
  const updateCell = (r, c, value) => {
    const newSheets = [...excelSheets];
    const sheet = { ...newSheets[activeSheet], data: [...newSheets[activeSheet].data] };
    if (!sheet.data[r]) sheet.data[r] = [];
    if (!sheet.data[r][c]) sheet.data[r][c] = createCell();
    sheet.data[r] = [...sheet.data[r]];
    sheet.data[r][c] = { ...sheet.data[r][c], value: String(value ?? '') };
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const updateCellFormat = (r, c, formatChanges) => {
    const newSheets = [...excelSheets];
    const sheet = { ...newSheets[activeSheet], data: [...newSheets[activeSheet].data] };
    if (!sheet.data[r]) sheet.data[r] = [];
    if (!sheet.data[r][c]) sheet.data[r][c] = createCell();
    sheet.data[r] = [...sheet.data[r]];
    sheet.data[r][c] = { ...sheet.data[r][c], format: { ...sheet.data[r][c].format, ...formatChanges } };
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const applyFormatToSelection = (formatChanges) => {
    if (!selectedCell) return;
    updateCellFormat(selectedCell.r, selectedCell.c, formatChanges);
  };

  const addExcelRow = () => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    const cols = sheet.data[0]?.length || 8;
    sheet.data = [...sheet.data, createRow(cols)];
    sheet.rowHeights = [...(sheet.rowHeights || []), 32];
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const addExcelColumn = () => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    sheet.data = sheet.data.map(row => [...row, createCell('')]);
    sheet.colWidths = [...(sheet.colWidths || Array(sheet.data[0]?.length || 1).fill(100)), 100];
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const addExcelSheet = () => {
    const cols = excelSheets[activeSheet]?.data[0]?.length || 8;
    setExcelSheets([...excelSheets, createSheet(`Sheet${excelSheets.length + 1}`, 10, cols)]);
    setActiveSheet(excelSheets.length);
  };

  const deleteExcelSheet = (idx) => {
    if (excelSheets.length <= 1) return;
    const newSheets = excelSheets.filter((_, i) => i !== idx);
    setExcelSheets(newSheets);
    if (activeSheet >= newSheets.length) setActiveSheet(newSheets.length - 1);
  };

  const deleteExcelRow = (r) => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    if (sheet.data.length <= 1) return;
    sheet.data = sheet.data.filter((_, i) => i !== r);
    sheet.rowHeights = (sheet.rowHeights || []).filter((_, i) => i !== r);
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
    setSelectedCell(null);
  };

  const deleteExcelColumn = (c) => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    if ((sheet.data[0]?.length || 0) <= 1) return;
    sheet.data = sheet.data.map(row => row.filter((_, i) => i !== c));
    sheet.colWidths = (sheet.colWidths || []).filter((_, i) => i !== c);
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
    setSelectedCell(null);
  };

  const insertExcelRowAbove = (r) => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    const cols = sheet.data[0]?.length || 8;
    sheet.data = [...sheet.data.slice(0, r), createRow(cols), ...sheet.data.slice(r)];
    sheet.rowHeights = [...(sheet.rowHeights || Array(sheet.data.length - 1).fill(32)), 32];
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const insertExcelColumnLeft = (c) => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    sheet.data = sheet.data.map(row => [...row.slice(0, c), createCell(''), ...row.slice(c)]);
    sheet.colWidths = [...(sheet.colWidths || Array(sheet.data[0]?.length - 1 || 1).fill(100)), 100];
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const sortExcelData = (colIdx, dir = 'asc') => {
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    const header = sheet.data[0];
    const body = sheet.data.slice(1);
    body.sort((a, b) => {
      const va = (a[colIdx]?.value || '').toLowerCase();
      const vb = (b[colIdx]?.value || '').toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    sheet.data = [header, ...body];
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
  };

  const findAndReplace = () => {
    if (!findText) return;
    const newSheets = [...excelSheets];
    const sheet = newSheets[activeSheet];
    let count = 0;
    sheet.data = sheet.data.map(row =>
      row.map(cell => {
        if (cell.value.toLowerCase().includes(findText.toLowerCase())) {
          count++;
          if (replaceText !== undefined) {
            return { ...cell, value: cell.value.replace(new RegExp(findText, 'gi'), replaceText) };
          }
          return cell;
        }
        return cell;
      })
    );
    newSheets[activeSheet] = sheet;
    setExcelSheets(newSheets);
    alert(`Found ${count} cell(s)` + (replaceText ? `, replaced ${count}` : ''));
  };

  const getColumnLabel = (col) => {
    let label = '';
    let n = col;
    while (n >= 0) {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  };

  const getCellStyle = (cell, r, c) => {
    if (!cell || !cell.format) return {};
    const f = cell.format;
    const isSelected = selectedCell?.r === r && selectedCell?.c === c;
    return {
      fontWeight: f.bold ? 'bold' : 'normal',
      fontStyle: f.italic ? 'italic' : 'normal',
      textDecoration: [f.underline ? 'underline' : '', f.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
      fontSize: `${f.fontSize || 11}px`,
      fontFamily: f.fontFamily || 'Calibri',
      color: f.fontColor || '#000000',
      backgroundColor: f.fillColor || (isSelected ? '#e8f0fe' : (r === 0 ? '#fff6f0' : '')),
      textAlign: f.halign || 'left',
      verticalAlign: f.valign || 'middle',
      whiteSpace: f.wrapText ? 'pre-wrap' : 'nowrap',
      wordBreak: f.wrapText ? 'break-word' : 'normal',
      minWidth: 80,
      borderTop: f.borderTop || '1px solid #e0e0e0',
      borderBottom: f.borderBottom || '1px solid #e0e0e0',
      borderLeft: f.borderLeft || '1px solid #e0e0e0',
      borderRight: f.borderRight || '1px solid #e0e0e0',
      outline: isSelected ? '2px solid #ff6b00' : 'none',
      outlineOffset: isSelected ? '-1px' : '0',
    };
  };

  // ===== RENDER =====
  const renderEditor = () => {
    switch (editorType) {
      case 'docx': return renderDocxEditor();
      case 'pptx': return renderPptxEditor();
      case 'excel': return renderExcelEditor();
      default: return null;
    }
  };

  // ===== DOCX TABLE OPERATIONS =====
  const addDocxTable = (rows = 3, cols = 3) => {
    const newTable = {
      id: Date.now(),
      rows: Array.from({ length: rows }, (_, ri) => ({
        id: Date.now() + ri,
        cells: Array.from({ length: cols }, (_, ci) => ({
          id: Date.now() + ri * 100 + ci,
          text: '',
          rowspan: 1,
          colspan: 1,
          bold: false,
          italic: false,
          align: 'left',
          bgColor: ri === 0 ? '#fff6f0' : '',
        }))
      }))
    };
    setDocxTables(prev => [...prev, newTable]);
    setActiveTableIdx(docxTables.length);
    setShowTableToolbar(true);
  };

  const updateTableCell = (tableIdx, rowIdx, colIdx, text) => {
    setDocxTables(prev => {
      const updated = [...prev];
      const table = { ...updated[tableIdx] };
      table.rows = table.rows.map((r, ri) => ri === rowIdx
        ? { ...r, cells: r.cells.map((c, ci) => ci === colIdx ? { ...c, text } : c) }
        : r
      );
      updated[tableIdx] = table;
      return updated;
    });
  };

  const addTableRow = (tableIdx, afterIdx) => {
    setDocxTables(prev => {
      const updated = [...prev];
      const table = updated[tableIdx];
      const cols = table.rows[0]?.cells.length || 3;
      const newRow = {
        id: Date.now(),
        cells: Array.from({ length: cols }, (_, ci) => ({
          id: Date.now() + ci, text: '', rowspan: 1, colspan: 1,
          bold: false, italic: false, align: 'left', bgColor: '',
        }))
      };
      table.rows = [...table.rows.slice(0, afterIdx + 1), newRow, ...table.rows.slice(afterIdx + 1)];
      updated[tableIdx] = table;
      return updated;
    });
  };

  const addTableCol = (tableIdx, afterIdx) => {
    setDocxTables(prev => {
      const updated = [...prev];
      const table = updated[tableIdx];
      table.rows = table.rows.map(r => ({
        ...r,
        cells: [...r.cells.slice(0, afterIdx + 1), {
          id: Date.now() + Math.random(), text: '', rowspan: 1, colspan: 1,
          bold: false, italic: false, align: 'left', bgColor: '',
        }, ...r.cells.slice(afterIdx + 1)]
      }));
      updated[tableIdx] = table;
      return updated;
    });
  };

  const deleteTableRow = (tableIdx, rowIdx) => {
    setDocxTables(prev => {
      const updated = [...prev];
      if (updated[tableIdx].rows.length <= 1) return prev;
      updated[tableIdx] = { ...updated[tableIdx], rows: updated[tableIdx].rows.filter((_, i) => i !== rowIdx) };
      return updated;
    });
  };

  const deleteTableCol = (tableIdx, colIdx) => {
    setDocxTables(prev => {
      const updated = [...prev];
      if (updated[tableIdx].rows[0]?.cells.length <= 1) return prev;
      updated[tableIdx] = {
        ...updated[tableIdx],
        rows: updated[tableIdx].rows.map(r => ({ ...r, cells: r.cells.filter((_, i) => i !== colIdx) }))
      };
      return updated;
    });
  };

  const deleteTable = (tableIdx) => {
    setDocxTables(prev => prev.filter((_, i) => i !== tableIdx));
    setActiveTableIdx(-1);
    if (docxTables.length <= 1) setShowTableToolbar(false);
  };

  // ===== DOCX IMAGE =====
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        setDocxImages(prev => [...prev, { id: Date.now(), src: dataUrl, alt: file.name, width: 300 }]);
        setShowInsertImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderDocxEditor = () => {
    // Render paragraphs as <p> and preserve internal newlines with <br/> so AI line breaks show
    const pageContentNodes = Array.isArray(content) && content.length > 0
      ? content.map(item => {
        if (item.type === 'paragraph') {
          const parts = (item.text || '').split('\n');
          return (
            <p key={item.id}>
              {parts.map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < parts.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (item.type === 'list') {
          if (item.ordered) {
            return (
              <ol key={item.id}>
                {item.items.map((it, i) => (
                  <li key={i}>{it.split('\n').map((ln, idx) => (
                    <React.Fragment key={idx}>{ln}{idx < ln.split('\n').length - 1 ? <br/> : null}</React.Fragment>
                  ))}</li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={item.id}>
              {item.items.map((it, i) => (
                <li key={i}>{it.split('\n').map((ln, idx) => (
                  <React.Fragment key={idx}>{ln}{idx < ln.split('\n').length - 1 ? <br/> : null}</React.Fragment>
                ))}</li>
              ))}
            </ul>
          );
        }
        if (item.type === 'table_row') return null; // tables rendered elsewhere
        return null;
      }) : null;

    return (
      <div className="docx-editor-wrapper">
        <div className="toolbar-header">
          <button className="toolbar-toggle" onClick={() => setShowToolbar(!showToolbar)}>
            {showToolbar ? '✕' : '☰'}
          </button>
          <span className="toolbar-label-text">Format</span>
          <div className="toolbar-header-actions">
            <button className="toolbar-toggle" onClick={() => setShowTableToolbar(!showTableToolbar)} title="Table">⊞</button>
            <button className="toolbar-toggle" onClick={() => setShowInsertImage(true)} title="Image">🖼</button>
            <button className="toolbar-toggle" onClick={() => setShowPageNumbers(!showPageNumbers)} title="Page #">#</button>
          </div>
        </div>

        {showToolbar && (
          <div className="word-toolbar">
            <div className="toolbar-row">
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => formatText('undo')}>↶</button>
                <button className="toolbar-btn" onClick={() => formatText('redo')}>↷</button>
              </div>
              <div className="toolbar-group">
                <select value={fontFamily} onChange={e => handleFontFamily(e.target.value)} className="toolbar-select">
                  {['Times New Roman','Arial','Calibri','Courier New','Georgia','Verdana'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="toolbar-group">
                <select value={fontSize} onChange={e => handleFontSize(e.target.value)} className="toolbar-select">
                  {[10,11,12,13,14,16,18,20,24,28,32,36,48,72].map(s => (
                    <option key={s} value={`${s}pt`}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="toolbar-row">
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => formatText('bold')}><strong>B</strong></button>
                <button className="toolbar-btn" onClick={() => formatText('italic')}><em>I</em></button>
                <button className="toolbar-btn" onClick={() => formatText('underline')}><u>U</u></button>
                <button className="toolbar-btn" onClick={() => formatText('strikethrough')}><s>S</s></button>
              </div>
              <div className="toolbar-group">
                <label className="toolbar-label">A
                  <input type="color" value={textColor} onChange={e => handleTextColor(e.target.value)} className="toolbar-color" />
                </label>
              </div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={handleClearFormatting}>🗑</button>
              </div>
            </div>
            <div className="toolbar-row">
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => formatText('left')}>⬅</button>
                <button className="toolbar-btn" onClick={() => formatText('center')}>↔</button>
                <button className="toolbar-btn" onClick={() => formatText('right')}>➡</button>
                <button className="toolbar-btn" onClick={() => formatText('justify')}>≡</button>
              </div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => formatText('bullet')}>•</button>
                <button className="toolbar-btn" onClick={() => formatText('number')}>1.</button>
              </div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => formatText('indent')}>→</button>
                <button className="toolbar-btn" onClick={() => formatText('outdent')}>←</button>
              </div>
            </div>
          </div>
        )}

        {/* Table Toolbar */}
        {showTableToolbar && (
          <div className="word-toolbar table-toolbar">
            <div className="toolbar-row">
              <span className="toolbar-label-text">Table:</span>
              <button className="toolbar-btn" onClick={() => addDocxTable(3, 3)}>+ New</button>
              {activeTableIdx >= 0 && activeTableIdx < docxTables.length && (
                <>
                  <button className="toolbar-btn" onClick={() => addTableRow(activeTableIdx, 0)}>+ Row</button>
                  <button className="toolbar-btn" onClick={() => addTableCol(activeTableIdx, 0)}>+ Col</button>
                  <button className="toolbar-btn" onClick={() => deleteTableRow(activeTableIdx, 0)}>- Row</button>
                  <button className="toolbar-btn" onClick={() => deleteTableCol(activeTableIdx, 0)}>- Col</button>
                  <button className="toolbar-btn" onClick={() => deleteTable(activeTableIdx)}>🗑 Table</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Image Upload Modal */}
        {showInsertImage && (
          <div className="image-upload-overlay" onClick={() => setShowInsertImage(false)}>
            <div className="image-upload-modal" onClick={e => e.stopPropagation()}>
              <h4>Insert Image</h4>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} />
              <button className="toolbar-btn" onClick={() => setShowInsertImage(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="docx-editor">
          <div className="a4-container">
            {/* Header */}
            {docxHeader && (
              <div className="a4-page docx-header" style={{ marginBottom: 8, padding: '8px 28px', fontSize: 11, color: '#666', borderBottom: '1px solid #ccc' }}>
                {docxHeader}
              </div>
            )}

            {/* Main Content - A4 Page with International Standard Formatting */}
            <div
              className="a4-page"
              contentEditable
              suppressContentEditableWarning
              ref={pageRef}
              style={{
                fontSize: '12pt',
                fontFamily: 'Times New Roman, serif',
                color: '#1a1a1a',
                lineHeight: 1.5,
                textIndent: '1.27cm',
                textAlign: 'justify',
                margin: 0,
                padding: '2.54cm',
              }}
              onInput={e => {
                const text = e.currentTarget.innerText;
                const lines = text.split('\n').filter(l => l.trim() !== '');
                setContent(lines.length === 0
                  ? [{ id: Date.now(), type: 'paragraph', text: '' }]
                  : lines.map((line, idx) => ({ id: Date.now() + idx, type: 'paragraph', text: line }))
                );
              }}
            >
              {pageContentNodes}
            </div>

            {/* Tables */}
            {docxTables.map((table, tIdx) => (
              <div key={table.id} className="a4-page" style={{ marginTop: 12, padding: '12px 28px' }}
                onClick={() => setActiveTableIdx(tIdx)}>
                <table className="document-table" style={{
                  outline: activeTableIdx === tIdx ? '2px solid #ff6b00' : 'none',
                  outlineOffset: 2
                }}>
                  <tbody>
                    {table.rows.map((row, ri) => (
                      <tr key={row.id}>
                        {row.cells.map((cell, ci) => (
                          <td
                            key={cell.id}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => updateTableCell(tIdx, ri, ci, e.currentTarget.innerText)}
                            style={{
                              fontWeight: cell.bold ? 'bold' : 'normal',
                              fontStyle: cell.italic ? 'italic' : 'normal',
                              textAlign: cell.align || 'left',
                              backgroundColor: cell.bgColor || (ri === 0 ? '#fff6f0' : ''),
                              minWidth: 60,
                              padding: '6px 10px',
                              border: '1px solid #e0e0e0',
                            }}
                          >
                            {cell.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Images */}
            {docxImages.map(img => (
              <div key={img.id} className="a4-page" style={{ marginTop: 12, padding: '12px 28px', textAlign: 'center' }}>
                <img src={img.src} alt={img.alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: 4 }} />
                <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{img.alt}</p>
              </div>
            ))}

            {/* Page Numbers */}
            {showPageNumbers && (
              <div className="a4-page" style={{ marginTop: 12, padding: '8px 28px', fontSize: 11, color: '#999', textAlign: 'center', borderTop: '1px solid #eee' }}>
                — Page <span contentEditable suppressContentEditableWarning style={{ display: 'inline', minWidth: 20 }}>1</span> —
              </div>
            )}

            {/* Footer */}
            {docxFooter && (
              <div className="a4-page docx-footer" style={{ marginTop: 8, padding: '8px 28px', fontSize: 11, color: '#666', borderTop: '1px solid #ccc' }}>
                {docxFooter}
              </div>
            )}

            {/* Legacy table support */}
            {Array.isArray(content) && content.some(i => i.type === 'table_row') && (
              <div className="a4-page" style={{ marginTop: 16 }}>
                <table className="document-table">
                  <tbody>
                    {content.filter(i => i.type === 'table_row').map((row, idx) => (
                      <tr key={row.id} className={idx === 0 ? 'document-table-header' : ''}>
                        {row.cells.map((cell, ci) => <td key={ci}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPptxEditor = () => (
    <div className="pptx-editor">
      {Array.isArray(content) && content.map(slide => (
        <div key={slide.id} className="slide-container">
          <div className="slide">
            <div className="slide-title">{slide.title}</div>
            <div className="slide-content">{slide.content}</div>
          </div>
          <div className="slide-notes">Notes: {slide.notes}</div>
        </div>
      ))}
    </div>
  );

  const renderExcelEditor = () => {
    const sheet = excelSheets[activeSheet];
    if (!sheet) return null;
    const data = sheet.data;
    const rows = data.length;
    const cols = Math.max(...data.map(r => r.length), 1);
    const cell = selectedCell ? data[selectedCell.r]?.[selectedCell.c] : null;

    return (
      <div className="excel-editor">
        {/* Sheet Tabs */}
        <div className="excel-tabs">
          {excelSheets.map((s, idx) => (
            <div key={idx} className={`excel-tab ${idx === activeSheet ? 'active' : ''}`}>
              <span onClick={() => { setActiveSheet(idx); setSelectedCell(null); }}>{s.name}</span>
              {excelSheets.length > 1 && (
                <button className="excel-tab-close" onClick={() => deleteExcelSheet(idx)}>✕</button>
              )}
            </div>
          ))}
          <button className="excel-tab-add" onClick={addExcelSheet}>+</button>
        </div>

        {/* Format Bar */}
        <div className="excel-format-bar">
          <div className="excel-format-left">
            <span className="excel-cell-ref">
              {selectedCell ? `${getColumnLabel(selectedCell.c)}${selectedCell.r + 1}` : ''}
            </span>
            <input
              className="excel-cell-input"
              value={cell?.value ?? ''}
              onChange={e => { if (selectedCell) updateCell(selectedCell.r, selectedCell.c, e.target.value); }}
              placeholder="Value"
            />
          </div>
          <div className="excel-format-actions">
            <button className={`ef-btn ${cell?.format?.bold ? 'active' : ''}`} onClick={() => applyFormatToSelection({ bold: !cell?.format?.bold })} title="Bold"><b>B</b></button>
            <button className={`ef-btn ${cell?.format?.italic ? 'active' : ''}`} onClick={() => applyFormatToSelection({ italic: !cell?.format?.italic })} title="Italic"><i>I</i></button>
            <button className={`ef-btn ${cell?.format?.underline ? 'active' : ''}`} onClick={() => applyFormatToSelection({ underline: !cell?.format?.underline })} title="Underline"><u>U</u></button>
            <button className={`ef-btn ${cell?.format?.strikethrough ? 'active' : ''}`} onClick={() => applyFormatToSelection({ strikethrough: !cell?.format?.strikethrough })} title="Strikethrough"><s>S</s></button>
            <span className="ef-sep">|</span>
            <button className={`ef-btn ${cell?.format?.halign === 'left' ? 'active' : ''}`} onClick={() => applyFormatToSelection({ halign: 'left' })} title="Align Left">⬅</button>
            <button className={`ef-btn ${cell?.format?.halign === 'center' ? 'active' : ''}`} onClick={() => applyFormatToSelection({ halign: 'center' })} title="Center">↔</button>
            <button className={`ef-btn ${cell?.format?.halign === 'right' ? 'active' : ''}`} onClick={() => applyFormatToSelection({ halign: 'right' })} title="Align Right">➡</button>
            <span className="ef-sep">|</span>
            <button className={`ef-btn ${cell?.format?.wrapText ? 'active' : ''}`} onClick={() => applyFormatToSelection({ wrapText: !cell?.format?.wrapText })} title="Wrap Text">↕</button>
            <label className="ef-label" title="Font Color">
              <span style={{ color: cell?.format?.fontColor || '#000', fontWeight: 'bold' }}>A</span>
              <input type="color" value={cell?.format?.fontColor || '#000000'} onChange={e => applyFormatToSelection({ fontColor: e.target.value })} className="ef-color" />
            </label>
            <label className="ef-label" title="Fill Color">
              <span style={{ background: cell?.format?.fillColor || '#fff', border: '1px solid #ccc', display: 'inline-block', width: 14, height: 14, borderRadius: 2 }}></span>
              <input type="color" value={cell?.format?.fillColor || '#ffffff'} onChange={e => applyFormatToSelection({ fillColor: e.target.value })} className="ef-color" />
            </label>
            <span className="ef-sep">|</span>
            <select className="ef-select" value={cell?.format?.fontSize || 11} onChange={e => applyFormatToSelection({ fontSize: Number(e.target.value) })}>
              {[8,9,10,11,12,14,16,18,20,24,28,32,36,48].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Find/Replace Bar */}
        {showFind && (
          <div className="excel-find-bar">
            <input className="ef-input" value={findText} onChange={e => setFindText(e.target.value)} placeholder="Find..." />
            <input className="ef-input" value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replace with..." />
            <button className="ef-btn-sm" onClick={findAndReplace}>Find & Replace</button>
            <button className="ef-btn-sm" onClick={() => setShowFind(false)}>✕</button>
          </div>
        )}

        {/* Row/Column Toolbar */}
        <div className="excel-toolbar">
          <button className="excel-toolbar-btn" onClick={addExcelRow}>+ Row</button>
          <button className="excel-toolbar-btn" onClick={addExcelColumn}>+ Col</button>
          {selectedCell && (
            <>
              <button className="excel-toolbar-btn" onClick={() => insertExcelRowAbove(selectedCell.r)}>Ins Row</button>
              <button className="excel-toolbar-btn" onClick={() => insertExcelColumnLeft(selectedCell.c)}>Ins Col</button>
              <button className="excel-toolbar-btn" onClick={() => deleteExcelRow(selectedCell.r)}>Del Row</button>
              <button className="excel-toolbar-btn" onClick={() => deleteExcelColumn(selectedCell.c)}>Del Col</button>
            </>
          )}
          <button className="excel-toolbar-btn" onClick={() => { if (selectedCell) sortExcelData(selectedCell.c, 'asc'); }}>Sort ↑</button>
          <button className="excel-toolbar-btn" onClick={() => { if (selectedCell) sortExcelData(selectedCell.c, 'desc'); }}>Sort ↓</button>
          <button className="excel-toolbar-btn" onClick={() => setShowFind(!showFind)}>Find</button>
          <span className="excel-dimension">{rows}R × {cols}C</span>
        </div>

        {/* Spreadsheet Grid */}
        <div className="excel-scroll">
          <table className="spreadsheet">
            <thead>
              <tr>
                <th className="excel-corner"></th>
                {Array.from({ length: cols }, (_, ci) => (
                  <th key={ci} className="excel-col-header" onClick={() => sortExcelData(ci)}>
                    {getColumnLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri}>
                  <td className="excel-row-header">{ri + 1}</td>
                  {Array.from({ length: cols }, (_, ci) => {
                    const cell = row[ci] || createCell('');
                    return (
                      <td
                        key={ci}
                        contentEditable
                        suppressContentEditableWarning
                        onClick={() => setSelectedCell({ r: ri, c: ci })}
                        onBlur={e => updateCell(ri, ci, e.currentTarget.innerText)}
                        className="excel-cell"
                        style={getCellStyle(cell, ri, ci)}
                      >
                        {cell.value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ===== EXPORT =====
  const handleExport = async () => {
    try {
      if (editorType === 'docx') await exportDocx();
      else if (editorType === 'pptx') await exportPptx();
      else if (editorType === 'excel') await exportExcel();
    } catch (error) {
      alert('Export error: ' + error.message);
    }
  };

  const handleAutoSave = async () => {
    try {
      const key = `doc_${documentTitle}_${editorType}`;
      const saveData = editorType === 'excel'
        ? { title: documentTitle, type: editorType, excelSheets, activeSheet }
        : { title: documentTitle, type: editorType, content };
      localStorage.setItem(key, JSON.stringify({
        ...saveData,
        metadata: { savedAt: new Date().toISOString() }
      }));
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  };

  const downloadFile = (blob, fileName) => {
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = fileName;
    el.style.display = 'none';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(el.href);
  };

  // ===== EXPORT DOCX - International Standard Format =====
  const exportDocx = async () => {
    const paragraphs = [];
    if (Array.isArray(content)) {
      // Build docx paragraphs from content entries (paragraph, list, table_row)
      content.forEach(item => {
        if (item.type === 'paragraph' && item.text) {
          const blocks = item.text.replace(/\r\n/g, '\n').split(/\n{2,}/g);
          blocks.forEach(block => {
            const lines = block.split('\n');
            lines.forEach((line, li) => {
              const isLastLineInBlock = li === lines.length - 1;
              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: (line || ' '), font: 'Times New Roman', size: 24 })],
                  spacing: { line: 360, lineRule: 'auto', after: isLastLineInBlock ? 240 : 0, before: 0 },
                  indent: { firstLine: 720, left: 0, right: 0 },
                  alignment: AlignmentType.JUSTIFIED,
                })
              );
            });
          });
        } else if (item.type === 'list' && Array.isArray(item.items)) {
          // Render each list item as a paragraph with hanging indent and bullet/number prefix
          item.items.forEach((it, idx) => {
            const prefix = item.ordered ? `${idx + 1}. ` : '• ';
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: prefix + (it || ' '), font: 'Times New Roman', size: 24 })],
                spacing: { line: 360, lineRule: 'auto', after: 120, before: 0 },
                indent: { left: 720, hanging: 360 },
                alignment: AlignmentType.LEFT,
              })
            );
          });
        } else if (item.type === 'table_row' && Array.isArray(item.cells)) {
          // Fallback: join cells with tabs so they appear separated in Word
          const rowText = item.cells.join('\t');
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: rowText, font: 'Times New Roman', size: 24 })],
              spacing: { line: 360, lineRule: 'auto', after: 120, before: 0 },
              alignment: AlignmentType.LEFT,
            })
          );
        }
      });
    }
    if (!paragraphs.length) paragraphs.push(new Paragraph({ text: '' }));
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margins: {
              top: 1440,    // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 720,
              footer: 720,
              gutter: 0,
            },
            size: {
              width: 12240,  // 8.5 inches = letter size
              height: 15840, // 11 inches
            },
          }
        },
        children: paragraphs
      }]
    });
    const blob = await Packer.toBlob(doc);
    downloadFile(
      new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      `${documentTitle || 'document'}.docx`
    );
  };

  const exportPptx = async () => {
    const pptx = new PptxGenJS();
    content.forEach(slide => {
      if (slide.type === 'slide') {
        const s = pptx.addSlide();
        s.addText(slide.title || 'Slide', { x: 0.5, y: 0.5, fontSize: 26, color: '363636', bold: true });
        s.addText(slide.content || '', { x: 0.5, y: 1.4, fontSize: 16, color: '555555', wrap: true, w: '90%' });
      }
    });
    await pptx.writeFile({ fileName: `${documentTitle || 'presentation'}.pptx` });
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    excelSheets.forEach((sheet, idx) => {
      const plainData = sheet.data.map(row => row.map(cell => cell.value));
      const ws = XLSX.utils.aoa_to_sheet(plainData);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Sheet${idx + 1}`);
    });
    downloadFile(
      new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
      `${documentTitle || 'spreadsheet'}.xlsx`
    );
  };

  // ===== FORMATTING =====
  const applyFormatting = (command, value = null) => {
    document.execCommand(command, false, value);
    pageRef.current?.focus();
  };

  const formatText = (style) => {
    const map = {
      bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strikeThrough',
      left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull',
      bullet: 'insertUnorderedList', number: 'insertOrderedList', undo: 'undo', redo: 'redo',
      indent: 'indent', outdent: 'outdent',
    };
    applyFormatting(map[style] || style);
  };

  const handleFontSize = (size) => { setFontSize(size); applyFormatting('fontSize', parseInt(size)); };
  const handleFontFamily = (font) => { setFontFamily(font); applyFormatting('fontName', font); };
  const handleTextColor = (color) => { setTextColor(color); applyFormatting('foreColor', color); };
  const handleClearFormatting = () => applyFormatting('removeFormat');

  // ===== RENDER =====
  return (
    <div className="document-editor-container">
      {/* Minimal Header */}
      <div className="doc-editor-header">
        <div className="header-left">
          <button className="back-to-chat-btn" onClick={() => onNavigate?.('chat')} title="Back">←</button>
          <input type="text" value={documentTitle} onChange={e => setDocumentTitle(e.target.value)}
            className="doc-title-input" placeholder="Untitled" />
        </div>
        <div className="header-right">
          <div className="editor-type-selector">
            <button className={`type-btn ${editorType === 'docx' ? 'active' : ''}`} onClick={() => setEditorType('docx')}>DOCX</button>
            <button className={`type-btn ${editorType === 'pptx' ? 'active' : ''}`} onClick={() => setEditorType('pptx')}>PPTX</button>
            <button className={`type-btn ${editorType === 'excel' ? 'active' : ''}`} onClick={() => setEditorType('excel')}>XLSX</button>
          </div>
          <button className="artifact-btn" onClick={() => setShowArtifacts(!showArtifacts)} title="Artifacts">
            {showArtifacts ? '✕' : '+'}
          </button>
          <button className="ai-header-btn" onClick={() => setShowAiPanel(!showAiPanel)} title="AI">🤖</button>
          <button className="export-btn" onClick={handleExport} title="Export">⬇</button>
        </div>
      </div>

      <div className="editor-layout">
        <div className="editor-center">
          <div className="editor-main">
            {renderEditor()}
          </div>
        </div>

        {/* Artifacts Panel */}
        {showArtifacts && (
          <div className="artifacts-panel">
            <div className="artifacts-header">
              <span className="artifacts-title">Artifacts ({artifacts.length})</span>
              <div className="artifacts-controls">
                <label className="auto-regen-toggle" title="Auto-regenerate on edit">
                  <input type="checkbox" checked={autoRegenerate} onChange={e => setAutoRegenerate(e.target.checked)} />
                  <span>Auto</span>
                </label>
                <button className="close-btn" onClick={() => setShowArtifacts(false)}>✕</button>
              </div>
            </div>
            <div className="artifacts-list">
              {artifacts.length === 0 && (
                <div className="artifacts-empty">
                  <p>No artifacts yet.</p>
                  <p className="artifacts-hint">Generate content with AI to create artifacts.</p>
                </div>
              )}
              {artifacts.map(art => (
                <div key={art.id} className={`artifact-item ${selectedArtifact?.id === art.id ? 'active' : ''}`}
                  onClick={() => loadArtifact(art)}>
                  <div className="artifact-icon">
                    {art.type === 'docx' ? '📄' : art.type === 'pptx' ? '📊' : '📈'}
                  </div>
                  <div className="artifact-info">
                    <div className="artifact-prompt">{art.prompt?.slice(0, 60)}{art.prompt?.length > 60 ? '...' : ''}</div>
                    <div className="artifact-meta">
                      <span className="artifact-type">{art.type?.toUpperCase()}</span>
                      <span className="artifact-time">{new Date(art.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <button className="artifact-delete" onClick={e => { e.stopPropagation(); deleteArtifact(art.id); }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Panel */}
        {showAiPanel && (
          <div className="ai-panel" ref={aiPanelRef}>
            <div className="ai-header">
              <span className="ai-title">AI</span>
              <div className="ai-header-controls">
                <label className="auto-regen-toggle" title="Auto-regenerate on edit">
                  <input type="checkbox" checked={autoRegenerate} onChange={e => setAutoRegenerate(e.target.checked)} />
                  <span>Auto</span>
                </label>
                <button className="close-btn" onClick={() => setShowAiPanel(false)}>✕</button>
              </div>
            </div>
            <div className="ai-content">
              {generationProgress && <div className="generation-status">{generationProgress}</div>}
              {aiError && <div className="error-message">{aiError}</div>}

              <div className="ai-input-section">
                <div className="textarea-wrapper">
                  <textarea
                    value={aiPrompt}
                    onChange={e => {
                      setAiPrompt(e.target.value);
                      const ta = e.target;
                      ta.style.height = 'auto';
                      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
                    }}
                    placeholder={messages.length === 0 ? "Chat with Orion..." : "Reply to Orion..."}
                    disabled={isGenerating}
                    className="message-input"
                    rows={1}
                  />
                </div>
                <button
                  className={`action-button ${isGenerating ? 'stop-mode' : 'send-mode'}`}
                  onClick={isGenerating ? handleStopStreaming : handleAiWrite}
                  disabled={!isGenerating && !aiPrompt.trim()}
                >
                  {isGenerating ? 'Stop' : 'Send'}
                </button>
              </div>

              {isStreaming && streamingContent && (
                <div className="ai-response-compact streaming">
                  <div className="response-label">
                    <span>Streaming</span>
                    <span className="streaming-dot">●</span>
                  </div>
                  <div className="ai-response-content">
                    {streamingContent.split('\n').slice(0, 10).map((line, idx) => (
                      <p key={idx} className="response-line">{line || '\u00A0'}</p>
                    ))}
                    {streamingContent.split('\n').length > 10 && <p className="response-more">...</p>}
                    <p className="streaming-cursor">▌</p>
                  </div>
                </div>
              )}

              {!isStreaming && aiResponse && (
                <div className="ai-response-compact">
                  <div className="response-label">Preview</div>
                  <div className="ai-response-content">
                    {aiResponse.split('\n').slice(0, 8).map((line, idx) => (
                      <p key={idx} className="response-line">{line}</p>
                    ))}
                    {aiResponse.split('\n').length > 8 && <p className="response-more">...</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;
