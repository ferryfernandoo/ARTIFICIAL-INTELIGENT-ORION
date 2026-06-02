---
name: ppt_modern
description: >
  Gunakan skill ini setiap kali ada permintaan membuat, mengedit, atau menghasilkan file presentasi (.pptx).
  Trigger: kata "presentasi", "slide", "deck", "PPT", "PPTX", atau permintaan membuat dokumen visual multi-halaman.
---

# SKILL: Membuat Presentasi Modern (PPTX) dengan python-pptx

> Baca seluruh skill ini sebelum menulis satu baris kode pun. Skill ini hanya untuk Python `python-pptx`.

## 1. LIBRARY WAJIB

- `from pptx import Presentation`
- `from pptx.util import Inches, Pt`
- `from pptx.enum.text import PP_ALIGN`
- `from pptx.enum.shapes import MSO_SHAPE`
- `from pptx.dml.color import RGBColor`

## 2. PALETTE MODERN - PILIH SALAH SATU (SANGAT BERLIMPAH)

Setiap presentasi WAJIB gunakan satu palette yang konsisten. Pilih berdasarkan task atau random untuk variasi.

### 2.1 PALETTE: MODERN BLUE (Default - Profesional)
- `DARK   = RGBColor(30, 39, 97)`      # 1E2761
- `LIGHT  = RGBColor(240, 244, 255)`   # F0F4FF
- `AKSEN  = RGBColor(79, 195, 247)`    # 4FC3F7
- `TEKS   = RGBColor(26, 26, 46)`      # 1A1A2E
- `MUTED  = RGBColor(100, 116, 139)`   # 64748B
- `WHITE  = RGBColor(255, 255, 255)`

### 2.2 PALETTE: EMERALD GREEN (Segar & Modern)
- `DARK   = RGBColor(11, 108, 84)`     # 0B6C54
- `LIGHT  = RGBColor(232, 245, 233)`   # E8F5E9
- `AKSEN  = RGBColor(76, 175, 80)`     # 4CAF50
- `TEKS   = RGBColor(27, 47, 46)`      # 1B2F2E
- `MUTED  = RGBColor(129, 199, 132)`   # 81C784
- `WHITE  = RGBColor(255, 255, 255)`

### 2.3 PALETTE: DEEP PURPLE (Elegan & Kreatif)
- `DARK   = RGBColor(63, 18, 93)`      # 3F125D
- `LIGHT  = RGBColor(243, 229, 245)`   # F3E5F5
- `AKSEN  = RGBColor(171, 71, 188)`    # AB47BC
- `TEKS   = RGBColor(49, 27, 45)`      # 311B2D
- `MUTED  = RGBColor(186, 104, 200)`   # BA68C8
- `WHITE  = RGBColor(255, 255, 255)`

### 2.4 PALETTE: WARM ORANGE (Energik & Fun)
- `DARK   = RGBColor(230, 81, 0)`      # E65100
- `LIGHT  = RGBColor(255, 243, 224)`   # FFF3E0
- `AKSEN  = RGBColor(255, 152, 0)`     # FF9800
- `TEKS   = RGBColor(33, 33, 33)`      # 212121
- `MUTED  = RGBColor(255, 171, 64)`    # FFAB40
- `WHITE  = RGBColor(255, 255, 255)`

### 2.5 PALETTE: TEAL MODERN (Fresh & Minimal)
- `DARK   = RGBColor(0, 121, 107)`     # 00796B
- `LIGHT  = RGBColor(224, 242, 241)`   # E0F2F1
- `AKSEN  = RGBColor(0, 188, 212)`     # 00BCD4
- `TEKS   = RGBColor(13, 71, 79)`      # 0D474F
- `MUTED  = RGBColor(77, 182, 172)`    # 4DB6AC
- `WHITE  = RGBColor(255, 255, 255)`

### 2.6 PALETTE: CRIMSON RED (Bold & Powerful)
- `DARK   = RGBColor(97, 26, 30)`      # 611A1E
- `LIGHT  = RGBColor(255, 242, 242)`   # FFF2F2
- `AKSEN  = RGBColor(192, 57, 43)`     # C0392B
- `TEKS   = RGBColor(46, 52, 64)`      # 2E3440
- `MUTED  = RGBColor(140, 60, 58)`     # 8C3C3A
- `WHITE  = RGBColor(255, 255, 255)`

### 2.7 PALETTE: INDIGO MODERN (Corporate & Trust)
- `DARK   = RGBColor(26, 35, 126)`     # 1A237E
- `LIGHT  = RGBColor(237, 241, 245)`   # EDF1F5
- `AKSEN  = RGBColor(63, 81, 181)`     # 3F51B5
- `TEKS   = RGBColor(13, 13, 60)`      # 0D0D3C
- `MUTED  = RGBColor(103, 127, 204)`   # 677FCC
- `WHITE  = RGBColor(255, 255, 255)`

### 2.8 PALETTE: SLATE GREY (Sophisticated & Neutral)
- `DARK   = RGBColor(55, 71, 79)`      # 37474F
- `LIGHT  = RGBColor(238, 238, 238)`   # EEEEEE
- `AKSEN  = RGBColor(117, 117, 117)`   # 757575
- `TEKS   = RGBColor(33, 33, 33)`      # 212121
- `MUTED  = RGBColor(158, 158, 158)`   # 9E9E9E
- `WHITE  = RGBColor(255, 255, 255)`

### 2.9 PALETTE: CORAL MODERN (Friendly & Warm)
- `DARK   = RGBColor(244, 67, 54)`     # F44336
- `LIGHT  = RGBColor(255, 235, 238)`   # FFEBEE
- `AKSEN  = RGBColor(229, 57, 53)`     # E53935
- `TEKS   = RGBColor(33, 33, 33)`      # 212121
- `MUTED  = RGBColor(239, 112, 96)`    # EF7060
- `WHITE  = RGBColor(255, 255, 255)`

### 2.10 PALETTE: AMBER GOLD (Premium & Luxury)
- `DARK   = RGBColor(191, 144, 0)`     # BF9000
- `LIGHT  = RGBColor(255, 250, 235)`   # FFFAEB
- `AKSEN  = RGBColor(255, 193, 7)`     # FFC107
- `TEKS   = RGBColor(51, 35, 0)`       # 332300
- `MUTED  = RGBColor(255, 224, 178)`   # FFE0B2
- `WHITE  = RGBColor(255, 255, 255)`

### 2.11 PALETTE: MINT FRESH (Clean & Light)
- `DARK   = RGBColor(15, 157, 103)`    # 0F9D67
- `LIGHT  = RGBColor(230, 245, 240)`   # E6F5F0
- `AKSEN  = RGBColor(38, 198, 218)`    # 26C6DA
- `TEKS   = RGBColor(15, 76, 48)`      # 0F4C30
- `MUTED  = RGBColor(128, 222, 234)`   # 80DEEA
- `WHITE  = RGBColor(255, 255, 255)`

### 2.12 PALETTE: BERRY DARK (Modern Minimal)
- `DARK   = RGBColor(69, 39, 160)`     # 4527A0
- `LIGHT  = RGBColor(243, 229, 245)`   # F3E5F5
- `AKSEN  = RGBColor(156, 39, 176)`    # 9C27B0
- `TEKS   = RGBColor(33, 33, 33)`      # 212121
- `MUTED  = RGBColor(206, 17, 114)`    # CE0172
- `WHITE  = RGBColor(255, 255, 255)`

### 2.13 PALETTE: CYBER GREY (Tech & Digital)
- `DARK   = RGBColor(25, 25, 25)`      # 191919
- `LIGHT  = RGBColor(245, 245, 245)`   # F5F5F5
- `AKSEN  = RGBColor(0, 229, 255)`     # 00E5FF
- `TEKS   = RGBColor(200, 200, 200)`   # C8C8C8
- `MUTED  = RGBColor(100, 100, 100)`   # 646464
- `WHITE  = RGBColor(255, 255, 255)`

Jika task meminta tema tertentu, pilih palette yang sesuai. Jika tidak disebutkan, gunakan random dari 13 pilihan di atas.

## 3. ATURAN UMUM LAYOUT

- Gunakan `prs = Presentation()` dan `prs.slide_width = Inches(10)` serta `prs.slide_height = Inches(5.625)`.
- Buat slide dengan `prs.slides.add_slide(prs.slide_layouts[6])`.
- Untuk warna latar, buat shape rectangle penuh dengan `MSO_SHAPE.RECTANGLE`.
- Gunakan `slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))` untuk teks.
- Setiap textbox harus menggunakan `text_frame` dan `paragraph.runs`.
- Pastikan setiap slide punya judul.
- Jangan gunakan `pptxgenjs` atau library JavaScript.

## 4. VARIASI SLIDE & LAYOUT DESIGN (WAJIB BERVARIASI)

Untuk mencegah desain yang monoton, gunakan MINIMAL 5 layout berbeda dalam presentasi.
Setiap slide HARUS punya karakteristik visual yang berbeda, jangan copy-paste.

### 4.1 LAYOUT TYPE 1: COVER SLIDE (Impressive Entry)
- Full-width background DARK color
- Title besar (44pt), centered, AKSEN atau WHITE color
- Subtitle medium (20pt), WHITE
- Accent bar vertikal / horizontal di satu sisi (0.06" wide, AKSEN color)
- Optional: small shape/shape accent di corner

### 4.2 LAYOUT TYPE 2: BULLET SLIDE (Classic Content)
- Background LIGHT color
- Title (28pt, DARK, bold) aligned left with underline (AKSEN color)
- Vertical bar (0.08" wide, AKSEN) di sebelah kiri bullets
- 3-5 bullet points (15pt, TEKS)
- Bullets berwarna AKSEN bukan default
- Bottom footer line (thin, MUTED color)

### 4.3 LAYOUT TYPE 3: TWO-COLUMN CARD (Visual + Text)
- Background LIGHT color
- Title (28pt, DARK, bold) di atas
- Left: Colored card/box (background AKSEN dengan opacity/lighter shade)
  - Text inside with white color
- Right: Text block with TEKS color
- Layout balanced, seperti magazine style

### 4.4 LAYOUT TYPE 4: QUOTE / HIGHLIGHT (Emphasis Slide)
- Background DARK color
- Large statement/quote di tengah (32pt bold, AKSEN atau WHITE)
- Optional: Decorative line atau shape di atas/bawah quote
- Attribution / source di bawah (14pt, MUTED)
- Minimal text, maximum impact

### 4.5 LAYOUT TYPE 5: CHART / STATISTICS (Visual Data)
- Background LIGHT color
- Title (28pt, DARK)
- Chart area (matplotlib PNG di tengah, width 8.5")
- Below chart: brief explanation text (13pt, TEKS)
- Optional: 2-3 stat boxes (small, AKSEN background) di sisi

### 4.6 LAYOUT TYPE 6: COMPARISON / FEATURE (Side-by-Side)
- Background LIGHT
- Title (28pt) top center
- Two columns with:
  - Left: Feature A dengan icon/shape + bullet points
  - Right: Feature B dengan icon/shape + bullet points
- Dividing line di tengah (MUTED color)

### 4.7 LAYOUT TYPE 7: TIMELINE / STEPS (Process)
- Background LIGHT
- Title top
- Horizontal atau vertikal timeline dengan:
  - Step circles (AKSEN background)
  - Connected lines
  - Label text (14pt, TEKS)
- 4-5 steps untuk clarity

### 4.8 LAYOUT TYPE 8: SECTION DIVIDER (Visual Break)
- Full background dengan gradation / solid AKSEN color
- Large section number atau symbol (60pt+)
- Section title (24pt, bold, WHITE)
- Decorative elements (lines, shapes) di corners
- Minimal text - hanya untuk navigation

### 4.9 LAYOUT TYPE 9: DETAILED LIST (Rich Content)
- Background LIGHT
- Title
- Content dengan mixed format:
  - Some text in DARK bold (untuk emphasis)
  - Some in regular TEKS
  - Small icons / colored dots sebelum list items
  - Spacing generous untuk readability

### 4.10 LAYOUT TYPE 10: CLOSING / CALL-TO-ACTION (Ending Strong)
- Background DARK
- Main message (28pt, AKSEN, bold)
- Supporting text (16pt, WHITE)
- Call-to-action or key takeaway
- Optional: Logo placeholder atau contact info
- Feel: professional + memorable

## 4.11 STRATEGI VARIASI WAJIB IKUTI
- JANGAN gunakan layout yang sama dua kali berturut-turut
- MINIMAL buat 2 different layouts untuk setiap 5 slide
- Setiap slide MUST punya visual identity berbeda
- Mix: bold slides (dark bg), content slides (light bg), untuk rhythm
- Warna AKSEN HARUS prominent di setiap slide tapi dalam bentuk yang berbeda
- Avoid: monotonous left-align, use center, right-align, dan mixed alignment

## 5. ANTI-ERROR PENTING

- Jangan pakai `#FF0000` dalam string; gunakan `RGBColor()`.
- Jangan pakai `slide.add_text()` — gunakan `slide.shapes.add_textbox`.
- Jangan pakai `pres.save` jika object `prs` tidak dibuat.
- Jangan buat variabel `presentation` lalu simpan `prs`; gunakan nama yang konsisten.
- Jangan menghasilkan teks instruksi dalam slide seperti "buat judul" atau "generate slide".
- Jangan output markdown, penjelasan, atau kode non-Python.
- Selalu print: `print('FILE_CREATED:<filename>')` setelah `prs.save()`.

## 6. CHART / GAMBAR

Jika presentasi perlu chart atau visualisasi:
- Generate dengan matplotlib → save PNG
- Insert ke slide dengan `slide.shapes.add_picture()`
- Tempatkan chart di area konten, bukan header/footer
- Size chart sesuai slide (width 8-9 inches untuk 10" slide)

## 7. STRUKTUR SLIDE 10-HALAMAN

Jika task meminta 10 halaman, template ideal:

1. Cover (judul + subtitle + accent bar)
2. Agenda / ringkasan (bullet points)
3-8. Konten utama dengan variasi:
   - Slide dengan teks + bullet
   - Slide dengan chart/gambar
   - Slide dengan statistics/highlights
9. Insight / rekomendasi (key takeaways)
10. Penutup / terima kasih (closing message)

Jika tidak disebut angka, cukup minimal 5 slide.

## 8. SAMPLE HELPER

Gunakan helper sederhana jika perlu:

```python
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

def add_text_box(slide, x, y, w, h, text, size, color, bold=False, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.word_wrap = True
    frame.clear()
    p = frame.paragraphs[0]
    p.text = text
    for run in p.runs:
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    p.alignment = align
    return box
```

## 8. RULE PENYIMPANAN

- Simpan file menggunakan `prs.save('<outputFileName>')`.
- Cetak hanya satu baris dengan `FILE_CREATED:`.
- Output tidak boleh mengandung syntax error.

## 9. QA FINAL

Sebelum selesai, pastikan:
- file `.pptx` dibuat
- slide count sesuai permintaan
- judul dan teks tampil konsisten
- semua warna memakai `RGBColor(...)`
- tidak ada kode JavaScript
