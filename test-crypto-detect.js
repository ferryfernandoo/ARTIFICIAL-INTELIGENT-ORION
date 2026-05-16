#!/usr/bin/env node

// Quick test for crypto detection logic
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
      console.log(`[Crypto] Pattern matched word: "${word}"`);
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

// Test cases
console.log('=== Testing Crypto Detection ===\n');

const testQueries = [
  'harga btc',
  'harga btc idr',
  'bitcoin harga berapa',
  'btc dalam idr',
  'eth price',
  'ethereum kurs',
  'doge coin',
  'ripple xrp',
  'what is the price of bitcoin',
  'btc eth doge',
  'saham bbca',
  'ekonomi hari ini',
  'harga doge dalam idr',
  'berapa harga eth usd',
];

testQueries.forEach(q => {
  extractCryptos(q);
  console.log('---');
});
