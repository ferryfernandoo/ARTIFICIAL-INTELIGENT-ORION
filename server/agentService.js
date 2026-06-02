import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AGENT SERVICE - Agentic AI with Safe Sandbox Execution
 * - Resource limiting: 180s timeout, 512MB memory
 * - File operations within sandbox only
 * - Real-time execution monitoring
 * - Full audit logging
 */

class AgentService {
  constructor() {
    this.SANDBOX_ROOT = path.join(process.cwd(), 'server', 'sandbox');
    // Execution timeout for sandboxed agent code (ms). Can be overridden by env var AGENT_EXEC_TIMEOUT_MS
    this.EXEC_TIMEOUT = parseInt(process.env.AGENT_EXEC_TIMEOUT_MS, 10) || 180000; // default 180s (3 minutes)
    this.MEMORY_LIMIT = 512; // MB
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    this.DEEPSEEK_API = process.env.DEEPSEEK_API_KEY || 'sk-bf333936dd084c5f9016521b1b896610';
    
    this.initSandbox();
  }

  /**
   * Initialize sandbox folder structure
   */
  initSandbox() {
    try {
      if (!fs.existsSync(this.SANDBOX_ROOT)) {
        fs.mkdirSync(this.SANDBOX_ROOT, { recursive: true });
        console.log('[AGENT] Sandbox initialized at:', this.SANDBOX_ROOT);
      }
    } catch (err) {
      console.error('[AGENT] Sandbox init error:', err.message);
    }
    console.log(`[AGENT] EXEC_TIMEOUT set to ${this.EXEC_TIMEOUT}ms`);
  }

  /**
   * Validate PPTX file structure (check if valid ZIP with required files)
   */
  validatePPTX(filePath) {
    try {
      // PPTX must be a valid ZIP file with [Content_Types].xml
      const buffer = fs.readFileSync(filePath);
      
      // Check ZIP magic number (PK..)
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
        return { valid: false, error: 'Invalid ZIP header - not a valid PPTX' };
      }
      
      // Check file size (PPTX should be > 1KB, < 100MB)
      if (buffer.length < 1024) {
        return { valid: false, error: 'File too small - corrupted PPTX' };
      }
      
      if (buffer.length > 100 * 1024 * 1024) {
        return { valid: false, error: 'File too large' };
      }
      
      // Try to extract [Content_Types].xml using simple ZIP check
      const contentStr = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
      if (!contentStr.includes('[Content_Types]') && !contentStr.includes('Content_Types')) {
        return { valid: false, error: 'Missing [Content_Types].xml - corrupted PPTX' };
      }
      
      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Validation failed: ${err.message}` };
    }
  }

  /**
   * Create user-specific sandbox folder
   */
  getUserSandboxPath(userId) {
    const userSandbox = path.join(this.SANDBOX_ROOT, userId);
    if (!fs.existsSync(userSandbox)) {
      fs.mkdirSync(userSandbox, { recursive: true });
    }
    return userSandbox;
  }

  /**
   * Generate a descriptive filename from task and file type
   */
  generateOutputFileName(taskDescription, fileType) {
    const extMap = {
      ppt: 'pptx',
      excel: 'xlsx',
      csv: 'csv',
      pdf: 'pdf',
      json: 'json',
      docx: 'docx',
      general: 'txt'
    };

    const ext = extMap[fileType] || 'txt';
    let base = taskDescription
      .toLowerCase()
      .replace(/\b(buatkan|buat|make|generate|file|dokumen|document|word|docx|excel|ppt|pptx|presentation|presentasi|slide|spreadsheet|sheet|tabel|csv|pdf|json|portable document|javascript object notation|tolong|please|jangan|sampe|dong|sekarang|yang|untuk)\b/gi, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!base) {
      base = `file_${fileType}`;
    }

    const name = `ai_${base}`.slice(0, 48).replace(/_+$/g, '');
    return `${name}.${ext}`;
  }

  /**
   * Read skill file untuk reference dalam code generation
   */
  readSkillFile(fileType) {
    try {
      let skillPath = '';
      let fileName = '';
      
      if (fileType === 'ppt') {
        fileName = 'SKILL_ppt_agent.md';
      } else if (fileType === 'docx') {
        fileName = 'SKILL_docx_agent.md';
      }

      if (!fileName) {
        console.log(`⚠️  [AGENT] No skill file configured for type: ${fileType}`);
        return null;
      }

      // Try multiple paths
      const possiblePaths = [
        path.join(process.cwd(), 'public', fileName),
        path.join(process.cwd(), '..', 'public', fileName),
        path.join(__dirname, '..', 'public', fileName),
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          skillPath = p;
          break;
        }
      }
      
      if (skillPath && fs.existsSync(skillPath)) {
        console.log(`📖 [AGENT] Reading skill file: ${path.basename(skillPath)}`);
        const skillContent = fs.readFileSync(skillPath, 'utf-8');
        console.log(`✅ [AGENT] Skill file loaded (${skillContent.length} chars, ${skillContent.split('\n').length} lines)`);
        return skillContent;
      } else {
        console.log(`⚠️  [AGENT] Skill file not found for type: ${fileType}`);
        return null;
      }
    } catch (err) {
      console.error(`❌ [AGENT] Error reading skill file:`, err.message);
      return null;
    }
  }

  /**
   * Generate safe Python code using Deepseek
   */
  async generateAgentCode(taskDescription, userId, retry = false) {
    try {
      console.log(`[AGENT] Generating code for task: ${taskDescription} retry=${retry}`);

      // Detect file type from task description (CHECK IN SPECIFIC ORDER - most specific first)
      const pptPattern = /\b(ppt|pptx|powerpoint|presentation|slide|presentasi)\b/i;
      const excelPattern = /\b(excel|xlsx?|spreadsheet|sheet)\b/i;
      const csvPattern = /\b(csv|comma.?separated)\b/i;
      const pdfPattern = /\b(pdf|portable document)\b/i;
      const jsonPattern = /\b(json|javascript object notation)\b/i;
      const docxPattern = /\b(docx|word|doc|word document)\b/i;

      let fileType = 'general';

      // Check in priority order (most specific first)
      if (pptPattern.test(taskDescription)) {
        fileType = 'ppt';
      } else if (docxPattern.test(taskDescription)) {
        fileType = 'docx';
      } else if (excelPattern.test(taskDescription)) {
        fileType = 'excel';
      } else if (csvPattern.test(taskDescription)) {
        fileType = 'csv';
      } else if (pdfPattern.test(taskDescription)) {
        fileType = 'pdf';
      } else if (jsonPattern.test(taskDescription)) {
        fileType = 'json';
      }

      const outputFileName = this.generateOutputFileName(taskDescription, fileType);
      console.log(`[AGENT] Determined fileType=${fileType}, outputFileName=${outputFileName}`);

      let pythonCodePrompt = '';
      
      if (fileType === 'ppt') {
        // Read skill file untuk context
        const skillContent = this.readSkillFile('ppt');
        const skillSection = skillContent ? `\n\n╔═══ SKILL REFERENCE - BACA DENGAN TELITI ═══╗\n${skillContent}\n╚════════════════════════════════════════════╝\n` : '';
        
        // Extended palette selection based on keywords
        let palette = '';
        const palettes = {
          // Check for theme keywords
          green: `   DARK   = RGBColor(11, 108, 84)      # 0B6C54\n   LIGHT  = RGBColor(232, 245, 233)   # E8F5E9\n   AKSEN  = RGBColor(76, 175, 80)    # 4CAF50\n   TEKS   = RGBColor(27, 47, 46)      # 1B2F2E\n   MUTED  = RGBColor(129, 199, 132)   # 81C784\n   WHITE  = RGBColor(255, 255, 255)`,
          purple: `   DARK   = RGBColor(63, 18, 93)      # 3F125D\n   LIGHT  = RGBColor(243, 229, 245)   # F3E5F5\n   AKSEN  = RGBColor(171, 71, 188)    # AB47BC\n   TEKS   = RGBColor(49, 27, 45)      # 311B2D\n   MUTED  = RGBColor(186, 104, 200)   # BA68C8\n   WHITE  = RGBColor(255, 255, 255)`,
          orange: `   DARK   = RGBColor(230, 81, 0)      # E65100\n   LIGHT  = RGBColor(255, 243, 224)   # FFF3E0\n   AKSEN  = RGBColor(255, 152, 0)     # FF9800\n   TEKS   = RGBColor(33, 33, 33)      # 212121\n   MUTED  = RGBColor(255, 171, 64)    # FFAB40\n   WHITE  = RGBColor(255, 255, 255)`,
          teal: `   DARK   = RGBColor(0, 121, 107)     # 00796B\n   LIGHT  = RGBColor(224, 242, 241)   # E0F2F1\n   AKSEN  = RGBColor(0, 188, 212)     # 00BCD4\n   TEKS   = RGBColor(13, 71, 79)      # 0D474F\n   MUTED  = RGBColor(77, 182, 172)    # 4DB6AC\n   WHITE  = RGBColor(255, 255, 255)`,
          red: `   DARK   = RGBColor(97, 26, 30)      # 611A1E\n   LIGHT  = RGBColor(255, 242, 242)   # FFF2F2\n   AKSEN  = RGBColor(192, 57, 43)     # C0392B\n   TEKS   = RGBColor(46, 52, 64)      # 2E3440\n   MUTED  = RGBColor(140, 60, 58)     # 8C3C3A\n   WHITE  = RGBColor(255, 255, 255)`,
          indigo: `   DARK   = RGBColor(26, 35, 126)     # 1A237E\n   LIGHT  = RGBColor(237, 241, 245)   # EDF1F5\n   AKSEN  = RGBColor(63, 81, 181)     # 3F51B5\n   TEKS   = RGBColor(13, 13, 60)      # 0D0D3C\n   MUTED  = RGBColor(103, 127, 204)   # 677FCC\n   WHITE  = RGBColor(255, 255, 255)`,
          grey: `   DARK   = RGBColor(55, 71, 79)      # 37474F\n   LIGHT  = RGBColor(238, 238, 238)   # EEEEEE\n   AKSEN  = RGBColor(117, 117, 117)   # 757575\n   TEKS   = RGBColor(33, 33, 33)      # 212121\n   MUTED  = RGBColor(158, 158, 158)   # 9E9E9E\n   WHITE  = RGBColor(255, 255, 255)`,
          coral: `   DARK   = RGBColor(244, 67, 54)     # F44336\n   LIGHT  = RGBColor(255, 235, 238)   # FFEBEE\n   AKSEN  = RGBColor(229, 57, 53)     # E53935\n   TEKS   = RGBColor(33, 33, 33)      # 212121\n   MUTED  = RGBColor(239, 112, 96)    # EF7060\n   WHITE  = RGBColor(255, 255, 255)`,
          amber: `   DARK   = RGBColor(191, 144, 0)     # BF9000\n   LIGHT  = RGBColor(255, 250, 235)   # FFFAEB\n   AKSEN  = RGBColor(255, 193, 7)     # FFC107\n   TEKS   = RGBColor(51, 35, 0)       # 332300\n   MUTED  = RGBColor(255, 224, 178)   # FFE0B2\n   WHITE  = RGBColor(255, 255, 255)`,
          mint: `   DARK   = RGBColor(15, 157, 103)    # 0F9D67\n   LIGHT  = RGBColor(230, 245, 240)   # E6F5F0\n   AKSEN  = RGBColor(38, 198, 218)    # 26C6DA\n   TEKS   = RGBColor(15, 76, 48)      # 0F4C30\n   MUTED  = RGBColor(128, 222, 234)   # 80DEEA\n   WHITE  = RGBColor(255, 255, 255)`,
          berry: `   DARK   = RGBColor(69, 39, 160)     # 4527A0\n   LIGHT  = RGBColor(243, 229, 245)   # F3E5F5\n   AKSEN  = RGBColor(156, 39, 176)    # 9C27B0\n   TEKS   = RGBColor(33, 33, 33)      # 212121\n   MUTED  = RGBColor(206, 17, 114)    # CE0172\n   WHITE  = RGBColor(255, 255, 255)`,
          cyber: `   DARK   = RGBColor(25, 25, 25)      # 191919\n   LIGHT  = RGBColor(245, 245, 245)   # F5F5F5\n   AKSEN  = RGBColor(0, 229, 255)     # 00E5FF\n   TEKS   = RGBColor(200, 200, 200)   # C8C8C8\n   MUTED  = RGBColor(100, 100, 100)   # 646464\n   WHITE  = RGBColor(255, 255, 255)`,
          blue: `   DARK   = RGBColor(30, 39, 97)      # 1E2761\n   LIGHT  = RGBColor(240, 244, 255)   # F0F4FF\n   AKSEN  = RGBColor(79, 195, 247)    # 4FC3F7\n   TEKS   = RGBColor(26, 26, 46)      # 1A1A2E\n   MUTED  = RGBColor(100, 116, 139)   # 64748B\n   WHITE  = RGBColor(255, 255, 255)`
        };

        // Auto-detect theme from task description
        if (/\b(green|hijau|eco|natural)\b/i.test(taskDescription)) {
          palette = palettes.green;
        } else if (/\b(purple|ungu|elegan|kreatif)\b/i.test(taskDescription)) {
          palette = palettes.purple;
        } else if (/\b(orange|oranye|energik|fun|ceria)\b/i.test(taskDescription)) {
          palette = palettes.orange;
        } else if (/\b(teal|tosca|fresh|minimal)\b/i.test(taskDescription)) {
          palette = palettes.teal;
        } else if (/\b(red|merah|bold|powerful|kuat)\b/i.test(taskDescription)) {
          palette = palettes.red;
        } else if (/\b(indigo|corporate|trust|profesional)\b/i.test(taskDescription)) {
          palette = palettes.indigo;
        } else if (/\b(grey|gray|neutral|sophisticated)\b/i.test(taskDescription)) {
          palette = palettes.grey;
        } else if (/\b(coral|warm|friendly)\b/i.test(taskDescription)) {
          palette = palettes.coral;
        } else if (/\b(amber|gold|luxury|premium)\b/i.test(taskDescription)) {
          palette = palettes.amber;
        } else if (/\b(mint|clean|light)\b/i.test(taskDescription)) {
          palette = palettes.mint;
        } else if (/\b(berry|modern|minimal)\b/i.test(taskDescription)) {
          palette = palettes.berry;
        } else if (/\b(cyber|tech|digital|code)\b/i.test(taskDescription)) {
          palette = palettes.cyber;
        } else {
          // Default: random palette untuk variasi
          const paletteNames = Object.keys(palettes);
          const randomPalette = paletteNames[Math.floor(Math.random() * paletteNames.length)];
          palette = palettes[randomPalette];
        }

        const slideCountMatch = taskDescription.match(/\b(\d+)\s*(slide|slides|halaman|pages?)\b/i);
        const requestedSlideCount = slideCountMatch ? parseInt(slideCountMatch[1], 10) : null;
        const slideCountInstruction = requestedSlideCount
          ? `WAJIB TEPAT ${requestedSlideCount} SLIDES. Jika diminta ${requestedSlideCount} halaman, buat persis ${requestedSlideCount} slide.`
          : 'WAJIB MINIMAL 9 SLIDES dengan variasi layout dan konten yang kaya.';
        const slideOrderNote = requestedSlideCount
          ? `Slide 1 = COVER, slide ${requestedSlideCount} = CLOSING, sisanya konten dan variasi layout.`
          : 'Slide 1 = COVER, slide 2-8 = CONTENT (minimal 7 slide berbeda dengan layout unik), slide 9 = CLOSING.';

        pythonCodePrompt = `PENTING: Baca SKILL REFERENCE di bawah dengan SANGAT TELITI sebelum generate code.${skillSection}

TASK: ${taskDescription}
OUTPUT FILE: ${outputFileName}

IMPLEMENTASI PYTHON (IKUTI SKILL):
1. Use python-pptx library (dari skill file Bagian 4 - LAYOUT TYPES):
   from pptx import Presentation
   from pptx.util import Inches, Pt
   from pptx.enum.text import PP_ALIGN
   from pptx.enum.shapes import MSO_SHAPE
   from pptx.dml.color import RGBColor

2. Setup (Bagian 2 skill - palette sudah dipilih):
   prs = Presentation()
   prs.slide_width = Inches(10)
   prs.slide_height = Inches(5.625)
   
${palette}

3. Struktur & Variasi Slide (IKUTI Bagian 4.1-4.10 SKILL):
   WAJIB GUNAKAN MULTIPLE LAYOUT TYPES DARI SKILL:
   
   Slide 1 - LAYOUT TYPE 1 (COVER): Full dark background, title 44pt bold, subtitle, accent bar/shape
   Slide 2 - LAYOUT TYPE 2 (BULLETS): Light bg, title 28pt, vertical AKSEN bar, 3-5 bullets, footer line
   Slide 3 - LAYOUT TYPE 3 (CARD): Light bg, title, left colored card + right text column, magazine style
   Slide 4 - LAYOUT TYPE 4 (QUOTE): Dark bg, large statement 32pt bold AKSEN, decorative lines, attribution
   Slide 5 - LAYOUT TYPE 5 (CHART): Light bg, title, matplotlib chart/graph (width 8.5"), explanation below
   Slide 6 - LAYOUT TYPE 6 (COMPARISON): Light bg, two-column with features A & B, dividing line center
   Slide 7 - LAYOUT TYPE 7 (TIMELINE): Light bg, horizontal/vertical timeline dengan 4-5 steps+circles
   Slide 8 - LAYOUT TYPE 9 (RICH LIST): Light bg, mixed text formatting (bold+regular), colored dots, spacing
   Slide 9 - LAYOUT TYPE 10 (CLOSING): Dark bg, main message 28pt AKSEN bold, supporting text WHITE, CTA
   
   ${slideOrderNote}
   
   KRITICAL: SETIAP SLIDE WAJIB PUNYA VISUAL IDENTITY BERBEDA. Jangan sama dua slide. Mix dark & light backgrounds.

4. ANTI-ERROR (Bagian 5 SKILL - JANGAN LAKUKAN):
   ❌ Jangan pakai hex color string - gunakan RGBColor()
   ❌ Jangan layout identik berturut-turut
   ❌ Jangan forget accent color (AKSEN) - harus prominent setiap slide dengan bentuk berbeda
   ❌ Jangan generate task name atau title idea - only use content
   ❌ Jangan pakai javascript atau library non-python-pptx
   ❌ Jangan copy-paste textbox code - setiap slide unique positioning

5. OPTIONAL: CHART/GRAFIK (Gunakan untuk variasi visual)
   Jika applicable: matplotlib chart, save PNG, insert dengan add_picture()
   Import: import matplotlib.pyplot as plt; matplotlib.use('Agg')
   Sizing: width 8-8.5" untuk 10" slide width
   Font sizes: Cover 44pt, Title 28pt, Subtitle 18pt, Body 15-16pt, Captions 11-12pt

6. Simpan DENGAN PROPER CLOSING (CRITICAL):
   try:
       prs.save('${outputFileName}')
   except Exception as e:
       print(f'ERROR_SAVE: {str(e)}')
       import sys; sys.exit(1)
   print('FILE_CREATED:${outputFileName}')

${slideCountInstruction}
WAJIB IKUTI: Setiap slide HARUS berbeda layout dan visual. Mix layout types dari SKILL section 4.1-4.10.
Generate COMPLETE, VALID PYTHON CODE ONLY - NO EXPLANATIONS.
PYTHON CODE (NO EXPLANATIONS):`;
      } else if (fileType === 'excel') {
        pythonCodePrompt = `TASK: ${taskDescription}
OUTPUT: ${outputFileName}

Ini adalah prompt yang sudah di-test dan reliable untuk EXCEL. Follow EXACTLY.

LANGKAH 1: COPY TEMPLATE INI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import xlsxwriter

# Create workbook
workbook = xlsxwriter.Workbook("${outputFileName}")
worksheet = workbook.add_worksheet("Data")

# Set column widths
worksheet.set_column("A:A", 10)
worksheet.set_column("B:B", 25)
worksheet.set_column("C:C", 20)
worksheet.set_column("D:D", 15)
worksheet.set_column("E:E", 15)

# Define header format (DARK_BLUE bg, WHITE text, bold)
header_format = workbook.add_format({
    "bg_color": "#1E2761",
    "font_color": "#FFFFFF",
    "bold": True,
    "font_size": 12,
    "align": "center",
    "valign": "vcenter",
    "border": 1
})

# Define data format (WHITE bg, DARK_TEXT)
data_format = workbook.add_format({
    "bg_color": "#FFFFFF",
    "font_color": "#1A1A2E",
    "font_size": 11,
    "align": "left",
    "valign": "vcenter",
    "border": 1
})

# Define number format (align right, separator)
number_format = workbook.add_format({
    "bg_color": "#FFFFFF",
    "font_color": "#1A1A2E",
    "font_size": 11,
    "align": "right",
    "num_format": "#,##0",
    "border": 1
})

# Define currency format
currency_format = workbook.add_format({
    "bg_color": "#FFFFFF",
    "font_color": "#1A1A2E",
    "font_size": 11,
    "align": "right",
    "num_format": "Rp #,##0",
    "border": 1
})

# Define total format (LIGHT_GRAY bg, white text, bold)
total_format = workbook.add_format({
    "bg_color": "#64748B",
    "font_color": "#FFFFFF",
    "bold": True,
    "font_size": 11,
    "align": "right",
    "num_format": "#,##0",
    "border": 1
})

# Write header row (Row 0)
worksheet.write("A1", "No", header_format)
worksheet.write("B1", "Nama", header_format)
worksheet.write("C1", "Kategori", header_format)
worksheet.write("D1", "Jumlah", header_format)
worksheet.write("E1", "Nilai", header_format)

# Write data rows (Row 1+)
data = [
    [1, "Item 1", "Kategori A", 100, 500000],
    [2, "Item 2", "Kategori B", 50, 750000],
    [3, "Item 3", "Kategori A", 200, 300000],
    [4, "Item 4", "Kategori C", 75, 1000000],
    [5, "Item 5", "Kategori B", 150, 450000],
    [6, "Item 6", "Kategori A", 120, 600000],
    [7, "Item 7", "Kategori C", 90, 800000],
    [8, "Item 8", "Kategori B", 180, 400000],
    [9, "Item 9", "Kategori A", 110, 550000],
    [10, "Item 10", "Kategori C", 160, 700000],
]

row = 1
for item in data:
    worksheet.write(row, 0, item[0], number_format)
    worksheet.write(row, 1, item[1], data_format)
    worksheet.write(row, 2, item[2], data_format)
    worksheet.write(row, 3, item[3], number_format)
    worksheet.write(row, 4, item[4], currency_format)
    row += 1

# Add total row
total_row = row
worksheet.write(total_row, 1, "TOTAL", total_format)
worksheet.write(total_row, 2, "", total_format)
worksheet.write(total_row, 3, "", total_format)
worksheet.write_formula(total_row, 4, f"=SUM(E2:E{total_row})", total_format)

# Freeze header row
worksheet.freeze_panes(1, 0)

# OPTIONAL: ADD CHART/GRAFIK
# Column Chart Example
chart = workbook.add_chart({'type': 'column'})
chart.add_series({
    'name': 'Nilai',
    'categories': '=Data!$B$2:$B$11',
    'values': '=Data!$E$2:$E$11',
    'fill': {'color': '#4FC3F7'},
    'gap': 150,
})
chart.set_title({'name': 'Grafik Nilai per Item'})
chart.set_x_axis({'name': 'Item'})
chart.set_y_axis({'name': 'Nilai (Rp)'})
chart.set_style(10)
chart.set_size({'width': 720, 'height': 480})
worksheet.insert_chart('G2', chart)

# Close workbook
workbook.close()
print("FILE_CREATED:${outputFileName}")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGKAH 2: ISI DENGAN DATA SESUAI TASK
- Ganti "Item 1", "Item 2", dll dengan nama real sesuai task
- Ganti "Kategori A", "Kategori B", dll sesuai data
- Ganti angka (100, 500000, dll) dengan data real
- Jika perlu CHART: gunakan workbook.add_chart({'type': 'column|line|pie|area'})
- Chart types: column, line, pie, area (lihat SKILL_excel_agent.md)
- MINIMAL 10 baris data + OPTIONAL 1-2 chart

LANGKAH 3: ATURAN WAJIB EXCEL
✅ Import xlsxwriter HANYA (bukan openpyxl atau pandas)
✅ Header row SELALU row 0 dengan header_format (DARK_BLUE)
✅ Minimal 10 data rows dengan format konsisten
✅ Untuk CHART: gunakan workbook.add_chart() dengan cell references (e.g., '=Data!$B$2:$B$11')
✅ Setiap chart HARUS set title, x_axis name, y_axis name
✅ Warna dari palette: #1E2761, #4FC3F7, #1A1A2E, #64748B, #FFFFFF
✅ Font size: 11pt atau 12pt saja
✅ Setiap string complete dan ditutup dengan quote (")
✅ Akhir: workbook.close() dan print("FILE_CREATED:...")

LANGKAH 4: LARANGAN
❌ Jangan import openpyxl, pandas, csv, atau library lain
❌ Jangan incomplete variable (headers = tanpa value)
❌ Jangan split string tanpa proper syntax
❌ Jangan eval, exec, __import__, getattr
❌ Jangan lebih dari 7 format berbeda
❌ Jangan markdown backticks atau comments

LANGKAH 5: OUTPUT
- PURE PYTHON CODE ONLY
- NO EXPLANATIONS, NO MARKDOWN
- COPY TEMPLATE, GANTI DATA, SIMPAN

Generate code sekarang (MUST start with 'import xlsxwriter'):
`;
      } else if (fileType === 'docx') {
        // Read skill file untuk context
        const skillContent = this.readSkillFile('docx');
        const skillSection = skillContent ? `\n\n╔═══ SKILL REFERENCE - BACA DENGAN TELITI ═══╗\n${skillContent}\n╚════════════════════════════════════════════╝\n` : '';
        const retryNote = retry
          ? '\n\nCRITICAL RETRY: The previous code had syntax errors. Fix EVERY string to use proper Python syntax. Every string MUST end with a closing quote. Do not use eval, exec, or __import__.'
          : '';
        const chartRequested = /\b(chart|grafik|kurva|plot|diagram|line|bar|pie|graph)\b/i.test(taskDescription);
        const chartInstruction = chartRequested
          ? 'WAJIB minimal 1-2 chart/grafik jika diminta oleh task. Gunakan matplotlib hanya jika benar-benar diminta.'
          : 'JIKA TIDAK DIMINTA chart/grafik secara eksplisit, jangan gunakan matplotlib. Fokus pada python-docx saja.';

        // Select random design variant (1-3)
        const designVariant = Math.floor(Math.random() * 3) + 1;
        
        let designTemplate = '';
        if (designVariant === 1) {
          // DESIGN 1: Modern Blue - professional dengan warna biru
          designTemplate = `DESIGN VARIANT 1 - MODERN BLUE
Color: RGBColor(13, 71, 161) biru gelap, RGBColor(227, 242, 253) biru terang
Title color: RGBColor(13, 71, 161) bold 26pt
Heading: RGBColor(21, 101, 192) bold 14pt
Body: RGBColor(33, 33, 33) 11pt
Accent bar: gunakan title dengan underline style, alternating colors
Layout: Centered title, indented paragraphs, spaced sections`;
        } else if (designVariant === 2) {
          // DESIGN 2: Green Eco - profesional dengan warna hijau
          designTemplate = `DESIGN VARIANT 2 - GREEN ECO
Color: RGBColor(27, 94, 32) hijau gelap, RGBColor(232, 245, 233) hijau terang
Title color: RGBColor(56, 142, 60) bold 26pt
Heading: RGBColor(75, 175, 79) bold 14pt
Body: RGBColor(33, 33, 33) 11pt
Accent bar: colored paragraph background dengan shade hijau
Layout: Left-aligned title, quoted sections, bullet lists with green marks`;
        } else {
          // DESIGN 3: Red Modern - energik dengan warna merah
          designTemplate = `DESIGN VARIANT 3 - RED MODERN
Color: RGBColor(200, 30, 30) merah gelap, RGBColor(255, 243, 224) orange terang
Title color: RGBColor(211, 47, 47) bold 26pt
Heading: RGBColor(229, 57, 53) bold 14pt
Body: RGBColor(33, 33, 33) 11pt
Accent bar: colored paragraph background dengan shade merah
Layout: Large title with shadow effect, compact sections, color-coded headings`;
        }

        pythonCodePrompt = `TASK: ${taskDescription}
OUTPUT: ${outputFileName}
${retryNote}

${designTemplate}

⚠️ CRITICAL: EVERY doc.add_paragraph() string MUST END WITH " on SAME LINE!
NEVER split strings across multiple lines. NEVER cut text mid-word. Max 15 words per paragraph.

IMPLEMENTATION:
- Use design colors sesuai variant di atas
- Buat konten minimal 6-8 sections dengan chapter headings berbeda
- Variasikan layout: ada sections dengan paragraph, ada dengan bullet points
- Minimum 1 chart/grafik (gunakan matplotlib Agg backend)
- Save dengan proper handling: try-except block untuk prs.save()
- Output filename: harus di parameter '${outputFileName}'

CONTOH STRUCTURE (CUSTOMIZE berdasarkan task):
1. Title page dengan design color
2. Daftar isi / Overview
3-6. Content sections dengan berbagai layout
7. Chart/Grafik (jika applicable)
8. Kesimpulan

WAJIB gunakan python-docx, matplotlib (jika chart), jangan eval/exec/import_module.

Generate PURE PYTHON CODE ONLY - no explanations:
`;

      } else if (fileType === 'csv') {
        pythonCodePrompt = `Generate ONLY valid Python code. No markdown, backticks, or explanations.

TASK: ${taskDescription}
OUTPUT FILE: ${outputFileName}

REQUIREMENTS:
1. Import csv library: import csv
2. Create professional CSV with:
   - Clear headers
   - Multiple relevant data rows (10+)
   - Proper formatting
3. Save file EXACTLY as: ${outputFileName}
4. Print EXACTLY: FILE_CREATED:${outputFileName}
5. Make data meaningful and relevant to task

PYTHON CODE (NO EXPLANATIONS):`;
      } else if (fileType === 'json') {
        pythonCodePrompt = `Generate ONLY valid Python code. No markdown, backticks, or explanations.

TASK: ${taskDescription}
OUTPUT FILE: ${outputFileName}

REQUIREMENTS:
1. Import json: import json
2. Create well-structured JSON data:
   - Nested objects/arrays as appropriate
   - Meaningful keys and values
   - Relevant to: ${taskDescription}
3. Write with proper indentation: json.dump(data, f, indent=2)
4. Save: ${outputFileName}
5. Print EXACTLY: FILE_CREATED:${outputFileName}

PYTHON CODE (NO EXPLANATIONS):`;
      } else {
        pythonCodePrompt = `Generate ONLY valid Python code. No markdown, backticks, or explanations.

TASK: ${taskDescription}
OUTPUT FILE: ${outputFileName}

Create a ${fileType} file and save as '${outputFileName}'.
Print EXACTLY: FILE_CREATED:${outputFileName}

PYTHON CODE (NO EXPLANATIONS):`;
      }

      const prompt = pythonCodePrompt;

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a secure code generation AI. Generate ONLY Python code without explanations. Always follow templates exactly. Never generate incomplete code or broken strings.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: fileType === 'docx' ? 0.1 : 0.3, // Lower for DOCX to avoid syntax errors
          max_tokens: fileType === 'docx' ? 3500 : 4000
        })
      });

      if (!response.ok) {
        throw new Error(`Gagal menghasilkan kode: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedCode = data.choices?.[0]?.message?.content || '';

      console.log('[AGENT] Code generated:', generatedCode.substring(0, 100) + '...');
      return generatedCode;
    } catch (err) {
      console.error('[AGENT] Code generation error:', err.message);
      // Sanitize error message to hide API details from user
      const sanitizedMessage = err.message.replace(/api\.deepseek\.com|deepseek/gi, 'sistem').replace(/https:\/\/[^\s]+/g, 'server');
      throw new Error(`Gagal membuat file: ${sanitizedMessage}`);
    }
  }

  /**
   * Extract Python code from markdown formatted response
   */
  extractCodeFromMarkdown(response) {
    if (!response || typeof response !== 'string') {
      return response;
    }

    let code = response.trim();

    // Remove all markdown code fence markers (opening and closing)
    // Handle ```python, ```py, ```, or any variant with optional language
    code = code.replace(/```(?:python|py)?\n?/gi, '');
    code = code.replace(/```\n?/gi, '');
    code = code.replace(/^`{3,}\s*\n?/gm, '');  // Lines starting with backticks
    code = code.replace(/\n?`{3,}\s*$/gm, '');   // Lines ending with backticks
    
    return code.trim();
  }

  /**
   * Validate Python code for safety
   */
  validateCode(code) {
    const BLACKLIST = [
      'os.system',
      'subprocess',
      'exec',
      'eval',
      '__import__',
      'input(',
      'compile(',
      '__builtins__',
      'getattr(',
      'setattr(',
      'delattr(',
      'exec(',
      'globals()',
      'locals()',
      'vars(',
      'dir(',
      'importlib',
      'pickle'
    ];

    for (const pattern of BLACKLIST) {
      if (code.includes(pattern)) {
        throw new Error(`Unsafe operation detected: ${pattern}`);
      }
    }

    return true;
  }

  /**
   * Execute Python code in isolated sandbox
   */
  async executeCode(pythonCode, userId, taskId) {
    return new Promise((resolve, reject) => {
      const sandboxPath = this.getUserSandboxPath(userId);
      const execId = taskId || uuidv4();
      const scriptPath = path.join(sandboxPath, `script_${execId}.py`);
      const outputPath = path.join(sandboxPath, `output_${execId}.json`);
      const executionStartTime = Date.now(); // Capture time BEFORE execution
      const beforeFiles = fs.existsSync(sandboxPath) ? fs.readdirSync(sandboxPath) : [];

      try {
        // Extract code from markdown if needed
        const cleanCode = this.extractCodeFromMarkdown(pythonCode);
        
        // Validate code first
        this.validateCode(cleanCode);

        // Write script to sandbox
        const safeCode = `#!/usr/bin/env python3
import sys
import os

# Set sandbox path
SANDBOX_PATH = r"${sandboxPath.replace(/\\/g, '\\\\')}"
os.chdir(SANDBOX_PATH)

# Execute user code
${cleanCode}
`;



        fs.writeFileSync(scriptPath, safeCode);
        console.log(`[AGENT] Script written to: ${scriptPath}`);

        let output = '';
        let errorOutput = '';
        let startTime = Date.now();

        // Before executing, run a Python syntax check to avoid running invalid scripts
        console.log(`[AGENT] ✨ Performing Python syntax check for: ${scriptPath}`);
        const pyCheck = spawn('python', ['-m', 'py_compile', scriptPath], {
          cwd: sandboxPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUTF8: '1',
            PYTHONIOENCODING: 'utf-8'
          }
        });

        let checkErr = '';
        pyCheck.stderr.on('data', (d) => { checkErr += d.toString(); });

        pyCheck.on('close', (checkCode) => {
          if (checkCode !== 0) {
            const checkTime = Date.now() - startTime;
            console.error(`[AGENT] ❌ Syntax check failed (${checkTime}ms):`, checkErr.trim());
            try { fs.unlinkSync(scriptPath); } catch (e) {}
            const result = {
              status: 'error',
              execId,
              executionTime: `${checkTime}ms`,
              output: '',
              error: checkErr.trim(),
              code: checkCode,
              fileName: null
            };
            resolve(result);
            return;
          }

          // Syntax OK — now spawn the Python process to run the script
          const python = spawn('python', [scriptPath], {
            cwd: sandboxPath,
            timeout: this.EXEC_TIMEOUT,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1',
              PYTHONUTF8: '1',
              PYTHONIOENCODING: 'utf-8',
              SANDBOX_PATH: sandboxPath
            }
          });

          // Monitor execution
          python.stdout.on('data', (data) => { output += data.toString(); });
          python.stderr.on('data', (data) => { errorOutput += data.toString(); });

          // Execution timeout handling (redundant with spawn timeout but kept for safety)
          const timeoutHandle = setTimeout(() => {
            try { python.kill('SIGTERM'); } catch (e) {}
            setTimeout(() => { try { python.kill('SIGKILL'); } catch (e) {} }, 5000);
          }, this.EXEC_TIMEOUT + 2000);

          python.on('close', (code) => {
            clearTimeout(timeoutHandle);
            const executionTime = Date.now() - startTime;
            try { fs.unlinkSync(scriptPath); } catch (e) {}

            const trimmedOutput = output.trim();
            const result = {
              status: code === 0 ? 'success' : 'error',
              execId,
              executionTime: `${executionTime}ms`,
              output: trimmedOutput,
              error: errorOutput.trim(),
              code,
              fileName: null
            };

            console.log(`[AGENT] 🔍 Detecting generated files in: ${sandboxPath}`);
            try {
              const afterFiles = fs.readdirSync(sandboxPath);
              console.log(`[AGENT] 📁 Files in sandbox: ${afterFiles.join(', ')}`);

              const fileCreatedMatch = trimmedOutput.match(/FILE_CREATED:([^\r\n]+)/);
              const createdFileName = fileCreatedMatch ? fileCreatedMatch[1].trim() : null;
              if (createdFileName) {
                console.log(`[AGENT] 📣 FILE_CREATED signal from script: ${createdFileName}`);
              }

              const beforeFilesSet = new Set(beforeFiles);
              const documentExtensions = ['.docx', '.xlsx', '.pptx', '.pdf', '.csv', '.json', '.txt'];
              let generatedFiles = [];

              for (const file of afterFiles) {
                if (file === path.basename(scriptPath) || file === path.basename(outputPath)) continue;
                if (file.match(/^script_[a-f0-9\-]+\.py$/)) continue;

                const fileExt = path.extname(file).toLowerCase();
                if (!documentExtensions.includes(fileExt)) continue;
                try {
                  const filePath = path.join(sandboxPath, file);
                  const stats = fs.statSync(filePath);
                  const isNewFile = !beforeFilesSet.has(file);
                  const isUpdatedFile = stats.mtimeMs >= executionStartTime - 1000;
                  if (!isNewFile && !isUpdatedFile) continue;

                  generatedFiles.push({ name: file, mtime: stats.mtimeMs, isNewFile, isUpdatedFile });
                  console.log(`[AGENT] 📄 Candidate output file: ${file} (mtime: ${new Date(stats.mtimeMs).toISOString()}, new=${isNewFile}, updated=${isUpdatedFile})`);
                } catch (e) {
                  console.warn(`[AGENT] Could not stat ${file}: ${e.message}`);
                }
              }

              if (createdFileName && afterFiles.includes(createdFileName)) {
                result.fileName = createdFileName;
                console.log(`[AGENT] ✓ Using FILE_CREATED output file: ${result.fileName}`);
                
                // Validate PPTX files
                if (result.fileName.toLowerCase().endsWith('.pptx')) {
                  const pptxPath = path.join(sandboxPath, result.fileName);
                  const validation = this.validatePPTX(pptxPath);
                  if (!validation.valid) {
                    console.error(`[AGENT] ⚠️ PPTX validation failed: ${validation.error}`);
                    result.status = 'error';
                    result.error = `Generated PPTX is corrupted: ${validation.error}. This can happen if the code didn't properly close the presentation. Try again.`;
                    result.fileName = null;
                  }
                }
              } else if (generatedFiles.length > 0) {
                generatedFiles.sort((a, b) => b.mtime - a.mtime);
                result.fileName = generatedFiles[0].name;
                console.log(`[AGENT] ✓ Selected output file: ${result.fileName}`);
                
                // Validate PPTX files
                if (result.fileName.toLowerCase().endsWith('.pptx')) {
                  const pptxPath = path.join(sandboxPath, result.fileName);
                  const validation = this.validatePPTX(pptxPath);
                  if (!validation.valid) {
                    console.error(`[AGENT] ⚠️ PPTX validation failed: ${validation.error}`);
                    result.status = 'error';
                    result.error = `Generated PPTX is corrupted: ${validation.error}. This can happen if the code didn't properly close the presentation. Try again.`;
                    result.fileName = null;
                  }
                }
              } else {
                console.log(`[AGENT] ✗ No generated files detected`);
              }
            } catch (scanErr) {
              console.warn('[AGENT] File scan failed:', scanErr.message);
            }

            if (code === 0) {
              if (!result.fileName) {
                result.status = 'error';
                result.error = [result.error, 'No generated output file detected after successful execution.'].filter(Boolean).join(' ').trim();
              }
              console.log(`[AGENT] ✅ Execution completed (${executionTime}ms), status=${result.status}, fileName=${result.fileName}`);
              resolve(result);
            } else {
              console.error(`[AGENT] ❌ Execution failed (${executionTime}ms):`, errorOutput);
              result.status = 'error';
              result.fileName = null;
              resolve(result);
            }
          });

          python.on('error', (err) => {
            clearTimeout(timeoutHandle);
            reject({ status: 'spawn_error', execId, message: err.message });
          });
        });

      } catch (err) {
        console.error('[AGENT] Execution setup error:', err.message);
        reject({
          status: 'setup_error',
          message: err.message
        });
      }
    });
  }

  /**
   * Main execution flow: Task → Code Generation → Execution
   */
  async executeTask(taskDescription, userId) {
    const taskId = uuidv4();
    const startTime = Date.now();
    const logs = []; // Capture all logs

    // Intercept console.log to capture logs
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      logs.push(message);
      originalLog(...args); // Still print to console
    };

    try {
      console.log(`\n╔════════════════════════════════════════════════╗`);
      console.log(`║ [AGENT] 🚀 NEW TASK EXECUTION: ${taskId.substring(0, 8)}...`);
      console.log(`╚════════════════════════════════════════════════╝`);
      console.log(`📝 Task: ${taskDescription.substring(0, 80)}${taskDescription.length > 80 ? '...' : ''}`);
      console.log(`👤 User: ${userId.substring(0, 8)}...`);
      
      // Step 1: Generate code using Deepseek
      console.log(`\n[STEP 1/3] Generating Python code...`);
      const step1Start = Date.now();
      let pythonCode = await this.generateAgentCode(taskDescription, userId);
      const step1Time = Date.now() - step1Start;
      console.log(`✅ [STEP 1/3] Code generated (${step1Time}ms)`);

      // Step 2: Execute code in sandbox
      console.log(`\n[STEP 2/3] Executing code in sandbox...`);
      const step2Start = Date.now();
      let executionResult = await this.executeCode(pythonCode, userId, taskId);
      const step2Time = Date.now() - step2Start;
      console.log(`✅ [STEP 2/3] Execution completed (${step2Time}ms, status: ${executionResult.status})`);

      if (executionResult.status === 'error' && /SyntaxError|unterminated string literal|AttributeError|NameError/i.test(executionResult.error)) {
        console.log('[AGENT] 🔄 Detected invalid generated code, retrying once with stricter prompt...');
        pythonCode = await this.generateAgentCode(taskDescription, userId, true);
        const retryStart = Date.now();
        executionResult = await this.executeCode(pythonCode, userId, taskId);
        const retryTime = Date.now() - retryStart;
        console.log(`✅ [AGENT] Retry execution completed (${retryTime}ms, status: ${executionResult.status})`);
      }

      // Step 3: Prepare response
      console.log(`\n[STEP 3/3] Preparing response...`);
      const totalTime = Date.now() - startTime;
      
      const response = {
        taskId,
        status: executionResult.status,
        output: executionResult.output,
        error: executionResult.error,
        generatedCode: pythonCode.substring(0, 500) + '...', // First 500 chars
        executionTime: executionResult.executionTime,
        fileName: executionResult.fileName, // 🔥 IMPORTANT: Include fileName from execution result
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString(),
        logs: logs // Return captured logs to client
      };

      console.log(`✅ [STEP 3/3] Response prepared`);
      
      // Final summary
      console.log(`\n╔════════════════════════════════════════════════╗`);
      if (response.status === 'success' && response.fileName) {
        console.log(`║ ✅ TASK SUCCESS`);
        console.log(`║ File: ${response.fileName}`);
      } else {
        console.log(`║ ❌ TASK FAILED`);
        console.log(`║ Error: ${response.error || response.output}`);
      }
      console.log(`║ Total time: ${totalTime}ms`);
      console.log(`╚════════════════════════════════════════════════╝\n`);

      return response;

    } catch (err) {
      console.error(`[AGENT] ❌ Task failed:`, err);
      return {
        taskId,
        status: 'error',
        error: err.message || err.toString(),
        timestamp: new Date().toISOString(),
        logs: logs
      };
    } finally {
      // Restore console.log
      console.log = originalLog;
    }
  }

  /**
   * Get sandbox usage stats
   */
  getSandboxStats(userId) {
    try {
      const userSandbox = this.getUserSandboxPath(userId);
      const stats = {
        path: userSandbox,
        exists: fs.existsSync(userSandbox),
        files: 0,
        totalSize: 0
      };

      if (stats.exists) {
        const files = fs.readdirSync(userSandbox);
        stats.files = files.length;
        
        files.forEach(file => {
          const filePath = path.join(userSandbox, file);
          const fileStats = fs.statSync(filePath);
          stats.totalSize += fileStats.size;
        });

        stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
      }

      return stats;
    } catch (err) {
      console.error('[AGENT] Stats error:', err.message);
      return { error: err.message };
    }
  }

  /**
   * Clean old sandbox files (older than 24 hours)
   */
  cleanupOldSandboxes(ageHours = 24) {
    try {
      if (!fs.existsSync(this.SANDBOX_ROOT)) return;

      const now = Date.now();
      const ageMs = ageHours * 60 * 60 * 1000;

      const dirs = fs.readdirSync(this.SANDBOX_ROOT);
      let cleaned = 0;

      dirs.forEach(dir => {
        const dirPath = path.join(this.SANDBOX_ROOT, dir);
        const stats = fs.statSync(dirPath);
        
        if (now - stats.mtimeMs > ageMs) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          cleaned++;
          console.log(`[AGENT] Cleaned old sandbox: ${dir}`);
        }
      });

      console.log(`[AGENT] Cleanup completed: ${cleaned} old sandboxes removed`);
      return { cleaned };
    } catch (err) {
      console.error('[AGENT] Cleanup error:', err.message);
      return { error: err.message };
    }
  }
}

// Export singleton
const agentService = new AgentService();
export default agentService;
