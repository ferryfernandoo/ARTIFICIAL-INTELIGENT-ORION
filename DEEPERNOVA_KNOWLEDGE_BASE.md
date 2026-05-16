# Deepernova Official Knowledge Base

## 📋 Dokumentasi Sistem Pengetahuan

Dokumen ini menjelaskan bagaimana AI Orion memiliki akses ke informasi resmi perusahaan Deepernova dan bagaimana sistem RAG (Retrieval-Augmented Generation) diintegrasikan.

---

## ✅ Informasi yang Tersedia di Knowledge Base

### 1. **Company Background**
- Latar belakang didiriannya Deepernova
- Filosofi nama "Deepernova" (Deeper + Nova)
- Misi utama perusahaan

### 2. **Ferry Fernando - Founder & CEO**
- **Status:** Founder & CEO Deepernova (BUKAN Surya Wijaya)
- **Asal:** Kebumen, Jawa Tengah, Indonesia
- **Domisili:** Jakarta, Indonesia
- **Latar Belakang:** Self-taught (otodidak) di pemrograman, elektronika, dan AI
- **Pendidikan:** Mahasiswa aktif di Universitas Esa Unggul, Jakarta
- **Expertise Unik:**
  - **Software:** Pemrograman, arsitektur model, dataset engineering
  - **Hardware:** Desain prosesor CPU 64-bit, elektronika analog/digital, chip design
  - **AI:** Transformer, tokenisasi, dataset engineering Bahasa Indonesia
- **Personal:** Sedang menulis novel "Tunggu Aku Sukses, Sayang"
- **Motivasi:** Tanggung jawab pribadi untuk masa depan adik kandungnya

### 3. **Visi dan Misi Deepernova**
- **Visi:** Menjadi perusahaan AI terdepan dari Indonesia yang memahami manusia Indonesia secara mendalam
- **Misi 5 Pilar:**
  1. Membangun LLM berkualitas tinggi untuk Bahasa Indonesia
  2. Mengembangkan arsitektur AI inovatif (Synapsing Neuron)
  3. Membuat AI dapat diakses oleh semua (freemium model berbasis iklan)
  4. Membangun ekosistem AI Indonesia yang mandiri
  5. Berkontribusi pada komunitas riset global

### 4. **Orion AI - Model Unggulan**
- **Nama:** Orion (rasi bintang navigasi)
- **Tujuan:** Model bahasa yang memahami Bahasa Indonesia dengan mendalam
- **Kapabilitas:** Percakapan, coding, penulisan kreatif, analisis data, konteks budaya lokal
- **Arsitektur:** Mixture of Experts (MoE) + Synapsing Neuron

### 5. **Arsitektur Teknologi**
- **MoE (Mixture of Experts):** Efisiensi komputasi, hanya expert relevan yang aktif
- **Synapsing Neuron:** Komunikasi antar-expert dinamis seperti sinapsis otak manusia
- **Dynamic Positional Encoding:** Adaptif berdasarkan konteks input
- **Dataset Engineering:** Format Alpaca, JSON/JSONL, kurasi berlapis
- **Infrastructure:** GPU cluster yang disewa untuk training

### 6. **Roadmap Deepernova**
- **Fase 1 (Saat Ini):** Fondasi - dataset, finalisasi arsitektur, eksperimen training awal
- **Fase 2:** Pelatihan dan iterasi - training run full Orion
- **Fase 3:** Peluncuran produk - akses publik dengan sistem token berbasis iklan
- **Fase 4:** Skalabilitas - ekspansi ke bahasa lain di Asia Tenggara
- **Fase 5:** Custom processor - membangun chip prosesor sendiri

### 7. **Model Bisnis**
- **Freemium + Iklan:** Pengguna gratis, token dari interaksi iklan
- **API untuk Developer:** API berbayar untuk integrasi B2B
- **Enterprise Services:** Customized packages untuk korporat
- **Technology Licensing:** Lisensi arsitektur Synapsing Neuron

---

## 🔧 Bagaimana AI Menggunakan Knowledge Base Ini

### Sistem RAG (Retrieval-Augmented Generation)

1. **Deteksi Pertanyaan:** AI mendeteksi jika pertanyaan tentang Deepernova/Ferry Fernando/Orion
2. **Retrieval:** Sistem RAG mencari di dataset `orion_dataset.json` untuk dokumen relevan
3. **Augmentation:** Informasi dari knowledge base di-augment ke dalam context prompt
4. **Response:** AI menjawab berdasarkan informasi resmi perusahaan, bukan prediksi

### Instruksi di System Prompt

Dalam `src/services/grokApi.js`, system prompt memiliki section **PENGETAHUAN PERUSAHAAN** yang menginstruksikan AI untuk:

- ✅ **Selalu gunakan** official company data saat ditanya tentang perusahaan
- ✅ **Jangan katakan** "tidak ada informasi" jika knowledge base punya data
- ✅ **Akurat:** Ferry Fernando = Founder & CEO Deepernova (BUKAN Surya Wijaya)
- ✅ **Jangan invent** data yang tidak ada di knowledge base
- ✅ **Percaya diri:** Jawab dengan confident berdasarkan fact resmi

---

## 📄 Data yang Disimpan

**File:** `data/datasets/orion_dataset.json`

Berisi 13 entry dengan topik:
1. Orion AI profile
2. RAG logic
3. Vite guide
4. Deepernova background
5. Ferry Fernando (founder)
6. Ferry Fernando expertise
7. Vision & Mission
8. Orion introduction
9. Orion MoE architecture
10. Synapsing Neuron (trade secret)
11. Dataset engineering
12. Roadmap
13. Business model

---

## 🔒 Keamanan Data

- Knowledge base adalah **official company documentation**
- Tidak ada data sensitif atau rahasia teknis yang detail di public knowledge base
- **Synapsing Neuron architecture** hanya dijelaskan secara umum (trade secret tetap terjaga)
- Semua data sudah aman untuk di-share dengan publik

---

## 📝 Contoh Pertanyaan yang Dijawab dari Knowledge Base

### Sebelumnya (Tanpa Knowledge Base):
```
User: Siapa founder Deepernova?
AI: Saya tidak memiliki informasi spesifik tentang Ferry Fernando...
     CEO Deepernova adalah Surya Wijaya, berdasarkan data yang tersedia.
```

### Sekarang (Dengan Knowledge Base):
```
User: Siapa founder Deepernova?
AI: **Ferry Fernando** adalah Founder & CEO Deepernova.
    Ia adalah seorang pemuda dari Kebumen, Jawa Tengah yang self-taught 
    di bidang pemrograman, elektronika, dan kecerdasan buatan.
    
    **Keunikan Ferry:**
    - Mampu bergerak di dua dunia: software dan hardware
    - Software: pemrograman, arsitektur model, dataset engineering
    - Hardware: desain CPU 64-bit, elektronika, chip design
    
    **Motivasi:** Tanggung jawab pribadi untuk masa depan adik kandungnya
```

---

## 🚀 Cara Menggunakan Knowledge Base

### Untuk Developer:
1. **Untuk update data:** Edit `data/datasets/orion_dataset.json`
2. **Untuk trigger AI learning:** AI otomatis menggunakan data dari RAG saat menjawab
3. **Untuk verifikasi:** Cek `src/services/grokApi.js` section "PENGETAHUAN PERUSAHAAN"

### Untuk Users:
1. **Tanya tentang Deepernova:** AI akan menjawab dengan data resmi perusahaan
2. **Tanya tentang Ferry Fernando:** Langsung dapat jawaban akurat tanpa "ngawur"
3. **Tanya tentang Orion/teknis:** Dapatkan penjelasan berdasarkan official documentation

---

## ✨ Keuntungan Sistem Ini

✅ **Akurasi:** Jawaban berbasis official data, bukan prediksi\
✅ **Konsistensi:** Semua user mendapat jawaban yang sama\
✅ **Efisiensi:** Tidak pakai token API ekstra untuk knowledge base (cached)\
✅ **Kepercayaan:** User tahu AI punya informasi akurat tentang perusahaan\
✅ **Profesional:** Respons terasa seperti dari company official

---

**Terakhir Update:** April 2026\
**Maintained By:** Deepernova Development Team
