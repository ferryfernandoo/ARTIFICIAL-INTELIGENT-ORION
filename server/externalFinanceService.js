import fetch from 'node-fetch';

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'd3cb3d84026348a483f552949b855bd9';
const FRED_API_KEY = process.env.FRED_API_KEY || '';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '48E67IPHJM3FBZ46';

// Stock tickers mapping
const tickerMap = {
  bbca: 'BBCA.JK',
  tlkm: 'TLKM.JK',
  bmri: 'BMRI.JK',
  bbri: 'BBRI.JK',
  asii: 'ASII.JK',
  adro: 'ADRO.JK',
  unvr: 'UNVR.JK',
  smgr: 'SMGR.JK',
  bumn: 'BBCA.JK',
  msft: 'MSFT',
  aapl: 'AAPL',
  googl: 'GOOGL',
  amzn: 'AMZN',
  tsla: 'TSLA',
  meta: 'META',
  nvda: 'NVDA',
};

// Crypto symbols mapping to CoinGecko IDs
const cryptoMap = {
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  eth: 'ethereum',
  ethereum: 'ethereum',
  usdt: 'tether',
  tether: 'tether',
  bnb: 'binancecoin',
  xrp: 'ripple',
  ada: 'cardano',
  sol: 'solana',
  doge: 'dogecoin',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  link: 'chainlink',
};

const macroIndicators = [
  { regex: /suku bunga|fed funds|interest rate|federal funds|bank sentral/i, series: 'FEDFUNDS', label: 'Federal Funds Rate' },
  { regex: /inflasi|cpi|consumer price index/i, series: 'CPIAUCSL', label: 'US CPI' },
  { regex: /emas|gold/i, series: 'GOLDAMGBD228NLBM', label: 'Gold Price (London Fix)' },
  { regex: /minyak|oil|wti/i, series: 'DCOILWTICO', label: 'WTI Crude Oil Price' },
  { regex: /gdp|produk domestik bruto|pdb/i, series: 'GDP', label: 'US GDP' },
];

const isMarketQuery = (query) => {
  return /ekonomi|ekonomi global|ekonomi internasional|saham|market|inflasi|suku bunga|cpi|gdp|emas|gold|oil|minyak|bank|forex|usd|dollar|idr|rupiah|btc|bitcoin|eth|ethereum|crypto|kriptokripto|usdt|harg[a]+|price|stock|saham|doge|ripple|cardano|solana|altcoin|coin|koin|twelve data|fred|openbb|alpha vantage|yahoo finance/i.test(query);
};

const extractTickers = (query) => {
  const symbols = new Set();
  const normalized = query.toLowerCase();
  for (const key of Object.keys(tickerMap)) {
    if (normalized.includes(key)) {
      symbols.add(tickerMap[key]);
    }
  }

  const regex = /\b([A-Z]{2,5}\.JK)\b/g;
  let match;
  while ((match = regex.exec(query)) !== null) {
    symbols.add(match[1]);
  }

  return Array.from(symbols);
};

// Extract crypto symbols from query
const extractCryptos = (query) => {
  const cryptos = new Set();
  const normalized = query.toLowerCase();
  console.log(`[Crypto] Searching in query: "${query}"`);
  console.log(`[Crypto] Normalized: "${normalized}"`);
  
  // Method 1: Direct key matching
  for (const key of Object.keys(cryptoMap)) {
    if (normalized.includes(key)) {
      cryptos.add(cryptoMap[key]);
      console.log(`[Crypto] ✓ Method1 Matched: ${key} -> ${cryptoMap[key]}`);
    }
  }
  
  // Method 2: Fallback pattern - look for price-related query with common crypto mention
  // Pattern: "harga/price/berapa [word] [currency]"
  const pricePatterns = [
    /(?:harga|price|berapa|kurs)\s+(\w+)\s*(?:dalam|in)?\s*(?:idr|usd|rupiah|dolar|dollar)/i,
    /(\w+)\s+(?:harga|price|berapa)\s+(?:dalam|in)?\s*(?:idr|usd|rupiah|dolar|dollar)/i,
    /(?:idr|usd|rupiah|dolar|dollar)\s+untuk\s+(\w+)/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const word = match[1].toLowerCase();
      // Check if matched word is in our crypto map
      if (cryptoMap[word]) {
        cryptos.add(cryptoMap[word]);
        console.log(`[Crypto] ✓ Method2 Pattern Matched: ${word} -> ${cryptoMap[word]}`);
      }
    }
  }
  
  console.log(`[Crypto] Final detected cryptos: ${Array.from(cryptos).join(', ') || '(none)'}`);
  return Array.from(cryptos);
};

const fetchYahooQuote = async (symbol) => {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed for ${symbol}`);
  }
  const data = await response.json();
  const quote = data?.quoteResponse?.result?.[0];
  if (!quote) {
    throw new Error(`No Yahoo quote result for ${symbol}`);
  }
  return quote;
};

// Fetch crypto price from CoinGecko (free, no API key needed)
const fetchCryptoPrice = async (cryptoId) => {
  console.log(`[Crypto] Fetching price for ${cryptoId} from CoinGecko...`);
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(cryptoId)}&vs_currencies=usd,idr&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`CoinGecko request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data[cryptoId]) {
      throw new Error(`No crypto price data for ${cryptoId}`);
    }
    
    console.log(`[Crypto] ✓ Successfully fetched ${cryptoId} from CoinGecko`);
    return { id: cryptoId, ...data[cryptoId] };
  } catch (error) {
    console.error(`[Crypto] ✗ CoinGecko failed for ${cryptoId}: ${error.message}`);
    
    // Fallback: Try Alpha Vantage
    if (ALPHA_VANTAGE_API_KEY && cryptoId === 'bitcoin') {
      console.log(`[Crypto] Trying Alpha Vantage fallback for ${cryptoId}...`);
      try {
        // Map crypto IDs to Alpha Vantage symbols
        const cryptoSymbols = {
          bitcoin: 'BTC',
          ethereum: 'ETH',
          litecoin: 'LTC',
          dogecoin: 'DOGE',
          ripple: 'XRP',
          cardano: 'ADA',
        };
        
        const symbol = cryptoSymbols[cryptoId] || 'BTC';
        const avUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
        const avResponse = await fetch(avUrl);
        const avData = await avResponse.json();
        
        if (avData['Realtime Currency Exchange Rate']) {
          const rate = avData['Realtime Currency Exchange Rate'];
          console.log(`[Crypto] ✓ Got ${cryptoId} from Alpha Vantage`);
          return {
            id: cryptoId,
            usd: parseFloat(rate['5. Exchange Rate']) || 0,
            idr: (parseFloat(rate['5. Exchange Rate']) * 16000) || 0, // Rough conversion
            usd_24h_change: 0, // Alpha Vantage doesn't provide 24h change in free tier
            usd_market_cap: 0,
          };
        }
      } catch (avError) {
        console.error(`[Crypto] ✗ Alpha Vantage also failed: ${avError.message}`);
      }
    }
    
    throw new Error(`Unable to fetch crypto price for ${cryptoId} from all sources`);
  }
};

// Fetch forex rate (using exchangerate-api free tier or similar)
const fetchForexRate = async (fromCurrency, toCurrency) => {
  const url = `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(fromCurrency)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Exchange rate request failed for ${fromCurrency}`);
  }
  const data = await response.json();
  if (!data.rates || !data.rates[toCurrency]) {
    throw new Error(`No rate for ${fromCurrency}/${toCurrency}`);
  }
  return {
    from: fromCurrency,
    to: toCurrency,
    rate: data.rates[toCurrency],
    timestamp: data.time_last_updated
  };
};

const fetchTwelveQuote = async (symbol) => {
  if (!TWELVE_DATA_API_KEY) {
    throw new Error('Missing TWELVE_DATA_API_KEY');
  }

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (response.status !== 200 || data.status === 'error' || data.code) {
    throw new Error(data.message || `Twelve Data quote failed for ${symbol}`);
  }

  return data;
};

const fetchFredSeries = async (seriesId, start, end) => {
  if (!FRED_API_KEY) {
    throw new Error('Missing FRED_API_KEY');
  }

  const range = `&observation_start=${encodeURIComponent(start)}&observation_end=${encodeURIComponent(end)}`;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}${range}&api_key=${encodeURIComponent(FRED_API_KEY)}&file_type=json`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `FRED request failed for ${seriesId}`);
  }

  return data;
};

const formatQuoteSummary = (quote, source = 'Yahoo Finance') => {
  const name = quote.longName || quote.shortName || quote.name || quote.symbol;
  const close = quote.regularMarketPrice ?? quote.close ?? quote.previous_close;
  const open = quote.regularMarketOpen ?? quote.open;
  const high = quote.regularMarketDayHigh ?? quote.high;
  const low = quote.regularMarketDayLow ?? quote.low;
  const previousClose = quote.regularMarketPreviousClose ?? quote.previous_close;
  const change = quote.regularMarketChange ?? quote.change;
  const changePercent = quote.regularMarketChangePercent ?? quote.change_percent;

  return `Latest price data from ${source} for ${name} (${quote.symbol}):\n` +
    `- Last price: ${close ?? 'N/A'}\n` +
    `- Open: ${open ?? 'N/A'} | High: ${high ?? 'N/A'} | Low: ${low ?? 'N/A'}\n` +
    `- Previous close: ${previousClose ?? 'N/A'}\n` +
    `- Change: ${change ?? 'N/A'} (${changePercent ?? 'N/A'}%)\n`;
};

// Format crypto price summary
const formatCryptoSummary = (crypto) => {
  const id = crypto.id;
  const usd = crypto.usd ?? 'N/A';
  const idr = crypto.idr ?? 'N/A';
  const change24h = crypto.usd_24h_change ?? 'N/A';
  const marketCap = crypto.usd_market_cap ?? 'N/A';
  
  return `${id.toUpperCase()} Price:\n` +
    `- Price USD: $${typeof usd === 'number' ? usd.toLocaleString() : usd}\n` +
    `- Price IDR: Rp${typeof idr === 'number' ? Math.round(idr).toLocaleString('id-ID') : idr}\n` +
    `- 24h Change: ${typeof change24h === 'number' ? change24h.toFixed(2) : change24h}%\n` +
    `- Market Cap USD: $${typeof marketCap === 'number' ? (marketCap / 1e9).toFixed(2) : marketCap}B\n`;
};

// Format forex rate summary
const formatForexSummary = (forexData) => {
  return `${forexData.from}/${forexData.to} Exchange Rate: ${forexData.rate.toFixed(2)}`;
};

const formatFredSummary = (seriesId, label, observations) => {
  const latest = observations?.filter((item) => item.value !== '.')?.slice(-1)[0];
  if (!latest) return null;
  const value = latest.value;
  const date = latest.date;
  return `${label} (${seriesId}) as of ${date}: ${value}`;
};

const buildFinanceContext = async (query) => {
  console.log(`\n[Finance] buildFinanceContext called with query: "${query}"`);
  const needsMarket = isMarketQuery(query);
  console.log(`[Finance] isMarketQuery result: ${needsMarket}`);
  if (!needsMarket) {
    console.log('[Finance] Not a market query, returning empty');
    return '';
  }

  const lines = [];
  console.log('[Finance] Starting data collection...');
  
  // Fetch stock tickers
  const tickers = extractTickers(query);
  console.log(`[Finance] Extracted tickers: ${tickers.join(', ') || 'none'}`);
  for (const symbol of tickers) {
    try {
      const yahooQuote = await fetchYahooQuote(symbol);
      lines.push(formatQuoteSummary(yahooQuote, 'Yahoo Finance'));
    } catch {
      try {
        const twelveQuote = await fetchTwelveQuote(symbol);
        lines.push(formatQuoteSummary(twelveQuote, 'Twelve Data'));
      } catch {
        console.warn(`Failed to retrieve quote for ${symbol}`);
      }
    }
  }

  // Fetch crypto prices
  const cryptos = extractCryptos(query);
  console.log(`[Finance] Extracted cryptos: ${cryptos.join(', ') || 'none'}`);
  for (const cryptoId of cryptos) {
    try {
      console.log(`[Finance] Fetching crypto price for ${cryptoId}...`);
      const cryptoData = await fetchCryptoPrice(cryptoId);
      console.log(`[Finance] ✓ Got crypto data for ${cryptoId}`);
      lines.push(formatCryptoSummary(cryptoData));
    } catch (error) {
      console.warn(`[Finance] ✗ Unable to fetch crypto price for ${cryptoId}: ${error.message}`);
    }
  }

  // Fetch forex rates if query mentions currency pairs
  const forexPatterns = [
    { pattern: /usd.*idr|idr.*usd|dolar.*rupiah|rupiah.*dolar/i, from: 'USD', to: 'IDR' },
    { pattern: /eur.*usd|usd.*eur|euro.*dolar|dolar.*euro/i, from: 'EUR', to: 'USD' },
    { pattern: /gbp.*usd|usd.*gbp|pound.*dolar|dolar.*pound/i, from: 'GBP', to: 'USD' },
    { pattern: /jpy.*usd|usd.*jpy/i, from: 'JPY', to: 'USD' },
  ];
  
  for (const forexPair of forexPatterns) {
    if (forexPair.pattern.test(query)) {
      try {
        const forexData = await fetchForexRate(forexPair.from, forexPair.to);
        lines.push(formatForexSummary(forexData));
      } catch (error) {
        console.warn(`Unable to fetch forex rate ${forexPair.from}/${forexPair.to}: ${error.message}`);
      }
    }
  }

  const now = new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const genericEconomyQuery = /\bekonomi\b|ekonomi hari ini|ekonomi terkini|ekonomi global|ekonomi sekarang|pasar hari ini|market hari ini/i.test(query);
  let matchedIndicators = macroIndicators.filter((indicator) => indicator.regex.test(query));
  if (matchedIndicators.length === 0 && genericEconomyQuery) {
    matchedIndicators = macroIndicators;
  }

  for (const indicator of matchedIndicators) {
    try {
      const fredData = await fetchFredSeries(indicator.series, startDate, endDate);
      const summary = formatFredSummary(indicator.series, indicator.label, fredData.observations);
      if (summary) {
        lines.push(summary);
      }
    } catch (error) {
      console.warn(`Unable to fetch macro indicator ${indicator.label}: ${error.message}`);
    }
  }

  // Only return context if we actually collected real data
  if (lines.length === 0) {
    console.log('[Finance] ⚠️ No data collected, returning empty string');
    return '';
  }

  const context = `LATEST MARKET DATA CONTEXT:\n${lines.join('\n')}`;
  console.log(`[Finance] ✓ Collected ${lines.length} data points, returning context (${context.length} chars)`);
  return context;
};

export default {
  buildFinanceContext,
  fetchYahooQuote,
  fetchTwelveQuote,
  fetchFredSeries,
  fetchCryptoPrice,
  fetchForexRate,
  extractCryptos,
  isMarketQuery,
};
