---
name: ppt_modern
description: >
  Gunakan skill ini setiap kali ada permintaan membuat, mengedit, atau menghasilkan file presentasi (.pptx).
  Trigger: kata "presentasi", "slide", "deck", "PPT", "PPTX", atau permintaan membuat dokumen visual multi-halaman.
  Skill ini mencakup workflow lengkap: setup, desain modern, anti-error, dan QA visual.
---

# SKILL: Membuat Presentasi Modern (PPTX)

> Baca seluruh skill ini sebelum menulis satu baris kode pun. Jangan skip bagian manapun.

---

## 1. SETUP WAJIB

```bash
# Install dependensi (jalankan sekali)
npm install -g pptxgenjs
npm install -g react react-dom react-icons sharp
pip install Pillow --break-system-packages
```

```javascript
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();

// SELALU set layout ini terlebih dahulu
pres.layout  = "LAYOUT_16x9";   // 10" × 5.625"
pres.author  = "Deepernova";
pres.title   = "Judul Presentasi";
```

**Koordinat slide (dalam inci):**
- Lebar total: `10"`, Tinggi total: `5.625"`
- Safe margin: minimal `0.5"` dari semua tepi
- Titik nol ada di pojok kiri-atas `(x:0, y:0)`

---

## 2. WAJIB: PILIH TEMA SEBELUM MULAI

Jangan langsung coding sebelum memilih palette dan layout keseluruhan.

### Palette Siap Pakai (pilih SATU, gunakan konsisten)

| Nama | Background Gelap | Background Terang | Aksen | Teks Gelap |
|------|-----------------|-------------------|-------|------------|
| **Midnight Tech** | `1E2761` | `F0F4FF` | `4FC3F7` | `1A1A2E` |
| **Deepernova Dark** | `0D0D1A` | `F5F5FF` | `7B2FFF` | `1A1A2E` |
| **Coral Energy** | `F96167` | `FFF8F8` | `2F3C7E` | `1C1C2E` |
| **Ocean Pro** | `065A82` | `EEF6FB` | `02C39A` | `0A2239` |
| **Forest Moss** | `1B3A2D` | `F0F7F4` | `6FCF97` | `12261E` |
| **Charcoal Minimal** | `1C2B3A` | `F7F9FB` | `E74C3C` | `0D1B2A` |
| **Warm Executive** | `B85042` | `FDF6F0` | `A7BEAE` | `3C1A14` |
| **Teal Trust** | `028090` | `E8F8F9` | `FFD166` | `01363D` |

### Aturan Warna
- 1 warna dominan (60-70% visual), 1 warna pendukung, 1 aksen tajam
- Slide judul & penutup → pakai background **gelap**
- Slide konten → pakai background **terang**
- Pastikan kontras teks minimal 4.5:1 (jangan teks terang di background terang)

---

## 3. STRUKTUR SLIDE STANDAR

### Slide 1 — Cover / Title
```javascript
const slideCover = pres.addSlide();
slideCover.background = { color: "1E2761" };  // Warna gelap dominan

// Judul besar di tengah
slideCover.addText("Judul Presentasi", {
  x: 0.8, y: 1.5, w: 8.4, h: 1.2,
  fontSize: 44, fontFace: "Calibri", bold: true,
  color: "FFFFFF", align: "center", valign: "middle",
  margin: 0
});

// Subtitle
slideCover.addText("Subtitle atau nama pembuat", {
  x: 0.8, y: 3.0, w: 8.4, h: 0.6,
  fontSize: 18, fontFace: "Calibri",
  color: "CADCFC", align: "center",
  margin: 0
});

// Aksen visual (bukan garis bawah judul — gunakan shape dekoratif di bawah slide)
slideCover.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 5.225, w: 10, h: 0.4,
  fill: { color: "4FC3F7" }, line: { color: "4FC3F7" }
});
```

### Slide Konten — Layout 2 Kolom
```javascript
const slide = pres.addSlide();
slide.background = { color: "F0F4FF" };

// Header bar kiri (aksen vertikal, bukan horizontal!)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 0.4, w: 0.06, h: 0.7,
  fill: { color: "4FC3F7" }, line: { color: "4FC3F7" }
});

// Judul slide
slide.addText("Judul Slide", {
  x: 0.65, y: 0.38, w: 8.5, h: 0.75,
  fontSize: 28, fontFace: "Calibri", bold: true,
  color: "1E2761", align: "left", valign: "middle", margin: 0
});

// Kolom kiri (teks)
slide.addText([
  { text: "Poin pertama", options: { bullet: true, breakLine: true } },
  { text: "Poin kedua", options: { bullet: true, breakLine: true } },
  { text: "Poin ketiga", options: { bullet: true } }
], {
  x: 0.5, y: 1.4, w: 4.5, h: 3.5,
  fontSize: 16, fontFace: "Calibri", color: "1A1A2E",
  paraSpaceAfter: 8
});

// Kolom kanan (card/visual)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 5.3, y: 1.4, w: 4.2, h: 3.5,
  fill: { color: "FFFFFF" },
  shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.10 }
});
slide.addText("Visual / Data / Statistik", {
  x: 5.3, y: 1.4, w: 4.2, h: 3.5,
  fontSize: 14, color: "4A5568", align: "center", valign: "middle"
});
```

### Slide Konten — Layout Card Grid (2x2 atau 3x1)
```javascript
// Card helper — selalu buat fungsi, JANGAN reuse objek shadow
const makeCard = (slide, x, y, w, h, title, body, accentColor) => {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.10 }
  });
  // Aksen atas card
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: w, h: 0.06,
    fill: { color: accentColor }, line: { color: accentColor }
  });
  slide.addText(title, {
    x: x + 0.15, y: y + 0.15, w: w - 0.3, h: 0.4,
    fontSize: 14, bold: true, color: "1E2761", margin: 0
  });
  slide.addText(body, {
    x: x + 0.15, y: y + 0.6, w: w - 0.3, h: h - 0.75,
    fontSize: 12, color: "4A5568", margin: 0
  });
};

// Contoh grid 2x2
makeCard(slide, 0.5, 1.4, 4.2, 1.9, "Judul 1", "Deskripsi singkat 1", "4FC3F7");
makeCard(slide, 5.3, 1.4, 4.2, 1.9, "Judul 2", "Deskripsi singkat 2", "7B2FFF");
makeCard(slide, 0.5, 3.5, 4.2, 1.9, "Judul 3", "Deskripsi singkat 3", "02C39A");
makeCard(slide, 5.3, 3.5, 4.2, 1.9, "Judul 4", "Deskripsi singkat 4", "F96167");
```

### Slide Statistik Besar
```javascript
const slideStat = pres.addSlide();
slideStat.background = { color: "1E2761" };

// Angka besar di tengah
slideStat.addText("87%", {
  x: 1, y: 1.2, w: 3.5, h: 2,
  fontSize: 80, bold: true, color: "4FC3F7",
  align: "center", valign: "middle"
});
slideStat.addText("Label Statistik", {
  x: 1, y: 3.3, w: 3.5, h: 0.6,
  fontSize: 16, color: "CADCFC", align: "center"
});

// Statistik ke-2
slideStat.addText("3.2x", {
  x: 5.5, y: 1.2, w: 3.5, h: 2,
  fontSize: 80, bold: true, color: "02C39A",
  align: "center", valign: "middle"
});
slideStat.addText("Label Statistik 2", {
  x: 5.5, y: 3.3, w: 3.5, h: 0.6,
  fontSize: 16, color: "CADCFC", align: "center"
});
```

### Slide Penutup
```javascript
const slideEnd = pres.addSlide();
slideEnd.background = { color: "0D0D1A" };

slideEnd.addText("Terima Kasih", {
  x: 1, y: 1.8, w: 8, h: 1.5,
  fontSize: 48, bold: true, color: "FFFFFF",
  align: "center", valign: "middle"
});
slideEnd.addText("Nama | Kontak | Website", {
  x: 1, y: 3.5, w: 8, h: 0.6,
  fontSize: 16, color: "7B8FAB", align: "center"
});
// Aksen bawah
slideEnd.addShape(pres.shapes.RECTANGLE, {
  x: 3.5, y: 4.5, w: 3, h: 0.05,
  fill: { color: "7B2FFF" }, line: { color: "7B2FFF" }
});
```

---

## 4. ICON (Opsional, Sangat Direkomendasikan)

```javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaRocket, FaBrain, FaChartLine, FaShieldAlt } = require("react-icons/fa");

async function iconPng(IconComp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// Contoh penggunaan icon dalam lingkaran berwarna
const addIconCard = async (slide, x, y, IconComp, iconColor, bgColor, label) => {
  // Lingkaran background
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: 0.7, h: 0.7,
    fill: { color: bgColor }, line: { color: bgColor }
  });
  // Icon di dalam
  const data = await iconPng(IconComp, iconColor, 256);
  slide.addImage({ data, x: x + 0.1, y: y + 0.1, w: 0.5, h: 0.5 });
  // Label
  slide.addText(label, {
    x: x - 0.5, y: y + 0.75, w: 1.7, h: 0.4,
    fontSize: 12, color: "1A1A2E", align: "center", margin: 0
  });
};
```

---

## 5. CHART MODERN

```javascript
// Selalu terapkan styling ini agar chart tidak terlihat default/jadul
const modernChartOpts = {
  x: 0.5, y: 1.2, w: 9, h: 3.8,
  barDir: "col",

  // Warna sesuai tema
  chartColors: ["1E2761", "4FC3F7", "02C39A", "7B2FFF"],

  // Background bersih
  chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true },
  plotArea: { fill: { color: "FFFFFF" } },

  // Axis muted
  catAxisLabelColor: "64748B",
  valAxisLabelColor: "64748B",
  catAxisLineShow: false,

  // Grid minimal
  valGridLine: { color: "E2E8F0", size: 0.5 },
  catGridLine: { style: "none" },

  // Label data
  showValue: true,
  dataLabelColor: "1E293B",
  dataLabelFontSize: 11,

  // Sembunyikan legend kalau 1 seri
  showLegend: false,
};

slide.addChart(pres.charts.BAR, [{
  name: "Data",
  labels: ["Jan", "Feb", "Mar", "Apr"],
  values: [42, 67, 55, 89]
}], modernChartOpts);
```

---

## 6. ATURAN ANTI-ERROR (BACA SEMUA, JANGAN SKIP)

### ❌ Hal yang Menyebabkan FILE CORRUPT

```javascript
// 1. JANGAN pakai "#" di hex warna
color: "#FF0000"   // ❌ CORRUPT
color: "FF0000"    // ✅ BENAR

// 2. JANGAN opacity di dalam string warna 8 karakter
shadow: { color: "00000020" }              // ❌ CORRUPT
shadow: { color: "000000", opacity: 0.12 } // ✅ BENAR

// 3. JANGAN reuse objek shadow/opsi yang sama di dua elemen
const shadow = { type:"outer", blur:6, offset:2, color:"000000", opacity:0.1 };
slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // ❌ mutasi objek
slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // nilai sudah corrupt

const makeShadow = () => ({ type:"outer", blur:6, offset:2, color:"000000", opacity:0.1 });
slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });  // ✅
slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });  // ✅
```

### ❌ Hal yang Menyebabkan TAMPILAN RUSAK

```javascript
// 4. JANGAN buat bullet dengan unicode
slide.addText("• Item satu");  // ❌ bullet ganda

// Benar:
slide.addText([
  { text: "Item satu", options: { bullet: true, breakLine: true } },
  { text: "Item dua",  options: { bullet: true } }
], { x:0.5, y:1, w:8, h:3 });

// 5. JANGAN pakai lineSpacing dengan bullet — gunakan paraSpaceAfter
// ❌
{ lineSpacing: 28 }
// ✅
{ paraSpaceAfter: 8 }

// 6. JANGAN pasang ROUNDED_RECTANGLE dengan overlay persegi di atasnya
// Gunakan RECTANGLE biasa saja

// 7. Kalau teks harus sejajar dengan shape, set margin: 0
slide.addText("Teks sejajar", { x:0.65, y:0.38, w:8, h:0.75, margin: 0 });
```

### ❌ Hal yang Membuat Slide TERLIHAT MURAHAN / AI-Generated

- **JANGAN** buat garis horizontal di bawah judul (accent underline) — ini tanda khas slide AI
- **JANGAN** pakai background cream/beige default (`F5F5DC`, `FFFACD`, dll) tanpa diminta
- **JANGAN** semua slide layout sama persis — variasikan per slide
- **JANGAN** center-align semua teks body
- **JANGAN** pakai font Arial untuk semua teks — gunakan Calibri atau Trebuchet
- **JANGAN** pasang warna header bar / footer bar berwarna melintang penuh kecuali ada alasan desain kuat

---

## 7. UKURAN TEKS STANDAR

| Elemen | Ukuran | Style |
|--------|--------|-------|
| Judul cover | 40–48pt | Bold |
| Judul slide | 26–32pt | Bold |
| Sub-heading | 18–22pt | Bold atau SemiBold |
| Body teks | 14–16pt | Regular |
| Bullet item | 13–15pt | Regular |
| Caption / label kecil | 10–12pt | Regular, muted |
| Angka statistik besar | 60–80pt | Bold |

---

## 8. TYPOGRAPHY PAIRING

| Header | Body |
|--------|------|
| Calibri (Bold) | Calibri |
| Trebuchet MS | Calibri |
| Georgia | Calibri Light |
| Arial Black | Arial |
| Cambria | Calibri |

---

## 9. SIMPAN FILE

```javascript
// Simpan ke output
await pres.writeFile({ fileName: "/mnt/user-data/outputs/presentasi.pptx" });
console.log("✅ File berhasil dibuat.");
```

---

## 10. QA VISUAL (WAJIB SEBELUM SELESAI)

### Langkah 1 — Convert ke Gambar

```bash
python scripts/office/soffice.py --headless --convert-to pdf /mnt/user-data/outputs/presentasi.pptx
rm -f /mnt/user-data/outputs/slide-*.jpg
pdftoppm -jpeg -r 150 /mnt/user-data/outputs/presentasi.pdf /mnt/user-data/outputs/slide
ls -1 "$PWD"/mnt/user-data/outputs/slide-*.jpg
```

### Langkah 2 — Checklist Visual

Untuk setiap slide, periksa:

| # | Cek | Status |
|---|-----|--------|
| 1 | Teks tidak keluar dari kotak (overflow) | ☐ |
| 2 | Tidak ada teks yang terpotong di tepi slide | ☐ |
| 3 | Margin minimal 0.5" dari semua tepi | ☐ |
| 4 | Tidak ada elemen yang overlap tak sengaja | ☐ |
| 5 | Kontras teks cukup (gelap di terang, terang di gelap) | ☐ |
| 6 | Icon terlihat jelas (tidak tenggelam di background) | ☐ |
| 7 | Layout slide bervariasi (bukan semua sama) | ☐ |
| 8 | Tidak ada teks placeholder yang tersisa | ☐ |
| 9 | Tidak ada garis aksen horizontal di bawah judul | ☐ |
| 10 | Font dan warna konsisten dengan tema yang dipilih | ☐ |

### Langkah 3 — Perbaiki & Verifikasi Ulang

Perbaiki semua masalah yang ditemukan, lalu jalankan ulang convert + cek visual sekali lagi. Stop setelah satu iterasi kecuali ada masalah baru yang signifikan.

---

## 11. WORKFLOW SINGKAT

```
1. Baca brief / permintaan user
2. Pilih tema (palette + font) dari Bagian 2
3. Rancang urutan slide (cover → konten x N → penutup)
4. Tulis kode per slide mengikuti template di Bagian 3
5. Install deps jika belum ada (Bagian 1)
6. Jalankan script → simpan ke /mnt/user-data/outputs/
7. QA visual (Bagian 10) → perbaiki → simpan ulang
8. present_files ke user
```

---

## 12. CONTOH SCRIPT LENGKAP SIAP PAKAI

```javascript
const pptxgen = require("pptxgenjs");

async function buatPresentasi() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Presentasi Deepernova";

  const DARK   = "1E2761";
  const LIGHT  = "F0F4FF";
  const AKSEN  = "4FC3F7";
  const TEKS   = "1A1A2E";
  const MUTED  = "64748B";
  const WHITE  = "FFFFFF";

  // ── SLIDE 1: Cover ──────────────────────────────────
  const s1 = pres.addSlide();
  s1.background = { color: DARK };
  s1.addText("Judul Presentasi Anda", {
    x: 0.8, y: 1.6, w: 8.4, h: 1.2,
    fontSize: 44, fontFace: "Calibri", bold: true,
    color: WHITE, align: "center", margin: 0
  });
  s1.addText("Subtitle • Nama • Tanggal", {
    x: 0.8, y: 3.0, w: 8.4, h: 0.6,
    fontSize: 18, color: "CADCFC", align: "center", margin: 0
  });
  s1.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.225, w: 10, h: 0.4,
    fill: { color: AKSEN }, line: { color: AKSEN }
  });

  // ── SLIDE 2: Konten ──────────────────────────────────
  const s2 = pres.addSlide();
  s2.background = { color: LIGHT };
  s2.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.4, w: 0.06, h: 0.75,
    fill: { color: AKSEN }, line: { color: AKSEN }
  });
  s2.addText("Judul Slide Konten", {
    x: 0.65, y: 0.38, w: 8.5, h: 0.8,
    fontSize: 28, fontFace: "Calibri", bold: true,
    color: DARK, align: "left", valign: "middle", margin: 0
  });
  s2.addText([
    { text: "Poin pertama yang penting",    options: { bullet: true, breakLine: true } },
    { text: "Poin kedua dengan detail",     options: { bullet: true, breakLine: true } },
    { text: "Poin ketiga sebagai penutup",  options: { bullet: true } }
  ], {
    x: 0.5, y: 1.4, w: 4.5, h: 3.8,
    fontSize: 15, fontFace: "Calibri",
    color: TEKS, paraSpaceAfter: 10
  });
  s2.addShape(pres.shapes.RECTANGLE, {
    x: 5.3, y: 1.4, w: 4.2, h: 3.8,
    fill: { color: WHITE },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.10 }
  });
  s2.addText("Area Grafik / Visual", {
    x: 5.3, y: 1.4, w: 4.2, h: 3.8,
    fontSize: 14, color: MUTED, align: "center", valign: "middle"
  });

  // ── SLIDE 3: Penutup ─────────────────────────────────
  const s3 = pres.addSlide();
  s3.background = { color: "0D0D1A" };
  s3.addText("Terima Kasih", {
    x: 1, y: 1.8, w: 8, h: 1.5,
    fontSize: 48, bold: true, color: WHITE,
    align: "center", valign: "middle"
  });
  s3.addText("deepernova.id | info@deepernova.id", {
    x: 1, y: 3.6, w: 8, h: 0.5,
    fontSize: 14, color: "7B8FAB", align: "center"
  });
  s3.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 4.5, w: 3, h: 0.05,
    fill: { color: "7B2FFF" }, line: { color: "7B2FFF" }
  });

  await pres.writeFile({ fileName: "/mnt/user-data/outputs/presentasi.pptx" });
  console.log("✅ Presentasi berhasil dibuat!");
}

buatPresentasi().catch(console.error);
```

---

*Skill ini ditulis untuk Deepernova AI Agent. Versi: 1.0*
