# 🚀 Setup Orion AI Server - Panduan Lengkap

## Langkah 1: Dapatkan API Key Deepseek

1. Kunjungi: https://platform.deepseek.com/
2. Login atau daftar akun
3. Buat API key baru
4. Copy API key (format: `sk-...`)

## Langkah 2: Konfigurasi `.env`

File `.env` sudah ada di root folder. Edit isinya:

```
DEEPSEEK_API_KEY=sk-paste_your_api_key_here
VITE_API_BASE_URL=http://localhost:3001
```

Ganti `sk-paste_your_api_key_here` dengan API key yang kalian dapatkan.

## Langkah 3: Jalankan Server

Buka 2 terminal (PowerShell):

**Terminal 1 - Backend:**
```powershell
cd e:\coding\orion_deepernova-main
npm run start:server
```
Output: `🚀 File Generation Server running on http://localhost:3001`

**Terminal 2 - Frontend:**
```powershell
cd e:\coding\orion_deepernova-main
npm run dev
```
Output: `VITE v8.0.8 ready in ... ms`

## Langkah 4: Akses Aplikasi

Buka browser ke: **http://localhost:5173**

## Troubleshooting

### Port 3001 sudah dipakai
```powershell
netstat -ano | findstr ":3001"
taskkill /PID <PID> /F
```

### Vite command not found
```powershell
node ".\node_modules\vite\bin\vite.js"
```

### AI tidak merespons
- Pastikan `.env` sudah memiliki API key yang valid
- Restart backend server
- Buka browser console (F12) untuk melihat error

## File Struktur

```
orion_deepernova-main/
├── server/
│   ├── server.js          (Backend API + Chat Proxy)
│   ├── temp-files/        (Generated files storage)
│   └── package.json
├── src/
│   ├── App.jsx
│   ├── components/
│   │   └── ChatBot.jsx    (Frontend UI)
│   └── services/
│       ├── grokApi.js     (Calls backend /api/chat)
│       └── ...
├── .env                   (API configuration)
├── package.json           (Root dependencies)
└── vite.config.js
```

## API Routes

- `POST /api/chat` - AI chat proxy (backend only)
- `POST /api/upload-file` - File upload & parsing
- `POST /api/generate-file` - File generation
- `GET /health` - Health check

## Status Sekarang

✅ Backend server: http://localhost:3001  
✅ Frontend dev server: http://localhost:5173  
⏳ Tunggu API key untuk test chat
