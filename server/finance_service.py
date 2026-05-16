#!/usr/bin/env python3
"""
Finance Data Service - Dedicated Python backend for reliable financial data fetching
Uses yfinance, cryptocurrency APIs, and World News API for real-time data
"""

import sys
import os
import json
import datetime
import time
import re
import html
from typing import Dict, List, Optional, Any
from urllib.parse import quote

try:
    import yfinance as yf
    import requests
    import worldnewsapi
except ImportError as e:
    print(f"ERROR: Required library not installed: {e}", file=sys.stderr)
    print("Install with: pip install yfinance requests worldnewsapi", file=sys.stderr)
    sys.exit(1)

# ==================== CONFIG ====================
WORLD_NEWS_API_KEY = os.getenv('WORLD_NEWS_API_KEY') or os.getenv('WORLDNEWS_API_KEY') or ""  # Read from environment
# If not set in environment, try to read from project .env (useful during dev when server already loaded dotenv)
if not WORLD_NEWS_API_KEY:
    try:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() == 'WORLD_NEWS_API_KEY' or k.strip() == 'WORLDNEWS_API_KEY':
                            WORLD_NEWS_API_KEY = v.strip()
                            break
    except Exception:
        pass
FRED_API_KEY = ""  # Set from environment or config
ALPHA_VANTAGE_API_KEY = "48E67IPHJM3FBZ46"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
FRED_BASE = "https://api.stlouisfed.org/fred"

# ==================== HELPER FUNCTIONS ====================
def fetch_with_retry(url: str, params: Dict = None, max_retries: int = 2, backoff_secs: float = 1.0) -> Optional[Dict]:
    """
    Fetch URL with exponential backoff retry on rate limit (429)
    Returns response JSON or None on failure
    """
    for attempt in range(max_retries):
        try:
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:  # Rate limit
                if attempt < max_retries - 1:
                    wait_time = backoff_secs * (2 ** attempt)
                    print(f"[Python] Rate limited, waiting {wait_time}s before retry {attempt + 1}", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
            print(f"[Python] HTTP error: {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[Python] Fetch error: {e}", file=sys.stderr)
            return None
    return None

# ==================== STOCK DATA ====================
def get_stock_price(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Get current stock price using yfinance
    Returns: {symbol, price, currency, change, change_pct, timestamp}
    """
    try:
        print(f"[Python] Fetching stock: {ticker}", file=sys.stderr)
        stock = yf.Ticker(ticker)
        
        # Get 1 day history
        hist = stock.history(period="1d")
        if hist.empty:
            print(f"[Python] No history for {ticker}", file=sys.stderr)
            return None
        
        info = stock.info or {}
        current_price = info.get("currentPrice") or hist["Close"].iloc[-1]
        previous_close = info.get("previousClose") or 0
        change = current_price - previous_close
        change_pct = (change / previous_close * 100) if previous_close else 0
        
        result = {
            "symbol": ticker,
            "price": round(float(current_price), 2),
            "currency": "USD",
            "change": round(float(change), 2),
            "change_pct": round(float(change_pct), 2),
            "timestamp": datetime.datetime.now().isoformat()
        }
        print(f"[Python] ✓ Got stock {ticker}: ${result['price']}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[Python] ✗ Stock error for {ticker}: {e}", file=sys.stderr)
        return None

def get_stock_analysis(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed stock analysis including historical data and trend
    Returns: {symbol, current_price, open, high, low, 52w_high, 52w_low, avg_volume, pe_ratio, ...}
    """
    try:
        print(f"[Python] Fetching detailed analysis for stock: {ticker}", file=sys.stderr)
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        
        # Get 1 year history for trends
        hist = stock.history(period="1y")
        if hist.empty:
            return None
        
        current_price = hist["Close"].iloc[-1]
        price_1m_ago = hist["Close"].iloc[-21] if len(hist) > 21 else hist["Close"].iloc[0]
        price_1y_ago = hist["Close"].iloc[0]
        
        month_change = ((current_price - price_1m_ago) / price_1m_ago * 100) if price_1m_ago else 0
        year_change = ((current_price - price_1y_ago) / price_1y_ago * 100) if price_1y_ago else 0
        
        result = {
            "symbol": ticker,
            "current_price": round(float(current_price), 2),
            "open": round(float(info.get("open", 0)), 2),
            "high_52w": round(float(info.get("fiftyTwoWeekHigh", 0)), 2),
            "low_52w": round(float(info.get("fiftyTwoWeekLow", 0)), 2),
            "avg_volume": info.get("averageVolume", 0),
            "pe_ratio": round(float(info.get("trailingPE", 0)), 2),
            "market_cap": info.get("marketCap", 0),
            "change_1m": round(float(month_change), 2),
            "change_1y": round(float(year_change), 2),
            "timestamp": datetime.datetime.now().isoformat()
        }
        print(f"[Python] ✓ Got detailed analysis for {ticker}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[Python] ✗ Analysis error for {ticker}: {e}", file=sys.stderr)
        return None

def format_stock_summary(stock_data: Dict) -> str:
    """Format stock data for AI consumption"""
    if not stock_data:
        return ""
    s = stock_data
    change_indicator = "📈" if s["change"] >= 0 else "📉"
    return f"{s['symbol']}: {change_indicator} ${s['price']} (Change: {s['change']:+.2f} / {s['change_pct']:+.2f}%)"

def format_stock_analysis(stock_data: Dict) -> str:
    """Format detailed stock analysis for AI consumption"""
    if not stock_data:
        return ""
    s = stock_data
    return (
        f"{s['symbol']} Detailed Analysis:\n"
        f"  Current: ${s['current_price']} | Open: ${s['open']}\n"
        f"  52W Range: ${s['low_52w']} - ${s['high_52w']}\n"
        f"  1M Change: {s['change_1m']:+.2f}% | 1Y Change: {s['change_1y']:+.2f}%\n"
        f"  P/E Ratio: {s['pe_ratio']} | Market Cap: ${s['market_cap']/1e9:.1f}B\n"
        f"  Avg Volume: {s['avg_volume']:,.0f}"
    )

# ==================== CRYPTO DATA ====================
def get_crypto_price(crypto_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cryptocurrency price from CoinGecko (free, no auth)
    Returns: {id, usd, idr, change_24h, market_cap_usd, timestamp}
    """
    try:
        print(f"[Python] Fetching crypto: {crypto_id}", file=sys.stderr)
        url = f"{COINGECKO_BASE}/simple/price"
        params = {
            "ids": crypto_id,
            "vs_currencies": "usd,idr",
            "include_market_cap": "true",
            "include_24hr_change": "true"
        }
        
        data = fetch_with_retry(url, params=params, max_retries=3, backoff_secs=0.5)
        if not data:
            print(f"[Python] Failed to fetch crypto {crypto_id}", file=sys.stderr)
            return None
        
        if crypto_id not in data:
            print(f"[Python] No data for {crypto_id}", file=sys.stderr)
            return None
        
        crypto = data[crypto_id]
        result = {
            "id": crypto_id,
            "usd": crypto.get("usd", 0),
            "idr": crypto.get("idr", 0),
            "change_24h": crypto.get("usd_24h_change", 0),
            "market_cap_usd": crypto.get("usd_market_cap", 0),
            "timestamp": datetime.datetime.now().isoformat()
        }
        print(f"[Python] ✓ Got crypto {crypto_id}: ${result['usd']}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[Python] ✗ Crypto error for {crypto_id}: {e}", file=sys.stderr)
        return None

def format_crypto_summary(crypto_data: Dict) -> str:
    """Format crypto data for AI consumption"""
    if not crypto_data:
        return ""
    c = crypto_data
    change_indicator = "📈" if c["change_24h"] >= 0 else "📉"
    market_cap_b = c["market_cap_usd"] / 1e9 if c["market_cap_usd"] else 0
    return (
        f"{c['id'].upper()}: {change_indicator} USD ${c['usd']:,.2f} | IDR Rp{c['idr']:,.0f} | "
        f"24h: {c['change_24h']:+.2f}% | Market Cap: ${market_cap_b:.1f}B"
    )

# ==================== MACRO DATA (FRED) ====================
def get_macro_indicator(series_id: str, label: str) -> Optional[str]:
    """
    Get macro economic data from FRED API
    Returns formatted string with latest value
    """
    try:
        print(f"[Python] Fetching FRED series: {series_id}", file=sys.stderr)
        # Use FRED API directly (no API key required for public series)
        url = f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&limit=1&sort_order=desc&api_key=&file_type=json"
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('observations'):
            print(f"[Python] No FRED data for {series_id}", file=sys.stderr)
            return None
        
        obs = data['observations'][0]
        latest_value = float(obs.get('value', 0)) if obs.get('value') else 0
        latest_date = obs.get('date', 'N/A')
        
        result = f"{label} ({series_id}): {latest_value:.2f} as of {latest_date}"
        print(f"[Python] ✓ Got {label}: {latest_value}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[Python] ✗ FRED error for {series_id}: {e}", file=sys.stderr)
        return None

# ==================== FOREX DATA ====================
def get_forex_rate(from_currency: str, to_currency: str) -> Optional[Dict[str, Any]]:
    """
    Get forex exchange rate
    Returns: {from, to, rate, timestamp}
    """
    try:
        print(f"[Python] Fetching forex: {from_currency}/{to_currency}", file=sys.stderr)
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if to_currency not in data.get("rates", {}):
            print(f"[Python] No rate for {from_currency}/{to_currency}", file=sys.stderr)
            return None
        
        rate = data["rates"][to_currency]
        result = {
            "from": from_currency,
            "to": to_currency,
            "rate": round(float(rate), 4),
            "timestamp": datetime.datetime.now().isoformat()
        }
        print(f"[Python] ✓ Got forex: 1 {from_currency} = {rate:.2f} {to_currency}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"[Python] ✗ Forex error: {e}", file=sys.stderr)
        return None

def format_forex_summary(forex_data: Dict) -> str:
    """Format forex data for AI consumption"""
    if not forex_data:
        return ""
    f = forex_data
    return f"{f['from']}/{f['to']} Exchange Rate: {f['rate']:.4f}"

# ==================== WEB SEARCH (FREE - DuckDuckGo) ====================
# ==================== WEB SEARCH (World News API) ====================
def web_search(query: str, num_results: int = 1) -> Optional[tuple]:
    """
    Search news using World News API (comprehensive news source)
    Returns: (formatted_result_string, sources_list)
    """
    try:
        # Truncate and clean query for WorldNewsAPI (max 100 chars)
        query_clean = query.strip()
        query_clean = re.sub(r'\s+', ' ', query_clean)  # normalize whitespace
        query_clean = query_clean[:100]  # truncate to 100 chars max
        
        print(f"[Python] 🔍 News search: '{query_clean}'", file=sys.stderr)
        # Ensure API key is available
        if not WORLD_NEWS_API_KEY:
            print('[Python] ⚠️ WORLD_NEWS_API_KEY not set in environment; aborting news search', file=sys.stderr)
            return None, []

        # Initialize World News API
        configuration = worldnewsapi.Configuration(api_key={'apiKey': WORLD_NEWS_API_KEY})
        newsapi_instance = worldnewsapi.NewsApi(worldnewsapi.ApiClient(configuration))
        
        # Attempt multiple searches with backoff and broadened filters until we find results
        max_attempts = 4
        languages_to_try = ['id', '']  # prefer Indonesian, then no-language filter
        backoff = 0.5
        offset = 0
        found_sources = []
        result_text = ''

        for attempt in range(max_attempts):
            lang = languages_to_try[min(attempt, len(languages_to_try)-1)]
            try:
                print(f"[Python] Attempt {attempt+1}: searching news (lang='{lang}', offset={offset})", file=sys.stderr)
                response = newsapi_instance.search_news(
                    text=query_clean,
                    language=lang if lang else None,
                    sort="publish-time",
                    sort_direction="desc",
                    offset=offset,
                    number=min(max(1, num_results), 3)
                )
            except Exception as e:
                print(f"[Python] WorldNewsAPI call failed on attempt {attempt+1}: {e}", file=sys.stderr)
                response = None

            if response and getattr(response, 'news', None):
                news_list = response.news
                found_sources = []
                for article in news_list[:num_results]:
                    found_sources.append({
                        "title": getattr(article, 'title', '') or "News Article",
                        "description": (getattr(article, 'text', '') or getattr(article, 'summary', '') or "")[:300],
                        "url": getattr(article, 'url', '') or "",
                        "source": getattr(article, 'source', '') or "World News API",
                        "timestamp": getattr(article, 'publish_date', '') or datetime.datetime.now().isoformat()
                    })

                # Build a short summary from the first article
                first = news_list[0]
                title = getattr(first, 'title', '') or 'Latest News'
                text = (getattr(first, 'text', '') or getattr(first, 'summary', '') or '')[:300]
                source_name = getattr(first, 'source', '') or 'World News API'

                result_text = "📰 WEB SEARCH RESULTS:\n\n📰 Latest News:\n\n"
                result_text += f"📌 {title}\n"
                if text:
                    result_text += f"{text}...\n\n"
                result_text += f"🔗 Source: {source_name}"

                print(f"[Python] ✓ Found {len(found_sources)} news articles on attempt {attempt+1}", file=sys.stderr)
                return result_text, found_sources

            # Not found: increase offset and backoff then retry
            offset += 3
            wait = backoff * (2 ** attempt)
            print(f"[Python] No results on attempt {attempt+1}, sleeping {wait}s and retrying", file=sys.stderr)
            time.sleep(wait)

        # If we get here, no results found after attempts
        print(f"[Python] ⚠️ No news found for: {query} after {max_attempts} attempts", file=sys.stderr)
        return None, []
        
    except worldnewsapi.ApiException as e:
        print(f"[Python] ✗ World News API error: {e}", file=sys.stderr)
        return None, []
    except Exception as e:
        print(f"[Python] ✗ Web search error: {e}", file=sys.stderr)
        return None, []

# ==================== MAIN ORCHESTRATOR ====================
def build_finance_context(query: str) -> tuple:
    """
    Main function: analyze query and collect all relevant financial data
    Returns: (context_string, sources_list)
    
    If query contains "analisis" keyword, fetches DEEP analysis with historical data
    """
    print(f"\n[Python] Starting finance context for: '{query}'", file=sys.stderr)
    
    # Detect analysis mode (deeper search)
    is_analysis_mode = any(keyword in query.lower() for keyword in ["analisis", "analisa", "analysis", "analyze"])
    if is_analysis_mode:
        print("[Python] 🔍 ANALYSIS MODE DETECTED - Fetching deeper data", file=sys.stderr)
    
    results = []
    all_sources = []  # Track all sources
    query_lower = query.lower()
    
    # ---- WEB SEARCH (FREE) ----
    # If query contains search keywords and is NOT specifically about finance/stocks
    search_keywords = ["cari", "search", "informasi", "info", "apa itu", "bagaimana", "siapa", "kapan", "dimana", "berita", "news", "terbaru", "latest", "mengapa", "why", "kecelakaan"]
    is_search_query = any(keyword in query_lower for keyword in search_keywords)
    finance_keywords = ["btc", "bitcoin", "harga", "price", "saham", "stock", "inflasi", "ekonomi"]
    is_finance_query = any(keyword in query_lower for keyword in finance_keywords)
    
    if is_search_query and not is_finance_query:
        print("[Python] 🔍 SEARCH MODE - Using web search", file=sys.stderr)
        web_result, sources = web_search(query)
        if web_result:
            results.append(web_result)
            all_sources.extend(sources)  # Track sources
            # If web search found results, return early for pure search queries
            if len(results) > 0:
                context = "📰 WEB SEARCH RESULTS:\n" + "\n".join(results)
                print(f"[Python] ✓ Web search returned results with {len(sources)} source(s)", file=sys.stderr)
                return context, all_sources
    
    # ---- STOCKS ----
    stock_tickers = {
        "bbca": "BBCA.JK",
        "tlkm": "TLKM.JK",
        "bmri": "BMRI.JK",
        "bbri": "BBRI.JK",
        "msft": "MSFT",
        "aapl": "AAPL",
        "googl": "GOOGL",
        "tsla": "TSLA"
    }
    for keyword, ticker in stock_tickers.items():
        if keyword in query_lower:
            if is_analysis_mode:
                # Deep analysis for stocks
                stock = get_stock_analysis(ticker)
                if stock:
                    results.append(format_stock_analysis(stock))
            else:
                # Simple price for regular queries
                stock = get_stock_price(ticker)
                if stock:
                    results.append(format_stock_summary(stock))
    
    # ---- CRYPTO ----
    crypto_map = {
        "btc": "bitcoin",
        "bitcoin": "bitcoin",
        "eth": "ethereum",
        "ethereum": "ethereum",
        "doge": "dogecoin",
        "xrp": "ripple"
    }
    for keyword, crypto_id in crypto_map.items():
        if keyword in query_lower:
            crypto = get_crypto_price(crypto_id)
            if crypto:
                if is_analysis_mode:
                    # For analysis, include market cap analysis
                    market_cap_rank = crypto.get("market_cap_usd", 0) / 1e9
                    results.append(
                        f"{crypto['id'].upper()} Analysis:\n"
                        f"  Price USD: ${crypto['usd']:,.2f} | IDR: Rp{crypto['idr']:,.0f}\n"
                        f"  24h Change: {crypto['change_24h']:+.2f}%\n"
                        f"  Market Cap: ${market_cap_rank:.1f}B\n"
                        f"  Market Position: Top tier crypto asset"
                    )
                else:
                    results.append(format_crypto_summary(crypto))
    
    # ---- FOREX ----
    if any(x in query_lower for x in ["usd", "idr", "dolar", "rupiah", "forex"]):
        forex = get_forex_rate("USD", "IDR")
        if forex:
            results.append(format_forex_summary(forex))
    
    # ---- MACRO INDICATORS ----
    macro_series = {
        "inflasi": ("CPIAUCSL", "US Inflation (CPI)"),
        "suku bunga": ("FEDFUNDS", "Federal Funds Rate"),
        "fed funds": ("FEDFUNDS", "Federal Funds Rate"),
        "emas": ("GOLDAMGBD228NLBM", "Gold Price"),
        "minyak": ("DCOILWTICO", "WTI Crude Oil"),
        "gdp": ("GDP", "US GDP")
    }
    
    if is_analysis_mode:
        # In analysis mode, fetch ALL macro indicators for comprehensive view
        print("[Python] Analysis mode: fetching all macro indicators", file=sys.stderr)
        for keyword, (series_id, label) in macro_series.items():
            macro = get_macro_indicator(series_id, label)
            if macro:
                results.append(macro)
    else:
        # Regular mode: fetch only relevant indicators
        for keyword, (series_id, label) in macro_series.items():
            if keyword in query_lower:
                macro = get_macro_indicator(series_id, label)
                if macro:
                    results.append(macro)
    
    if not results:
        print("[Python] No financial data collected", file=sys.stderr)
        return "", []
    
    # ---- FORMAT OUTPUT ----
    if is_analysis_mode:
        context = "📊 DETAILED FINANCIAL ANALYSIS:\n" + "\n".join(results)
    else:
        context = "📊 LATEST FINANCIAL DATA:\n" + "\n".join(results)
    
    print(f"[Python] ✓ Collected {len(results)} data points (Analysis: {is_analysis_mode})", file=sys.stderr)
    return context, all_sources

# ==================== CLI INTERFACE ====================
if __name__ == "__main__":
    # Read query from stdin
    query = sys.stdin.read().strip()
    
    if not query:
        print(json.dumps({"success": False, "error": "No query provided"}))
        sys.exit(1)
    
    context, sources = build_finance_context(query)
    
    # Return as JSON
    print(json.dumps({
        "success": True,
        "query": query,
        "context": context,
        "sources": sources  # Include sources list
    }))
