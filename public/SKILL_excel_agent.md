---
name: excel_professional_guide
description: >
  Panduan PROFESIONAL untuk membuat file Excel (.xlsx) yang handal, modern, dan berkualitas tinggi.
  Trigger: "excel", "xlsx", "spreadsheet", "sheet", "tabel", "data", "laporan", "analisis".
  Fokus: struktur data yang jelas, formatting professional, dan output yang reliabel.
---

# SKILL: Membuat File EXCEL Profesional & Handal

> **PENTING**: Baca skill ini dari awal sampai akhir SEBELUM menulis satu baris kode Python.
> Hindari shortcut. Hasilnya akan JAUH lebih baik dan lebih cepat di-generate.

---

## 🚀 PRINSIP DASAR

1. **SIMPLE IS BETTER** — Gunakan xlsxwriter, bukan openpyxl atau pandas
2. **RELIABLE** — Format yang konsisten, tidak perlu kompleks
3. **CONSISTENT** — Satu warna palette, satu style header, satu struktur data
4. **READABLE** — Output code mudah dibaca dan di-maintain
5. **PROFESSIONAL** — Terlihat corporate dan siap untuk presentasi

---

## 📦 SETUP (COPY-PASTE, JANGAN DIUBAH)

```python
import xlsxwriter

# Jangan gunakan openpyxl, pandas, atau library lain untuk Excel generation
# xlsxwriter adalah yang paling simple dan reliable
```

---

## 🎨 WARNA PALETTE (GUNAKAN EXACT INI)

```python
# Deepernova Professional Color Scheme (SAME AS DOCX)
DARK_BLUE = '#1E2761'      # Judul, header background
PRIMARY_BLUE = '#4FC3F7'   # Aksen, highlight
DARK_TEXT = '#1A1A2E'      # Text utama
LIGHT_GRAY = '#64748B'     # Text secondary
WHITE = '#FFFFFF'          # White

# ALTERNATIVE PALETTE untuk variasi
ALT_ACCENT = '#02C39A'     # Green accent
ALT_ACCENT2 = '#7B2FFF'    # Purple accent

# JANGAN GUNAKAN:
# ❌ Warna random
# ❌ Lebih dari 7 warna berbeda
# ❌ Warna terlalu bright atau kontras tinggi
```

---

## 📊 STRUKTUR FILE EXCEL STANDAR

Gunakan struktur ini untuk SEMUA file Excel:

```
Sheet 1: Data/Konten Utama
├── Header Row (Row 1)
│   - Background: DARK_BLUE
│   - Text: WHITE
│   - Bold, 12pt font
│   - Centered alignment
├── Data Rows (Row 2+)
│   - Background: WHITE
│   - Text: DARK_TEXT
│   - 11pt font
│   - Left/center aligned sesuai tipe data
├── Total/Summary Row (akhir, optional)
│   - Background: LIGHT_GRAY
│   - Bold, 11pt
├── Column width: Auto-fit atau fixed 15-25 chars
└── Row height: Default atau 20-22 px untuk header

Sheet 2+: (optional, jika data kompleks)
- Setiap sheet punya struktur sama
- Header konsisten
- Nama sheet descriptive (bukan "Sheet1", "Sheet2")
```

---

## ✅ WORKING CODE PATTERNS

### Pattern 1: Setup Basic & Worksheet
```python
import xlsxwriter

# Create workbook
workbook = xlsxwriter.Workbook('output.xlsx')
worksheet = workbook.add_worksheet('Data')

# Bisa tambah worksheet lagi:
# summary_sheet = workbook.add_worksheet('Summary')

# Set column width
worksheet.set_column('A:A', 15)  # Column A: width 15
worksheet.set_column('B:C', 20)  # Column B-C: width 20
worksheet.set_column('D:D', 12)  # Column D: width 12
```

### Pattern 2: Format Definitions (HEADER & DATA)
```python
# Header format (untuk row 1)
header_format = workbook.add_format({
    'bg_color': '#1E2761',      # DARK_BLUE background
    'font_color': '#FFFFFF',    # WHITE text
    'bold': True,
    'font_size': 12,
    'align': 'center',
    'valign': 'vcenter',
    'border': 1
})

# Data format (untuk row 2+)
data_format = workbook.add_format({
    'bg_color': '#FFFFFF',      # WHITE background
    'font_color': '#1A1A2E',    # DARK_TEXT
    'font_size': 11,
    'align': 'left',
    'valign': 'vcenter',
    'border': 1
})

# Number format (untuk kolom numerik)
number_format = workbook.add_format({
    'bg_color': '#FFFFFF',
    'font_color': '#1A1A2E',
    'font_size': 11,
    'align': 'right',
    'num_format': '#,##0',      # Format angka dengan separator
    'border': 1
})

# Currency format (untuk kolom uang)
currency_format = workbook.add_format({
    'bg_color': '#FFFFFF',
    'font_color': '#1A1A2E',
    'font_size': 11,
    'align': 'right',
    'num_format': 'Rp #,##0',   # Rp format
    'border': 1
})

# Total/Summary format
total_format = workbook.add_format({
    'bg_color': '#64748B',      # LIGHT_GRAY background
    'font_color': '#FFFFFF',
    'bold': True,
    'font_size': 11,
    'align': 'right',
    'num_format': '#,##0',
    'border': 1
})
```

### Pattern 3: Write Header Row
```python
# Row 0 = Header
worksheet.write('A1', 'No', header_format)
worksheet.write('B1', 'Nama', header_format)
worksheet.write('C1', 'Kategori', header_format)
worksheet.write('D1', 'Jumlah', header_format)
worksheet.write('E1', 'Harga', header_format)

# Atau pakai cell reference:
row = 0
headers = ['No', 'Nama', 'Kategori', 'Jumlah', 'Harga']
for col, header in enumerate(headers):
    worksheet.write(row, col, header, header_format)
```

### Pattern 4: Write Data Rows
```python
# Contoh data
data = [
    [1, 'Produk A', 'Elektronik', 50, 500000],
    [2, 'Produk B', 'Fashion', 120, 250000],
    [3, 'Produk C', 'Elektronik', 30, 750000],
    [4, 'Produk D', 'Makanan', 200, 50000],
]

# Write data
row = 1
for data_row in data:
    worksheet.write(row, 0, data_row[0], data_format)        # No
    worksheet.write(row, 1, data_row[1], data_format)        # Nama
    worksheet.write(row, 2, data_row[2], data_format)        # Kategori
    worksheet.write(row, 3, data_row[3], number_format)      # Jumlah
    worksheet.write(row, 4, data_row[4], currency_format)    # Harga
    row += 1
```

### Pattern 5: Add Total/Summary Row
```python
# Total row (setelah data)
total_row = row  # row sudah increment setelah loop

worksheet.write(total_row, 0, '', total_format)           # Empty cell
worksheet.write(total_row, 1, 'TOTAL', total_format)
worksheet.write(total_row, 2, '', total_format)           # Empty cell

# Formula untuk SUM (Jumlah)
# Format: =SUM(D2:D5) untuk sheet range D2 sampai D5
worksheet.write_formula(total_row, 3, f'=SUM(D2:D{total_row})', total_format)

# Formula untuk SUM (Harga)
worksheet.write_formula(total_row, 4, f'=SUM(E2:E{total_row})', currency_format)
```

### Pattern 6: Freeze Header
```python
# Freeze header row (row 0) saat scroll
worksheet.freeze_panes(1, 0)
```

### Pattern 7: Save Workbook
```python
# ALWAYS akhir dengan ini
workbook.close()
print("FILE_CREATED:output.xlsx")
```

---

## 📊 CHARTS DALAM EXCEL (DENGAN XLSXWRITER)

### Chart Type 1: Column Chart (Perbandingan)
```python
# Create chart object
chart = workbook.add_chart({'type': 'column'})

# Add data series
chart.add_series({
    'name': 'Penjualan',
    'categories': '=Data!$B$2:$B$6',  # Sheet name: Data, range B2:B6
    'values': '=Data!$C$2:$C$6',      # Values dari C2:C6
    'fill': {'color': '#4FC3F7'},     # BLUE
    'gap': 150
})

# Chart title & labels
chart.set_title({'name': 'Penjualan per Kategori'})
chart.set_x_axis({'name': 'Kategori'})
chart.set_y_axis({'name': 'Nilai (Rp)'})

# Style & legend
chart.set_style(11)  # Professional style
chart.set_legend({'position': 'right'})
chart.set_size({'width': 720, 'height': 480})

# Insert chart ke worksheet
worksheet.insert_chart('G2', chart)  # Insert at G2
```

### Chart Type 2: Line Chart (Tren)
```python
# Create line chart
line_chart = workbook.add_chart({'type': 'line'})

# Add multiple series
line_chart.add_series({
    'name': 'Series 1',
    'categories': '=Data!$A$2:$A$7',
    'values': '=Data!$B$2:$B$7',
    'line': {'color': '#4FC3F7', 'width': 2.5},
    'marker': {'type': 'circle', 'size': 7, 'border': {'color': '#1E2761'}}
})

line_chart.add_series({
    'name': 'Series 2',
    'categories': '=Data!$A$2:$A$7',
    'values': '=Data!$C$2:$C$7',
    'line': {'color': '#02C39A', 'width': 2.5},
    'marker': {'type': 'square', 'size': 7}
})

# Formatting
line_chart.set_title({'name': 'Tren Data'})
line_chart.set_x_axis({'name': 'Periode'})
line_chart.set_y_axis({'name': 'Nilai'})
line_chart.set_style(11)
line_chart.set_size({'width': 720, 'height': 480})

# Insert
worksheet.insert_chart('G15', line_chart)
```

### Chart Type 3: Pie Chart (Distribusi)
```python
# Create pie chart
pie_chart = workbook.add_chart({'type': 'pie'})

# Add data
pie_chart.add_series({
    'name': 'Distribusi',
    'categories': '=Data!$B$2:$B$5',
    'values': '=Data!$C$2:$C$5',
    'points': [
        {'fill': {'color': '#1E2761'}},
        {'fill': {'color': '#4FC3F7'}},
        {'fill': {'color': '#02C39A'}},
        {'fill': {'color': '#7B2FFF'}},
    ],
    'data_labels': {'percentage': True}
})

# Formatting
pie_chart.set_title({'name': 'Distribusi Kategori'})
pie_chart.set_style(10)
pie_chart.set_size({'width': 600, 'height': 480})

# Insert
worksheet.insert_chart('G28', pie_chart)
```

### Chart Type 4: Area Chart (Tren Area)
```python
# Create area chart
area_chart = workbook.add_chart({'type': 'area'})

# Add series
area_chart.add_series({
    'name': 'Revenue',
    'categories': '=Data!$A$2:$A$7',
    'values': '=Data!$B$2:$B$7',
    'fill': {'color': '#4FC3F7', 'transparency': 30}
})

area_chart.set_title({'name': 'Revenue Trend'})
area_chart.set_size({'width': 720, 'height': 480})

# Insert
worksheet.insert_chart('A20', area_chart)
```

---

## 🚫 ANTI-PATTERN (JANGAN LAKUKAN INI)

### ❌ Library yang Salah
```python
# JANGAN GUNAKAN:
❌ import openpyxl
❌ import pandas
❌ from pandas import DataFrame
❌ import csv

# GUNAKAN:
✅ import xlsxwriter
```

### ❌ String Handling yang Salah
```python
# SALAH:
headers =  # Incomplete assignment

# SALAH:
data = [1, "Produk yang
         belum ditutup

# BENAR:
headers = ['No', 'Nama', 'Kategori']
data = [1, "Produk A", "Kategori"]
```

### ❌ Format yang Berlebihan
```python
# JANGAN:
- Lebih dari 10 format berbeda
- Warna gradient atau effect kompleks
- Font fancy atau terlalu besar/kecil
- Merged cells tanpa perlu
- Conditional formatting yang kompleks
```

### ❌ Data Type yang Salah
```python
# JANGAN:
worksheet.write('A1', 123.456, number_format)  # Angka tapi format text
worksheet.write('B1', '500', currency_format)   # Text tapi format currency

# BENAR:
worksheet.write_number('A1', 123.456, number_format)   # Explicit number
worksheet.write('B1', 500, currency_format)            # Number untuk currency
```

---

## 📝 DATA GUIDELINES

### Struktur Data
- **Header row harus jelas** — Bukan "Col1", "Col2", tapi "Nama Produk", "Kategori"
- **Data minimal 10 rows** — Bukan hanya 2-3 baris
- **Column count: 3-8 columns** — Optimal untuk readability
- **Konsisten data types** — Nomor untuk angka, text untuk nama, dll

### Tipe Kolom Standard
```python
Nomor/ID         → number_format (align right)
Nama/Deskripsi   → data_format (align left)
Kategori/Status  → data_format (align center)
Jumlah/Qty       → number_format (align right)
Harga/Nilai      → currency_format (align right)
Tanggal          → date_format (align center)
Persentase       → percentage_format (align right)
```

### Contoh Data BAIK
```python
# Professional data untuk Excel
data = [
    [1, 'Bebek Alabio Jantan', 'Unggas Hidup', 25, 350000],
    [2, 'Bebek Alabio Betina', 'Unggas Hidup', 40, 300000],
    [3, 'Telur Bebek Alabio', 'Produk', 500, 15000],
    [4, 'Pakan Khusus Bebek', 'Input', 200, 25000],
]
```

---

## 🛡️ VALIDATION CHECKLIST

Sebelum `workbook.close()`, pastikan:

```
✅ Library: import xlsxwriter saja (bukan openpyxl/pandas)
✅ Workbook: workbook = xlsxwriter.Workbook('filename')
✅ Worksheet: worksheet = workbook.add_worksheet('Name')
✅ Header row: Row 0 dengan DARK_BLUE background, WHITE text, bold
✅ Data rows: Minimal 10 rows dengan format konsisten
✅ Column width: Set dengan worksheet.set_column()
✅ Format: Max 5-7 format berbeda, pakai dari palette
✅ Total row: Optional, jika ada summary
✅ Freeze: worksheet.freeze_panes(1, 0) opsional tapi recommended
✅ String: Semua complete, tidak ada variable incomplete
✅ End: workbook.close() dan print("FILE_CREATED:...")
✅ No dangerous: Tidak ada eval, exec, __import__
✅ Test: python -m py_compile file.py returns 0 errors
```

---

## 🎯 COMPLETE WORKING EXAMPLE (COPY-PASTE READY)

```python
import xlsxwriter

# Create workbook
workbook = xlsxwriter.Workbook('laporan_penjualan.xlsx')
worksheet = workbook.add_worksheet('Penjualan')

# Set column widths
worksheet.set_column('A:A', 8)
worksheet.set_column('B:B', 25)
worksheet.set_column('C:C', 15)
worksheet.set_column('D:D', 12)
worksheet.set_column('E:E', 15)

# Define formats
header_format = workbook.add_format({
    'bg_color': '#1E2761',
    'font_color': '#FFFFFF',
    'bold': True,
    'font_size': 12,
    'align': 'center',
    'valign': 'vcenter',
    'border': 1
})

data_format = workbook.add_format({
    'bg_color': '#FFFFFF',
    'font_color': '#1A1A2E',
    'font_size': 11,
    'align': 'left',
    'valign': 'vcenter',
    'border': 1
})

number_format = workbook.add_format({
    'bg_color': '#FFFFFF',
    'font_color': '#1A1A2E',
    'font_size': 11,
    'align': 'right',
    'num_format': '#,##0',
    'border': 1
})

currency_format = workbook.add_format({
    'bg_color': '#FFFFFF',
    'font_color': '#1A1A2E',
    'font_size': 11,
    'align': 'right',
    'num_format': 'Rp #,##0',
    'border': 1
})

total_format = workbook.add_format({
    'bg_color': '#64748B',
    'font_color': '#FFFFFF',
    'bold': True,
    'font_size': 11,
    'align': 'right',
    'num_format': 'Rp #,##0',
    'border': 1
})

# Write header
headers = ['No', 'Produk', 'Kategori', 'Jumlah', 'Harga Satuan', 'Total']
for col, header in enumerate(headers):
    worksheet.write(0, col, header, header_format)

# Write data
data = [
    [1, 'Bebek Alabio Jantan', 'Unggas Hidup', 25, 350000],
    [2, 'Bebek Alabio Betina', 'Unggas Hidup', 40, 300000],
    [3, 'Telur Bebek', 'Produk', 500, 15000],
    [4, 'Pakan Premium', 'Input', 200, 25000],
    [5, 'Vitamin Unggas', 'Suplemen', 100, 50000],
    [6, 'Kandang Portable', 'Peralatan', 5, 2000000],
    [7, 'Air Minum Steril', 'Konsumsi', 300, 5000],
    [8, 'Alas Kandang', 'Material', 50, 100000],
    [9, 'Lampu Pemanas', 'Peralatan', 10, 75000],
    [10, 'Filter Air', 'Peralatan', 20, 125000],
]

row = 1
for item in data:
    worksheet.write(row, 0, item[0], number_format)           # No
    worksheet.write(row, 1, item[1], data_format)             # Produk
    worksheet.write(row, 2, item[2], data_format)             # Kategori
    worksheet.write(row, 3, item[3], number_format)           # Jumlah
    worksheet.write(row, 4, item[4], currency_format)         # Harga Satuan
    worksheet.write_formula(row, 5, f'=D{row+1}*E{row+1}', currency_format)  # Total (formula)
    row += 1

# Add total row
total_row = row
worksheet.write(total_row, 1, 'TOTAL PENJUALAN', total_format)
worksheet.write(total_row, 2, '', total_format)
worksheet.write(total_row, 3, '', total_format)
worksheet.write(total_row, 4, '', total_format)
worksheet.write_formula(total_row, 5, f'=SUM(F2:F{total_row})', total_format)

# Freeze header
worksheet.freeze_panes(1, 0)

# Close workbook
workbook.close()
print("FILE_CREATED:laporan_penjualan.xlsx")
```

---

## 🔥 RULES UNTUK AI CODE GENERATION

Ketika AI generate code untuk EXCEL, HARUS:

1. **Use xlsxwriter ONLY** — bukan openpyxl, pandas, atau library lain
2. **Follow format patterns dari skill ini** — tidak boleh creative interpretation
3. **Setiap string MUST COMPLETE** — tidak boleh split tanpa proper syntax
4. **Header ALWAYS row 0** — dengan format yang ditentukan
5. **Minimal 10 data rows** — bukan cuma 2-3
6. **Max 7 format definitions** — dari palette yang ditentukan
7. **Jangan ada eval, exec, __import__** — dangerous functions
8. **Include freeze_panes(1, 0)** — untuk professional spreadsheet
9. **End dengan workbook.close() dan print()** — tidak boleh lupa
10. **Test: python -m py_compile** — harus 0 errors

---

## ⚡ TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| "xlsxwriter not found" | Sudah terinstall di server, jangan import library lain |
| "Workbook is closed" | Jangan write setelah close(), close paling akhir |
| "Invalid number format" | Gunakan format dari contoh, bukan custom format |
| "Cell write error" | Check coordinates (row, col) benar dan format match type |
| Data terlihat tidak profesional | Check: header colored, data rows 10+, column width set |
| File terlalu besar | Jangan include gambar, chart, atau formatting kompleks |

---

## 📌 QUICK CHECKLIST

Sebelum submit kode EXCEL:

- [ ] Import: `import xlsxwriter` saja
- [ ] Workbook: `xlsxwriter.Workbook('file.xlsx')`
- [ ] Column width: Set dengan `set_column()`
- [ ] Header: Row 0 dengan header_format (DARK_BLUE bg)
- [ ] Data: Minimal 10 rows dengan format konsisten
- [ ] Formats: Gunakan dari palette (max 7 format)
- [ ] Total: Optional, jika ada summary
- [ ] Freeze: `freeze_panes(1, 0)` recommended
- [ ] End: `workbook.close()` dan `print("FILE_CREATED:...")`
- [ ] Test: 0 syntax errors, 0 dangerous functions
- [ ] Strings: Semua complete, tidak ada incomplete variable

---

## 🎯 MULTIPLE SHEETS EXAMPLE (Advanced)

Jika file perlu lebih dari 1 sheet:

```python
import xlsxwriter

workbook = xlsxwriter.Workbook('multi_sheet.xlsx')

# Sheet 1: Data
data_sheet = workbook.add_worksheet('Data')
summary_sheet = workbook.add_worksheet('Summary')

# Sheet 1 content (Data)
# ... write to data_sheet ...

# Sheet 2 content (Summary)
# ... write to summary_sheet ...

workbook.close()
print("FILE_CREATED:multi_sheet.xlsx")
```

---

## ✨ FINAL NOTES

- **Skill ini adalah resource utama untuk EXCEL generation**
- **Jangan mixing approach dari skill lain**
- **Consistency adalah kunci** — Format sama di semua sheet
- **Simplicity > Complexity** — User mau data yang jelas, bukan fancy formatting
- **Professional output = Reusable output** — Bisa langsung dikirim ke klien
