# 🐍 Python Finance Service Setup

Backend now menggunakan **Python service** untuk financial data collection yang lebih reliable!

## ✅ Requirements

- Python 3.8+ (check dengan: `python3 --version` atau `python --version`)
- pip (Python package manager)

## 🚀 Quick Install

### 1. Check Python Installation

```powershell
# Windows PowerShell
python3 --version
```

Jika tidak ketemu, download dari: https://www.python.org/downloads/

### 2. Install Required Packages

**Option A - Install All at Once:**
```powershell
cd F:\orion_deepernova-main\server
pip install yfinance pandas-datareader requests
```

**Option B - Install One by One (Safer):**
```powershell
pip install yfinance
pip install pandas-datareader
pip install requests
```

### 3. Verify Installation

```powershell
# Test if packages are available
python3 -c "import yfinance; print('✓ yfinance OK')"
python3 -c "import pandas_datareader; print('✓ pandas_datareader OK')"
python3 -c "import requests; print('✓ requests OK')"
```

All should print `✓ OK`

### 4. Restart Backend

```powershell
# Kill old backend (Ctrl+C if still running)

# Start backend again
cd F:\orion_deepernova-main\server
npm run dev
```

Look for this log:
```
[Python Finance] Calling finance_service.py for: ...
[Python Finance] ✓ Got data: 
```

## 🧪 Test the System

1. Backend running: `npm run dev` (folder `server/`)
2. Frontend running: `npm run dev` (folder root)
3. Send chat message: `harga btc`

**Expected backend logs:**
```
[Chat] Market query check: "harga btc" => true
[Chat] Building finance context...
[Python Finance] Calling finance_service.py for: "harga btc"
[Python] Starting finance context for: 'harga btc'
[Python] ✓ Got crypto bitcoin: $xyz
[Python Finance] ✓ Got data: 📊 LATEST FINANCIAL DATA: ...
[Finance] Injected latest market/economy context
✓✓✓ SUCCESS: Injecting 2 contexts into messages
```

**Expected AI response:**
- ✅ Shows **actual BTC price** (USD & IDR)
- ✅ Shows 24h change percentage
- ✅ Shows market cap
- ❌ NOT generic "I don't have access to..." response

## 🔧 Troubleshooting

### Problem: "python3: command not found"
**Solution:** Install Python from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation
- Restart PowerShell after installing

### Problem: "No module named 'yfinance'"
**Solution:** Install missing package
```powershell
pip install yfinance
```

### Problem: Backend logs show "Python Finance Process error"
**Solution:** Check if Python packages are installed
```powershell
pip list | findstr /I "yfinance pandas"
```
Should show both packages installed

### Problem: Still getting generic AI response
**Solution:** 
1. Make sure backend is fully restarted (Ctrl+C + npm run dev)
2. Check backend logs for `[Python Finance]` tags
3. If logs show successful data injection but AI still responds generically → issue is AI instruction following, not data collection

## 📊 What Data is Collected

The Python service now fetches:

| Query Type | Data Source | Example Query |
|-----------|------------|---------------|
| **Stocks** | Yahoo Finance | "bbca", "tlkm", "msft" |
| **Crypto** | CoinGecko | "btc", "eth", "doge" |
| **Forex** | exchangerate-api | "usd idr", "eur usd" |
| **Macro** | FRED | "inflasi", "suku bunga", "minyak" |

## 💡 Tips

- If installation is slow: use `pip install -U` to upgrade packages
- For offline installation: pre-download packages and install locally
- Backend logs all data fetching → check them to debug data collection issues
