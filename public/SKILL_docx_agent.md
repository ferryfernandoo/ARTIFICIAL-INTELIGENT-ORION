---
name: docx_professional_guide
description: >
  Panduan PROFESIONAL untuk membuat file Word (.docx) yang handal, modern, dan berkualitas tinggi.
  Trigger: "dokumen", "word", "docx", "laporan", "makalah", "tugas", "proposal", "memo", "penelitian".
  Fokus: struktur yang jelas, styling yang konsisten, dan output yang reliabel.
---

# SKILL: Membuat Dokumen DOCX Profesional & Handal

> **PENTING**: Baca skill ini dari awal sampai akhir SEBELUM menulis satu baris kode Python.
> Hindari shortcut. Hasilnya akan JAUH lebih baik.

---

## 🚀 PRINSIP DASAR

1. **SIMPLE IS BETTER** — Jangan gunakan XML manipulation atau OxmlElement kecuali sangat perlu
2. **RELIABLE** — Gunakan only validated API dari python-docx
3. **CONSISTENT** — Satu style, satu warna palette, satu struktur di seluruh dokumen
4. **READABLE** — Output code harus mudah dibaca dan di-maintain

---

## 📦 SETUP (COPY-PASTE, JANGAN DIUBAH)

```python
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Use non-GUI backend untuk headless environment
```

---

## 🎨 WARNA PALETTE (GUNAKAN EXACT INI)

```python
# Deepernova Professional Color Scheme
DARK_BLUE = RGBColor(30, 39, 97)      # 1E2761 - untuk judul & heading
PRIMARY_BLUE = RGBColor(79, 195, 247) # 4FC3F7 - untuk aksen & emphasis
DARK_TEXT = RGBColor(26, 26, 46)      # 1A1A2E - untuk body text
LIGHT_GRAY = RGBColor(100, 116, 139)  # 64748B - untuk secondary text
WHITE = RGBColor(255, 255, 255)       # FFFFFF - white

# JANGAN GUNAKAN:
# ❌ Warna hex (#FF0000)
# ❌ Warna random
# ❌ Lebih dari 5 warna berbeda
```

---

## 📄 STRUKTUR DOKUMEN STANDAR (TEMPLATE)

Gunakan struktur ini untuk SEMUA dokumen:

```
1. Cover/Judul
   - Judul dokumen (24pt, bold, DARK_BLUE, centered)
   - Subtitle (14pt, LIGHT_GRAY, centered)

2. Daftar Isi (optional, hanya jika 5+ bab)
   - Heading: "Daftar Isi"
   - List dengan nomor

3. Bab-bab Konten (3-7 bab minimum)
   - Heading Level 1 (DARK_BLUE, 16-18pt)
   - Paragraf (11pt, DARK_TEXT, 1.5 line spacing)
   - Sub-heading Level 2 (PRIMARY_BLUE, 13-14pt) jika ada
   - Bullet/numbered list jika diperlukan

4. Kesimpulan (terakhir)
   - Heading: "Kesimpulan"
   - Ringkasan poin-poin penting
```

---

## ✅ WORKING CODE PATTERNS

### Pattern 1: Judul & Subtitle
```python
doc = Document()

# Judul (ALWAYS gunakan ini untuk cover)
title_para = doc.add_paragraph()
title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_run = title_para.add_run("Judul Dokumen Penelitian")
title_run.font.size = Pt(24)
title_run.font.bold = True
title_run.font.color.rgb = DARK_BLUE

# Subtitle
subtitle_para = doc.add_paragraph()
subtitle_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub_run = subtitle_para.add_run("Subtitle atau Tanggal atau Penulis")
sub_run.font.size = Pt(12)
sub_run.font.color.rgb = LIGHT_GRAY

# Spacing setelah cover
doc.add_paragraph()
doc.add_page_break()
```

### Pattern 2: Heading & Body Text
```python
# Heading (gunakan ini untuk setiap bab)
doc.add_heading("Bab 1: Pendahuluan", level=1)

# Body paragraf (gunakan ini untuk konten)
p = doc.add_paragraph("Ini adalah konten paragraf yang jelas dan informatif.")
p.paragraph_format.line_spacing = 1.5
p.paragraph_format.space_after = Pt(12)

# Lebih banyak paragraf
doc.add_paragraph("Paragraf kedua dengan informasi lanjutan.")
doc.add_paragraph("Paragraf ketiga dengan detail lebih.")
```

### Pattern 3: Bullet List
```python
doc.add_paragraph("Poin pertama yang penting", style="List Bullet")
doc.add_paragraph("Poin kedua yang detail", style="List Bullet")
doc.add_paragraph("Sub-poin lebih spesifik", style="List Bullet 2")
```

### Pattern 4: Numbered List
```python
doc.add_paragraph("Langkah pertama dalam prosedur", style="List Number")
doc.add_paragraph("Langkah kedua setelah langkah pertama", style="List Number")
doc.add_paragraph("Sub-langkah di bawah langkah dua", style="List Number 2")
```

### Pattern 5: Simpan Dokumen
```python
# ALWAYS akhir dengan ini
doc.save("nama_file.docx")
print("FILE_CREATED:nama_file.docx")
```

---

## 📊 CHARTS & KURVA (DENGAN MATPLOTLIB)

### Setup Matplotlib
```python
import matplotlib.pyplot as plt
import matplotlib
from matplotlib import rcParams

# Configure matplotlib untuk professional charts
matplotlib.use('Agg')  # Non-GUI backend
rcParams['font.family'] = 'Calibri'
rcParams['font.size'] = 10
rcParams['axes.labelcolor'] = '#1A1A2E'
rcParams['xtick.color'] = '#64748B'
rcParams['ytick.color'] = '#64748B'
rcParams['axes.edgecolor'] = '#E2E8F0'
rcParams['figure.facecolor'] = 'white'
```

### Chart Type 1: Line Chart (Kurva Tren)
```python
fig, ax = plt.subplots(figsize=(10, 5), dpi=150)

# Data
months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni']
data1 = [45, 52, 48, 65, 71, 78]
data2 = [38, 42, 55, 60, 68, 75]

# Plot lines dengan marker
ax.plot(months, data1, marker='o', linewidth=2.5, color='#4FC3F7', 
        label='Series 1', markersize=8, markerfacecolor='white', markeredgewidth=2)
ax.plot(months, data2, marker='s', linewidth=2.5, color='#02C39A', 
        label='Series 2', markersize=7, markerfacecolor='white', markeredgewidth=2)

# Styling
ax.set_facecolor('#FFFFFF')
ax.grid(True, alpha=0.2, linestyle='--', color='#E2E8F0', linewidth=0.8)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#E2E8F0')
ax.spines['bottom'].set_color('#E2E8F0')

# Labels & Legend
ax.set_title('Tren Data 6 Bulan', fontsize=14, fontweight='bold', color='#1E2761', pad=15)
ax.set_xlabel('Bulan', fontsize=11, color='#64748B', fontweight='bold')
ax.set_ylabel('Nilai', fontsize=11, color='#64748B', fontweight='bold')
ax.legend(loc='upper left', frameon=True, fancybox=False, edgecolor='#E2E8F0', fontsize=9)

plt.tight_layout()
plt.savefig('chart_line.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

# Insert ke dokumen
doc.add_heading('Grafik Tren', level=2)
doc.add_picture('chart_line.png', width=Inches(6))
caption = doc.add_paragraph('Gambar 1: Tren Data Periode 6 Bulan', style='Caption')
caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### Chart Type 2: Bar Chart (Perbandingan)
```python
fig, ax = plt.subplots(figsize=(10, 5), dpi=150)

# Data
categories = ['Kategori A', 'Kategori B', 'Kategori C', 'Kategori D']
values = [45, 67, 52, 88]
colors = ['#1E2761', '#4FC3F7', '#02C39A', '#7B2FFF']

# Bar chart
bars = ax.bar(categories, values, color=colors, edgecolor='#E2E8F0', linewidth=1.5)

# Value labels on top
for bar in bars:
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 1,
            f'{int(height)}',
            ha='center', va='bottom', fontsize=10, fontweight='bold', color='#1A1A2E')

# Styling
ax.set_facecolor('#FFFFFF')
ax.set_ylim(0, max(values) * 1.2)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#E2E8F0')
ax.spines['bottom'].set_color('#E2E8F0')

# Labels
ax.set_title('Perbandingan Kategori', fontsize=14, fontweight='bold', color='#1E2761', pad=15)
ax.set_ylabel('Nilai', fontsize=11, color='#64748B', fontweight='bold')

plt.tight_layout()
plt.savefig('chart_bar.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

# Insert ke dokumen
doc.add_picture('chart_bar.png', width=Inches(6))
```

### Chart Type 3: Pie Chart (Distribusi)
```python
fig, ax = plt.subplots(figsize=(8, 6), dpi=150)

# Data
labels = ['Segmen A', 'Segmen B', 'Segmen C', 'Segmen D']
sizes = [35, 25, 20, 20]
colors_pie = ['#1E2761', '#4FC3F7', '#02C39A', '#7B2FFF']
explode = (0.05, 0, 0, 0)

# Pie chart
wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors_pie,
                                    autopct='%1.1f%%', shadow=False, startangle=90,
                                    textprops={'fontsize': 10})

# Format percentage text
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontweight('bold')
    autotext.set_fontsize(9)

for text in texts:
    text.set_color('#1A1A2E')
    text.set_fontweight('bold')

ax.set_title('Distribusi Segmen', fontsize=14, fontweight='bold', color='#1E2761', pad=15)

plt.tight_layout()
plt.savefig('chart_pie.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

# Insert ke dokumen
doc.add_picture('chart_pie.png', width=Inches(5.5))
```

### Chart Type 4: Scatter Chart (Korelasi)
```python
fig, ax = plt.subplots(figsize=(10, 5), dpi=150)

# Data
import random
random.seed(42)
x = [i for i in range(1, 21)]
y = [i*2 + random.uniform(-5, 5) for i in range(1, 21)]

# Scatter plot
ax.scatter(x, y, s=100, color='#4FC3F7', alpha=0.7, edgecolors='#1E2761', linewidth=1.5, label='Data Points')

# Trendline
z = numpy.polyfit(x, y, 1)
p = numpy.poly1d(z)
ax.plot(x, p(x), color='#7B2FFF', linewidth=2, linestyle='--', label='Trendline')

# Styling
ax.set_facecolor('#FFFFFF')
ax.grid(True, alpha=0.2, linestyle='--', color='#E2E8F0')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Labels
ax.set_title('Analisis Korelasi', fontsize=14, fontweight='bold', color='#1E2761', pad=15)
ax.set_xlabel('Variabel X', fontsize=11, color='#64748B', fontweight='bold')
ax.set_ylabel('Variabel Y', fontsize=11, color='#64748B', fontweight='bold')
ax.legend(loc='upper left', frameon=True, fancybox=False, edgecolor='#E2E8F0')

plt.tight_layout()
plt.savefig('chart_scatter.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

# Insert ke dokumen
doc.add_picture('chart_scatter.png', width=Inches(6))
```

---

## 🚫 ANTI-PATTERN (JANGAN LAKUKAN INI)

### ❌ String Handling yang Salah
```python
# SALAH:
text = "Ini string yang
       belum ditutup dengan quote

# SALAH:
headers = 

# SALAH:
doc.add_paragraph("Kalimat yang split
di tengah tanpa proper syntax

# BENAR:
text = "Ini string yang complete"
headers = ["Header 1", "Header 2"]
doc.add_paragraph("Kalimat complete di satu baris atau pakai concatenation")
```

### ❌ API yang Tidak Direkomendasikan
```python
# JANGAN GUNAKAN:
❌ doc.add_()  # method tidak lengkap
❌ WD_ALIGN_PARAGRAPH.JUSTIFIED  # pakai JUSTIFY saja
❌ eval()  # sangat berbahaya
❌ exec()  # sangat berbahaya
❌ getattr()  # tidak perlu
❌ OxmlElement untuk styling basic
❌ Import matplotlib kecuali benar-benar ada chart
❌ Library random seperti pandas, openpyxl, xlsxwriter
```

### ❌ Styling Terlalu Kompleks
```python
# JANGAN:
- Custom border dengan XML manipulation
- Nested table dengan complex formatting
- Color mixing yang tidak di-palette
- Font yang tidak standard (pakai Calibri, Arial, atau Times New Roman saja)
- Multiple text runs dalam satu paragraph tanpa alasan yang jelas
```

---

## 📝 CONTENT GUIDELINES

### Jumlah Minimum
- **Minimal 25 paragraf** untuk 800+ kata
- **Minimal 3 bab** besar (Pendahuluan, Isi, Kesimpulan)
- **Sub-bagian** jika bab lebih dari 400 kata

### Kualitas Konten
- Profesional dan informatif
- Tidak ada placeholder kosong
- Logika urutan yang masuk akal
- Relevan dengan task/topic
- Natural Indonesian language

### Indonesian Text Examples
Semua text harus natural Indonesian. Contoh BAIK:
```python
doc.add_heading("Penelitian Bebek Alabio: Karakteristik Fisik", level=1)
doc.add_paragraph("Bebek alabio merupakan salah satu rumpun unggas lokal unggulan Indonesia yang berasal dari Kalimantan Selatan.")
doc.add_paragraph("Ciri khas bebek alabio antara lain memiliki bulu berwarna hitam mengkilat, bentuk tubuh yang proporsional, dan produktivitas telur yang tinggi.")
doc.add_heading("Habitat dan Distribusi", level=2)
doc.add_paragraph("Bebek alabio berkembang dengan baik di wilayah beriklim tropis lembab seperti Kalimantan Selatan.")
```

---

## �️ VALIDATION CHECKLIST

Sebelum `doc.save()`, pastikan:

```
✅ Setiap paragraph dimulai dengan doc.add_paragraph() atau doc.add_heading()
✅ Setiap string complete (ada opening quote DAN closing quote)
✅ Variable assignment lengkap (tidak ada `headers =` tanpa value)
✅ Tidak ada eval, exec, atau unsafe functions
✅ Warna hanya dari palette DARK_BLUE, PRIMARY_BLUE, DARK_TEXT, LIGHT_GRAY, WHITE
✅ Font size masuk akal (11pt-24pt range)
✅ Minimal 800 kata total (bisa count dari doc.add_paragraph calls)
✅ Struktur: Cover → Content (3-5 bab) → Kesimpulan
✅ Akhir file: doc.save(...) dan print("FILE_CREATED:...")
✅ 0 syntax errors ketika di-check dengan python -m py_compile
✅ No dangerous functions: eval, exec, __import__, getattr, setattr, compile
```

---

## 🎯 COMPLETE WORKING EXAMPLE (COPY JIKA BUTUH TEMPLATE)

```python
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

DARK_BLUE = RGBColor(30, 39, 97)
PRIMARY_BLUE = RGBColor(79, 195, 247)
DARK_TEXT = RGBColor(26, 26, 46)
LIGHT_GRAY = RGBColor(100, 116, 139)

doc = Document()

# COVER
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
tr = title.add_run("Laporan Penelitian Bebek Alabio")
tr.font.size = Pt(24)
tr.font.bold = True
tr.font.color.rgb = DARK_BLUE

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
sr = sub.add_run("Tanggal: 28 Mei 2026")
sr.font.size = Pt(12)
sr.font.color.rgb = LIGHT_GRAY

doc.add_page_break()

# BAB 1
doc.add_heading("Bab 1: Pendahuluan", level=1)
doc.add_paragraph("Bebek alabio merupakan unggas lokal yang penting bagi ekonomi Kalimantan Selatan.")
doc.add_paragraph("Penelitian ini dilakukan untuk menganalisis karakteristik dan potensi populasi bebek alabio.")
doc.add_paragraph("Tujuan utama adalah memberikan data ilmiah yang dapat digunakan untuk pengembangan lebih lanjut.")

# BAB 2
doc.add_heading("Bab 2: Metodologi", level=1)
doc.add_paragraph("Penelitian dilakukan di daerah Kalimantan Selatan selama 6 bulan.")
doc.add_paragraph("Sampel penelitian terdiri dari 100 ekor bebek alabio yang dipilih secara random.")
doc.add_paragraph("Data dikumpulkan melalui observasi langsung dan wawancara dengan peternak.")
doc.add_heading("Analisis Data", level=2)
doc.add_paragraph("Data dianalisis menggunakan metode deskriptif dan statistik inferensial.")

# BAB 3
doc.add_heading("Bab 3: Hasil & Diskusi", level=1)
doc.add_paragraph("Hasil penelitian menunjukkan bahwa bebek alabio memiliki karakteristik fisik yang unik.")
doc.add_paragraph("Rata-rata berat badan bebek alabio adalah 2.8 kg dengan variasi 2.5-3.2 kg.")
doc.add_paragraph("Warna bulu dominan adalah hitam mengkilat dengan beberapa varian.")
doc.add_heading("Perbandingan dengan Unggas Lain", level=2)
doc.add_paragraph("Dibandingkan dengan bebek lokal lainnya, bebek alabio menunjukkan performa yang lebih baik.")

# BAB 4
doc.add_heading("Bab 4: Kesimpulan", level=1)
doc.add_paragraph("Penelitian ini memberikan pemahaman yang lebih baik tentang bebek alabio.")
doc.add_paragraph("Hasil penelitian dapat menjadi dasar untuk program pengembangan dan konservasi.")
doc.add_paragraph("Penelitian lebih lanjut sangat diperlukan untuk aspek nutrisi dan reproduksi.")

# SAVE
doc.save("laporan_penelitian.docx")
print("FILE_CREATED:laporan_penelitian.docx")
```

---

## 🔥 RULES UNTUK AI CODE GENERATION

Ketika AI generate code untuk DOCX, HARUS:

1. **Follow template di skill ini exactly** — tidak boleh creative interpretation
2. **Setiap string HARUS complete** di satu baris atau pakai `+` untuk concatenation
3. **Include print("FILE_CREATED:...")** di akhir tanpa fail
4. **Minimal 25 doc.add_paragraph() calls** untuk konten yang cukup
5. **Max 5 warna** dari palette yang ditentukan
6. **Jangan ada eval, exec, __import__, getattr, setattr, compile, globals, locals, vars, dir, pickle, importlib**
7. **Output harus pass: python -m py_compile** dengan 0 errors
8. **Struktur: Cover → 3-5 bab → Kesimpulan** — jangan langsung ke konten
9. **Indonesian text natural** — bukan translated English

---

## ⚡ TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| "SyntaxError: unterminated string literal" | Check setiap `"` ada pasangannya. Pakai `+` jika split line |
| "invalid syntax" di line tertentu | Lihat line itu, pastikan assignment complete dan string ditutup |
| "AttributeError: no attribute 'add_()'" | Pakai method lengkap: `add_paragraph()` bukan `add_()` |
| File tidak profesional | Check: warna dari palette saja, font 11-24pt, struktur 3+ bab |
| Code tidak bisa di-compile | Copy-paste dari contoh, jangan modifikasi structure |

---

## 📌 QUICK CHECKLIST

Sebelum submit kode DOCX, check ini:

- [ ] Imports: Document, Pt, RGBColor, WD_ALIGN_PARAGRAPH (hanya ini)
- [ ] Colors: Hanya DARK_BLUE, PRIMARY_BLUE, DARK_TEXT, LIGHT_GRAY, WHITE
- [ ] Structure: Cover (title+subtitle) → 3-5 bab → Kesimpulan
- [ ] Content: Minimal 25 paragraf, 800+ words
- [ ] Strings: Semua ditutup, tidak ada incomplete variable
- [ ] Dangerous: Jangan ada eval, exec, __import__, getattr, dll
- [ ] End: `doc.save(...)` dan `print("FILE_CREATED:...")`
- [ ] Test: `python -m py_compile file.py` returns 0 errors

---

## ✨ FINAL NOTES

- **This skill adalah satu-satunya resource untuk DOCX generation**
- **Jangan mixing approach dari skill lain**
- **Jika ada pertanyaan, refer ke contoh working example di atas**
- **Consistency dan simplicity adalah kunci kesuksesan**
