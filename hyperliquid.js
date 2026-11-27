/* HyperStocks — Hyperliquid Public HIP-3 Market Data & WebSocket Client (No Login Required) */
(function (global) {
  const HS = (global.HS = global.HS || {});

const INFO_URL = 'https://api.hyperliquid.xyz/info';
const WS_URL = 'wss://api.hyperliquid.xyz/ws';

const DEX_LABELS = {
  xyz: 'Trade.xyz',
  flx: 'Felix',
  vntl: 'Ventuals',
  km: 'Kinetiq',
  cash: 'Dreamcash',
  para: 'Paragon',
  mkts: 'Kinetiq Mkts',
  io: 'EntropyIO',
  hyna: 'HyENA',
  spot: 'Crypto Spot',
};

const SPOT_COIN_TICKER_MAP = {
  '@142': 'BTC',
  '@151': 'ETH',
  '@156': 'SOL',
};

const MAG7_PERP_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'];

function resolveCoinTicker(coin) {
  const raw = String(coin || '').trim();
  if (SPOT_COIN_TICKER_MAP[raw]) return SPOT_COIN_TICKER_MAP[raw];
  return (raw.includes(':') ? raw.split(':')[1] : raw).toUpperCase();
}

const COMPANY_NAMES = {
  // Mega-cap US Tech & AI
  NVDA: 'NVIDIA Corp.',
  TSLA: 'Tesla, Inc.',
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corp.',
  AMZN: 'Amazon.com, Inc.',
  GOOGL: 'Alphabet Inc.',
  META: 'Meta Platforms',
  AMD: 'Advanced Micro Devices',
  AVGO: 'Broadcom Inc.',
  ARM: 'Arm Holdings',
  ASML: 'ASML Holding',
  AMAT: 'Applied Materials',
  LRCX: 'Lam Research',
  INTC: 'Intel Corp.',
  MU: 'Micron Technology',
  MRVL: 'Marvell Technology',
  QCOM: 'Qualcomm Inc.',
  TSM: 'TSMC (Taiwan Semi)',
  SMCI: 'Super Micro Computer',
  SNDK: 'SanDisk Corp.',
  WDC: 'Western Digital',
  STX: 'Seagate Technology',
  DELL: 'Dell Technologies',
  IBM: 'IBM Corp.',
  ORCL: 'Oracle Corp.',
  PLTR: 'Palantir Technologies',
  CRWD: 'CrowdStrike',
  PANW: 'Palo Alto Networks',
  SNOW: 'Snowflake Inc.',
  NET: 'Cloudflare, Inc.',
  NOW: 'ServiceNow, Inc.',
  NFLX: 'Netflix, Inc.',
  RDDT: 'Reddit, Inc.',
  SNAP: 'Snap Inc.',
  ZM: 'Zoom Communications',
  BB: 'BlackBerry Ltd.',
  TTWO: 'Take-Two Interactive',
  ACN: 'Accenture plc',
  GLW: 'Corning Inc.',
  TER: 'Teradyne, Inc.',
  COHR: 'Coherent Corp.',
  CIEN: 'Ciena Corp.',
  CRDO: 'Credo Technology',
  AAOI: 'Applied Optoelectronics',
  LITE: 'Lumentum Holdings',
  IONQ: 'IonQ, Inc.',
  NBIS: 'Nebius Group',
  CRWV: 'CoreWeave, Inc.',
  IREN: 'IREN Limited',
  CIFR: 'Cipher Mining',
  VST: 'Vistra Corp.',
  GEV: 'GE Vernova',
  BE: 'Bloom Energy',
  USAR: 'USA Rare Earth',
  // Crypto-adjacent & FinTech Equities
  COIN: 'Coinbase Global',
  HOOD: 'Robinhood Markets',
  MSTR: 'Strategy (MicroStrategy)',
  STRC: 'Strategy Stretch Pref.',
  CRCL: 'Circle Internet Group',
  SOFI: 'SoFi Technologies',
  NU: 'Nu Holdings',
  MELI: 'MercadoLibre',
  BX: 'Blackstone Inc.',
  ICE: 'Intercontinental Exchange',
  BMNR: 'BitMine Immersion',
  // Consumer, Health, Auto, Space, Retail
  COST: 'Costco Wholesale',
  LLY: 'Eli Lilly & Co.',
  MRNA: 'Moderna, Inc.',
  HIMS: 'Hims & Hers Health',
  TWST: 'Twist Bioscience',
  CVX: 'Chevron Corp.',
  RIVN: 'Rivian Automotive',
  RKLB: 'Rocket Lab USA',
  GME: 'GameStop Corp.',
  DKNG: 'DraftKings Inc.',
  EBAY: 'eBay Inc.',
  CAR: 'Avis Budget Group',
  GPRO: 'GoPro, Inc.',
  BIRD: 'Allbirds, Inc.',
  RTX: 'RTX Corp.',
  NOK: 'Nokia Corp.',
  UMC: 'United Microelectronics',
  // International / Asia Equities
  BABA: 'Alibaba Group',
  TCNT: 'Tencent Holdings',
  TENCENT: 'Tencent Holdings',
  XIAOMI: 'Xiaomi Corp.',
  SKHX: 'SK Hynix',
  SKHY: 'SK Hynix (ADR)',
  SMSN: 'Samsung Electronics',
  KIOXIA: 'Kioxia Holdings',
  SOFTBANK: 'SoftBank Group',
  HYUNDAI: 'Hyundai Motor',
  IBIDEN: 'Ibiden Co.',
  RELIANCE: 'Reliance Industries',
  JIO: 'Jio Platforms',
  CATL: 'CATL (Contemporary Amperex)',
  GIGADEV: 'GigaDevice Semiconductor',
  INNOLIGHT: 'Zhongji Innolight',
  AMEC: 'AMEC Semiconductor',
  NAVER: 'NAVER Corp.',
  // Recent 2026 IPOs & Pre-IPO / Private Equity Perps
  ANT: 'Anthropic PBC (NASDAQ: ANT)',
  ANTH: 'Anthropic PBC',
  ANTHROPIC: 'Anthropic PBC (Valuation)',
  OAI: 'OpenAI (Pre-IPO)',
  OPENAI: 'OpenAI (Pre-IPO)',
  SPCX: 'SpaceX (NASDAQ: SPCX)',
  SPACEX: 'SpaceX (Valuation)',
  CBRS: 'Cerebras Systems (NASDAQ: CBRS)',
  UNITREE: 'Unitree Robotics (Pre-IPO)',
  SHEIN: 'SHEIN (Pre-IPO)',
  OURA: 'Oura Health (Pre-IPO)',
  MINIMAX: 'MiniMax AI (Pre-IPO)',
  ZHIPU: 'Zhipu AI (Pre-IPO)',
  MOONSHOT: 'Moonshot AI / Kimi (Pre-IPO)',
  CAMBRICON: 'Cambricon Technologies',
  YMTC: 'YMTC Memory (Pre-IPO)',
  CXMT: 'CXMT Memory (Pre-IPO)',
  // Equity Indices & ETFs
  XYZ100: 'Nasdaq 100 Proxy',
  SP500: 'S&P 500 Index',
  US500: 'S&P 500 Index',
  USA500: 'S&P 500 Index',
  USTECH: 'US Tech 100 Index',
  USA100: 'Nasdaq 100 Index',
  SMALL2000: 'Russell 2000 Index',
  MAG7: 'Magnificent 7 Index',
  MAGS: 'Magnificent 7 ETF',
  SOXL: '3x Semis Bull ETF',
  SMH: 'VanEck Semiconductor ETF',
  MUU: '2x Micron Bull ETF',
  NVDL: '2x NVIDIA Bull ETF',
  SNXX: 'Tradr 2x Long SNDK ETF',
  SHAZ: 'SharonAI Holdings Inc.',
  KSTR: 'KraneShares STAR 50 ETF',
  NCLD: 'Roundhill Neocloud ETF',
  PURRDAT: 'Hyperliquid Strategies (PURR)',
  LYTE: 'Lyte RWA Basket',
  BOT: 'AI & Robotics Basket',
  QNT: 'Quant Network',
  TOTAL2: 'Crypto Market Cap (ex-BTC)',
  OTHERS: 'Altcoin Market Cap (ex-Top 10)',
  PRL: 'PRL On-Chain Index',
  SEMIS: 'Semiconductors Basket',
  SEMI: 'Semiconductors Index',
  INFOTECH: 'InfoTech Sector Index',
  BIOTECH: 'Biotech Sector Index',
  DEFENSE: 'Defense Sector Index',
  ENERGY: 'Energy Sector Index',
  USENERGY: 'US Energy Sector Index',
  NUCLEAR: 'Nuclear Sector Index',
  ROBOT: 'Robotics Index',
  IGV: 'Software Sector ETF',
  XLE: 'Energy Select ETF',
  XBI: 'SPDR Biotech ETF',
  GDX: 'Gold Miners ETF',
  GLDMINE: 'Gold Miners Index',
  GOLDJM: 'Junior Gold Miners Index',
  SILVERJM: 'Junior Silver Miners Index',
  URNM: 'Uranium Miners ETF',
  TLT: '20+ Yr Treasury ETF',
  EWY: 'South Korea ETF',
  EWJ: 'Japan ETF',
  EWT: 'Taiwan ETF',
  EWZ: 'Brazil ETF',
  KWEB: 'China Internet ETF',
  KORU: '3x South Korea ETF',
  JP225: 'Nikkei 225 Index',
  JPN225: 'Nikkei 225 Index',
  KR200: 'KOSPI 200 Index',
  NIFTY: 'Nifty 50 Index',
  IBOV: 'Ibovespa Index',
  // Commodities / FX / Rates
  GOLD: 'Gold Spot',
  SILVER: 'Silver Spot',
  CL: 'WTI Crude Oil',
  OIL: 'Crude Oil',
  USOIL: 'WTI Crude Oil',
  WTI: 'WTI Crude Oil',
  BRENTOIL: 'Brent Crude Oil',
  NATGAS: 'Natural Gas',
  GAS: 'Natural Gas',
  COPPER: 'Copper',
  ALUMINIUM: 'Aluminium',
  PLATINUM: 'Platinum',
  PALLADIUM: 'Palladium',
  URANIUM: 'Uranium',
  CORN: 'Corn Futures',
  WHEAT: 'Wheat Futures',
  SOY: 'Soybeans Futures',
  HO: 'Heating Oil Futures',
  TTF: 'European Natural Gas (TTF)',
  DRAM: 'DRAM Memory Spot Index',
  H100: 'H100 GPU Compute Index',
  EUR: 'Euro / USD',
  GBP: 'British Pound / USD',
  JPY: 'Japanese Yen',
  KRW: 'Korean Won',
  DXY: 'US Dollar Index',
  VIX: 'CBOE Volatility Index',
  BVIV: 'Bitcoin Vol Index',
  '10Y': 'US 10Y Treasury Yield',
  '2Y': 'US 2Y Treasury Yield',
  '30Y': 'US 30Y Treasury Yield',
  USBOND: 'US Treasury Bond',
  // Top 5 Cryptocurrencies (Spot)
  BTC: 'Bitcoin (Spot)',
  ETH: 'Ethereum (Spot)',
  SOL: 'Solana (Spot)',
  BNB: 'BNB (Spot)',
  XRP: 'XRP (Spot)',
};

const COMMODITY_FX_SET = new Set([
  'GOLD', 'SILVER', 'CL', 'OIL', 'USOIL', 'WTI', 'BRENTOIL', 'NATGAS', 'GAS', 'COPPER',
  'ALUMINIUM', 'PLATINUM', 'PALLADIUM', 'URANIUM', 'CORN', 'WHEAT', 'SOY', 'HO', 'TTF',
  'EUR', 'GBP', 'JPY', 'KRW', 'DXY', 'CHF', 'AUD', 'CAD', 'CNY',
  '10Y', '2Y', '30Y', 'USBOND', 'VIX', 'BVIV', 'VOL', 'DRAM', 'H100',
]);

const CRYPTO_SET = new Set([
  'BTC', 'ETH', 'SOL', 'HYPE', 'HYPE2', 'DOGE', 'ADA', 'BCH', 'BNB', 'ENA', 'FARTCOIN',
  'IP', 'BASED', 'XRP', 'AVAX', 'LINK', 'SUI', 'AAVE', 'UNI', 'ARB', 'OP',
  'WIF', 'PEPE', '1000PEPE', 'BONK', 'LTC', 'TON', 'NEAR', 'APT', 'TIA', 'SEI', 'PENDLE',
  'BTCD', 'TOTAL2', 'OTHERS', 'PUMP', 'TRUMP', 'MELANIA', 'PENGU', 'VIRTUAL',
  'PURR', 'JEFF', 'LDO', 'MKR', 'CRV', 'ATOM', 'DOT', 'TRX', 'SHIB', 'XLM',
  'XMR', 'ZEC', 'LIT', 'XPL', 'LIGHTER', 'USDE', 'QNT', 'ANSEM', 'TREAD', 'DRV', 'PAPER', 'SBE',
]);

function classifyAsset(ticker, dexName) {
  const t = ticker.toUpperCase();
  if (COMMODITY_FX_SET.has(t)) return 'commodity_fx';
  if (CRYPTO_SET.has(t) || dexName === 'hyna') return 'crypto';
  return 'stock';
}

function getCompanyName(ticker) {
  const t = ticker.toUpperCase();
  return COMPANY_NAMES[t] || '';
}

const hasNativeBridge = () =>
  Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hlInfo);

const isLocalServerHost = () =>
  !window.HS_STATIC_WEB &&
  window.location.protocol === 'http:' &&
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

const getWebApiBase = () => {
  const raw = typeof window.HS_WEB_API_BASE === 'string' ? window.HS_WEB_API_BASE.trim() : '';
  return raw ? raw.replace(/\/+$/, '') : '';
};

const HL_MAX_CONCURRENT = 4;
let hlInFlightCount = 0;
const hlPendingQueue = [];
let hlCooldownUntil = 0;

function hlSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function acquireHlSlot() {
  if (hlInFlightCount < HL_MAX_CONCURRENT) {
    hlInFlightCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => hlPendingQueue.push(resolve));
}

function releaseHlSlot() {
  const next = hlPendingQueue.shift();
  if (next) next();
  else hlInFlightCount = Math.max(0, hlInFlightCount - 1);
}

async function hlInfoRaw(body) {
  if (hasNativeBridge()) {
    const res = await window.webkit.messageHandlers.hlInfo.postMessage(body);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Hyperliquid API request failed');
    }
    return JSON.parse(res.raw);
  }
  const url = isLocalServerHost() ? '/api/hl-info' : INFO_URL;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}

async function hlInfo(payload) {
  const body = JSON.stringify(payload);
  const maxAttempts = 5;
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    if (hlCooldownUntil > now) {
      await hlSleep(hlCooldownUntil - now);
    }
    await acquireHlSlot();
    let released = false;
    const releaseOnce = () => {
      if (!released) {
        released = true;
        releaseHlSlot();
      }
    };
    try {
      return await hlInfoRaw(body);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      const isRateLimit = msg.includes('429');
      const isRetryable = isRateLimit || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('fetch failed') || msg.includes('Network');
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw err;
      }
      const baseDelay = isRateLimit ? 750 * Math.pow(2, attempt) : 350 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 300);
      const waitMs = baseDelay + jitter;
      if (isRateLimit) {
        hlCooldownUntil = Math.max(hlCooldownUntil, Date.now() + Math.min(3500, waitMs));
      }
      releaseOnce();
      await hlSleep(waitMs);
    } finally {
      releaseOnce();
    }
  }
  throw lastErr || new Error('Hyperliquid API request failed');
}

async function loadNativePrefs() {
  if (window.webkit?.messageHandlers?.hlPrefs) {
    try {
      const res = await window.webkit.messageHandlers.hlPrefs.postMessage({ op: 'get' });
      if (res?.ok && res.raw) return JSON.parse(res.raw);
    } catch (_) {}
  } else if (isLocalServerHost()) {
    try {
      const resp = await fetch('/api/prefs');
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch (_) {}
  }
  try {
    const raw = localStorage.getItem('HyperStocksPrefsV1');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

async function saveNativePrefs(obj) {
  const raw = JSON.stringify(obj);
  try {
    localStorage.setItem('HyperStocksPrefsV1', raw);
  } catch (_) {}
  if (window.webkit?.messageHandlers?.hlPrefs) {
    try {
      await window.webkit.messageHandlers.hlPrefs.postMessage({ op: 'set', raw });
    } catch (_) {}
  } else if (isLocalServerHost()) {
    try {
      await fetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });
    } catch (_) {}
  }
}

function playAlertSound() {
  if (window.webkit?.messageHandlers?.hlAlert) {
    window.webkit.messageHandlers.hlAlert.postMessage({ sound: true });
    return;
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (_) {}
}

function startWindowDrag() {
  if (window.webkit?.messageHandlers?.hlDragWindow) {
    window.webkit.messageHandlers.hlDragWindow.postMessage({});
  }
}

// Unified WebSocket Client (Native URLSessionWebSocketTask in .app, browser WebSocket fallback)
class HyperliquidWSClient {
  constructor() {
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.refCounts = new Map(); // canonicalKey -> { count, subStr }
    this.browserWs = null;
    this.browserPing = null;
    this.browserReconnect = null;
    this.state = 'connecting';
    this.latencyMs = null;

    // Hook global callbacks invoked by Swift
    window.__hlWsMessage = (raw) => this._handleRawMessage(raw);
    window.__hlWsStatus = (state, latency) => {
      this.state = state;
      this.latencyMs = latency;
      for (const fn of this.statusListeners) fn(state, latency);
    };
  }

  connect() {
    if (window.webkit?.messageHandlers?.hlWs) {
      window.webkit.messageHandlers.hlWs.postMessage({ action: 'connect' });
    } else {
      this._connectBrowserWs();
    }
  }

  reconnect() {
    if (window.webkit?.messageHandlers?.hlWs) {
      window.webkit.messageHandlers.hlWs.postMessage({ action: 'reconnect' });
    } else {
      this._connectBrowserWs(true);
    }
  }

  onMessage(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.state, this.latencyMs);
    return () => this.statusListeners.delete(fn);
  }

  subscribe(subscription) {
    const subStr = JSON.stringify(subscription);
    const key = subStr;
    const entry = this.refCounts.get(key);
    if (entry) {
      entry.count += 1;
      return key;
    }
    this.refCounts.set(key, { count: 1, subStr });
    if (window.webkit?.messageHandlers?.hlWs) {
      window.webkit.messageHandlers.hlWs.postMessage({ action: 'subscribe', key, sub: subStr });
    } else if (this.browserWs && this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.send(`{"method":"subscribe","subscription":${subStr}}`);
    }
    return key;
  }

  unsubscribe(key) {
    if (!key) return;
    const entry = this.refCounts.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count > 0) return;
    this.refCounts.delete(key);
    if (window.webkit?.messageHandlers?.hlWs) {
      window.webkit.messageHandlers.hlWs.postMessage({ action: 'unsubscribe', key, sub: entry.subStr });
    } else if (this.browserWs && this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.send(`{"method":"unsubscribe","subscription":${entry.subStr}}`);
    }
  }

  _handleRawMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (_) {
      return;
    }
    for (const fn of this.listeners) {
      try {
        fn(msg);
      } catch (err) {
        console.error('WS listener error:', err);
      }
    }
  }

  _connectBrowserWs(force = false) {
    if (force && this.browserWs) {
      try { this.browserWs.close(); } catch (_) {}
      this.browserWs = null;
    }
    if (this.browserWs && (this.browserWs.readyState === WebSocket.OPEN || this.browserWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    clearTimeout(this.browserReconnect);
    clearInterval(this.browserPing);
    window.__hlWsStatus('connecting', this.latencyMs);

    const ws = new WebSocket(WS_URL);
    this.browserWs = ws;
    let lastPing = 0;

    ws.onopen = () => {
      window.__hlWsStatus('connected', this.latencyMs);
      for (const { subStr } of this.refCounts.values()) {
        ws.send(`{"method":"subscribe","subscription":${subStr}}`);
      }
      lastPing = Date.now();
      ws.send('{"method":"ping"}');
      this.browserPing = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          lastPing = Date.now();
          ws.send('{"method":"ping"}');
        }
      }, 25000);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string' && ev.data.includes('"channel":"pong"')) {
        if (lastPing) {
          window.__hlWsStatus('connected', Math.max(1, Date.now() - lastPing));
        }
        return;
      }
      this._handleRawMessage(ev.data);
    };

    ws.onclose = () => {
      clearInterval(this.browserPing);
      window.__hlWsStatus('reconnecting', this.latencyMs);
      this.browserReconnect = setTimeout(() => this._connectBrowserWs(), 2000);
    };

    ws.onerror = () => {
      try { ws.close(); } catch (_) {}
    };
  }
}

const STEP_SPLIT_FACTORS = [4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 50];

function matchStepSplitFactor(prevPx, curPx) {
  if (!Number.isFinite(prevPx) || !Number.isFinite(curPx) || prevPx <= 0 || curPx <= 0) return 1;
  const ratio = prevPx / curPx;
  if (ratio >= 3.5) {
    let best = 1;
    let bestErr = Infinity;
    for (const k of STEP_SPLIT_FACTORS) {
      const err = Math.abs(ratio - k) / k;
      if (err < bestErr) { bestErr = err; best = k; }
    }
    return bestErr <= 0.14 ? best : 1;
  }
  if (ratio <= 1 / 3.5) {
    const inv = curPx / prevPx;
    let best = 1;
    let bestErr = Infinity;
    for (const k of STEP_SPLIT_FACTORS) {
      const err = Math.abs(inv - k) / k;
      if (err < bestErr) { bestErr = err; best = k; }
    }
    return bestErr <= 0.14 ? 1 / best : 1;
  }
  return 1;
}

function normalizeSplitPrevDayPx(prevDayPx, price, category) {
  if (category !== 'stock') return prevDayPx;
  if (!Number.isFinite(prevDayPx) || !Number.isFinite(price) || prevDayPx <= 0 || price <= 0) return prevDayPx;
  const k = matchStepSplitFactor(prevDayPx, price);
  return k !== 1 ? prevDayPx / k : prevDayPx;
}

function normalizeIntraSeriesSplits(candles, category = 'stock') {
  if (category !== 'stock' || !Array.isArray(candles) || candles.length === 0) return candles;
  const out = candles.map((c) => ({ ...c }));

  // 1. Clean any single bar that opened pre-split and closed post-split (removes giant split-day wick)
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const kBar = matchStepSplitFactor(c.o, c.c);
    if (kBar > 1 && c.l < c.o / (kBar * 0.75)) {
      c.o = c.o / kBar;
      c.h = Math.max(c.h / kBar, c.o, c.c);
      c.l = Math.min(c.l, c.o, c.c);
    }
  }

  // 2. Scan backwards from latest bar and adjust all earlier bars across any corporate split discontinuity
  for (let i = out.length - 1; i >= 1; i--) {
    const k = matchStepSplitFactor(out[i - 1].c, out[i].c);
    if (k !== 1) {
      for (let j = 0; j < i; j++) {
        out[j].o /= k;
        out[j].h /= k;
        out[j].l /= k;
        out[j].c /= k;
        out[j].v *= k;
      }
    }
  }
  return out;
}

async function fetchAllHip3Markets() {
  const [dexsRaw, spotRaw, mainPerpRaw] = await Promise.all([
    hlInfo({ type: 'perpDexs' }),
    hlInfo({ type: 'spotMetaAndAssetCtxs' }).catch(() => null),
    hlInfo({ type: 'metaAndAssetCtxs' }).catch(() => null),
  ]);
  const dexs = (Array.isArray(dexsRaw) ? dexsRaw : [])
    .filter((d) => d && typeof d.name === 'string' && d.name.length > 0)
    .filter((d) => !d.assetToStreamingOiCap || d.assetToStreamingOiCap.length > 0);

  const results = await Promise.allSettled(
    dexs.map(async (d) => {
      const resp = await hlInfo({ type: 'metaAndAssetCtxs', dex: d.name });
      return { dex: d, resp };
    })
  );

  const markets = [];
  const activeDexs = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { dex, resp } = r.value;
    if (!Array.isArray(resp) || resp.length < 2) continue;
    const meta = resp[0];
    const ctxs = resp[1];
    const universe = meta?.universe || [];
    if (universe.length === 0) continue;

    activeDexs.push({
      name: dex.name,
      fullName: DEX_LABELS[dex.name] || dex.fullName || dex.name.toUpperCase(),
      count: universe.length,
    });

    for (let i = 0; i < universe.length; i++) {
      const u = universe[i];
      const ctx = ctxs[i] || {};
      if (!u || !u.name) continue;
      const fullId = u.name.includes(':') ? u.name : `${dex.name}:${u.name}`;
      const ticker = fullId.includes(':') ? fullId.split(':')[1] : fullId;
      const markPx = parseFloat(ctx.markPx);
      const midPx = ctx.midPx !== null && ctx.midPx !== undefined ? parseFloat(ctx.midPx) : NaN;
      const oraclePx = parseFloat(ctx.oraclePx);
      const category = classifyAsset(ticker, dex.name);
      const rawPrevDayPx = parseFloat(ctx.prevDayPx);
      const price = Number.isFinite(midPx) ? midPx : (Number.isFinite(markPx) ? markPx : oraclePx);
      if (!Number.isFinite(price) || price <= 0) continue;

      const prevDayPx = normalizeSplitPrevDayPx(rawPrevDayPx, price, category);
      const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
      const openInterest = parseFloat(ctx.openInterest) || 0;
      const openInterestUsd = openInterest * (Number.isFinite(markPx) ? markPx : price);
      const funding = parseFloat(ctx.funding) || 0;
      const change24h = Number.isFinite(prevDayPx) && prevDayPx > 0 ? price - prevDayPx : 0;
      const change24hPct = Number.isFinite(prevDayPx) && prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;

      markets.push({
        id: fullId,
        dex: dex.name,
        dexLabel: DEX_LABELS[dex.name] || dex.fullName || dex.name,
        ticker,
        companyName: getCompanyName(ticker),
        category,
        price,
        markPx: Number.isFinite(markPx) ? markPx : price,
        oraclePx: Number.isFinite(oraclePx) ? oraclePx : price,
        prevDayPx: Number.isFinite(prevDayPx) ? prevDayPx : price,
        change24h,
        change24hPct,
        dayNtlVlm,
        openInterestUsd,
        funding,
        maxLeverage: u.maxLeverage || 10,
        szDecimals: u.szDecimals ?? 2,
        flashDir: null,
        flashTs: 0,
      });
    }
  }

  // Add Top 5 Cryptocurrencies (Spot Prices): BTC, ETH, SOL via native Hyperliquid Spot (UBTC/UETH/USOL),
  // and BNB, XRP via Hyperliquid live Spot Index (oraclePx) for deep 24/7 spot pricing & charts
  let spotCount = 0;
  const spotCtxByCoin = new Map();
  if (Array.isArray(spotRaw) && spotRaw.length >= 2 && Array.isArray(spotRaw[1])) {
    for (const c of spotRaw[1]) {
      if (c && c.coin) spotCtxByCoin.set(c.coin, c);
    }
  }
  const mainCtxByName = new Map();
  if (Array.isArray(mainPerpRaw) && mainPerpRaw.length >= 2) {
    const mUni = mainPerpRaw[0]?.universe || [];
    const mCtxs = mainPerpRaw[1] || [];
    for (let i = 0; i < mUni.length; i++) {
      if (mUni[i]?.name && mCtxs[i]) mainCtxByName.set(mUni[i].name.toUpperCase(), { u: mUni[i], ctx: mCtxs[i] });
    }
  }

  const nativeSpotSpecs = [
    { coin: '@142', ticker: 'BTC', pairLabel: 'HL Spot (BTC/USDC)' },
    { coin: '@151', ticker: 'ETH', pairLabel: 'HL Spot (ETH/USDC)' },
    { coin: '@156', ticker: 'SOL', pairLabel: 'HL Spot (SOL/USDC)' },
  ];
  for (const spec of nativeSpotSpecs) {
    const ctx = spotCtxByCoin.get(spec.coin);
    if (!ctx) continue;
    const midPx = ctx.midPx !== null && ctx.midPx !== undefined ? parseFloat(ctx.midPx) : NaN;
    const markPx = parseFloat(ctx.markPx);
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const price = Number.isFinite(midPx) ? midPx : markPx;
    if (!Number.isFinite(price) || price <= 0) continue;
    const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
    const change24h = Number.isFinite(prevDayPx) && prevDayPx > 0 ? price - prevDayPx : 0;
    const change24hPct = Number.isFinite(prevDayPx) && prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;
    markets.push({
      id: spec.coin,
      dex: 'spot',
      dexLabel: spec.pairLabel,
      ticker: spec.ticker,
      companyName: getCompanyName(spec.ticker),
      category: 'crypto',
      isSpot: true,
      useOracleAsSpot: false,
      price,
      markPx: Number.isFinite(markPx) ? markPx : price,
      oraclePx: price,
      prevDayPx: Number.isFinite(prevDayPx) ? prevDayPx : price,
      change24h,
      change24hPct,
      dayNtlVlm,
      openInterestUsd: 0,
      funding: 0,
      maxLeverage: 1,
      szDecimals: 4,
      flashDir: null,
      flashTs: 0,
    });
    spotCount++;
  }

  for (const ticker of ['BNB', 'XRP']) {
    const entry = mainCtxByName.get(ticker);
    if (!entry) continue;
    const { u, ctx } = entry;
    const oraclePx = parseFloat(ctx.oraclePx);
    const midPx = ctx.midPx !== null && ctx.midPx !== undefined ? parseFloat(ctx.midPx) : NaN;
    const markPx = parseFloat(ctx.markPx);
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const price = Number.isFinite(oraclePx) && oraclePx > 0 ? oraclePx : (Number.isFinite(midPx) ? midPx : markPx);
    if (!Number.isFinite(price) || price <= 0) continue;
    const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
    const change24h = Number.isFinite(prevDayPx) && prevDayPx > 0 ? price - prevDayPx : 0;
    const change24hPct = Number.isFinite(prevDayPx) && prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;
    markets.push({
      id: ticker,
      dex: 'spot',
      dexLabel: 'Spot Index',
      ticker,
      companyName: getCompanyName(ticker),
      category: 'crypto',
      isSpot: true,
      useOracleAsSpot: true,
      price,
      markPx: Number.isFinite(markPx) ? markPx : price,
      oraclePx: price,
      prevDayPx: Number.isFinite(prevDayPx) ? prevDayPx : price,
      change24h,
      change24hPct,
      dayNtlVlm,
      openInterestUsd: 0,
      funding: 0,
      maxLeverage: 1,
      szDecimals: u?.szDecimals ?? 2,
      flashDir: null,
      flashTs: 0,
    });
    spotCount++;
  }

  if (spotCount > 0) {
    activeDexs.push({
      name: 'spot',
      fullName: 'Crypto Spot',
      count: spotCount,
    });
  }

  return { markets, activeDexs };
}

const candleLiveCache = new Map();
const candleInFlight = new Map();

async function fetchCandles(coin, interval, endTimeMs = Date.now(), barCount = 320, allowWiden = true) {
  const mapMs = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
    '3d': 259_200_000,
    '1w': 604_800_000,
    '1M': 2_592_000_000,
  };
  const intMs = mapMs[interval] || 900_000;
  const now = Date.now();
  const isLiveTail = Math.abs(now - endTimeMs) <= 90_000;
  // Minimum fetch span for common live intervals so 15m/30m/1H, 3H/6H, 12H/1D/Chart all share cache cleanly
  const minLiveBars = interval === '1m' ? 75 : interval === '5m' ? 95 : interval === '15m' ? 320 : barCount;
  const reqBars = isLiveTail ? Math.max(barCount, minLiveBars) : barCount;
  const cacheKey = `${coin}|${interval}`;

  if (isLiveTail) {
    const cached = candleLiveCache.get(cacheKey);
    if (cached && now - cached.at < 45_000 && cached.requestedBars >= barCount) {
      return cached.candles.slice(-Math.max(barCount + 5, 1)).map((c) => ({ ...c }));
    }
    const inflight = candleInFlight.get(cacheKey);
    if (inflight && inflight.requestedBars >= barCount) {
      const list = await inflight.promise;
      return list.slice(-Math.max(barCount + 5, 1)).map((c) => ({ ...c }));
    }
  }

  const runFetch = async () => {
    const parseList = (raw) =>
      (Array.isArray(raw) ? raw : [])
        .map((c) => ({
          t: Number(c.t),
          T: Number(c.T),
          o: parseFloat(c.o),
          h: parseFloat(c.h),
          l: parseFloat(c.l),
          c: parseFloat(c.c),
          v: parseFloat(c.v) || 0,
        }))
        .filter((c) => Number.isFinite(c.c) && Number.isFinite(c.t))
        .sort((a, b) => a.t - b.t);

    const startTime = Math.max(0, endTimeMs - intMs * reqBars);
    const raw = await hlInfo({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime: endTimeMs },
    });
    let candles = parseList(raw);

    // On quiet overnight/weekend hours, widen lookback once so short timeframes still populate cleanly
    if (allowWiden && candles.length < 30 && intMs <= 3_600_000) {
      const widerStart = Math.max(0, endTimeMs - Math.max(intMs * 2000, 7 * 86_400_000));
      const rawWide = await hlInfo({
        type: 'candleSnapshot',
        req: { coin, interval, startTime: widerStart, endTime: endTimeMs },
      });
      const wideCandles = parseList(rawWide);
      if (wideCandles.length > candles.length) {
        candles = wideCandles.slice(-500);
      }
    }

    const dex = coin.includes(':') ? coin.split(':')[0] : 'spot';
    const ticker = resolveCoinTicker(coin);
    return normalizeIntraSeriesSplits(candles, classifyAsset(ticker, dex));
  };

  if (!isLiveTail) {
    return runFetch();
  }

  const p = runFetch();
  candleInFlight.set(cacheKey, { requestedBars: reqBars, promise: p });
  try {
    const result = await p;
    if (result.length > 0) {
      candleLiveCache.set(cacheKey, { at: Date.now(), requestedBars: reqBars, candles: result });
    }
    return result.slice(-Math.max(barCount + 5, 1)).map((c) => ({ ...c }));
  } finally {
    if (candleInFlight.get(cacheKey)?.promise === p) {
      candleInFlight.delete(cacheKey);
    }
  }
}

// Map Hyperliquid HIP-3 tickers to public Yahoo Finance equity/index/commodity symbols for multi-year backfill
const EQUITY_HISTORY_MAP = {
  XYZ100: '^NDX',
  USTECH: '^NDX',
  USA100: '^NDX',
  SP500: '^GSPC',
  US500: '^GSPC',
  USA500: '^GSPC',
  SMALL2000: '^RUT',
  JP225: '^N225',
  JPN225: '^N225',
  KR200: '^KS200',
  NIFTY: '^NSEI',
  IBOV: '^BVSP',
  VIX: '^VIX',
  DXY: 'DX-Y.NYB',
  GOLD: 'GC=F',
  SILVER: 'SI=F',
  CL: 'CL=F',
  OIL: 'CL=F',
  USOIL: 'CL=F',
  WTI: 'CL=F',
  BRENTOIL: 'BZ=F',
  NATGAS: 'NG=F',
  GAS: 'NG=F',
  COPPER: 'HG=F',
  PLATINUM: 'PL=F',
  PALLADIUM: 'PA=F',
  CORN: 'ZC=F',
  WHEAT: 'ZW=F',
  SOY: 'ZS=F',
  EUR: 'EURUSD=X',
  GBP: 'GBPUSD=X',
  JPY: 'JPY=X',
  KRW: 'KRW=X',
  SMSN: '005930.KS',
  SKHX: '000660.KS',
  SKHY: '000660.KS',
  HYUNDAI: '005380.KS',
  NAVER: '035420.KS',
  TCNT: '0700.HK',
  TENCENT: '0700.HK',
  XIAOMI: '1810.HK',
  SOFTBANK: '9984.T',
  IBIDEN: '4062.T',
  KIOXIA: '285A.T',
  RELIANCE: 'RELIANCE.NS',
  CATL: '300750.SZ',
  '10Y': '^TNX',
  '30Y': '^TYX',
  ANTH: 'ANT',
  PURRDAT: 'PURR',
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  BNB: 'BNB-USD',
  XRP: 'XRP-USD',
};

const NASDAQ_TICKER_ALIAS = {
  ANTH: 'ANT',
  ANTHROPIC: 'ANT',
  SPACEX: 'SPCX',
  PURRDAT: 'PURR',
};

// Hyperliquid DEXs/tickers quoted in Implied Company Valuation ($ Billions) rather than per-share stock price
function isValuationPerpCoin(coin) {
  const parts = String(coin || '').split(':');
  const dex = (parts.length > 1 ? parts[0] : '').toLowerCase();
  const ticker = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();
  if (ticker === 'ANTHROPIC' || ticker === 'SPACEX' || ticker === 'OPENAI' || ticker === 'OAI') return true;
  if ((dex === 'io' || dex === 'vntl') && (ticker === 'ANTH' || ticker === 'SPCX' || ticker === 'OAI')) return true;
  return false;
}

const NO_PUBLIC_EQUITY_SET = new Set([
  'ANTHROPIC', 'OAI', 'OPENAI', 'SPACEX', 'UNITREE', 'SHEIN', 'OURA',
  'MINIMAX', 'ZHIPU', 'MOONSHOT', 'YMTC', 'CXMT', 'JIO', 'DRAM', 'H100',
  'MAG7', 'SEMIS', 'SEMI', 'INFOTECH', 'BIOTECH', 'DEFENSE', 'ENERGY', 'USENERGY', 'NUCLEAR', 'ROBOT',
  'GLDMINE', 'GOLDJM', 'SILVERJM', 'BVIV', 'VOL', 'BTCD', 'TOTAL2', 'OTHERS', 'PAPER', 'TREAD', 'DRV', 'ANSEM',
  'PRL', 'LYTE', 'BOT', 'QNT', 'SBE', 'HYPE2', 'USDE', 'XMR', 'ZEC', 'LIT', 'XPL', 'LIGHTER',
  'GOLD', 'SILVER', 'CL', 'OIL', 'USOIL', 'WTI', 'BRENTOIL', 'NATGAS', 'GAS', 'COPPER', 'PLATINUM', 'PALLADIUM', 'URANIUM', 'ALUMINIUM',
  'CORN', 'WHEAT', 'SOY', 'HO', 'TTF', 'EUR', 'GBP', 'JPY', 'KRW', 'DXY', 'VIX', '10Y', '2Y', '30Y', 'USBOND',
  'SKHX', 'SKHY', 'SMSN', 'TCNT', 'TENCENT', 'XIAOMI', 'HYUNDAI', 'SOFTBANK', 'IBIDEN', 'KIOXIA', 'RELIANCE', 'CATL', 'GIGADEV', 'INNOLIGHT', 'AMEC', 'CAMBRICON', 'NAVER',
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
]);

// Map equity indices & thematic baskets to liquid US ETF proxies for benchmark metrics
const INDEX_PROXY_ETF_MAP = {
  XYZ100: 'QQQ',
  USA100: 'QQQ',
  USTECH: 'QQQ',
  SP500: 'SPY',
  US500: 'SPY',
  USA500: 'SPY',
  SMALL2000: 'IWM',
  JP225: 'EWJ',
  JPN225: 'EWJ',
  KR200: 'EWY',
  NIFTY: 'INDA',
  IBOV: 'EWZ',
  MAG7: 'MAGS',
  SEMIS: 'SMH',
  SEMI: 'SMH',
  INFOTECH: 'XLK',
  BIOTECH: 'XBI',
  DEFENSE: 'ITA',
  ENERGY: 'XLE',
  USENERGY: 'XLE',
  NUCLEAR: 'URNM',
  ROBOT: 'BOTZ',
  GLDMINE: 'GDX',
  GOLDJM: 'GDXJ',
  SILVERJM: 'SILJ',
};

// Rich curated intelligence profiles for Pre-IPO companies, Global non-US Equities, Indices & Macro assets
const CURATED_ASSET_PROFILES = {
  SPCX: {
    assetKind: 'recent_ipo',
    isPublicIpo: true,
    nasdaqTicker: 'SPCX',
    ipoDate: 'Jun 12, 2026',
    companyName: 'Space Exploration Technologies Corp. (SpaceX)',
    exchange: 'NASDAQ-GS (SPCX)',
    country: 'United States',
    sector: 'Aerospace & Space',
    industry: 'Orbital Launch & Satellite Broadband',
    ceo: 'Elon Musk',
    founded: '2002',
    website: 'https://www.spacex.com',
    refValuation: '~$1.88T Public Market Cap',
    estRevenue: 'Starlink & Launch Scale',
    ipoStatus: 'Public · NASDAQ: SPCX (Jun 12, 2026)',
    description: 'SpaceX went public on the Nasdaq Global Select Market (SPCX) on June 12, 2026. It is the dominant global commercial launch provider (Falcon 9, Falcon Heavy, Starship) and operator of Starlink, the world’s largest low-Earth orbit satellite broadband constellation serving global consumer, aviation, maritime, and enterprise networks.',
    keyDrivers: [
      'Starlink global broadband & direct-to-cell recurring subscription revenue growth',
      'Falcon 9 high-cadence reusable orbital launch leadership (>80% global upmass)',
      'Starship heavy-lift full reusability program & Starlink V3 orbital deployment',
      'Starshield defense, sovereign & government satellite communications contracts',
    ],
    milestones: [
      { period: 'Jun 2026 Nasdaq IPO', tag: 'PUBLIC IPO', detail: 'Completed landmark public debut on Nasdaq Global Select Market under ticker SPCX on June 12, 2026.' },
      { period: 'Starlink Scale', tag: 'GROWTH', detail: 'Rapidly expanding global subscriber base across 100+ countries, airlines, and maritime fleets.' },
      { period: 'Starship Program', tag: 'CATALYST', detail: 'Full reusability milestones unlock next-generation Starlink V3 capacity and deep-space economics.' },
      { period: 'SEC Reporting', tag: 'FILINGS', detail: 'Public Nasdaq issuer; official S-1/prospectus and ongoing SEC filings linked below.' },
    ],
  },
  ANTH: {
    assetKind: 'recent_ipo',
    isPublicIpo: true,
    nasdaqTicker: 'ANT',
    ipoDate: 'Nov 19, 2026',
    ipoPrice: 83.00,
    ipoRaised: '$81.3B',
    arrUsd: 81e9,
    rev9m2026: 33.24e9,
    companyName: 'Anthropic, PBC',
    exchange: 'NASDAQ-GS (ANT)',
    country: 'United States',
    sector: 'Artificial Intelligence',
    industry: 'Frontier AI Models & Enterprise API',
    ceo: 'Dario Amodei',
    founded: '2021',
    website: 'https://www.anthropic.com',
    refValuation: '~$1.27T Basic / ~$1.75T FD',
    estRevenue: '$81B ARR · $33.24B 9M \'26',
    ipoStatus: 'Public · NASDAQ: ANT (Nov 19, 2026)',
    description: 'Anthropic, PBC debuted on the Nasdaq Global Select Market under ticker ANT on November 19, 2026, pricing at $83/share to raise $81.3B in a record-setting IPO. Creator of the Claude model family (Claude Opus 5.5, Claude Mythos) and Claude Code, Anthropic reported $33.24B in 9M 2026 revenue and reached an $81B annualized run-rate by October 2026.',
    keyDrivers: [
      'Hyper-growth enterprise API & coding agent adoption (Claude Opus 5.5, Claude Mythos & Claude Code)',
      '$33.24B 9M 2026 revenue ($16.2B H1 + ~$17B Q3) scaling to $81B ARR by Oct 2026',
      'Strategic hyperscaler backing & distribution via Amazon AWS (~14.7% stake) & Google Cloud (~13.7% stake)',
      'Record $81.3B Nasdaq IPO (Nov 19, 2026 @ $83/sh) with cornerstone chip & cloud partners',
    ],
    milestones: [
      { period: 'Nov 19, 2026 Nasdaq IPO', tag: 'PUBLIC IPO', detail: 'Listed on Nasdaq Global Select (ANT) at $83/share (980M shares, $81.3B raised); opened at $111.50 and closed Day 1 at $97.17 (~$1.3T–$1.75T valuation).' },
      { period: '9M 2026 S-1 Revenue', tag: 'GROWTH', detail: 'IPO prospectus disclosed $33.24B revenue in 9M 2026 ($16.2B H1 + ~$17B Q3, up from $4.6B FY2025) and $81B ARR by Oct 2026.' },
      { period: 'May 2026 Series H', tag: 'PRE-IPO', detail: 'Raised $65B at a $965B post-money valuation ahead of its November public offering, backed by Amazon & Google.' },
      { period: 'Frontier Models', tag: 'PRODUCT', detail: 'Claude Opus 5.5, Claude Mythos, and Claude Code driving enterprise engineering and Fortune 500 agentic workloads.' },
    ],
  },
  OAI: {
    assetKind: 'preipo',
    companyName: 'OpenAI',
    exchange: 'Pre-IPO Private Equity',
    country: 'United States',
    sector: 'Artificial Intelligence',
    industry: 'Consumer & Enterprise Frontier AI',
    ceo: 'Sam Altman',
    founded: '2015',
    website: 'https://openai.com',
    refValuation: '$852B Last Round · $1T+ IPO Target',
    estRevenue: 'Multi-Ten-Billion ARR Scale',
    ipoStatus: 'Pre-IPO · Confidential S-1 (2027 Target)',
    description: 'OpenAI is the creator of ChatGPT, frontier reasoning models, Sora video generation, and enterprise AI APIs. Privately valued at $852B in its latest funding/tender cycle, OpenAI has submitted a confidential draft S-1 to the SEC with a public IPO targeted for 2027.',
    keyDrivers: [
      'ChatGPT global consumer & enterprise paid subscription scale',
      'Developer API ecosystem & reasoning model compute consumption',
      'Strategic Microsoft Azure & Stargate AI datacenter infrastructure',
      'Confidential SEC S-1 filing targeting a landmark 2027 public listing ($1T+ target)',
    ],
    milestones: [
      { period: 'Confidential S-1 Filed', tag: 'PRE-IPO', detail: 'Submitted confidential draft S-1 registration statement with the SEC; leadership targeting a 2027 public listing.' },
      { period: '$852B Private Benchmark', tag: 'VALUATION', detail: 'Latest private funding and tender valuation reached $852B ahead of prospective $1T+ IPO.' },
      { period: 'Consumer & API Scale', tag: 'GROWTH', detail: 'Global ChatGPT subscription base and enterprise API adoption powering rapid ARR expansion.' },
    ],
  },
  CBRS: {
    assetKind: 'recent_ipo',
    isPublicIpo: true,
    nasdaqTicker: 'CBRS',
    ipoDate: 'May 14, 2026',
    companyName: 'Cerebras Systems, Inc.',
    exchange: 'NASDAQ-GS (CBRS)',
    country: 'United States',
    sector: 'Semiconductors',
    industry: 'Wafer-Scale AI Accelerators',
    ceo: 'Andrew Feldman',
    founded: '2016',
    website: 'https://www.cerebras.ai',
    refValuation: '~$21B Public Market Cap',
    estRevenue: 'AI Supercomputer & Inference Cloud',
    ipoStatus: 'Public · NASDAQ: CBRS (May 14, 2026)',
    description: 'Cerebras Systems went public on the Nasdaq Global Select Market (CBRS) on May 14, 2026. It designs wafer-scale AI processors (WSE-3) and CS-3 AI supercomputers engineered for ultra-fast LLM training and real-time inference cloud workloads as an architectural alternative to GPU clusters.',
    keyDrivers: [
      'Wafer-Scale Engine (WSE-3) ultra-low-latency AI inference speed advantage',
      'Cerebras Inference Cloud developer API and enterprise token throughput growth',
      'Large sovereign & enterprise AI supercomputer deployments',
    ],
    milestones: [
      { period: 'May 2026 Nasdaq IPO', tag: 'PUBLIC IPO', detail: 'Completed public debut on Nasdaq Global Select Market under ticker CBRS on May 14, 2026.' },
      { period: 'WSE-3 & Inference Cloud', tag: 'PRODUCT', detail: 'Third-generation wafer-scale chip powering high-throughput, ultra-low-latency inference workloads.' },
    ],
  },
  UNITREE: {
    assetKind: 'preipo',
    companyName: 'Unitree Robotics',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Robotics & AI',
    industry: 'Humanoid & Quadruped Robotics',
    ceo: 'Wang Xingxing',
    founded: '2016',
    website: 'https://www.unitree.com',
    refValuation: 'Private Growth Rounds',
    estRevenue: 'Global Leader in Quadruped / Humanoid Units',
    ipoStatus: 'Private · Pre-IPO',
    description: 'Unitree Robotics is a leading Chinese robotics manufacturer producing mass-market quadruped robots (Go2, B2) and general-purpose humanoid robots (G1, H1) with vertically integrated actuators and embodied-AI control.',
    keyDrivers: [
      'Cost-disruptive humanoid robot commercialization (G1 / H1 platforms)',
      'Global market-share leadership in consumer & industrial quadruped robots',
      'Embodied AI foundation model integration & industrial automation demand',
    ],
    milestones: [
      { period: 'Humanoid Commercialization', tag: 'PRODUCT', detail: 'Aggressive sub-$20K pricing on G1 humanoid accelerates research and commercial deployment.' },
      { period: 'Embodied AI Wave', tag: 'CATALYST', detail: 'Surging global capital and industrial demand for general-purpose humanoid robotics.' },
    ],
  },
  SHEIN: {
    assetKind: 'preipo',
    companyName: 'SHEIN Group Ltd.',
    exchange: 'Pre-IPO Private Equity',
    country: 'Singapore',
    sector: 'Consumer Discretionary',
    industry: 'On-Demand Global E-Commerce',
    ceo: 'Sky Xu',
    founded: '2008',
    website: 'https://www.sheingroup.com',
    refValuation: '$50B–$66B Private Marks',
    estRevenue: '$30B+ Est. Annual GMV/Rev',
    ipoStatus: 'Private · London / Global IPO Candidate',
    description: 'SHEIN is a global on-demand fashion and lifestyle e-commerce marketplace using real-time demand sensing and small-batch agile manufacturing to ship directly to consumers in 150+ countries.',
    keyDrivers: [
      'Ultra-agile small-batch supply chain minimizing inventory markdowns',
      'Expansion into third-party marketplace categories beyond apparel',
      'Tariff / de minimis trade policy & international IPO listing progress',
    ],
    milestones: [
      { period: 'Marketplace Expansion', tag: 'GROWTH', detail: 'Expanding localized fulfillment and 3P merchant marketplace across US, Europe, and Latin America.' },
      { period: 'IPO Path', tag: 'OUTLOOK', detail: 'Evaluating international listing venue amid cross-border e-commerce regulatory updates.' },
    ],
  },
  OURA: {
    assetKind: 'preipo',
    companyName: 'Oura Health Oy',
    exchange: 'Pre-IPO Private Equity',
    country: 'Finland',
    sector: 'Consumer HealthTech',
    industry: 'Smart Wearables & Health Subscriptions',
    ceo: 'Tom Hale',
    founded: '2013',
    website: 'https://ouraring.com',
    refValuation: '$5B+ Private Valuation',
    estRevenue: '$500M+ Annual Run-Rate',
    ipoStatus: 'Private · Profitable Growth',
    description: 'Oura Health develops the Oura Ring smart wearable and recurring biometric health membership tracking sleep, readiness, heart rate variability, metabolic health, and women’s health metrics.',
    keyDrivers: [
      'Oura Ring 4 hardware upgrade cycle & retail distribution (Best Buy, Target, Amazon)',
      'High-margin recurring monthly health membership subscriptions',
      'Enterprise, clinical research & employer wellness partnerships',
    ],
    milestones: [
      { period: 'Oura Ring 4 Launch', tag: 'PRODUCT', detail: 'Next-generation recessed sensor design expands mainstream wearable adoption.' },
      { period: 'Series D Valuation', tag: 'PRE-IPO', detail: 'Crossed multi-million cumulative rings sold with strong recurring software margins.' },
    ],
  },
  JIO: {
    assetKind: 'preipo',
    companyName: 'Jio Platforms Limited',
    exchange: 'Pre-IPO Subsidiary (Reliance)',
    country: 'India',
    sector: 'Telecom & Digital',
    industry: '5G Telecom, Broadband & Digital Ecosystem',
    ceo: 'Akash Ambani',
    founded: '2019',
    website: 'https://www.jio.com',
    refValuation: '$100B+ Analyst Est.',
    estRevenue: '$14B+ Annual Run-Rate',
    ipoStatus: 'Private Subsidiary · Major India IPO Watch',
    description: 'Jio Platforms is India’s largest digital services and 5G telecom operator (470M+ subscribers), backed by Reliance Industries, Meta, and Google, spanning mobile connectivity, JioAirFiber broadband, JioCinema, and enterprise AI cloud.',
    keyDrivers: [
      '470M+ wireless subscribers & rising telecom ARPU across India',
      'JioAirFiber fixed wireless broadband & enterprise 5G rollout',
      'Anticipated blockbuster domestic Indian IPO catalyst',
    ],
    milestones: [
      { period: '5G Scale Leader', tag: 'GROWTH', detail: 'Nationwide standalone 5G rollout and tariff increases expanding EBITDA margins.' },
      { period: 'IPO Catalyst', tag: 'OUTLOOK', detail: 'Widely watched as one of India’s largest prospective technology & telecom listings.' },
    ],
  },
  CXMT: {
    assetKind: 'preipo',
    companyName: 'ChangXin Memory Technologies (CXMT)',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Semiconductors',
    industry: 'DRAM Memory Manufacturing',
    founded: '2016',
    website: 'https://www.cxmt.com',
    refValuation: '$20B+ Private Valuation',
    estRevenue: 'China’s #1 Domestic DRAM Foundry',
    ipoStatus: 'Private · Pre-IPO',
    description: 'CXMT is China’s flagship domestic DRAM semiconductor manufacturer producing DDR4, DDR5, and LPDDR5 memory chips for smartphones, PCs, and servers while advancing domestic HBM packaging capabilities.',
    keyDrivers: [
      'Domestic Chinese semiconductor self-sufficiency & fab capacity expansion',
      'Global DRAM pricing cycle & DDR5/LPDDR5 yield ramp',
      'Next-generation HBM memory R&D for AI accelerators',
    ],
    milestones: [
      { period: 'Capacity Ramp', tag: 'GROWTH', detail: 'Rapidly growing global DRAM wafer share with Hefei and Beijing fabs.' },
      { period: 'DDR5 / HBM Push', tag: 'CATALYST', detail: 'Advancing high-bandwidth memory packaging for domestic AI server ecosystem.' },
    ],
  },
  YMTC: {
    assetKind: 'preipo',
    companyName: 'Yangtze Memory Technologies (YMTC)',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Semiconductors',
    industry: '3D NAND Flash Memory',
    founded: '2016',
    website: 'https://www.ymtc.com',
    refValuation: 'Private State-Backed',
    estRevenue: 'China’s #1 3D NAND Producer',
    ipoStatus: 'Private',
    description: 'YMTC is China’s leading 3D NAND flash memory manufacturer known for its Xtacking hybrid-bonding architecture supplying SSDs, mobile flash storage, and enterprise datacenter storage.',
    keyDrivers: [
      'Xtacking high-layer 3D NAND architecture & cost competitiveness',
      'Global NAND flash pricing and AI datacenter SSD demand',
      'Domestic Chinese storage supply chain localization',
    ],
  },
  ZHIPU: {
    assetKind: 'preipo',
    companyName: 'Zhipu AI (Zhipu Huazhang)',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Artificial Intelligence',
    industry: 'Foundation LLMs (GLM Family)',
    founded: '2019',
    website: 'https://www.zhipuai.cn',
    refValuation: '$3B+ Private Valuation',
    estRevenue: 'Enterprise LLM & API Platform',
    ipoStatus: 'Private · IPO Guidance Filed',
    description: 'Zhipu AI is one of China’s premier frontier AI labs spun out of Tsinghua University, building the GLM family of open- and closed-weight multimodal models, coding agents, and enterprise AI deployments.',
    keyDrivers: [
      'GLM-4 / AutoGLM multimodal and autonomous agent ecosystem',
      'Enterprise & sovereign cloud AI deployments across China and APAC',
      'Backed by Alibaba, Tencent, Meituan, and leading institutional funds',
    ],
  },
  MINIMAX: {
    assetKind: 'preipo',
    companyName: 'MiniMax AI',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Artificial Intelligence',
    industry: 'Multimodal Consumer & API AI',
    founded: '2021',
    website: 'https://www.minimax.io',
    refValuation: '$3B+ Private Valuation',
    estRevenue: 'Global Consumer AI Apps & Video/Voice APIs',
    ipoStatus: 'Private · Pre-IPO',
    description: 'MiniMax is a frontier multimodal AI startup developing text, audio, and Hailuo video generation models powering viral global consumer AI apps (Talkie / Xingye) and developer APIs.',
    keyDrivers: [
      'Hailuo AI video & speech synthesis global viral adoption',
      'Talkie AI companion app recurring consumer monetization',
      'MiniMax open-weight & MoE model API growth',
    ],
  },
  MOONSHOT: {
    assetKind: 'preipo',
    companyName: 'Moonshot AI (Kimi)',
    exchange: 'Pre-IPO Private Equity',
    country: 'China',
    sector: 'Artificial Intelligence',
    industry: 'Long-Context Frontier LLMs',
    founded: '2023',
    website: 'https://www.moonshot.cn',
    refValuation: '$3B+ Private Valuation',
    estRevenue: 'Kimi AI Assistant & API',
    ipoStatus: 'Private',
    description: 'Moonshot AI is the creator of Kimi, one of China’s fastest-growing consumer and developer AI assistants, pioneering ultra-long-context reasoning and open-weight Kimi K-series frontier models.',
    keyDrivers: [
      'Kimi consumer assistant MAU & developer API adoption',
      'Long-context & reinforcement-learning reasoning model breakthroughs',
      'Backed by Alibaba and top global venture investors',
    ],
  },
  // Global Non-US Listed Equities (KRX, HKEX, TSE, SSE/SZSE, NSE)
  SKHX: {
    assetKind: 'intl_stock',
    companyName: 'SK hynix Inc.',
    exchange: 'KRX: 000660',
    country: 'South Korea',
    cadence: '4Q',
    sector: 'Semiconductors',
    industry: 'HBM & DRAM / NAND Memory',
    website: 'https://www.skhynix.com',
    refValuation: 'Top Global HBM AI Memory Leader',
    description: 'SK hynix is the world’s leading supplier of High Bandwidth Memory (HBM3E / HBM4) powering NVIDIA and hyperscaler AI GPUs, alongside enterprise DRAM and Solidigm NAND flash storage.',
    keyDrivers: [
      'Dominant market share in HBM3E / HBM4 AI accelerator memory (NVIDIA primary supplier)',
      'AI server DDR5 & enterprise eSSD margin expansion',
      'Global DRAM / NAND supply-demand cycle & capex discipline',
    ],
  },
  SMSN: {
    assetKind: 'intl_stock',
    companyName: 'Samsung Electronics Co., Ltd.',
    exchange: 'KRX: 005930',
    country: 'South Korea',
    cadence: '4Q',
    sector: 'Technology & Semiconductors',
    industry: 'Memory, Foundry, Smartphones & Displays',
    website: 'https://www.samsung.com',
    refValuation: 'Korea’s Largest Public Company',
    description: 'Samsung Electronics is a global technology titan spanning DRAM/NAND/HBM memory semiconductors, advanced logic foundry, Galaxy smartphones, OLED displays, and consumer electronics.',
    keyDrivers: [
      'DRAM / NAND memory pricing cycle & HBM qualification milestones',
      'Galaxy AI smartphone & foldable device margin mix',
      'Advanced 2nm/3nm foundry utilization & OLED display demand',
    ],
  },
  KIOXIA: {
    assetKind: 'intl_stock',
    companyName: 'Kioxia Holdings Corporation',
    exchange: 'TSE: 285A',
    country: 'Japan',
    cadence: '4Q',
    sector: 'Semiconductors',
    industry: 'BiCS FLASH 3D NAND Memory',
    website: 'https://www.kioxia.com',
    refValuation: 'Tokyo Prime Listed Memory Pure-Play',
    description: 'Kioxia Holdings (formerly Toshiba Memory) is one of the world’s largest pure-play NAND flash and SSD manufacturers, operating massive joint-venture flash fabs in Japan with SanDisk/Western Digital.',
    keyDrivers: [
      'Enterprise AI datacenter SSD & high-density BiCS FLASH demand',
      'Global NAND flash pricing & fab utilization recovery',
      'JPY/USD currency tailwinds for Japanese semiconductor exports',
    ],
  },
  HYUNDAI: {
    assetKind: 'intl_stock',
    companyName: 'Hyundai Motor Company',
    exchange: 'KRX: 005380',
    country: 'South Korea',
    cadence: '4Q',
    sector: 'Automotive & Mobility',
    industry: 'EVs, Hybrids, Robotics (Boston Dynamics)',
    website: 'https://www.hyundai.com',
    refValuation: 'Top-3 Global Automaker',
    description: 'Hyundai Motor is one of the world’s largest automakers leading in hybrid vehicles, IONIQ EVs, luxury Genesis models, and physical AI/robotics via majority ownership of Boston Dynamics.',
    keyDrivers: [
      'High-margin US/Global hybrid & Genesis SUV volume growth',
      'Boston Dynamics humanoid robotics & autonomous mobility optionality',
      'Shareholder return program (dividends & buybacks under Korea Value-Up)',
    ],
  },
  SOFTBANK: {
    assetKind: 'intl_stock',
    companyName: 'SoftBank Group Corp.',
    exchange: 'TSE: 9984',
    country: 'Japan',
    cadence: '4Q',
    sector: 'Technology Investing',
    industry: 'AI Infrastructure, Arm Holdings & Vision Fund',
    website: 'https://group.softbank',
    refValuation: 'Arm Majority Owner & AI Holding Co.',
    description: 'SoftBank Group is Masayoshi Son’s global technology investment powerhouse holding ~90% of Arm Holdings, major stakes in OpenAI/Stargate AI infrastructure, SoftBank Corp telecom, and Vision Fund portfolios.',
    keyDrivers: [
      'Net Asset Value (NAV) sensitivity to Arm Holdings (ARM) share price',
      'Stargate AI datacenter & OpenAI strategic investments',
      'NAV discount compression via buybacks and asset monetizations',
    ],
  },
  TCNT: {
    assetKind: 'intl_stock',
    companyName: 'Tencent Holdings Limited',
    exchange: 'HKEX: 0700',
    country: 'Hong Kong / China',
    cadence: '4Q',
    sector: 'Communication Services',
    industry: 'WeChat, Gaming, Cloud & FinTech',
    website: 'https://www.tencent.com',
    refValuation: 'Asia’s Largest Internet Platform',
    description: 'Tencent Holdings operates WeChat/Weixin (1.3B+ users), the world’s largest video game publishing business, AI-powered digital advertising, WeChat Pay fintech, and Tencent Cloud.',
    keyDrivers: [
      'High-margin Video Accounts & AI-targeted advertising growth',
      'Evergreen domestic & international gaming franchises (Riot, Supercell, Honor of Kings)',
      'Aggressive annual share buybacks & dividend capital returns',
    ],
  },
  XIAOMI: {
    assetKind: 'intl_stock',
    companyName: 'Xiaomi Corporation',
    exchange: 'HKEX: 1810',
    country: 'Hong Kong / China',
    cadence: '4Q',
    sector: 'Consumer Tech & EVs',
    industry: 'Smartphones, Smart EVs (SU7) & IoT',
    website: 'https://www.mi.com',
    refValuation: 'Top-3 Global Smartphone & EV Challenger',
    description: 'Xiaomi is a global consumer electronics and smart EV leader spanning top-3 worldwide smartphone share, a massive AIoT smart-home ecosystem, and rapidly scaling Xiaomi EV (SU7 / YU7) electric vehicles.',
    keyDrivers: [
      'Xiaomi EV (SU7 / YU7) delivery ramp and automotive gross margin expansion',
      'Premium smartphone market share gains globally',
      'High-margin internet services & connected AIoT ecosystem',
    ],
  },
  RELIANCE: {
    assetKind: 'intl_stock',
    companyName: 'Reliance Industries Limited',
    exchange: 'NSE: RELIANCE',
    country: 'India',
    cadence: '4Q',
    sector: 'Conglomerate / Energy / Telecom',
    industry: 'Jio 5G, Reliance Retail, Refining & New Energy',
    website: 'https://www.ril.com',
    refValuation: 'India’s Largest Public Company',
    description: 'Reliance Industries is India’s flagship conglomerate operating Jio Platforms (telecom/digital), Reliance Retail (India’s largest retailer), Jamnagar O2C refining/petrochemicals, and gigafactory solar/new energy.',
    keyDrivers: [
      'Jio 5G tariff growth & prospective Jio Platforms / Retail value-unlock IPOs',
      'Reliance Retail nationwide omnichannel expansion',
      'Oil-to-Chemicals (O2C) refining margins & New Energy gigafactory ramp',
    ],
  },
  CATL: {
    assetKind: 'intl_stock',
    companyName: 'Contemporary Amperex Technology (CATL)',
    exchange: 'SZSE: 300750',
    country: 'China',
    cadence: '4Q',
    sector: 'Industrials / Clean Energy',
    industry: 'EV Batteries & Grid Energy Storage',
    website: 'https://www.catl.com',
    refValuation: 'World’s #1 EV & ESS Battery Maker',
    description: 'CATL commands ~37% global market share in electric vehicle batteries and grid-scale energy storage systems (ESS), supplying Tesla, BMW, Mercedes, Ford, and leading Asian OEMs with Shenxing & Qilin battery tech.',
    keyDrivers: [
      'Global EV adoption & AI datacenter grid energy storage (ESS) boom',
      'Shenxing fast-charging LFP & sodium-ion battery cost leadership',
      'European & international battery factory localization',
    ],
  },
  GIGADEV: {
    assetKind: 'intl_stock',
    companyName: 'GigaDevice Semiconductor Inc.',
    exchange: 'SSE: 603986',
    country: 'China',
    cadence: '4Q',
    sector: 'Semiconductors',
    industry: 'NOR Flash, MCUs & Specialty DRAM',
    website: 'https://www.gigadevice.com',
    description: 'GigaDevice is a leading fabless semiconductor designer specializing in SPI NOR Flash memory, ARM/RISC-V microcontrollers (MCUs), automotive chips, and specialty DRAM.',
  },
  INNOLIGHT: {
    assetKind: 'intl_stock',
    companyName: 'Zhongji Innolight Co., Ltd.',
    exchange: 'SZSE: 300308',
    country: 'China',
    cadence: '4Q',
    sector: 'AI Optical Networking',
    industry: '800G / 1.6T Optical Transceivers',
    website: 'https://www.innolight.com',
    description: 'Zhongji Innolight is the world’s largest manufacturer of high-speed 800G and 1.6T optical transceivers connecting GPU clusters inside US and global hyperscaler AI datacenters.',
  },
  AMEC: {
    assetKind: 'intl_stock',
    companyName: 'Advanced Micro-Fabrication Equipment (AMEC)',
    exchange: 'SSE: 688012',
    country: 'China',
    cadence: '4Q',
    sector: 'Semiconductor Equipment',
    industry: 'Plasma Etch & MOCVD Tools',
    website: 'https://www.amec-inc.com',
    description: 'AMEC is China’s premier semiconductor wafer-fab equipment maker specializing in advanced dielectric/conductor plasma etching and MOCVD tools for logic and 3D NAND fabs.',
  },
  CAMBRICON: {
    assetKind: 'intl_stock',
    companyName: 'Cambricon Technologies Corp.',
    exchange: 'SSE: 688256',
    country: 'China',
    cadence: '4Q',
    sector: 'Semiconductors',
    industry: 'Domestic AI Accelerator Chips',
    website: 'https://www.cambricon.com',
    description: 'Cambricon Technologies designs cloud and edge AI accelerator processors (Siyuan series) serving China’s domestic AI training and inference datacenter buildout.',
  },
  NAVER: {
    assetKind: 'intl_stock',
    companyName: 'NAVER Corporation',
    exchange: 'KRX: 035420',
    country: 'South Korea',
    cadence: '4Q',
    sector: 'Communication Services',
    industry: 'Search, E-Commerce, Cloud & Webtoon',
    website: 'https://www.navercorp.com',
    description: 'NAVER operates South Korea’s dominant search engine, shopping marketplace, Naver Pay fintech, HyperCLOVA X sovereign AI cloud, and global Webtoon Entertainment content platform.',
  },
  IBIDEN: {
    assetKind: 'intl_stock',
    companyName: 'Ibiden Co., Ltd.',
    exchange: 'TSE: 4062',
    country: 'Japan',
    cadence: '4Q',
    sector: 'Semiconductor Packaging',
    industry: 'Advanced IC Substrates for AI GPUs',
    website: 'https://www.ibiden.com',
    description: 'Ibiden is a critical Japanese supplier of high-layer-count ABF IC package substrates used in NVIDIA AI GPUs and server CPUs, alongside automotive ceramic components.',
  },
  // Equity Indices & Sector Baskets
  XYZ100: {
    assetKind: 'index',
    companyName: 'Nasdaq 100 Index Perpetual (XYZ100)',
    exchange: 'Equity Index · Benchmark Proxy: QQQ',
    country: 'United States',
    sector: 'Equity Index',
    industry: 'Top 100 Non-Financial Nasdaq Companies',
    description: 'Tracks the Nasdaq-100 Index, covering the 100 largest non-financial companies listed on Nasdaq, heavily weighted toward mega-cap technology, AI semiconductors, cloud hyperscalers, and biotech leaders (AAPL, NVDA, MSFT, AMZN, META, AVGO, GOOGL, TSLA).',
    keyDrivers: [
      'Mega-cap AI & cloud earnings growth (Magnificent 7 = ~45%+ index weight)',
      'US 10-Year Treasury yields & Federal Reserve interest rate path',
      'Semiconductor capex cycle & Nasdaq-100 valuation multiple expansion',
    ],
  },
  SP500: {
    assetKind: 'index',
    companyName: 'S&P 500 Index Perpetual',
    exchange: 'Equity Index · Benchmark Proxy: SPY',
    country: 'United States',
    sector: 'Equity Index',
    industry: '500 Leading Large-Cap US Equities',
    description: 'Tracks the Standard & Poor’s 500 Index, the primary benchmark for US large-cap equities representing ~80% of total US equity market capitalization across all 11 GICS sectors.',
    keyDrivers: [
      'Broad US corporate EPS growth and profit margin resilience',
      'Federal Reserve policy, inflation trends, and US GDP growth',
      'Information Technology, Financials, and Healthcare sector leadership',
    ],
  },
  SMALL2000: {
    assetKind: 'index',
    companyName: 'Russell 2000 Small-Cap Index',
    exchange: 'Equity Index · Benchmark Proxy: IWM',
    country: 'United States',
    sector: 'Equity Index',
    industry: '2,000 US Small-Cap Equities',
    description: 'Tracks the Russell 2000 Index of 2,000 domestic US small-cap companies across regional banks, industrials, biotech, and domestic services, which are highly sensitive to US interest rates and domestic economic growth.',
  },
  JP225: {
    assetKind: 'index',
    companyName: 'Nikkei 225 Index',
    exchange: 'Equity Index · Japan (Proxy: EWJ)',
    country: 'Japan',
    sector: 'Equity Index',
    industry: '225 Blue-Chip Tokyo Equities',
    description: 'Tracks Japan’s flagship Nikkei 225 price-weighted equity benchmark spanning Japanese semiconductor equipment, robotics, automotive exporters, and trading houses.',
  },
  KR200: {
    assetKind: 'index',
    companyName: 'KOSPI 200 Index',
    exchange: 'Equity Index · South Korea (Proxy: EWY)',
    country: 'South Korea',
    sector: 'Equity Index',
    industry: 'Top 200 Korean Equities',
    description: 'Tracks South Korea’s KOSPI 200 large-cap index anchored by Samsung Electronics, SK hynix, Hyundai Motor, NAVER, and Korean shipbuilding/defense leaders.',
  },
  // Top 5 Cryptocurrencies (Spot)
  BTC: {
    assetKind: 'crypto',
    companyName: 'Bitcoin (Spot)',
    exchange: 'Hyperliquid Spot · BTC/USDC',
    country: 'Global · Decentralized',
    sector: 'Digital Assets',
    industry: 'Layer 1 Store of Value & Settlement Network',
    website: 'https://bitcoin.org',
    description: 'Bitcoin is the largest decentralized cryptocurrency by market capitalization, secured by proof-of-work consensus with a fixed 21 million coin supply cap. Streamed directly from Hyperliquid Spot (UBTC/USDC).',
  },
  ETH: {
    assetKind: 'crypto',
    companyName: 'Ethereum (Spot)',
    exchange: 'Hyperliquid Spot · ETH/USDC',
    country: 'Global · Decentralized',
    sector: 'Digital Assets',
    industry: 'Smart Contract & Layer 1 Settlement Network',
    website: 'https://ethereum.org',
    description: 'Ethereum is the leading programmable smart-contract blockchain powering decentralized finance, stablecoins, tokenized real-world assets, and Layer 2 rollups. Streamed directly from Hyperliquid Spot (UETH/USDC).',
  },
  SOL: {
    assetKind: 'crypto',
    companyName: 'Solana (Spot)',
    exchange: 'Hyperliquid Spot · SOL/USDC',
    country: 'Global · Decentralized',
    sector: 'Digital Assets',
    industry: 'High-Throughput Layer 1 Blockchain',
    website: 'https://solana.com',
    description: 'Solana is a high-throughput, low-latency Layer 1 blockchain engineered for on-chain order books, consumer applications, DeFi, and payments. Streamed directly from Hyperliquid Spot (USOL/USDC).',
  },
  BNB: {
    assetKind: 'crypto',
    companyName: 'BNB (Spot Index)',
    exchange: 'Spot Index · BNB/USD',
    country: 'Global · Decentralized',
    sector: 'Digital Assets',
    industry: 'Exchange & BNB Smart Chain Ecosystem Asset',
    website: 'https://www.bnbchain.org',
    description: 'BNB is the native utility and gas token of the BNB Chain ecosystem, used for transaction fees, staking, and governance across decentralized applications. Priced from Hyperliquid live spot oracle.',
  },
  XRP: {
    assetKind: 'crypto',
    companyName: 'XRP (Spot Index)',
    exchange: 'Spot Index · XRP/USD',
    country: 'Global · Decentralized',
    sector: 'Digital Assets',
    industry: 'Cross-Border Payments & Settlement Ledger',
    website: 'https://xrpl.org',
    description: 'XRP is the native digital asset of the XRP Ledger (XRPL), built for fast, low-cost global liquidity, remittances, and institutional cross-border settlement. Priced from Hyperliquid live spot oracle.',
  },
  NIFTY: {
    assetKind: 'index',
    companyName: 'Nifty 50 Index',
    exchange: 'Equity Index · India (Proxy: INDA)',
    country: 'India',
    sector: 'Equity Index',
    industry: 'Top 50 NSE Indian Equities',
    description: 'Tracks India’s benchmark Nifty 50 Index covering Reliance Industries, HDFC Bank, TCS, Infosys, and India’s largest financial, IT, and consumer leaders.',
  },
  IBOV: {
    assetKind: 'index',
    companyName: 'Bovespa (Ibovespa) Index',
    exchange: 'Equity Index · Brazil (Proxy: EWZ)',
    country: 'Brazil',
    sector: 'Equity Index',
    industry: 'Leading Brazilian Equities',
    description: 'Tracks Brazil’s flagship Ibovespa equity benchmark weighted toward energy (Petrobras), mining (Vale), and major Brazilian banks.',
  },
  MAG7: {
    assetKind: 'index',
    companyName: 'Magnificent 7 Tech Index',
    exchange: 'Thematic Basket · Proxy: MAGS',
    country: 'United States',
    sector: 'Thematic Index',
    industry: 'AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA',
    description: 'Equal- or market-cap weighted index of the seven dominant US mega-cap AI and platform technology leaders: Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta Platforms, and Tesla.',
  },
  SEMIS: {
    assetKind: 'index',
    companyName: 'Semiconductors Sector Index',
    exchange: 'Thematic Basket · Proxy: SMH',
    country: 'Global',
    sector: 'Semiconductors',
    industry: 'Global Chip Designers, Foundries & Equipment',
    description: 'Tracks leading global semiconductor companies across AI GPUs, foundries, memory, and lithography equipment (NVDA, TSM, AVGO, ASML, AMD, MU, AMAT, LRCX).',
  },
  // Macro: Commodities, FX & Rates
  GOLD: {
    assetKind: 'macro',
    companyName: 'Gold Spot (XAU/USD)',
    exchange: 'Precious Metals · USD / Troy Oz',
    country: 'Global Macro',
    sector: 'Commodities',
    industry: 'Precious Metals & Monetary Store of Value',
    description: 'Tracks global spot Gold per troy ounce in USD, driven by central bank reserve accumulation, US real Treasury yields, US Dollar (DXY) direction, and geopolitical safe-haven demand.',
  },
  SILVER: {
    assetKind: 'macro',
    companyName: 'Silver Spot (XAG/USD)',
    exchange: 'Precious & Industrial Metals · USD / Oz',
    country: 'Global Macro',
    sector: 'Commodities',
    industry: 'Precious Metal + Solar / Electronics Demand',
    description: 'Tracks global spot Silver per troy ounce, blending monetary precious-metal beta to Gold with structural industrial demand from solar photovoltaics, EVs, and AI electronics.',
  },
  CL: {
    assetKind: 'macro',
    companyName: 'WTI Crude Oil (West Texas Intermediate)',
    exchange: 'Energy Futures · USD / Barrel',
    country: 'Global Macro',
    sector: 'Energy Commodities',
    industry: 'US Benchmark Light Sweet Crude',
    description: 'Tracks West Texas Intermediate (WTI) crude oil per barrel, the primary North American oil pricing benchmark driven by OPEC+ supply quotas, US shale output, refinery demand, and geopolitical risk.',
  },
  BRENTOIL: {
    assetKind: 'macro',
    companyName: 'Brent Crude Oil',
    exchange: 'Energy Futures · USD / Barrel',
    country: 'Global Macro',
    sector: 'Energy Commodities',
    industry: 'Global Seaborne Crude Oil Benchmark',
    description: 'Tracks ICE Brent Crude Oil per barrel, the global benchmark pricing over two-thirds of internationally traded crude oil supplies.',
  },
  NATGAS: {
    assetKind: 'macro',
    companyName: 'Henry Hub Natural Gas',
    exchange: 'Energy Futures · USD / MMBtu',
    country: 'United States',
    sector: 'Energy Commodities',
    industry: 'Natural Gas & LNG / AI Power Generation',
    description: 'Tracks US Henry Hub Natural Gas futures, influenced by seasonal weather storage draws, US LNG export capacity, and rising baseload electricity demand from AI datacenters.',
  },
  COPPER: {
    assetKind: 'macro',
    companyName: 'High-Grade Copper',
    exchange: 'Industrial Metals · USD / lb',
    country: 'Global Macro',
    sector: 'Industrial Metals',
    industry: 'Electrification, Grid & Datacenter Metal',
    description: 'Tracks COMEX Copper, nicknamed "Dr. Copper" as a barometer for global manufacturing, power grid expansion, EVs, and AI datacenter electrical infrastructure.',
  },
  DRAM: {
    assetKind: 'macro',
    companyName: 'DRAM Memory Spot Price Index',
    exchange: 'Hardware Commodity Index',
    country: 'Global Semiconductor',
    sector: 'Semiconductors',
    industry: 'DDR4 / DDR5 Memory Spot Benchmark',
    description: 'Synthetic hardware commodity perpetual tracking global DRAM memory chip contract & spot pricing driven by AI server buildouts, smartphone/PC refresh cycles, and Samsung/SK hynix/Micron supply discipline.',
  },
  H100: {
    assetKind: 'macro',
    companyName: 'NVIDIA H100 GPU Compute Index',
    exchange: 'AI Compute Index · USD / GPU-Hr',
    country: 'Global AI Cloud',
    sector: 'AI Infrastructure',
    industry: 'Cloud GPU Rental Rate Benchmark',
    description: 'Tracks real-time decentralized and neocloud hourly rental pricing for NVIDIA H100 AI training/inference GPUs across compute marketplaces.',
  },
  EUR: {
    assetKind: 'macro',
    companyName: 'Euro / US Dollar (EUR/USD)',
    exchange: 'G10 Foreign Exchange',
    country: 'Eurozone / US',
    sector: 'Foreign Exchange',
    industry: 'Major Currency Pair',
    description: 'Tracks the EUR/USD exchange rate, the world’s most liquid currency pair driven by ECB vs. Federal Reserve interest rate differentials and Eurozone/US macro data.',
  },
  GBP: {
    assetKind: 'macro',
    companyName: 'British Pound / US Dollar (GBP/USD)',
    exchange: 'G10 Foreign Exchange',
    country: 'United Kingdom / US',
    sector: 'Foreign Exchange',
    industry: 'Major Currency Pair',
    description: 'Tracks the GBP/USD ("Cable") exchange rate driven by Bank of England vs. Federal Reserve monetary policy and UK inflation/growth trends.',
  },
  JPY: {
    assetKind: 'macro',
    companyName: 'US Dollar / Japanese Yen (USD/JPY)',
    exchange: 'G10 Foreign Exchange',
    country: 'Japan / US',
    sector: 'Foreign Exchange',
    industry: 'Carry Trade & Rates FX Pair',
    description: 'Tracks USD/JPY, the global macro carry-trade bellwether closely tied to Bank of Japan yield curve normalization vs. US Treasury yields.',
  },
  DXY: {
    assetKind: 'macro',
    companyName: 'US Dollar Index (DXY)',
    exchange: 'Macro FX Index',
    country: 'United States',
    sector: 'Foreign Exchange',
    industry: 'Trade-Weighted USD Basket',
    description: 'Measures the value of the US Dollar against a trade-weighted basket of six major currencies (EUR, JPY, GBP, CAD, SEK, CHF).',
  },
  VIX: {
    assetKind: 'macro',
    companyName: 'CBOE Volatility Index (VIX)',
    exchange: 'Equity Volatility Index',
    country: 'United States',
    sector: 'Volatility',
    industry: 'S&P 500 30-Day Implied Volatility',
    description: 'Measures the stock market’s expectation of 30-day forward volatility implied by S&P 500 index options, widely known as Wall Street’s fear gauge.',
  },
  '10Y': {
    assetKind: 'macro',
    companyName: 'US 10-Year Treasury Yield',
    exchange: 'US Sovereign Rates · % Yield',
    country: 'United States',
    sector: 'Fixed Income / Rates',
    industry: 'Global Risk-Free Benchmark Rate',
    description: 'Tracks the yield on benchmark 10-Year US Treasury notes, the primary global discount rate anchoring equity valuations, mortgages, and corporate credit.',
  },
};

// Curated profile aliases so every DEX spelling resolves cleanly
const PROFILE_ALIASES = {
  SPACEX: 'SPCX',
  ANT: 'ANTH',
  ANTHROPIC: 'ANTH',
  OPENAI: 'OAI',
  SKHY: 'SKHX',
  TENCENT: 'TCNT',
  US500: 'SP500',
  USA500: 'SP500',
  USA100: 'XYZ100',
  USTECH: 'XYZ100',
  JPN225: 'JP225',
  SEMI: 'SEMIS',
  OIL: 'CL',
  USOIL: 'CL',
  WTI: 'CL',
  GAS: 'NATGAS',
  '2Y': '10Y',
  '30Y': '10Y',
};

function getCuratedProfile(ticker) {
  const t = String(ticker || '').toUpperCase();
  return CURATED_ASSET_PROFILES[t] || (PROFILE_ALIASES[t] ? CURATED_ASSET_PROFILES[PROFILE_ALIASES[t]] : null);
}

function toEquityHistorySymbol(coin) {
  if (isValuationPerpCoin(coin)) return null;
  const ticker = resolveCoinTicker(coin);
  // Explicit map covers crypto spot (-USD), indices, international equities & commodities
  if (EQUITY_HISTORY_MAP[ticker]) return EQUITY_HISTORY_MAP[ticker];
  if (NO_PUBLIC_EQUITY_SET.has(ticker)) return null;
  // Standard equity/ETF tickers (1-5 uppercase letters)
  if (/^[A-Z]{1,5}$/.test(ticker)) return ticker;
  return null;
}

const equityHistoryCache = new Map();

function parseMoneyString(str) {
  if (str === null || str === undefined) return null;
  if (typeof str === 'number') return Number.isFinite(str) ? str : null;
  const s = String(str).trim();
  if (!s || s === '--' || s === 'N/A' || s === 'null') return null;
  const neg = s.startsWith('(') && s.endsWith(')') || s.startsWith('-');
  const cleaned = s.replace(/[$,%()\s,]/g, '').replace(/^-/, '');
  const val = parseFloat(cleaned);
  if (!Number.isFinite(val)) return null;
  return neg ? -val : val;
}

function aggregateDailyCandles(daily, targetInterval) {
  if (!daily || daily.length === 0) return [];
  if (targetInterval !== '1wk' && targetInterval !== '1mo') return daily;
  const buckets = new Map();
  for (const c of daily) {
    const d = new Date(c.t);
    let key;
    if (targetInterval === '1mo') {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      // ISO week bucket anchored to Monday
      const day = d.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
      key = mon.toISOString().slice(0, 10);
    }
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...c });
    } else {
      existing.h = Math.max(existing.h, c.h);
      existing.l = Math.min(existing.l, c.l);
      existing.c = c.c;
      existing.T = c.T;
      existing.v += c.v;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

function parseNasdaqHistorical(json, targetInterval) {
  const rows = json?.data?.tradesTable?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const daily = [];
  for (const r of rows) {
    // date format MM/DD/YYYY
    const parts = String(r.date || '').split('/');
    if (parts.length !== 3) continue;
    const t = Date.UTC(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]), 16, 0, 0);
    const o = parseMoneyString(r.open);
    const h = parseMoneyString(r.high);
    const l = parseMoneyString(r.low);
    const c = parseMoneyString(r.close);
    const v = parseMoneyString(r.volume) || 0;
    if (!Number.isFinite(t) || !Number.isFinite(o) || !Number.isFinite(c) || c <= 0) continue;
    daily.push({
      t,
      T: t + 86_400_000 - 1,
      o,
      h: Number.isFinite(h) ? h : Math.max(o, c),
      l: Number.isFinite(l) ? l : Math.min(o, c),
      c,
      v,
      isBackfill: true,
    });
  }
  daily.sort((a, b) => a.t - b.t);
  return aggregateDailyCandles(daily, targetInterval);
}

async function fetchEquityHistory(coin, yfRange, yfInterval) {
  const sym = toEquityHistorySymbol(coin);
  if (!sym) return [];
  const cacheKey = `${sym}|${yfRange}|${yfInterval}`;
  const cached = equityHistoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60_000) {
    return cached.candles;
  }

  let json = null;
  let source = 'yahoo';
  try {
    const webApiBase = getWebApiBase();
    if (window.webkit?.messageHandlers?.hlEquityHistory) {
      const res = await window.webkit.messageHandlers.hlEquityHistory.postMessage({
        symbol: sym,
        range: yfRange,
        interval: yfInterval,
      });
      if (res?.ok && res.raw) {
        source = res.source || 'yahoo';
        json = JSON.parse(res.raw);
      }
    } else if (webApiBase || isLocalServerHost()) {
      const url = `${webApiBase}/api/equity-history?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(yfRange)}&interval=${encodeURIComponent(yfInterval)}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const wrapper = await resp.json();
        if (wrapper && wrapper.source && wrapper.data) {
          source = wrapper.source;
          json = wrapper.data;
        } else {
          json = wrapper;
        }
      }
    } else {
      // Static browser hosting (e.g. GitHub Pages) cannot call Yahoo/Nasdaq directly due to CORS
      return [];
    }
  } catch (_) {
    return [];
  }

  let out = [];
  if (source === 'nasdaq' || json?.data?.tradesTable?.rows) {
    out = parseNasdaqHistorical(json, yfInterval);
  } else {
    const result = json?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) return [];
    const tsList = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!quote) return [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const vols = quote.volume || [];

    const intMs =
      yfInterval === '1mo' ? 2_592_000_000 :
      yfInterval === '1wk' ? 604_800_000 :
      yfInterval === '1d' ? 86_400_000 : 3_600_000;

    for (let i = 0; i < tsList.length; i++) {
      const tSec = tsList[i];
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      if (tSec == null || o == null || h == null || l == null || c == null) continue;
      if (!Number.isFinite(o) || !Number.isFinite(c) || c <= 0) continue;
      const t = tSec * 1000;
      out.push({
        t,
        T: t + intMs - 1,
        o: Number(o),
        h: Number(h),
        l: Number(l),
        c: Number(c),
        v: Number(vols[i]) || 0,
        isBackfill: true,
      });
    }
    out.sort((a, b) => a.t - b.t);
  }

  if (out.length > 0) {
    equityHistoryCache.set(cacheKey, { at: Date.now(), candles: out });
  }
  return out;
}

// MARK: Stock Insights & Live-Priced Fundamental Valuation Engine

const insightsCache = new Map();

function findFinRow(table, keywords, multiplyThousands = true) {
  const rows = table?.rows;
  if (!Array.isArray(rows)) return null;
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const row = rows.find((r) => String(r.value1 || '').toLowerCase().trim() === lower) ||
                rows.find((r) => String(r.value1 || '').toLowerCase().includes(lower));
    if (row) {
      const vals = [row.value2, row.value3, row.value4, row.value5].map((v) => {
        const n = parseMoneyString(v);
        if (n === null) return null;
        return multiplyThousands ? n * 1000 : n;
      });
      if (vals.some((v) => v !== null)) return vals;
    }
  }
  return null;
}

function computeCandleAnalytics(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const sorted = candles.slice().sort((a, b) => a.t - b.t);
  let periodHigh = -Infinity;
  let periodLow = Infinity;
  let volSum = 0;
  for (const c of sorted) {
    if (c.h > periodHigh) periodHigh = c.h;
    if (c.l < periodLow) periodLow = c.l;
    volSum += (c.v || 0) * (c.c || 0);
  }
  const n = sorted.length;
  const last = sorted[n - 1];
  const retFor = (days) => {
    if (n <= 1) return null;
    const idx = Math.max(0, n - 1 - days);
    const base = sorted[idx]?.c;
    return base && base > 0 ? ((last.c - base) / base) * 100 : null;
  };
  // 30-day annualized realized volatility (%)
  let vol30dAnn = null;
  if (n >= 7) {
    const startIdx = Math.max(1, n - 30);
    const rets = [];
    for (let i = startIdx; i < n; i++) {
      const prev = sorted[i - 1].c;
      const cur = sorted[i].c;
      if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
    }
    if (rets.length >= 5) {
      const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
      const variance = rets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (rets.length - 1);
      vol30dAnn = Math.sqrt(variance) * Math.sqrt(365) * 100;
    }
  }
  return {
    periodHigh: Number.isFinite(periodHigh) ? periodHigh : null,
    periodLow: Number.isFinite(periodLow) ? periodLow : null,
    periodDays: n,
    ret7d: n >= 7 ? retFor(7) : retFor(n - 1),
    ret30d: n >= 30 ? retFor(30) : null,
    ret90d: n >= 60 ? retFor(90) : null,
    retInception: n >= 2 ? retFor(n - 1) : null,
    vol30dAnn,
    avgDailyHlUsdVol: n > 0 ? volSum / n : null,
    sparkSeries: sorted.slice(-90).map((c) => ({ t: c.t, c: c.c })),
  };
}

async function fetchStockInsights(coin) {
  const ticker = resolveCoinTicker(coin);
  const cacheKey = `${coin.toUpperCase()}`;
  const cached = insightsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60_000) {
    return cached.data;
  }

  const curated = getCuratedProfile(ticker);
  const isValPerp = isValuationPerpCoin(coin);
  const proxySymbol = INDEX_PROXY_ETF_MAP[ticker] || null;
  const mappedNasdaq = NASDAQ_TICKER_ALIAS[ticker] || curated?.nasdaqTicker || null;
  const isDirectNasdaq = !isValPerp && (Boolean(mappedNasdaq) || (/^[A-Z]{1,5}$/.test(ticker) && !NO_PUBLIC_EQUITY_SET.has(ticker)));
  const querySymbol = isDirectNasdaq ? (mappedNasdaq || ticker) : (isValPerp && mappedNasdaq ? mappedNasdaq : proxySymbol);

  const fetchNasdaqRaw = async () => {
    if (!querySymbol) return null;
    try {
      const webApiBase = getWebApiBase();
      if (window.webkit?.messageHandlers?.hlStockInsights) {
        const res = await window.webkit.messageHandlers.hlStockInsights.postMessage({ symbol: querySymbol });
        if (res?.ok && res.raw) return JSON.parse(res.raw);
      } else if (webApiBase || isLocalServerHost()) {
        const resp = await fetch(`${webApiBase}/api/stock-insights?symbol=${encodeURIComponent(querySymbol)}`);
        if (resp.ok) return await resp.json();
      }
    } catch (_) {}
    return null;
  };

  const fetchHlDaily = async () => {
    try {
      const hl = await fetchCandles(coin, '1d', Date.now(), 365, false);
      if (Array.isArray(hl) && hl.length >= 2) return hl;
    } catch (_) {}
    try {
      return await fetchEquityHistory(coin, '1y', '1d');
    } catch (_) {
      return [];
    }
  };

  const [raw, hlCandles] = await Promise.all([fetchNasdaqRaw(), fetchHlDaily()]);
  const hlStats = computeCandleAnalytics(hlCandles);

  const hasStockSum = Boolean(raw?.summary?.summaryData && Object.keys(raw.summary.summaryData).length > 0);
  const hasEtfSum = Boolean(raw?.summaryEtf?.summaryData && Object.keys(raw.summaryEtf.summaryData).length > 0);
  const isEtf = !hasStockSum && hasEtfSum && !proxySymbol;
  const isIndexProxy = Boolean(proxySymbol);

  const sumData = (hasStockSum ? raw.summary.summaryData : null) || (hasEtfSum ? raw.summaryEtf.summaryData : null) || {};
  const infoData = (hasStockSum ? raw?.info : null) || raw?.infoEtf || raw?.info || {};
  const prof = raw?.profile || {};
  const ratings = isIndexProxy ? {} : (raw?.ratings || {});
  const target = isIndexProxy ? {} : (raw?.target?.consensusOverview || {});
  const peg = isIndexProxy ? {} : (raw?.peg?.pegr || {});
  const epsList = isIndexProxy ? [] : (Array.isArray(raw?.eps?.earningsPerShare) ? raw.eps.earningsPerShare : []);
  const fin = isIndexProxy ? {} : (raw?.financials || {});

  // Parse 52-week High / Low ("$243.37/$148.8") — never mix proxy ETF price into index level!
  let week52High = null;
  let week52Low = null;
  let rangeSource = '52W';
  if (!isIndexProxy && !isValPerp) {
    const hlStr = sumData.FiftTwoWeekHighLow?.value || '';
    if (hlStr.includes('/')) {
      const [hiS, loS] = hlStr.split('/');
      week52High = parseMoneyString(hiS);
      week52Low = parseMoneyString(loS);
    }
  }
  if ((week52High == null || week52Low == null) && hlStats?.periodHigh && hlStats?.periodLow) {
    week52High = hlStats.periodHigh;
    week52Low = hlStats.periodLow;
    rangeSource = `${hlStats.periodDays}D HL`;
  }

  const refMarketCap = parseMoneyString(sumData.MarketCap?.value);
  const refPrevClose = parseMoneyString(sumData.PreviousClose?.value);
  const refLastSale = parseMoneyString(infoData?.primaryData?.lastSalePrice);
  const refPrice = refLastSale || refPrevClose;
  const impliedShares = !isIndexProxy && !isValPerp && refMarketCap && refPrice && refPrice > 0 ? refMarketCap / refPrice : null;

  const annualDividend = parseMoneyString(sumData.AnnualizedDividend?.value);
  const beta = parseMoneyString(sumData.Beta?.value);
  const shareVolume = parseMoneyString(sumData.ShareVolume?.value);
  const avgDailyVol = parseMoneyString(sumData.FiftyDayAvgDailyVol?.value);
  const expenseRatio = sumData.ExpenseRatio?.value || null;
  const weightedAlpha = parseMoneyString(sumData.WeightedAlpha?.value);
  const stdDev = sumData.StandardDeviation?.value || null;
  const avgVol20d = parseMoneyString(sumData.AvgDailyVol20Days?.value);
  const avgVol65d = parseMoneyString(sumData.AvgDailyVol65Days?.value);

  // Financials (Nasdaq reports income/balance/cashflow in $ thousands)
  const incTbl = fin.incomeStatementTable;
  const balTbl = fin.balanceSheetTable;
  const cfTbl = fin.cashFlowTable;
  const ratTbl = fin.financialRatiosTable;

  const periods = incTbl?.headers
    ? [incTbl.headers.value2, incTbl.headers.value3, incTbl.headers.value4, incTbl.headers.value5].filter(Boolean)
    : [];
  const revArr = findFinRow(incTbl, ['total revenue', 'total revenues', 'revenues', 'revenue', 'net sales']);
  const grossArr = findFinRow(incTbl, ['gross profit']);
  const rdArr = findFinRow(incTbl, ['research and development', 'research & development']);
  const opIncArr = findFinRow(incTbl, ['operating income', 'operating income (loss)', 'earnings before interest and tax']);
  const netIncArr =
    findFinRow(incTbl, ['net income', 'net income applicable to common', 'net income applicable to common shareholders', 'net income (loss)']) ||
    findFinRow(cfTbl, ['net income']);

  const cashArr = findFinRow(balTbl, ['cash and cash equivalents', 'cash and short term investments']);
  const stInvArr = findFinRow(balTbl, ['short-term investments', 'short term investments']);
  const ltDebtArr = findFinRow(balTbl, ['long-term debt', 'long term debt']);
  const stDebtArr = findFinRow(balTbl, ['short-term debt', 'short term debt / current portion', 'current portion of long-term debt']);
  const assetsArr = findFinRow(balTbl, ['total assets']);
  const equityArr = findFinRow(balTbl, ['total equity', 'total stockholders equity', 'stockholders equity', "total shareholders' equity"]);

  const opCfArr = findFinRow(cfTbl, ['net cash flow-operating', 'operating activities']);
  const capexArr = findFinRow(cfTbl, ['capital expenditures']);

  const grossMarginArr = findFinRow(ratTbl, ['gross margin'], false);
  const opMarginArr = findFinRow(ratTbl, ['operating margin'], false);
  const profitMarginArr = findFinRow(ratTbl, ['profit margin'], false);
  const roeArr = findFinRow(ratTbl, ['after tax roe', 'pre-tax roe'], false);
  const currentRatioArr = findFinRow(ratTbl, ['current ratio'], false);
  const quickRatioArr = findFinRow(ratTbl, ['quick ratio'], false);

  const latestRev = revArr?.[0] ?? null;
  const prevRev = revArr?.[1] ?? null;
  const revGrowthYoY = latestRev && prevRev && prevRev > 0 ? ((latestRev - prevRev) / prevRev) * 100 : null;
  const latestGross = grossArr?.[0] ?? null;
  const latestOpInc = opIncArr?.[0] ?? null;
  const latestNetInc = netIncArr?.[0] ?? null;
  const totalCash = (cashArr?.[0] || 0) + (stInvArr?.[0] || 0);
  const totalDebt = (ltDebtArr?.[0] || 0) + (stDebtArr?.[0] || 0);
  const latestEquity = equityArr?.[0] ?? null;
  const latestOpCf = opCfArr?.[0] ?? null;
  const latestCapex = capexArr?.[0] ?? null;
  const freeCashFlow = latestOpCf !== null && latestCapex !== null ? latestOpCf - Math.abs(latestCapex) : null;

  // Compute TTM EPS & Forward 12M EPS from Nasdaq quarterly EPS endpoint (most accurate!)
  const prevQs = epsList.filter((q) => q.type === 'PreviousQuarter' && Number.isFinite(Number(q.earnings)));
  const nextQs = epsList.filter((q) => q.type === 'UpcomingQuarter' && Number.isFinite(Number(q.consensus)) && Number(q.consensus) !== 0);

  let ttmEps = null;
  if (prevQs.length >= 4) {
    ttmEps = prevQs.slice(-4).reduce((s, q) => s + Number(q.earnings), 0);
  } else if (latestNetInc && impliedShares && impliedShares > 0) {
    ttmEps = latestNetInc / impliedShares;
  }

  let forwardEps = null;
  if (nextQs.length >= 4) {
    forwardEps = nextQs.slice(0, 4).reduce((s, q) => s + Number(q.consensus), 0);
  } else if (nextQs.length > 0) {
    const avgQ = nextQs.reduce((s, q) => s + Number(q.consensus), 0) / nextQs.length;
    forwardEps = avgQ * 4;
  }

  // MARK: Country-Aware Recent Earnings Reports (Last 4Q or Last 2H) + Official Filings
  const MONTH_MAP = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function parseFlexDateMs(str) {
    if (!str) return null;
    const s = String(str).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [m, d, y] = s.split('/').map(Number);
      return Date.UTC(y, m - 1, d);
    }
    const mmy = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
    if (mmy && MONTH_MAP[mmy[1].toLowerCase()] !== undefined) {
      return Date.UTC(Number(mmy[2]), MONTH_MAP[mmy[1].toLowerCase()] + 1, 0);
    }
    const parsedMs = Date.parse(s);
    return Number.isFinite(parsedMs) ? parsedMs : null;
  }

  const addrStr = String(prof?.Address?.value || '');
  const regionStr = String(prof?.Region?.value || '');
  const SEMI_ANNUAL_COUNTRIES = [
    'united kingdom', 'uk', 'england', 'scotland', 'australia', 'new zealand',
    'hong kong', 'singapore', 'ireland', 'south africa', 'france', 'germany',
    'switzerland', 'spain', 'italy', 'netherlands', 'belgium', 'luxembourg',
    'denmark', 'sweden', 'norway', 'finland', 'austria', 'portugal',
  ];
  let countryName = null;
  if (addrStr) {
    const parts = addrStr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (!/^\d/.test(last) && last.length >= 2 && last.length <= 36) countryName = last;
    }
  }
  if (!countryName) {
    if (/north america/i.test(regionStr)) countryName = 'United States';
    else if (regionStr) countryName = regionStr;
    else countryName = 'United States';
  }
  const countryLower = `${countryName} ${addrStr} ${regionStr}`.toLowerCase();
  const isSemiAnnualCountry = SEMI_ANNUAL_COUNTRIES.some((c) => countryLower.includes(c));

  // Parse quarterly financials (?frequency=2) with recency guard (ignore stale >3yr ADR placeholders)
  const finQ = raw?.financialsQ || {};
  const qInc = finQ.incomeStatementTable;
  const qCf = finQ.cashFlowTable;
  const qRat = finQ.financialRatiosTable;
  const rawQPeriods = qInc?.headers
    ? [qInc.headers.value2, qInc.headers.value3, qInc.headers.value4, qInc.headers.value5].filter((v) => v && String(v).trim())
    : [];
  const latestQMs = rawQPeriods.length > 0 ? parseFlexDateMs(rawQPeriods[0]) : null;
  const hasRecentFinQ = Boolean(latestQMs && Date.now() - latestQMs < 3 * 366 * 86_400_000);

  const qPeriods = hasRecentFinQ ? rawQPeriods : [];
  const qRev = hasRecentFinQ ? findFinRow(qInc, ['total revenue', 'revenue']) : null;
  const qGross = hasRecentFinQ ? findFinRow(qInc, ['gross profit']) : null;
  const qRd = hasRecentFinQ ? findFinRow(qInc, ['research and development']) : null;
  const qOpInc = hasRecentFinQ ? findFinRow(qInc, ['operating income', 'earnings before interest and tax']) : null;
  const qNetInc = hasRecentFinQ
    ? (findFinRow(qInc, ['net income', 'net income applicable to common']) || findFinRow(qCf, ['net income']))
    : null;
  const qOpCf = hasRecentFinQ ? findFinRow(qCf, ['net cash flow-operating', 'operating activities']) : null;
  const qGrossM = hasRecentFinQ ? findFinRow(qRat, ['gross margin'], false) : null;
  const qOpM = hasRecentFinQ ? findFinRow(qRat, ['operating margin'], false) : null;
  const qNetM = hasRecentFinQ ? findFinRow(qRat, ['profit margin'], false) : null;

  // Build quarterly financial column lookup
  const finQCols = qPeriods.map((pStr, i) => {
    const rev = qRev?.[i] ?? null;
    const gross = qGross?.[i] ?? null;
    const rd = qRd?.[i] ?? null;
    const opInc = qOpInc?.[i] ?? null;
    const netInc = qNetInc?.[i] ?? null;
    const opCf = qOpCf?.[i] ?? null;
    return {
      periodEnd: pStr,
      periodMs: parseFlexDateMs(pStr),
      revenue: rev,
      grossProfit: gross,
      rd,
      operatingIncome: opInc,
      netIncome: netInc,
      operatingCashFlow: opCf,
      grossMargin: qGrossM?.[i] ?? (gross != null && rev > 0 ? (gross / rev) * 100 : null),
      operatingMargin: qOpM?.[i] ?? (opInc != null && rev > 0 ? (opInc / rev) * 100 : null),
      netMargin: qNetM?.[i] ?? (netInc != null && rev > 0 ? (netInc / rev) * 100 : null),
    };
  });

  // Parse earnings-surprise rows (most recent first)
  const rawSurprise = Array.isArray(raw?.surprise?.earningsSurpriseTable?.rows)
    ? raw.surprise.earningsSurpriseTable.rows
    : [];
  let reportRows = rawSurprise.slice(0, 6).map((r) => {
    const actual = Number.isFinite(Number(r.eps)) ? Number(r.eps) : parseMoneyString(r.eps);
    const est = parseMoneyString(r.consensusForecast);
    const surp = parseMoneyString(r.percentageSurprise);
    return {
      periodLabel: r.fiscalQtrEnd || '—',
      periodMs: parseFlexDateMs(r.fiscalQtrEnd),
      dateReported: r.dateReported || null,
      epsActual: actual,
      epsEstimate: est,
      surprisePct: surp,
    };
  });

  // Fallback to PreviousQuarter entries from /eps if surprise table is empty
  if (reportRows.length === 0 && prevQs.length > 0) {
    reportRows = prevQs.slice(-4).reverse().map((q) => {
      const actual = Number(q.earnings);
      const est = Number.isFinite(Number(q.consensus)) ? Number(q.consensus) : null;
      const surp = est && Math.abs(est) > 1e-6 ? ((actual - est) / Math.abs(est)) * 100 : null;
      return {
        periodLabel: q.period || '—',
        periodMs: parseFlexDateMs(q.period),
        dateReported: null,
        epsActual: actual,
        epsEstimate: est,
        surprisePct: surp,
      };
    });
  }

  // Merge matched quarterly financial metrics onto each report row
  const quarterlyReports = [];
  if (reportRows.length > 0) {
    for (let i = 0; i < Math.min(4, reportRows.length); i++) {
      const rr = reportRows[i];
      let matched = null;
      if (rr.periodMs && finQCols.length > 0) {
        matched = finQCols.find((fc) => fc.periodMs && Math.abs(fc.periodMs - rr.periodMs) <= 50 * 86_400_000) || null;
      }
      if (!matched && finQCols.length > 0 && !rr.periodMs) {
        matched = finQCols[i] || null;
      }
      quarterlyReports.push({
        ...rr,
        periodEnd: matched?.periodEnd || rr.periodLabel,
        revenue: matched?.revenue ?? null,
        grossProfit: matched?.grossProfit ?? null,
        rd: matched?.rd ?? null,
        operatingIncome: matched?.operatingIncome ?? null,
        netIncome: matched?.netIncome ?? null,
        operatingCashFlow: matched?.operatingCashFlow ?? null,
        grossMargin: matched?.grossMargin ?? null,
        operatingMargin: matched?.operatingMargin ?? null,
        netMargin: matched?.netMargin ?? null,
      });
    }
  } else if (finQCols.length > 0) {
    for (const fc of finQCols.slice(0, 4)) {
      quarterlyReports.push({
        periodLabel: fc.periodEnd,
        periodMs: fc.periodMs,
        periodEnd: fc.periodEnd,
        dateReported: null,
        epsActual: null,
        epsEstimate: null,
        surprisePct: null,
        ...fc,
      });
    }
  }

  // Parse official SEC / foreign earnings filings (10-Q, 10-K, 6-K, 20-F, 40-F, 8-K)
  const FORM_LABELS = {
    '10-Q': 'Quarterly Report',
    '10-K': 'Annual Report',
    '8-K': 'Earnings / Current Release',
    'S-1': 'IPO Registration Statement',
    'S-1/A': 'Amended IPO Prospectus',
    '424B4': 'Final IPO Prospectus',
    'F-1': 'Foreign IPO Registration',
    '6-K': 'Foreign Interim / Earnings Report',
    '20-F': 'Foreign Annual Report',
    '40-F': 'Canadian Annual Report',
  };
  const rawFilings = Array.isArray(raw?.filings?.rows) ? raw.filings.rows : [];
  const seenFilingKey = new Set();
  const earningsFilings = [];
  for (const row of rawFilings) {
    const ft = String(row.formType || '').trim().toUpperCase();
    if (!FORM_LABELS[ft]) continue;
    const filed = String(row.filed || '').trim();
    const key = `${ft}|${filed}`;
    if (seenFilingKey.has(key)) continue;
    seenFilingKey.add(key);
    const htmlUrl = row.view?.htmlLink || null;
    const pdfUrl = row.view?.pdfLink || null;
    if (!htmlUrl && !pdfUrl) continue;
    earningsFilings.push({
      formType: ft,
      label: FORM_LABELS[ft],
      filed,
      period: row.period || null,
      htmlUrl,
      pdfUrl,
    });
    if (earningsFilings.length >= 10) break;
  }

  // Detect reporting cadence: '4Q' (Quarterly) vs '2H' (Semi-Annual)
  const has10Q = earningsFilings.some((f) => f.formType === '10-Q');
  const hasForeignForms = earningsFilings.some((f) => f.formType === '6-K' || f.formType === '20-F');
  let medianGapDays = null;
  if (reportRows.length >= 2) {
    const gaps = [];
    for (let i = 0; i < reportRows.length - 1; i++) {
      if (reportRows[i].periodMs && reportRows[i + 1].periodMs) {
        const g = Math.abs(reportRows[i].periodMs - reportRows[i + 1].periodMs) / 86_400_000;
        if (g > 20 && g < 400) gaps.push(g);
      }
    }
    if (gaps.length > 0) {
      gaps.sort((a, b) => a - b);
      medianGapDays = gaps[Math.floor(gaps.length / 2)];
    }
  }

  let defaultCadence = '4Q';
  if (medianGapDays !== null && medianGapDays > 135) {
    defaultCadence = '2H';
  } else if (isSemiAnnualCountry && !has10Q && (!hasRecentFinQ || hasForeignForms)) {
    defaultCadence = '2H';
  } else if (hasForeignForms && !has10Q && !hasRecentFinQ && quarterlyReports.length <= 2) {
    defaultCadence = '2H';
  }

  // Build Last 2H (Semi-Annual) view:
  // If native semi-annual (medianGapDays > 135), map top 2 reports directly as H2 / H1.
  // If quarterly data exists, roll up pairs (Q0+Q1 = Recent Half, Q2+Q3 = Prior Half) cleanly!
  const sumOpt = (a, b) => {
    if (a == null && b == null) return null;
    return (a || 0) + (b || 0);
  };
  const semiAnnualReports = [];
  if (medianGapDays !== null && medianGapDays > 135 && quarterlyReports.length > 0) {
    quarterlyReports.slice(0, 2).forEach((r, idx) => {
      semiAnnualReports.push({
        ...r,
        halfTag: idx === 0 ? 'Latest Half (H2)' : 'Prior Half (H1)',
      });
    });
  } else if (quarterlyReports.length >= 2) {
    const pairs = [
      { tag: 'Recent 6M (Latest Half)', list: quarterlyReports.slice(0, 2) },
      { tag: 'Prior 6M (Prior Half)', list: quarterlyReports.slice(2, 4) },
    ];
    for (const p of pairs) {
      if (p.list.length === 0) continue;
      const a = p.list[0];
      const b = p.list[1] || null;
      const rev = sumOpt(a.revenue, b?.revenue);
      const gross = sumOpt(a.grossProfit, b?.grossProfit);
      const rd = sumOpt(a.rd, b?.rd);
      const opInc = sumOpt(a.operatingIncome, b?.operatingIncome);
      const netInc = sumOpt(a.netIncome, b?.netIncome);
      const opCf = sumOpt(a.operatingCashFlow, b?.operatingCashFlow);
      const epsAct = sumOpt(a.epsActual, b?.epsActual);
      const epsEst = sumOpt(a.epsEstimate, b?.epsEstimate);
      const surp = epsAct != null && epsEst != null && Math.abs(epsEst) > 1e-6
        ? ((epsAct - epsEst) / Math.abs(epsEst)) * 100
        : a.surprisePct;
      semiAnnualReports.push({
        halfTag: p.tag,
        periodLabel: b ? `${b.periodLabel} – ${a.periodLabel}` : a.periodLabel,
        periodEnd: a.periodEnd,
        dateReported: a.dateReported,
        epsActual: epsAct,
        epsEstimate: epsEst,
        surprisePct: surp,
        revenue: rev,
        grossProfit: gross,
        rd,
        operatingIncome: opInc,
        netIncome: netInc,
        operatingCashFlow: opCf,
        grossMargin: gross != null && rev > 0 ? (gross / rev) * 100 : a.grossMargin,
        operatingMargin: opInc != null && rev > 0 ? (opInc / rev) * 100 : a.operatingMargin,
        netMargin: netInc != null && rev > 0 ? (netInc / rev) * 100 : a.netMargin,
      });
    }
  } else if (periods.length > 0 && (revArr || netIncArr)) {
    // Fallback for foreign semi-annual issuers with annual statements + 6-K filings
    for (let i = 0; i < Math.min(2, periods.length); i++) {
      const rev = revArr?.[i] ?? null;
      const gross = grossArr?.[i] ?? null;
      const opInc = opIncArr?.[i] ?? null;
      const netInc = netIncArr?.[i] ?? null;
      semiAnnualReports.push({
        halfTag: i === 0 ? 'Latest Fiscal Period' : 'Prior Fiscal Period',
        periodLabel: `FY Ending ${periods[i]}`,
        periodEnd: periods[i],
        dateReported: null,
        epsActual: netInc && impliedShares ? netInc / impliedShares : null,
        epsEstimate: null,
        surprisePct: null,
        revenue: rev,
        grossProfit: gross,
        rd: rdArr?.[i] ?? null,
        operatingIncome: opInc,
        netIncome: netInc,
        operatingCashFlow: opCfArr?.[i] ?? null,
        grossMargin: gross != null && rev > 0 ? (gross / rev) * 100 : null,
        operatingMargin: opInc != null && rev > 0 ? (opInc / rev) * 100 : null,
        netMargin: netInc != null && rev > 0 ? (netInc / rev) * 100 : null,
      });
    }
  }

  let assetKind = 'stock';
  if (isValPerp) {
    assetKind = curated?.isPublicIpo ? 'valuation_perp' : 'preipo';
  } else if (curated?.isPublicIpo) {
    // Auto-upgrade recent IPOs to full 'stock' mode as soon as Nasdaq publishes structured EPS/financials
    assetKind = (ttmEps != null || latestRev != null) ? 'stock' : 'recent_ipo';
  } else if (curated?.assetKind) {
    assetKind = curated.assetKind;
  } else if (isEtf) {
    assetKind = 'etf';
  } else if (isIndexProxy) {
    assetKind = 'index';
  } else if (COMMODITY_FX_SET.has(ticker)) {
    assetKind = 'macro';
  } else if (!hasStockSum && !hasEtfSum) {
    assetKind = 'perp';
  }

  const resolvedCountry = curated?.country || countryName;
  const resolvedCadence = curated?.cadence || defaultCadence;

  const parsed = {
    ticker,
    assetKind,
    isValuationPerp: isValPerp,
    isEtf,
    isIndexProxy: isIndexProxy || isValPerp,
    proxySymbol,
    curated,
    hlStats,
    rangeSource,
    hasFundamentals: Boolean(refMarketCap || latestRev || ttmEps || prof?.CompanyDescription?.value || target?.priceTarget || curated || hlStats),
    companyName: curated?.companyName || (!isIndexProxy && prof?.CompanyName?.value) || (!isIndexProxy && infoData?.companyName) || COMPANY_NAMES[ticker] || ticker,
    exchange: curated?.exchange || sumData.Exchange?.value || infoData?.exchange || (isEtf ? 'US ETF' : 'Hyperliquid HIP-3'),
    sector: curated?.sector || sumData.Sector?.value || prof?.Sector?.value || (isEtf ? 'Exchange Traded Fund' : null),
    industry: curated?.industry || sumData.Industry?.value || prof?.Industry?.value || null,
    region: prof?.Region?.value || curated?.country || null,
    country: resolvedCountry,
    description: curated?.description || (!isIndexProxy && prof?.CompanyDescription?.value) || null,
    website: curated?.website || (!isIndexProxy && prof?.CompanyUrl?.value) || null,
    refMarketCap,
    refPrice,
    impliedShares,
    ttmEps,
    forwardEps,
    epsQuarters: epsList,
    pegValue: Number.isFinite(Number(peg?.pegValue)) ? Number(peg.pegValue) : null,
    annualDividend,
    exDividendDate: sumData.ExDividendDate?.value || null,
    dividendPayDate: sumData.DividendPaymentDate?.value || null,
    week52High,
    week52Low,
    beta,
    shareVolume,
    avgDailyVol,
    etfMetrics: (isEtf || isIndexProxy) ? {
      expenseRatio,
      weightedAlpha,
      stdDev,
      avgVol20d,
      avgVol65d,
      fundCap: refMarketCap,
      proxySymbol,
    } : null,
    earningsReports: {
      country: resolvedCountry,
      defaultCadence: resolvedCadence,
      isSemiAnnualCountry,
      hasRecentFinQ,
      finQCols,
      quarterly: isIndexProxy ? [] : quarterlyReports,
      semiAnnual: isIndexProxy ? [] : semiAnnualReports,
      filings: isIndexProxy ? [] : earningsFilings,
    },
    analyst: {
      rating: ratings?.meanRatingType || null,
      summary: ratings?.ratingsSummary || null,
      buy: Number.isFinite(Number(target?.buy)) ? Number(target.buy) : null,
      hold: Number.isFinite(Number(target?.hold)) ? Number(target.hold) : null,
      sell: Number.isFinite(Number(target?.sell)) ? Number(target.sell) : null,
      lowTarget: Number.isFinite(Number(target?.lowPriceTarget)) ? Number(target.lowPriceTarget) : null,
      meanTarget: Number.isFinite(Number(target?.priceTarget)) ? Number(target.priceTarget) : (isIndexProxy ? null : parseMoneyString(sumData.OneYrTarget?.value)),
      highTarget: Number.isFinite(Number(target?.highPriceTarget)) ? Number(target.highPriceTarget) : null,
      brokers: Array.isArray(ratings?.brokerNames) ? ratings.brokerNames : [],
    },
    financials: {
      periods,
      revenue: revArr,
      grossProfit: grossArr,
      rd: rdArr,
      operatingIncome: opIncArr,
      netIncome: netIncArr,
      latestRev,
      revGrowthYoY,
      latestGross,
      latestOpInc,
      latestNetInc,
      totalCash: totalCash > 0 ? totalCash : null,
      totalDebt: totalDebt > 0 ? totalDebt : null,
      totalAssets: assetsArr?.[0] ?? null,
      totalEquity: latestEquity,
      operatingCashFlow: latestOpCf,
      freeCashFlow,
      grossMargin: grossMarginArr?.[0] ?? (latestGross && latestRev ? (latestGross / latestRev) * 100 : null),
      operatingMargin: opMarginArr?.[0] ?? (latestOpInc && latestRev ? (latestOpInc / latestRev) * 100 : null),
      profitMargin: profitMarginArr?.[0] ?? (latestNetInc && latestRev ? (latestNetInc / latestRev) * 100 : null),
      roe: roeArr?.[0] ?? (latestNetInc && latestEquity && latestEquity > 0 ? (latestNetInc / latestEquity) * 100 : null),
      currentRatio: currentRatioArr?.[0] ? currentRatioArr[0] / 100 : null,
      quickRatio: quickRatioArr?.[0] ? quickRatioArr[0] / 100 : null,
    },
  };

  if (hlStats || refMarketCap || latestRev) {
    insightsCache.set(cacheKey, { at: Date.now(), data: parsed });
  }
  return parsed;
}

function detectSplitFactor(refPrice, livePrice) {
  if (!Number.isFinite(refPrice) || !Number.isFinite(livePrice) || refPrice <= 0 || livePrice <= 0) {
    return { factor: 1, label: null };
  }
  const ratio = refPrice / livePrice;
  const STD_SPLITS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 50, 100];
  if (ratio >= 1.7) {
    let best = Math.round(ratio);
    let bestErr = Infinity;
    for (const k of STD_SPLITS) {
      const err = Math.abs(ratio - k) / k;
      if (err < bestErr) { bestErr = err; best = k; }
    }
    const factor = bestErr <= 0.22 ? best : Math.max(2, Math.round(ratio));
    return { factor, label: `${factor}:1 Split` };
  }
  if (ratio <= 0.58) {
    const inv = livePrice / refPrice;
    let best = Math.round(inv);
    let bestErr = Infinity;
    for (const k of STD_SPLITS) {
      const err = Math.abs(inv - k) / k;
      if (err < bestErr) { bestErr = err; best = k; }
    }
    const k = bestErr <= 0.22 ? best : Math.max(2, Math.round(inv));
    return { factor: 1 / k, label: `1:${k} Rev Split` };
  }
  return { factor: 1, label: null };
}

function computeLiveValuation(ins, livePrice) {
  if (!ins || !Number.isFinite(livePrice) || livePrice <= 0) return {};

  // Auto-detect corporate stock splits when live Hyperliquid price has split ahead of Nasdaq fundamentals
  const split = !ins.isIndexProxy && ins.refPrice > 0
    ? detectSplitFactor(ins.refPrice, livePrice)
    : { factor: 1, label: null };
  const sf = split.factor;

  const adjImpliedShares = ins.impliedShares ? ins.impliedShares * sf : null;
  const liveMarketCap = ins.isIndexProxy
    ? ins.refMarketCap
    : (adjImpliedShares ? livePrice * adjImpliedShares : ins.refMarketCap);

  const adjTtmEps = Number.isFinite(ins.ttmEps) ? ins.ttmEps / sf : null;
  const adjForwardEps = Number.isFinite(ins.forwardEps) ? ins.forwardEps / sf : null;

  const liveTrailingPE = !ins.isIndexProxy && adjTtmEps && adjTtmEps > 0
    ? livePrice / adjTtmEps
    : (!ins.isIndexProxy && liveMarketCap && ins.financials?.latestNetInc > 0 ? liveMarketCap / ins.financials.latestNetInc : null);
  const liveForwardPE = !ins.isIndexProxy && adjForwardEps && adjForwardEps > 0 ? livePrice / adjForwardEps : null;

  // Scale reported PEG by split-adjusted live vs reference price ratio
  const livePEG = !ins.isIndexProxy && ins.pegValue && ins.refPrice && ins.refPrice > 0
    ? ins.pegValue * ((livePrice * sf) / ins.refPrice)
    : ins.pegValue;

  const livePS = !ins.isIndexProxy && liveMarketCap && ins.financials?.latestRev > 0 ? liveMarketCap / ins.financials.latestRev : null;
  const livePB = !ins.isIndexProxy && liveMarketCap && ins.financials?.totalEquity > 0 ? liveMarketCap / ins.financials.totalEquity : null;
  const liveEV = !ins.isIndexProxy && liveMarketCap
    ? liveMarketCap + (ins.financials?.totalDebt || 0) - (ins.financials?.totalCash || 0)
    : null;
  const liveEvToEbit = liveEV && ins.financials?.latestOpInc > 0 ? liveEV / ins.financials.latestOpInc : null;
  const liveEvToRev = liveEV && ins.financials?.latestRev > 0 ? liveEV / ins.financials.latestRev : null;
  const liveEarningsYield = liveTrailingPE && liveTrailingPE > 0 ? (100 / liveTrailingPE) : null;
  const adjAnnualDividend = ins.annualDividend && ins.annualDividend > 0 ? ins.annualDividend / sf : null;
  const liveDivYield = !ins.isIndexProxy && adjAnnualDividend ? (adjAnnualDividend / livePrice) * 100 : null;

  const adjLowTarget = !ins.isIndexProxy && ins.analyst?.lowTarget ? ins.analyst.lowTarget / sf : null;
  const adjMeanTarget = !ins.isIndexProxy && ins.analyst?.meanTarget ? ins.analyst.meanTarget / sf : null;
  const adjHighTarget = !ins.isIndexProxy && ins.analyst?.highTarget ? ins.analyst.highTarget / sf : null;
  const targetUpsidePct = adjMeanTarget ? ((adjMeanTarget - livePrice) / livePrice) * 100 : null;

  const hi = ins.week52High ? (ins.rangeSource === '52W' ? ins.week52High / sf : ins.week52High) : (ins.hlStats?.periodHigh || null);
  const lo = ins.week52Low ? (ins.rangeSource === '52W' ? ins.week52Low / sf : ins.week52Low) : (ins.hlStats?.periodLow || null);
  let range52PosPct = null;
  let pctFrom52High = null;
  if (hi && lo && hi > lo) {
    range52PosPct = Math.max(0, Math.min(100, ((livePrice - lo) / (hi - lo)) * 100));
    pctFrom52High = ((livePrice - hi) / hi) * 100;
  }

  return {
    splitFactor: sf,
    splitLabel: split.label,
    adjImpliedShares,
    adjTtmEps,
    adjForwardEps,
    adjAnnualDividend,
    adjLowTarget,
    adjMeanTarget,
    adjHighTarget,
    liveMarketCap,
    liveTrailingPE,
    liveForwardPE,
    livePEG,
    livePS,
    livePB,
    liveEV,
    liveEvToEbit,
    liveEvToRev,
    liveEarningsYield,
    liveDivYield,
    targetUpsidePct,
    range52PosPct,
    pctFrom52High,
    rangeHigh: hi,
    rangeLow: lo,
  };
}

const RANGE_PRESETS = {
  '1D':  { hlInterval: '5m',  bars: 288,  lookbackMs: 1 * 86_400_000,    yfRange: null,  yfInterval: null },
  '5D':  { hlInterval: '15m', bars: 480,  lookbackMs: 5 * 86_400_000,    yfRange: null,  yfInterval: null },
  '1M':  { hlInterval: '1h',  bars: 740,  lookbackMs: 31 * 86_400_000,   yfRange: '1mo', yfInterval: '60m' },
  '3M':  { hlInterval: '1d',  bars: 120,  lookbackMs: 92 * 86_400_000,   yfRange: '3mo', yfInterval: '1d' },
  '6M':  { hlInterval: '1d',  bars: 200,  lookbackMs: 184 * 86_400_000,  yfRange: '6mo', yfInterval: '1d' },
  '1Y':  { hlInterval: '1d',  bars: 380,  lookbackMs: 366 * 86_400_000,  yfRange: '1y',  yfInterval: '1d' },
  '3Y':  { hlInterval: '1w',  bars: 180,  lookbackMs: 3 * 366 * 86_400_000,  yfRange: '5y',  yfInterval: '1wk' },
  '5Y':  { hlInterval: '1w',  bars: 280,  lookbackMs: 5 * 366 * 86_400_000,  yfRange: '5y',  yfInterval: '1wk' },
  '10Y': { hlInterval: '1w',  bars: 540,  lookbackMs: 10 * 366 * 86_400_000, yfRange: '10y', yfInterval: '1wk' },
  'ALL': { hlInterval: '1M',  bars: 400,  lookbackMs: null,                  yfRange: 'max', yfInterval: '1mo' },
};

function stitchHistoryWithHL(histCandles, hlCandles, minCutoffMs = 0, category = 'stock') {
  const filteredHist = minCutoffMs > 0 ? histCandles.filter((c) => c.t >= minCutoffMs) : histCandles;
  if (!hlCandles || hlCandles.length === 0) {
    return { candles: filteredHist, hasBackfill: filteredHist.length > 0 };
  }
  if (!filteredHist || filteredHist.length === 0) {
    return { candles: hlCandles, hasBackfill: false };
  }
  const earliestHl = hlCandles[0].t;
  // Only prepend historical equity bars strictly before Hyperliquid's earliest bar
  let prior = filteredHist.filter((c) => c.t < earliestHl - 3_600_000);
  if (prior.length === 0) {
    return { candles: hlCandles, hasBackfill: false };
  }
  // Auto-normalize historical backfill ONLY for equities (never run stock-split math on crypto/macro!)
  if (category === 'stock') {
    const split = detectSplitFactor(prior[prior.length - 1].c, hlCandles[0].o || hlCandles[0].c);
    if (split.factor !== 1) {
      const sf = split.factor;
      prior = prior.map((c) => ({
        ...c,
        o: c.o / sf,
        h: c.h / sf,
        l: c.l / sf,
        c: c.c / sf,
        v: c.v * sf,
      }));
    }
  }
  return {
    candles: [...prior, ...hlCandles],
    hasBackfill: true,
  };
}

async function fetchCandlesWithHistory(coin, interval, rangeKey = null) {
  const now = Date.now();
  const preset = rangeKey ? RANGE_PRESETS[rangeKey] : null;
  const targetInterval = preset ? preset.hlInterval : interval;
  const barCount = preset ? preset.bars : (targetInterval === '1d' ? 400 : targetInterval === '1w' ? 300 : targetInterval === '1M' ? 240 : 320);

  let hlCandles = [];
  try {
    hlCandles = await fetchCandles(coin, targetInterval, now, barCount, true);
  } catch (_) {
    hlCandles = [];
  }

  let yfRange = preset?.yfRange || null;
  let yfInterval = preset?.yfInterval || null;
  let cutoffMs = preset?.lookbackMs ? now - preset.lookbackMs : 0;

  // Also allow multi-year backfill when user manually selects 1D, 1W, or 1M interval
  if (!preset) {
    if (targetInterval === '1d') { yfRange = '2y'; yfInterval = '1d'; }
    else if (targetInterval === '1w') { yfRange = '10y'; yfInterval = '1wk'; }
    else if (targetInterval === '1M') { yfRange = 'max'; yfInterval = '1mo'; }
  }

  let hasBackfill = false;
  let finalCandles = hlCandles;
  const dex = coin.includes(':') ? coin.split(':')[0] : 'spot';
  const ticker = resolveCoinTicker(coin);
  const category = classifyAsset(ticker, dex);

  if (yfRange && yfInterval) {
    const earliestNeeded = cutoffMs > 0 ? cutoffMs : 0;
    const earliestHL = hlCandles.length > 0 ? hlCandles[0].t : Infinity;
    // Fetch equity history if HL data doesn't already cover the full requested range
    if (hlCandles.length < 20 || earliestHL > earliestNeeded + 2 * 86_400_000 || rangeKey === 'ALL' || !preset) {
      const hist = await fetchEquityHistory(coin, yfRange, yfInterval);
      if (hist.length > 0) {
        const stitched = stitchHistoryWithHL(hist, hlCandles, cutoffMs, category);
        finalCandles = stitched.candles;
        hasBackfill = stitched.hasBackfill;
      }
    }
  }
  // Always enforce the exact range lookback cutoff so all compared assets start on the same date
  if (cutoffMs > 0 && finalCandles.length > 0) {
    const sliced = finalCandles.filter((c) => c.t >= cutoffMs);
    if (sliced.length >= 2) finalCandles = sliced;
  }

  finalCandles = normalizeIntraSeriesSplits(finalCandles, category);

  return {
    candles: finalCandles,
    interval: targetInterval,
    hasBackfill,
    sourceLabel: hasBackfill ? 'HL Live + History' : 'Hyperliquid Live',
  };
}

// MARK: Portfolio Performance Over Time vs. Benchmarks (S&P 500, Nasdaq-100, Mag 7 Perps, MSCI World)

function toUtcDayKey(tsMs) {
  const d = new Date(tsMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function resolveMag7PerpCoins(marketsMap) {
  return MAG7_PERP_TICKERS.map((t) => {
    const xyzId = `xyz:${t}`;
    if (marketsMap?.has(xyzId)) return xyzId;
    if (marketsMap) {
      for (const [id, m] of marketsMap.entries()) {
        if (m.ticker === t && !m.isSpot) return id;
      }
    }
    return xyzId;
  });
}

async function fetchDailyHistoryForHolding(coin, yfRange, livePrice) {
  const [hist, hl] = await Promise.all([
    fetchEquityHistory(coin, yfRange, '1d').catch(() => []),
    fetchCandles(coin, '1d', Date.now(), 365, false).catch(() => []),
  ]);
  const dex = coin.includes(':') ? coin.split(':')[0] : 'spot';
  const ticker = resolveCoinTicker(coin);
  const category = classifyAsset(ticker, dex);
  let stitched = normalizeIntraSeriesSplits(stitchHistoryWithHL(hist, hl, 0, category).candles, category);
  // Normalize full series if latest close vs livePrice reflects an unadjusted stock split (stocks only)
  if (category === 'stock' && stitched.length > 0 && Number.isFinite(livePrice) && livePrice > 0) {
    const lastC = stitched[stitched.length - 1].c;
    const sp = detectSplitFactor(lastC, livePrice);
    if (sp.factor !== 1) {
      stitched = stitched.map((c) => ({ ...c, c: c.c / sp.factor }));
    }
  }
  const byDay = new Map();
  for (const c of stitched) {
    if (Number.isFinite(c.c) && c.c > 0) byDay.set(toUtcDayKey(c.t), c.c);
  }
  return { byDay, sorted: stitched };
}

const INTRADAY_PF_PRESETS = {
  '15m': { hlInterval: '1m',  stepMs: 60_000,    lookbackMs: 15 * 60_000,       bars: 25,  yfRange: '1d', yfInterval: '1m' },
  '30m': { hlInterval: '1m',  stepMs: 60_000,    lookbackMs: 30 * 60_000,       bars: 40,  yfRange: '1d', yfInterval: '1m' },
  '1H':  { hlInterval: '1m',  stepMs: 60_000,    lookbackMs: 60 * 60_000,       bars: 70,  yfRange: '1d', yfInterval: '2m' },
  '3H':  { hlInterval: '5m',  stepMs: 300_000,   lookbackMs: 3 * 3_600_000,     bars: 48,  yfRange: '1d', yfInterval: '5m' },
  '6H':  { hlInterval: '5m',  stepMs: 300_000,   lookbackMs: 6 * 3_600_000,     bars: 84,  yfRange: '1d', yfInterval: '5m' },
  '12H': { hlInterval: '15m', stepMs: 900_000,   lookbackMs: 12 * 3_600_000,    bars: 60,  yfRange: '5d', yfInterval: '15m' },
  '1D':  { hlInterval: '15m', stepMs: 900_000,   lookbackMs: 24 * 3_600_000,    bars: 110, yfRange: '5d', yfInterval: '15m' },
  '3D':  { hlInterval: '30m', stepMs: 1_800_000, lookbackMs: 72 * 3_600_000,    bars: 160, yfRange: '5d', yfInterval: '30m' },
};

async function fetchIntradayPortfolioBenchmarkSeries(holdings, marketsMap, rangeKey) {
  const preset = INTRADAY_PF_PRESETS[rangeKey];
  if (!preset) return null;
  const now = Date.now();
  const cutoffMs = now - preset.lookbackMs;
  const uniqueSyms = Array.from(new Set(holdings.map((h) => h.symbol)));

  const sp500Coin = marketsMap?.has('xyz:SP500') ? 'xyz:SP500' : (marketsMap?.has('km:US500') ? 'km:US500' : 'xyz:SP500');
  const ndxCoin = marketsMap?.has('xyz:XYZ100') ? 'xyz:XYZ100' : (marketsMap?.has('km:USTECH') ? 'km:USTECH' : 'xyz:XYZ100');
  const jp225Coin = marketsMap?.has('xyz:JP225') ? 'xyz:JP225' : (marketsMap?.has('xyz:EWJ') ? 'xyz:EWJ' : 'xyz:JP225');
  const msciCoins = [sp500Coin, jp225Coin];
  const mag7Coins = resolveMag7PerpCoins(marketsMap);
  const allPerpSyms = Array.from(new Set([...uniqueSyms, ...mag7Coins]));

  const [spyCandles, qqqCandles, jp225Candles, urthCandles, symResults] = await Promise.all([
    fetchCandles(sp500Coin, preset.hlInterval, now, preset.bars, true).catch(() => []),
    fetchCandles(ndxCoin, preset.hlInterval, now, preset.bars, true).catch(() => []),
    fetchCandles(jp225Coin, preset.hlInterval, now, preset.bars, true).catch(() => []),
    fetchEquityHistory('URTH', preset.yfRange, preset.yfInterval).catch(() => []),
    Promise.all(
      allPerpSyms.map((sym) =>
        fetchCandles(sym, preset.hlInterval, now, preset.bars, true)
          .catch(() => [])
          .then((candles) => [sym, candles])
      )
    ),
  ]);

  const bucketTs = (t) => Math.floor(t / preset.stepMs) * preset.stepMs;
  const toBucketMap = (candles) => {
    const map = new Map();
    for (const c of candles || []) {
      if (Number.isFinite(c.c) && c.c > 0 && Number.isFinite(c.t)) {
        map.set(bucketTs(c.t), c.c);
      }
    }
    return map;
  };

  const spyMap = toBucketMap(spyCandles);
  const qqqMap = toBucketMap(qqqCandles);
  const jp225Map = toBucketMap(jp225Candles);
  const urthMap = toBucketMap(urthCandles);
  const symMaps = new Map(symResults.map(([sym, cands]) => [sym, toBucketMap(cands)]));

  // Build aligned intraday grid from cutoffMs .. now
  const tsSet = new Set();
  for (const t of spyMap.keys()) if (t >= cutoffMs) tsSet.add(t);
  for (const t of qqqMap.keys()) if (t >= cutoffMs) tsSet.add(t);
  for (const [, m] of symMaps) {
    for (const t of m.keys()) if (t >= cutoffMs) tsSet.add(t);
  }
  const nowBucket = now;
  tsSet.add(nowBucket);
  const timestamps = Array.from(tsSet).sort((a, b) => a - b);
  if (timestamps.length < 2) return null;

  function buildAlignedByTs(tsMap, fallbackVal, liveVal = null) {
    const keys = Array.from(tsMap.keys()).sort((a, b) => a - b);
    let ptr = 0;
    let lastKnown = null;
    while (ptr < keys.length && keys[ptr] <= timestamps[0]) {
      lastKnown = tsMap.get(keys[ptr]);
      ptr++;
    }
    if (lastKnown == null && keys.length > 0) lastKnown = tsMap.get(keys[0]);
    if (lastKnown == null) lastKnown = fallbackVal;

    const out = [];
    for (let i = 0; i < timestamps.length; i++) {
      const tk = timestamps[i];
      if (i === timestamps.length - 1 && Number.isFinite(liveVal) && liveVal > 0) {
        out.push(liveVal);
        continue;
      }
      while (ptr < keys.length && keys[ptr] <= tk) {
        lastKnown = tsMap.get(keys[ptr]);
        ptr++;
      }
      out.push(lastKnown);
    }
    return out;
  }

  const alignedHoldings = new Map();
  for (const sym of uniqueSyms) {
    const m = marketsMap?.get(sym);
    const livePx = m ? m.price : (holdings.find((h) => h.symbol === sym)?.avgPrice || 1);
    alignedHoldings.set(sym, buildAlignedByTs(symMaps.get(sym) || new Map(), livePx, livePx));
  }

  const portfolioVal = timestamps.map((_, idx) => {
    let total = 0;
    for (const h of holdings) {
      const arr = alignedHoldings.get(h.symbol);
      const px = arr ? arr[idx] : h.avgPrice;
      const cost = h.qty * h.avgPrice;
      if (h.side === 'short') {
        total += Math.max(0, cost + h.qty * (h.avgPrice - px));
      } else {
        total += h.qty * px;
      }
    }
    return total;
  });

  const startVal = portfolioVal[0] > 0 ? portfolioVal[0] : 1;
  const portfolioPct = portfolioVal.map((v) => ((v - startVal) / startVal) * 100);

  const buildIntradayBench = (tsMap, hlMarket, requireFreshInWindow = false) => {
    const keys = Array.from(tsMap.keys()).sort((a, b) => a - b);
    if (keys.length < 2) return null;
    if (requireFreshInWindow) {
      const inWin = keys.filter((k) => k >= cutoffMs);
      if (inWin.length < 2) return null;
    }
    const lastVal = tsMap.get(keys[keys.length - 1]);
    const liveVal = hlMarket && Number.isFinite(hlMarket.price) && hlMarket.price > 0 ? hlMarket.price : lastVal;
    const prices = buildAlignedByTs(tsMap, liveVal, liveVal);
    const base = prices[0] > 0 ? prices[0] : 1;
    const pct = prices.map((p) => ((p - base) / base) * 100);
    const dollar = pct.map((r) => startVal * (1 + r / 100));
    return { prices, pct, dollar, totalReturnPct: pct[pct.length - 1] };
  };

  // Equal-weighted Mag 7 composite computed strictly from the 7 live Hyperliquid perpetuals
  const mag7Constituents = [];
  for (const sym of mag7Coins) {
    const m = marketsMap?.get(sym);
    const tsMap = symMaps.get(sym) || new Map();
    const keys = Array.from(tsMap.keys());
    const liveVal = m && Number.isFinite(m.price) && m.price > 0 ? m.price : (keys.length ? tsMap.get(keys[keys.length - 1]) : null);
    if (!Number.isFinite(liveVal) || liveVal <= 0 || keys.length === 0) continue;
    const series = buildAlignedByTs(tsMap, liveVal, liveVal);
    const startPx = series[0];
    if (Number.isFinite(startPx) && startPx > 0) {
      mag7Constituents.push({ coin: sym, startPx, series });
    }
  }
  let mag7 = null;
  if (mag7Constituents.length > 0) {
    const prices = timestamps.map((_, idx) => {
      let sumNorm = 0;
      for (const c of mag7Constituents) sumNorm += c.series[idx] / c.startPx;
      return (sumNorm / mag7Constituents.length) * 100;
    });
    const pct = prices.map((p) => p - 100);
    const dollar = pct.map((r) => startVal * (1 + r / 100));
    mag7 = {
      prices,
      pct,
      dollar,
      totalReturnPct: pct[pct.length - 1],
      constituents: mag7Constituents.map((c) => ({ coin: c.coin, startPx: c.startPx })),
    };
  }

  const spy = buildIntradayBench(spyMap, marketsMap?.get(sp500Coin), false);
  const qqq = buildIntradayBench(qqqMap, marketsMap?.get(ndxCoin), false);

  // Hybrid MSCI World: real URTH intraday while US market is open, seamlessly bridged 24/7 via live SP500 (85%) + JP225 (15%) perps off-hours
  let msci = null;
  const urthKeys = Array.from(urthMap.keys()).sort((a, b) => a - b);
  const urthInWin = urthKeys.filter((k) => k >= cutoffMs);
  const lastUrthTs = urthKeys.length > 0 ? urthKeys[urthKeys.length - 1] : 0;
  const urthIsLiveNow = urthInWin.length >= 2 && (now - lastUrthTs) <= Math.max(20 * 60_000, preset.stepMs * 2);

  if (urthIsLiveNow) {
    msci = buildIntradayBench(urthMap, null, true);
    if (msci) msci.isEstimated = false;
  } else {
    const proxySpecs = [];
    const spM = marketsMap?.get(sp500Coin);
    const spKeys = Array.from(spyMap.keys());
    if (spKeys.length >= 2) {
      const spLive = spM && Number.isFinite(spM.price) && spM.price > 0 ? spM.price : spyMap.get(spKeys[spKeys.length - 1]);
      proxySpecs.push({ coin: sp500Coin, weight: 0.85, series: buildAlignedByTs(spyMap, spLive, spLive) });
    }
    const jpM = marketsMap?.get(jp225Coin);
    const jpKeys = Array.from(jp225Map.keys());
    if (jpKeys.length >= 2) {
      const jpLive = jpM && Number.isFinite(jpM.price) && jpM.price > 0 ? jpM.price : jp225Map.get(jpKeys[jpKeys.length - 1]);
      proxySpecs.push({ coin: jp225Coin, weight: 0.15, series: buildAlignedByTs(jp225Map, jpLive, jpLive) });
    }
    const wSum = proxySpecs.reduce((s, p) => s + p.weight, 0);
    if (wSum > 0) {
      for (const p of proxySpecs) p.weight /= wSum;
      if (urthInWin.length >= 2) {
        // Real URTH bars during open hours, then compound off-hours using live 24/7 perp proxy
        const urthRaw = buildAlignedByTs(urthMap, urthMap.get(lastUrthTs), urthMap.get(lastUrthTs));
        const urthStart = urthRaw[0] > 0 ? urthRaw[0] : 1;
        let handoffIdx = 0;
        for (let i = 0; i < timestamps.length; i++) {
          if (timestamps[i] <= lastUrthTs) handoffIdx = i;
        }
        const urthAtHandoff = urthRaw[handoffIdx] > 0 ? urthRaw[handoffIdx] : urthStart;
        const anchorBaseRatio = urthAtHandoff / urthStart;
        const constituents = proxySpecs.map((p) => ({
          coin: p.coin,
          weight: p.weight,
          refPx: p.series[handoffIdx] > 0 ? p.series[handoffIdx] : p.series[0],
        }));
        const prices = timestamps.map((ts, idx) => {
          if (idx <= handoffIdx) return (urthRaw[idx] / urthStart) * 100;
          let factor = 0;
          for (let j = 0; j < proxySpecs.length; j++) {
            const ref = constituents[j].refPx;
            factor += constituents[j].weight * (ref > 0 ? proxySpecs[j].series[idx] / ref : 1);
          }
          return anchorBaseRatio * factor * 100;
        });
        const pct = prices.map((p) => p - 100);
        const dollar = pct.map((r) => startVal * (1 + r / 100));
        msci = {
          prices,
          pct,
          dollar,
          totalReturnPct: pct[pct.length - 1],
          isEstimated: true,
          anchorBaseRatio,
          constituents,
        };
      } else {
        // Entire intraday window is off-hours: compute live 24/7 perp proxy directly
        const constituents = proxySpecs.map((p) => ({
          coin: p.coin,
          weight: p.weight,
          refPx: p.series[0] > 0 ? p.series[0] : 1,
        }));
        const prices = timestamps.map((_, idx) => {
          let factor = 0;
          for (let j = 0; j < proxySpecs.length; j++) {
            const ref = constituents[j].refPx;
            factor += constituents[j].weight * (ref > 0 ? proxySpecs[j].series[idx] / ref : 1);
          }
          return factor * 100;
        });
        const pct = prices.map((p) => p - 100);
        const dollar = pct.map((r) => startVal * (1 + r / 100));
        msci = {
          prices,
          pct,
          dollar,
          totalReturnPct: pct[pct.length - 1],
          isEstimated: true,
          anchorBaseRatio: 1,
          constituents,
        };
      }
    }
  }

  let peak = portfolioVal[0];
  let maxDrawdownPct = 0;
  for (const v of portfolioVal) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((v - peak) / peak) * 100;
      if (dd < maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  const portRets = [];
  const spyRets = [];
  for (let i = 1; i < portfolioVal.length; i++) {
    if (portfolioVal[i - 1] > 0 && portfolioVal[i] > 0) {
      portRets.push((portfolioVal[i] - portfolioVal[i - 1]) / portfolioVal[i - 1]);
      if (spy && spy.prices[i - 1] > 0 && spy.prices[i] > 0) {
        spyRets.push((spy.prices[i] - spy.prices[i - 1]) / spy.prices[i - 1]);
      }
    }
  }

  let periodVolPct = null;
  let betaVsSpy = null;
  if (portRets.length >= 5) {
    const meanP = portRets.reduce((s, x) => s + x, 0) / portRets.length;
    const varP = portRets.reduce((s, x) => s + (x - meanP) * (x - meanP), 0) / (portRets.length - 1);
    periodVolPct = Math.sqrt(varP) * Math.sqrt(portRets.length) * 100;
    if (spyRets.length === portRets.length) {
      const meanS = spyRets.reduce((s, x) => s + x, 0) / spyRets.length;
      let cov = 0;
      let varS = 0;
      for (let i = 0; i < spyRets.length; i++) {
        cov += (portRets[i] - meanP) * (spyRets[i] - meanS);
        varS += (spyRets[i] - meanS) * (spyRets[i] - meanS);
      }
      if (varS > 1e-12) betaVsSpy = cov / varS;
    }
  }

  const formatTsLabel = (ms) => {
    const d = new Date(ms);
    if (rangeKey === '3D') {
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const dates = timestamps.map((t, i) => (i === timestamps.length - 1 ? 'LIVE' : formatTsLabel(t)));
  const portReturnPct = portfolioPct[portfolioPct.length - 1];
  const portDollarChange = portfolioVal[portfolioVal.length - 1] - portfolioVal[0];

  return {
    rangeKey,
    isIntraday: true,
    timestamps,
    dates,
    spyCoin: sp500Coin,
    qqqCoin: ndxCoin,
    mag7Coins,
    msciCoins,
    portfolioVal,
    portfolioPct,
    benchmarks: { spy, qqq, mag7, msci },
    stats: {
      startVal,
      endVal: portfolioVal[portfolioVal.length - 1],
      portReturnPct,
      portDollarChange,
      spyReturnPct: spy ? spy.totalReturnPct : null,
      qqqReturnPct: qqq ? qqq.totalReturnPct : null,
      mag7ReturnPct: mag7 ? mag7.totalReturnPct : null,
      msciReturnPct: msci ? msci.totalReturnPct : null,
      alphaVsSpy: spy ? portReturnPct - spy.totalReturnPct : null,
      alphaVsQqq: qqq ? portReturnPct - qqq.totalReturnPct : null,
      alphaVsMag7: mag7 ? portReturnPct - mag7.totalReturnPct : null,
      alphaVsMsci: msci ? portReturnPct - msci.totalReturnPct : null,
      maxDrawdownPct,
      annVolPct: null,
      periodVolPct,
      sharpeRatio: null,
      betaVsSpy,
    },
  };
}

async function fetchPortfolioBenchmarkSeries(holdings, marketsMap, rangeKey = '1Y') {
  if (!Array.isArray(holdings) || holdings.length === 0) return null;
  if (INTRADAY_PF_PRESETS[rangeKey]) {
    return fetchIntradayPortfolioBenchmarkSeries(holdings, marketsMap, rangeKey);
  }

  const now = Date.now();
  const ytdStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
  const cutoffMap = {
    '1W': now - 8 * 86_400_000,
    '1M': now - 31 * 86_400_000,
    '3M': now - 92 * 86_400_000,
    '6M': now - 184 * 86_400_000,
    'YTD': ytdStart,
    '1Y': now - 366 * 86_400_000,
    '3Y': now - 3 * 366 * 86_400_000,
  };
  const yfRangeMap = {
    '1W': '3mo',
    '1M': '3mo',
    '3M': '6mo',
    '6M': '1y',
    'YTD': '1y',
    '1Y': '2y',
    '3Y': '5y',
  };
  const cutoffMs = cutoffMap[rangeKey] || cutoffMap['1Y'];
  const yfRange = yfRangeMap[rangeKey] || '2y';

  const uniqueSyms = Array.from(new Set(holdings.map((h) => h.symbol)));
  const mag7Coins = resolveMag7PerpCoins(marketsMap);
  const sp500Coin = marketsMap?.has('xyz:SP500') ? 'xyz:SP500' : (marketsMap?.has('km:US500') ? 'km:US500' : 'xyz:SP500');
  const jp225Coin = marketsMap?.has('xyz:JP225') ? 'xyz:JP225' : (marketsMap?.has('xyz:EWJ') ? 'xyz:EWJ' : 'xyz:JP225');
  const msciCoins = [sp500Coin, jp225Coin];
  const allEquitySyms = Array.from(new Set([...uniqueSyms, ...mag7Coins]));
  const benchSyms = ['SPY', 'QQQ', 'URTH'];

  const [benchResults, equityResults, sp500RecentHl, jp225RecentHl] = await Promise.all([
    Promise.all(benchSyms.map((s) => fetchEquityHistory(s, yfRange, '1d').catch(() => []))),
    Promise.all(
      allEquitySyms.map((sym) => {
        const m = marketsMap?.get(sym);
        return fetchDailyHistoryForHolding(sym, yfRange, m ? m.price : null).then((res) => [sym, res]);
      })
    ),
    fetchCandles(sp500Coin, '1d', now, 12, false).catch(() => []),
    fetchCandles(jp225Coin, '1d', now, 12, false).catch(() => []),
  ]);

  const benchBySym = {};
  benchSyms.forEach((sym, i) => {
    const map = new Map();
    for (const c of benchResults[i] || []) {
      if (Number.isFinite(c.c) && c.c > 0) map.set(toUtcDayKey(c.t), c.c);
    }
    benchBySym[sym] = { map, candles: benchResults[i] || [] };
  });

  // Static-web fallback: when Yahoo/Nasdaq equity history is unavailable (CORS on GitHub Pages),
  // seamlessly source S&P 500, Nasdaq 100, and MSCI World (85% SP500 + 15% JP225) from live Hyperliquid daily candles.
  const ndxCoin = marketsMap?.has('xyz:XYZ100') ? 'xyz:XYZ100' : (marketsMap?.has('km:USTECH') ? 'km:USTECH' : 'xyz:XYZ100');
  const needSpyHl = benchBySym.SPY.map.size === 0;
  const needQqqHl = benchBySym.QQQ.map.size === 0;
  const needUrthHl = benchBySym.URTH.map.size === 0;
  let sp500FullHl = null;
  let jp225FullHl = null;
  if (needSpyHl || needQqqHl || needUrthHl) {
    const [spFull, ndxFull, jpFull] = await Promise.all([
      (needSpyHl || needUrthHl) ? fetchCandles(sp500Coin, '1d', now, 400, false).catch(() => []) : Promise.resolve([]),
      needQqqHl ? fetchCandles(ndxCoin, '1d', now, 400, false).catch(() => []) : Promise.resolve([]),
      needUrthHl ? fetchCandles(jp225Coin, '1d', now, 400, false).catch(() => []) : Promise.resolve([]),
    ]);
    sp500FullHl = spFull;
    jp225FullHl = jpFull;
    if (needSpyHl && spFull.length > 0) {
      const m = new Map();
      for (const c of spFull) if (Number.isFinite(c.c) && c.c > 0) m.set(toUtcDayKey(c.t), c.c);
      benchBySym.SPY = { map: m, candles: spFull };
    }
    if (needQqqHl && ndxFull.length > 0) {
      const m = new Map();
      for (const c of ndxFull) if (Number.isFinite(c.c) && c.c > 0) m.set(toUtcDayKey(c.t), c.c);
      benchBySym.QQQ = { map: m, candles: ndxFull };
    }
  }

  const holdingSeriesMap = new Map(equityResults);

  // Build aligned trading-day timeline from SPY (or union of available holding dates)
  const daySet = new Set();
  for (const c of benchBySym.SPY.candles) {
    if (c.t >= cutoffMs) daySet.add(toUtcDayKey(c.t));
  }
  if (daySet.size < 3) {
    for (const [, res] of equityResults) {
      for (const c of res.sorted) {
        if (c.t >= cutoffMs) daySet.add(toUtcDayKey(c.t));
      }
    }
  }
  const todayKey = toUtcDayKey(now);
  daySet.add(todayKey);
  const dates = Array.from(daySet).sort();
  if (dates.length < 2) return null;

  // Helper to resolve daily close on or before each date with clean carry-forward
  function buildAlignedPrices(dayMap, fallbackFirst, liveVal = null) {
    const sortedKeys = Array.from(dayMap.keys()).sort();
    let ptr = 0;
    let lastKnown = null;
    while (ptr < sortedKeys.length && sortedKeys[ptr] <= dates[0]) {
      lastKnown = dayMap.get(sortedKeys[ptr]);
      ptr++;
    }
    if (lastKnown == null && sortedKeys.length > 0) {
      lastKnown = dayMap.get(sortedKeys[0]);
    }
    if (lastKnown == null) lastKnown = fallbackFirst;

    const out = [];
    for (let i = 0; i < dates.length; i++) {
      const dk = dates[i];
      if (i === dates.length - 1 && Number.isFinite(liveVal) && liveVal > 0) {
        out.push(liveVal);
        continue;
      }
      while (ptr < sortedKeys.length && sortedKeys[ptr] <= dk) {
        lastKnown = dayMap.get(sortedKeys[ptr]);
        ptr++;
      }
      out.push(lastKnown);
    }
    return out;
  }

  // Align each holding's price series
  const alignedHoldings = new Map();
  for (const sym of uniqueSyms) {
    const m = marketsMap?.get(sym);
    const livePx = m ? m.price : (holdings.find((h) => h.symbol === sym)?.avgPrice || 1);
    const res = holdingSeriesMap.get(sym);
    alignedHoldings.set(sym, buildAlignedPrices(res?.byDay || new Map(), livePx, livePx));
  }

  // Compute portfolio dollar value on every date
  const portfolioVal = dates.map((_, idx) => {
    let total = 0;
    for (const h of holdings) {
      const arr = alignedHoldings.get(h.symbol);
      const px = arr ? arr[idx] : h.avgPrice;
      const cost = h.qty * h.avgPrice;
      if (h.side === 'short') {
        total += Math.max(0, cost + h.qty * (h.avgPrice - px));
      } else {
        total += h.qty * px;
      }
    }
    return total;
  });

  const startVal = portfolioVal[0] > 0 ? portfolioVal[0] : 1;
  const portfolioPct = portfolioVal.map((v) => ((v - startVal) / startVal) * 100);

  // Align benchmarks (SPY/QQQ with live Hyperliquid proxy, Mag 7 strictly from the 7 live perpetuals)
  const sp500Hl = marketsMap?.get('xyz:SP500');
  const ndxHl = marketsMap?.get('xyz:XYZ100');
  const buildBench = (sym, hlProxy) => {
    const bMap = benchBySym[sym].map;
    const keys = Array.from(bMap.keys()).sort();
    if (keys.length === 0) return null;
    const lastKey = keys[keys.length - 1];
    let liveVal = bMap.get(lastKey);
    if (hlProxy && lastKey < todayKey && Number.isFinite(hlProxy.change24hPct)) {
      liveVal = liveVal * (1 + hlProxy.change24hPct / 100);
    }
    const prices = buildAlignedPrices(bMap, liveVal, liveVal);
    const base = prices[0] > 0 ? prices[0] : 1;
    const pct = prices.map((p) => ((p - base) / base) * 100);
    const dollar = pct.map((r) => startVal * (1 + r / 100));
    return { prices, pct, dollar, totalReturnPct: pct[pct.length - 1] };
  };

  // Equal-weighted Mag 7 basket built from the 7 Hyperliquid perpetuals + stitched history, anchored live to perp ticks
  const mag7Constituents = [];
  for (const sym of mag7Coins) {
    const m = marketsMap?.get(sym);
    const res = holdingSeriesMap.get(sym);
    const livePx = m && Number.isFinite(m.price) && m.price > 0 ? m.price : null;
    if (!res || res.byDay.size === 0) continue;
    const fallbackFirst = livePx || res.sorted[0]?.c || 1;
    const series = buildAlignedPrices(res.byDay, fallbackFirst, livePx);
    const startPx = series[0];
    if (Number.isFinite(startPx) && startPx > 0) {
      mag7Constituents.push({ coin: sym, startPx, series });
    }
  }
  let mag7 = null;
  if (mag7Constituents.length > 0) {
    const prices = dates.map((_, idx) => {
      let sumNorm = 0;
      for (const c of mag7Constituents) sumNorm += c.series[idx] / c.startPx;
      return (sumNorm / mag7Constituents.length) * 100;
    });
    const pct = prices.map((p) => p - 100);
    const dollar = pct.map((r) => startVal * (1 + r / 100));
    mag7 = {
      prices,
      pct,
      dollar,
      totalReturnPct: pct[pct.length - 1],
      constituents: mag7Constituents.map((c) => ({ coin: c.coin, startPx: c.startPx })),
    };
  }

  const spy = buildBench('SPY', sp500Hl);
  const qqq = buildBench('QQQ', ndxHl);

  // Hybrid MSCI World: real historical daily URTH, with final LIVE point updated 24/7 via SP500 (85%) + JP225 (15%) perps
  // Static-web fallback: if URTH is unavailable, build daily MSCI proxy from 85% SP500 + 15% JP225 Hyperliquid candles
  let msci = buildBench('URTH', null);
  if (!msci && Array.isArray(sp500FullHl) && sp500FullHl.length > 0) {
    const spMap = new Map();
    for (const c of sp500FullHl) if (Number.isFinite(c.c) && c.c > 0) spMap.set(toUtcDayKey(c.t), c.c);
    const jpMap = new Map();
    for (const c of jp225FullHl || []) if (Number.isFinite(c.c) && c.c > 0) jpMap.set(toUtcDayKey(c.t), c.c);
    const spM = marketsMap?.get(sp500Coin);
    const jpM = marketsMap?.get(jp225Coin);
    const spLive = spM && Number.isFinite(spM.price) && spM.price > 0 ? spM.price : null;
    const jpLive = jpM && Number.isFinite(jpM.price) && jpM.price > 0 ? jpM.price : null;
    const spSeries = spMap.size > 0 ? buildAlignedPrices(spMap, spLive || sp500FullHl[0].c, spLive) : null;
    const jpSeries = jpMap.size > 0 ? buildAlignedPrices(jpMap, jpLive || jp225FullHl[0].c, jpLive) : null;
    if (spSeries && spSeries[0] > 0) {
      const hasJp = Boolean(jpSeries && jpSeries[0] > 0);
      const wSp = hasJp ? 0.85 : 1.0;
      const wJp = hasJp ? 0.15 : 0.0;
      const prices = dates.map((_, idx) => {
        const spNorm = spSeries[idx] / spSeries[0];
        const jpNorm = hasJp ? jpSeries[idx] / jpSeries[0] : 1;
        return (wSp * spNorm + wJp * jpNorm) * 100;
      });
      const pct = prices.map((p) => p - 100);
      const dollar = pct.map((r) => startVal * (1 + r / 100));
      msci = {
        prices,
        pct,
        dollar,
        totalReturnPct: pct[pct.length - 1],
        isEstimated: true,
        constituents: hasJp
          ? [{ coin: sp500Coin, weight: wSp, refPx: spSeries[0] }, { coin: jp225Coin, weight: wJp, refPx: jpSeries[0] }]
          : [{ coin: sp500Coin, weight: 1.0, refPx: spSeries[0] }],
      };
    }
  }
  if (msci && benchBySym.URTH.map.size > 0) {
    const urthMap = benchBySym.URTH.map;
    const urthKeys = Array.from(urthMap.keys()).sort();
    const lastUrthDay = urthKeys[urthKeys.length - 1];
    const lastUrthClose = urthMap.get(lastUrthDay);
    const urthStart = msci.prices[0] > 0 ? msci.prices[0] : 1;
    const lookupRefOnOrBefore = (candles, dayKey, fallbackM) => {
      const dm = new Map();
      for (const c of candles || []) {
        if (Number.isFinite(c.c) && c.c > 0) dm.set(toUtcDayKey(c.t), c.c);
      }
      const ks = Array.from(dm.keys()).sort();
      let ref = null;
      for (const k of ks) {
        if (k <= dayKey) ref = dm.get(k);
      }
      if (ref == null && fallbackM && Number.isFinite(fallbackM.prevDayPx) && fallbackM.prevDayPx > 0) {
        ref = fallbackM.prevDayPx;
      }
      return ref;
    };
    const spM = marketsMap?.get(sp500Coin);
    const jpM = marketsMap?.get(jp225Coin);
    const rawConst = [];
    if (spM && Number.isFinite(spM.price) && spM.price > 0) {
      const refPx = lookupRefOnOrBefore(sp500RecentHl, lastUrthDay, spM);
      if (Number.isFinite(refPx) && refPx > 0) rawConst.push({ coin: sp500Coin, weight: 0.85, refPx, livePx: spM.price });
    }
    if (jpM && Number.isFinite(jpM.price) && jpM.price > 0) {
      const refPx = lookupRefOnOrBefore(jp225RecentHl, lastUrthDay, jpM);
      if (Number.isFinite(refPx) && refPx > 0) rawConst.push({ coin: jp225Coin, weight: 0.15, refPx, livePx: jpM.price });
    }
    const wSum = rawConst.reduce((s, c) => s + c.weight, 0);
    if (wSum > 0 && lastUrthDay < todayKey && Number.isFinite(lastUrthClose) && lastUrthClose > 0) {
      let factor = 0;
      const constituents = rawConst.map((c) => {
        const w = c.weight / wSum;
        factor += w * (c.livePx / c.refPx);
        return { coin: c.coin, weight: w, refPx: c.refPx };
      });
      const liveUrth = lastUrthClose * factor;
      const lastIdx = msci.prices.length - 1;
      const pctVal = ((liveUrth - urthStart) / urthStart) * 100;
      msci.prices[lastIdx] = liveUrth;
      msci.pct[lastIdx] = pctVal;
      msci.dollar[lastIdx] = startVal * (1 + pctVal / 100);
      msci.totalReturnPct = pctVal;
      msci.isEstimated = true;
      msci.anchorBaseRatio = lastUrthClose / urthStart;
      msci.constituents = constituents;
    } else {
      msci.isEstimated = false;
    }
  }

  // Risk & Alpha Analytics
  let peak = portfolioVal[0];
  let maxDrawdownPct = 0;
  for (const v of portfolioVal) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((v - peak) / peak) * 100;
      if (dd < maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  const portDailyRets = [];
  const spyDailyRets = [];
  for (let i = 1; i < portfolioVal.length; i++) {
    if (portfolioVal[i - 1] > 0 && portfolioVal[i] > 0) {
      const rp = (portfolioVal[i] - portfolioVal[i - 1]) / portfolioVal[i - 1];
      portDailyRets.push(rp);
      if (spy && spy.prices[i - 1] > 0 && spy.prices[i] > 0) {
        spyDailyRets.push((spy.prices[i] - spy.prices[i - 1]) / spy.prices[i - 1]);
      }
    }
  }

  let annVolPct = null;
  let sharpeRatio = null;
  let betaVsSpy = null;
  if (portDailyRets.length >= 5) {
    const meanP = portDailyRets.reduce((s, x) => s + x, 0) / portDailyRets.length;
    const varP = portDailyRets.reduce((s, x) => s + (x - meanP) * (x - meanP), 0) / (portDailyRets.length - 1);
    const sdP = Math.sqrt(varP);
    annVolPct = sdP * Math.sqrt(252) * 100;
    const annRetPct = meanP * 252 * 100;
    if (annVolPct > 0.5) {
      sharpeRatio = (annRetPct - 4.25) / annVolPct;
    }
    if (spyDailyRets.length === portDailyRets.length) {
      const meanS = spyDailyRets.reduce((s, x) => s + x, 0) / spyDailyRets.length;
      let cov = 0;
      let varS = 0;
      for (let i = 0; i < spyDailyRets.length; i++) {
        cov += (portDailyRets[i] - meanP) * (spyDailyRets[i] - meanS);
        varS += (spyDailyRets[i] - meanS) * (spyDailyRets[i] - meanS);
      }
      if (varS > 1e-10) betaVsSpy = cov / varS;
    }
  }

  const portReturnPct = portfolioPct[portfolioPct.length - 1];
  const portDollarChange = portfolioVal[portfolioVal.length - 1] - portfolioVal[0];

  return {
    rangeKey,
    dates,
    mag7Coins,
    msciCoins,
    portfolioVal,
    portfolioPct,
    benchmarks: { spy, qqq, mag7, msci },
    stats: {
      startVal,
      endVal: portfolioVal[portfolioVal.length - 1],
      portReturnPct,
      portDollarChange,
      spyReturnPct: spy ? spy.totalReturnPct : null,
      qqqReturnPct: qqq ? qqq.totalReturnPct : null,
      mag7ReturnPct: mag7 ? mag7.totalReturnPct : null,
      msciReturnPct: msci ? msci.totalReturnPct : null,
      alphaVsSpy: spy ? portReturnPct - spy.totalReturnPct : null,
      alphaVsQqq: qqq ? portReturnPct - qqq.totalReturnPct : null,
      alphaVsMag7: mag7 ? portReturnPct - mag7.totalReturnPct : null,
      alphaVsMsci: msci ? portReturnPct - msci.totalReturnPct : null,
      maxDrawdownPct,
      annVolPct,
      sharpeRatio,
      betaVsSpy,
    },
  };
}

  HS.DEX_LABELS = DEX_LABELS;
  HS.COMPANY_NAMES = COMPANY_NAMES;
  HS.MAG7_PERP_TICKERS = MAG7_PERP_TICKERS;
  HS.resolveCoinTicker = resolveCoinTicker;
  HS.classifyAsset = classifyAsset;
  HS.getCompanyName = getCompanyName;
  HS.hlInfo = hlInfo;
  HS.loadNativePrefs = loadNativePrefs;
  HS.saveNativePrefs = saveNativePrefs;
  HS.playAlertSound = playAlertSound;
  HS.startWindowDrag = startWindowDrag;
  HS.HyperliquidWSClient = HyperliquidWSClient;
  HS.fetchAllHip3Markets = fetchAllHip3Markets;
  HS.fetchCandles = fetchCandles;
  HS.fetchEquityHistory = fetchEquityHistory;
  HS.fetchCandlesWithHistory = fetchCandlesWithHistory;
  HS.fetchStockInsights = fetchStockInsights;
  HS.computeLiveValuation = computeLiveValuation;
  HS.detectSplitFactor = detectSplitFactor;
  HS.normalizeSplitPrevDayPx = normalizeSplitPrevDayPx;
  HS.normalizeIntraSeriesSplits = normalizeIntraSeriesSplits;
  HS.fetchPortfolioBenchmarkSeries = fetchPortfolioBenchmarkSeries;
  HS.RANGE_PRESETS = RANGE_PRESETS;
})(window);

