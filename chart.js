/* HyperStocks — High-DPI Interactive TradingView-Style Financial Charting Engine */
(function (global) {
  const HS = (global.HS = global.HS || {});

  function getMarketColors() {
    const isAsia = typeof document !== 'undefined' && document.body && document.body.classList.contains('color-asia');
    return isAsia
      ? {
          bull: '#ff4d6d',
          bear: '#00d395',
          bullRgb: '255, 77, 109',
          bearRgb: '0, 211, 149',
          bullDark: '#881337',
          bearDark: '#065f46',
          areaUp: '#fb7185',
          areaDown: '#2dd4bf',
          areaUpRgb: '251, 113, 133',
          areaDownRgb: '45, 212, 191',
          volBull: 'rgba(244, 63, 94, 0.22)',
          volBear: 'rgba(16, 185, 129, 0.22)',
        }
      : {
          bull: '#00d395',
          bear: '#ff4d6d',
          bullRgb: '0, 211, 149',
          bearRgb: '255, 77, 109',
          bullDark: '#065f46',
          bearDark: '#881337',
          areaUp: '#2dd4bf',
          areaDown: '#fb7185',
          areaUpRgb: '45, 212, 191',
          areaDownRgb: '251, 113, 133',
          volBull: 'rgba(16, 185, 129, 0.22)',
          volBear: 'rgba(244, 63, 94, 0.22)',
        };
  }

  function formatPrice(val) {
    if (val === null || val === undefined || Number.isNaN(val)) return '—';
    const n = Number(val);
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (abs >= 10) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (abs >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    if (abs >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 6 });
  }

  function formatCompact(val) {
    if (val === null || val === undefined || Number.isNaN(val)) return '—';
    const n = Number(val);
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(56, 189, 248, ${alpha})`;
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    return `rgba(56, 189, 248, ${alpha})`;
  }

  function lineDashForStyle(style, width = 1.6) {
    if (style === 'dashed') return [Math.max(5, width * 3.5), Math.max(3.5, width * 2.2)];
    if (style === 'dotted') return [Math.max(1.5, width * 1.1), Math.max(3, width * 2.2)];
    return [];
  }

  function intervalToMs(interval) {
    const map = {
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
    return map[interval] || 900_000;
  }

  function niceStep(range, targetSteps) {
    if (range <= 0 || !Number.isFinite(range)) return 1;
    const rough = range / Math.max(1, targetSteps);
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const frac = rough / pow10;
    let nice;
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 2.5) nice = 2.5;
    else if (frac <= 5) nice = 5;
    else nice = 10;
    return nice * pow10;
  }

  function computeSMA(values, period) {
    const out = new Array(values.length).fill(null);
    if (values.length < period) return out;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  function computeEMA(values, period) {
    const out = new Array(values.length).fill(null);
    if (values.length < period) return out;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let ema = sum / period;
    out[period - 1] = ema;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  function computeVWAP(candles) {
    const out = new Array(candles.length).fill(null);
    let cumPV = 0;
    let cumV = 0;
    let prevDay = null;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const d = new Date(c.t);
      const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      // Reset session VWAP on intraday intervals; keep rolling cumulative on >=1d
      if (candles.length > 1 && candles[1].t - candles[0].t < 43_200_000 && dayKey !== prevDay) {
        cumPV = 0;
        cumV = 0;
        prevDay = dayKey;
      }
      const tp = (c.h + c.l + c.c) / 3;
      const vol = c.v > 0 ? c.v : 1;
      cumPV += tp * vol;
      cumV += vol;
      out[i] = cumV > 0 ? cumPV / cumV : tp;
    }
    return out;
  }

  function computeBB(closes, period = 20, mult = 2) {
    const mid = new Array(closes.length).fill(null);
    const upper = new Array(closes.length).fill(null);
    const lower = new Array(closes.length).fill(null);
    if (closes.length < period) return { mid, upper, lower };
    for (let i = period - 1; i < closes.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      const mean = sum / period;
      let sq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const d = closes[j] - mean;
        sq += d * d;
      }
      const std = Math.sqrt(sq / period);
      mid[i] = mean;
      upper[i] = mean + mult * std;
      lower[i] = mean - mult * std;
    }
    return { mid, upper, lower };
  }

  function computeRSI(closes, period = 14) {
    const out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  function computeMACD(closes, fast = 12, slow = 26, sig = 9) {
    const n = closes.length;
    const macd = new Array(n).fill(null);
    const signal = new Array(n).fill(null);
    const hist = new Array(n).fill(null);
    if (n < slow) return { macd, signal, hist };

    const emaFast = computeEMA(closes, fast);
    const emaSlow = computeEMA(closes, slow);
    const validMacd = [];
    const validIndices = [];
    for (let i = 0; i < n; i++) {
      if (emaFast[i] !== null && emaSlow[i] !== null) {
        macd[i] = emaFast[i] - emaSlow[i];
        validMacd.push(macd[i]);
        validIndices.push(i);
      }
    }
    const sigArr = computeEMA(validMacd, sig);
    for (let j = 0; j < sigArr.length; j++) {
      if (sigArr[j] !== null) {
        const idx = validIndices[j];
        signal[idx] = sigArr[j];
        hist[idx] = macd[idx] - sigArr[j];
      }
    }
    return { macd, signal, hist };
  }

  function computeHeikinAshi(candles) {
    const out = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.o + c.h + c.l + c.c) / 4;
      const haOpen = i === 0 ? (c.o + c.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
      const haHigh = Math.max(c.h, haOpen, haClose);
      const haLow = Math.min(c.l, haOpen, haClose);
      out.push({ t: c.t, T: c.T, o: haOpen, h: haHigh, l: haLow, c: haClose, v: c.v });
    }
    return out;
  }

  function computeIchimoku(candles) {
    const n = candles.length;
    const tenkan = new Array(n).fill(null);
    const kijun = new Array(n).fill(null);
    const spanA = new Array(n).fill(null);
    const spanB = new Array(n).fill(null);
    const midHL = (idx, period) => {
      if (idx < period - 1) return null;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = idx - period + 1; j <= idx; j++) {
        if (candles[j].h > hi) hi = candles[j].h;
        if (candles[j].l < lo) lo = candles[j].l;
      }
      return (hi + lo) / 2;
    };
    for (let i = 0; i < n; i++) {
      tenkan[i] = midHL(i, 9);
      kijun[i] = midHL(i, 26);
      if (tenkan[i] !== null && kijun[i] !== null) {
        spanA[i] = (tenkan[i] + kijun[i]) / 2;
      }
      spanB[i] = midHL(i, 52);
    }
    return { tenkan, kijun, spanA, spanB };
  }

  function computePSAR(candles, step = 0.02, maxStep = 0.2) {
    const n = candles.length;
    const out = new Array(n).fill(null);
    if (n < 3) return out;
    let isUp = candles[1].c >= candles[0].c;
    let sar = isUp ? candles[0].l : candles[0].h;
    let ep = isUp ? candles[1].h : candles[1].l;
    let af = step;
    for (let i = 1; i < n; i++) {
      const c = candles[i];
      sar = sar + af * (ep - sar);
      if (isUp) {
        sar = Math.min(sar, candles[i - 1].l, i >= 2 ? candles[i - 2].l : candles[i - 1].l);
        if (c.l < sar) {
          isUp = false;
          sar = ep;
          ep = c.l;
          af = step;
        } else if (c.h > ep) {
          ep = c.h;
          af = Math.min(maxStep, af + step);
        }
      } else {
        sar = Math.max(sar, candles[i - 1].h, i >= 2 ? candles[i - 2].h : candles[i - 1].h);
        if (c.h > sar) {
          isUp = true;
          sar = ep;
          ep = c.h;
          af = step;
        } else if (c.l < ep) {
          ep = c.l;
          af = Math.min(maxStep, af + step);
        }
      }
      out[i] = { val: sar, up: isUp };
    }
    return out;
  }

  function computeStoch(candles, kPeriod = 14, dPeriod = 3) {
    const n = candles.length;
    const kArr = new Array(n).fill(null);
    const dArr = new Array(n).fill(null);
    for (let i = kPeriod - 1; i < n; i++) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (candles[j].h > hi) hi = candles[j].h;
        if (candles[j].l < lo) lo = candles[j].l;
      }
      kArr[i] = hi > lo ? ((candles[i].c - lo) / (hi - lo)) * 100 : 50;
    }
    for (let i = kPeriod + dPeriod - 2; i < n; i++) {
      let sum = 0;
      let cnt = 0;
      for (let j = i - dPeriod + 1; j <= i; j++) {
        if (kArr[j] !== null) { sum += kArr[j]; cnt++; }
      }
      if (cnt === dPeriod) dArr[i] = sum / dPeriod;
    }
    return { k: kArr, d: dArr };
  }

  function computeATR(candles, period = 14) {
    const n = candles.length;
    const out = new Array(n).fill(null);
    if (n <= period) return out;
    const tr = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      if (i === 0) tr[i] = c.h - c.l;
      else {
        const pc = candles[i - 1].c;
        tr[i] = Math.max(c.h - c.l, Math.abs(c.h - pc), Math.abs(c.l - pc));
      }
    }
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += tr[i];
    let atr = sum / period;
    out[period] = atr;
    for (let i = period + 1; i < n; i++) {
      atr = (atr * (period - 1) + tr[i]) / period;
      out[i] = atr;
    }
    return out;
  }

  function computeOBV(candles) {
    const n = candles.length;
    const out = new Array(n).fill(null);
    if (n === 0) return out;
    let obv = 0;
    out[0] = 0;
    for (let i = 1; i < n; i++) {
      if (candles[i].c > candles[i - 1].c) obv += candles[i].v || 0;
      else if (candles[i].c < candles[i - 1].c) obv -= candles[i].v || 0;
      out[i] = obv;
    }
    return out;
  }

  function formatAxisTime(ts, interval, showDate) {
    const d = new Date(ts);
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const yr = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (interval === '1M') {
      return d.getMonth() === 0 ? `${d.getFullYear()}` : `${mon} '${yr}`;
    }
    if (interval === '1d' || interval === '3d' || interval === '1w') {
      if (d.getMonth() === 0 && day <= 10) return `${mon} '${yr}`;
      return `${mon} ${day}`;
    }
    if (showDate) return `${mon} ${day} ${hh}:${mm}`;
    return `${hh}:${mm}`;
  }

  function formatCrosshairTime(ts, interval) {
    const d = new Date(ts);
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const yr = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (interval === '1M') return `${mon} ${yr}`;
    if (interval === '1d' || interval === '3d' || interval === '1w') return `${mon} ${day}, ${yr}`;
    return `${mon} ${day}, ${hh}:${mm}`;
  }

  function formatDuration(ms) {
    const abs = Math.abs(ms);
    const mins = Math.round(abs / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    if (days < 365) return `${days}d`;
    return `${(days / 365).toFixed(1)}y`;
  }

  function formatCountdown(msRemaining) {
    if (msRemaining <= 0) return '00:00';
    const totalSec = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSec / 86400);
    if (days > 0) return `${days}d ${Math.floor((totalSec % 86400) / 3600)}h`;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  const FIB_LEVELS = [
    { r: 0,     label: '0%',     color: 'rgba(148, 163, 184, 0.78)', fill: null },
    { r: 0.236, label: '23.6%',  color: 'rgba(244, 63, 94, 0.75)',   fill: 'rgba(244, 63, 94, 0.05)' },
    { r: 0.382, label: '38.2%',  color: 'rgba(251, 191, 36, 0.80)',  fill: 'rgba(251, 191, 36, 0.06)' },
    { r: 0.5,   label: '50.0%',  color: 'rgba(16, 185, 129, 0.82)',  fill: 'rgba(16, 185, 129, 0.06)' },
    { r: 0.618, label: '61.8%',  color: 'rgba(56, 189, 248, 0.88)',  fill: 'rgba(56, 189, 248, 0.07)' },
    { r: 0.786, label: '78.6%',  color: 'rgba(167, 139, 250, 0.80)', fill: 'rgba(167, 139, 250, 0.06)' },
    { r: 1,     label: '100%',   color: 'rgba(148, 163, 184, 0.78)', fill: 'rgba(148, 163, 184, 0.04)' },
  ];

  class InteractiveFinancialChart {
    constructor(container, options = {}) {
      this.container = container;
      this.compact = Boolean(options.compact);
      this.onHover = options.onHover || null;
      this.onRequestMoreHistory = options.onRequestMoreHistory || null;
      this.onAutoScaleChange = options.onAutoScaleChange || null;
      this.onDrawingsChange = options.onDrawingsChange || null;
      this.onToolChange = options.onToolChange || null;
      this.onSelectionChange = options.onSelectionChange || null;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'hs-chart-canvas';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.rawCandles = [];
      this.displayCandles = [];
      this.ema20 = [];
      this.ema50 = [];
      this.sma100 = [];
      this.sma200 = [];
      this.vwap = [];
      this.bb = { mid: [], upper: [], lower: [] };
      this.ichimoku = { tenkan: [], kijun: [], spanA: [], spanB: [] };
      this.psar = [];
      this.rsi = [];
      this.macd = { macd: [], signal: [], hist: [] };
      this.stoch = { k: [], d: [] };
      this.atr = [];
      this.obv = [];
      this.peSeries = [];
      this.fundamentalContext = null; // { ttmEps, forwardEps, ticker }

      this.interval = '15m';
      this.chartType = 'candles';
      this.logScale = false;
      this.magnetMode = false;
      this.indicators = {
        ema20: true,
        ema50: false,
        sma100: false,
        sma200: false,
        vwap: false,
        bb: false,
        ichimoku: false,
        psar: false,
        vpvr: false,
        volume: true,
        pe: false,
        rsi: false,
        macd: false,
        stoch: false,
        atr: false,
        obv: false,
      };
      this.alerts = [];

      // TradingView-style Drawing Tools state
      this.activeTool = 'cursor';
      this.drawings = [];
      this.draftDrawing = null;
      this.selectedDrawingId = null;
      this.stayInDrawingMode = false;
      this.drawingsVisible = true;
      this.drawingsLocked = false;
      this.defaultDrawingStyle = {
        color: '#38bdf8',
        lineWidth: 1.75,
        lineStyle: 'solid',
      };
      this._dragDrawing = null;
      this._draftMouseDownPos = null;
      this._brushDrawing = false;

      this.loadingHistory = false;
      this.hasMoreHistory = true;
      this.lastHistoryReqAt = 0;
      this.statusMessage = 'Loading live Hyperliquid candles...';

      // Multi-asset normalized % comparison state (base + up to 9 overlays = 10 total)
      this.baseLabel = '';
      this.compareSeries = [];

      // Viewport state
      this.barSpacing = this.compact ? 7 : 10.5;
      this.rightMarginBars = this.compact ? 4 : 7;
      this.scrollOffset = 0;
      this.autoScale = true;
      this.manualYMin = 0;
      this.manualYMax = 100;

      // Layout metrics
      this.width = 0;
      this.height = 0;
      this.dpr = window.devicePixelRatio || 1;
      this.priceAxisWidth = this.compact ? 62 : 78;
      this.timeAxisHeight = this.compact ? 22 : 26;
      this.topPad = this.compact ? 14 : 20;

      // Pointer state
      this.mouseX = null;
      this.mouseY = null;
      this.dragging = null;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragStartScroll = 0;
      this.dragStartYMin = 0;
      this.dragStartYMax = 0;
      this.hoveredIndex = null;

      // Cached latest Y range for hit-testing & drawing creation
      this._lastYMin = 0;
      this._lastYMax = 100;

      this._raf = null;
      this._countdownTimer = setInterval(() => {
        if (this.rawCandles.length > 0) this.requestDraw();
      }, 1000);

      this._bindEvents();
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.container);
      this.resize();
    }

    destroy() {
      clearInterval(this._countdownTimer);
      if (this._raf) cancelAnimationFrame(this._raf);
      this._resizeObserver.disconnect();
      window.removeEventListener('mousemove', this._onWindowMove);
      window.removeEventListener('mouseup', this._onWindowUp);
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      const isNarrow = rect.width < 520;
      this.priceAxisWidth = this.compact ? 62 : (isNarrow ? 58 : 78);
      this.rightMarginBars = this.compact ? 4 : (isNarrow ? 2.5 : 7);
      this.canvas.width = Math.round(rect.width * this.dpr);
      this.canvas.height = Math.round(rect.height * this.dpr);
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      if (this.compareSeries.length > 0) {
        this._emitHover(this.hoveredIndex);
      }
      this.requestDraw();
    }

    setIntervalName(interval) {
      this.interval = interval;
      this.requestDraw();
    }

    setChartType(type) {
      this.chartType = type;
      this._recomputeDerived();
      this.requestDraw();
    }

    setLogScale(enabled) {
      this.logScale = Boolean(enabled);
      this.requestDraw();
    }

    setMagnetMode(enabled) {
      this.magnetMode = Boolean(enabled);
    }

    setFundamentalContext(ctx) {
      this.fundamentalContext = ctx || null;
      this._recomputeDerived();
      if (this.hoveredIndex === null) this._emitHover(null);
      this.requestDraw();
    }

    setIndicators(ind) {
      this.indicators = { ...this.indicators, ...ind };
      this.requestDraw();
    }

    setAlerts(alerts) {
      this.alerts = alerts || [];
      this.requestDraw();
    }

    setStatusMessage(msg) {
      this.statusMessage = msg;
      this.requestDraw();
    }

    setBaseLabel(label) {
      this.baseLabel = String(label || '');
      this.requestDraw();
    }

    setCompareSeries(seriesList) {
      this.compareSeries = Array.isArray(seriesList)
        ? seriesList.slice(0, 9).map((s) => ({
            id: s.id,
            ticker: s.ticker,
            color: s.color || '#38bdf8',
            candles: Array.isArray(s.candles) ? s.candles.slice().sort((a, b) => a.t - b.t) : [],
            alignedCloses: [],
          }))
        : [];
      this._alignCompareSeries();
      this._emitHover(this.hoveredIndex);
      this.requestDraw();
    }

    upsertCompareTick(id, price) {
      if (!Number.isFinite(price) || price <= 0 || this.compareSeries.length === 0) return;
      const entry = this.compareSeries.find((s) => s.id === id);
      if (!entry) return;
      if (entry.candles.length > 0) {
        entry.candles[entry.candles.length - 1].c = price;
      }
      if (entry.alignedCloses.length > 0) {
        entry.alignedCloses[entry.alignedCloses.length - 1] = price;
      }
      if (this.hoveredIndex === null) this._emitHover(null);
      this.requestDraw();
    }

    _alignCompareSeries() {
      const base = this.rawCandles;
      const n = base.length;
      const intMs = intervalToMs(this.interval);
      // Tolerate UTC hour-of-day offsets across venues (e.g. HL 00:00 UTC vs Nasdaq 16:00 UTC vs Yahoo 13:30 UTC)
      const alignTol = intMs >= 86_400_000 ? Math.floor(intMs * 0.85) : Math.floor(intMs * 0.45);
      for (const s of this.compareSeries) {
        const src = s.candles;
        if (n === 0 || src.length === 0) {
          s.alignedCloses = new Array(n).fill(null);
          continue;
        }
        const out = new Array(n).fill(null);
        let ptr = 0;
        let lastKnown = null;
        const firstSrcT = src[0].t;
        while (ptr < src.length && src[ptr].t <= base[0].t + alignTol) {
          lastKnown = src[ptr].c;
          ptr++;
        }
        for (let i = 0; i < n; i++) {
          const tk = base[i].t;
          while (ptr < src.length && src[ptr].t <= tk + alignTol) {
            lastKnown = src[ptr].c;
            ptr++;
          }
          if (lastKnown != null) {
            out[i] = lastKnown;
          } else if (i === 0 && Math.abs(firstSrcT - tk) <= intMs * 2) {
            out[i] = src[0].c;
          }
        }
        s.alignedCloses = out;
      }
    }

    _compareAnchorIndex(n) {
      if (n <= 0) return 0;
      const firstVis = Math.ceil(this._xToIndexFloat(0));
      return Math.max(0, Math.min(n - 1, firstVis));
    }

    _compareVisibleEndIndex(n, anchorIdx) {
      if (n <= 0) return 0;
      const lastVis = Math.floor(this._xToIndexFloat(this._plotWidth()));
      return Math.max(anchorIdx, Math.min(n - 1, lastVis));
    }

    // Drawing Tool API
    setActiveTool(tool) {
      this.activeTool = tool || 'cursor';
      this.draftDrawing = null;
      this._brushDrawing = false;
      this._draftMouseDownPos = null;
      if (this.activeTool !== 'cursor') {
        this._selectDrawing(null);
      }
      this.onToolChange?.(this.activeTool);
      this.requestDraw();
    }

    setStayInDrawingMode(enabled) {
      this.stayInDrawingMode = Boolean(enabled);
    }

    setDrawingsVisible(visible) {
      this.drawingsVisible = Boolean(visible);
      if (!this.drawingsVisible) this._selectDrawing(null);
      this.requestDraw();
    }

    setDrawingsLocked(locked) {
      this.drawingsLocked = Boolean(locked);
      this.requestDraw();
    }

    _selectDrawing(id) {
      if (this.selectedDrawingId === id) return;
      this.selectedDrawingId = id;
      this.onSelectionChange?.(this.getSelectedDrawing());
      this.requestDraw();
    }

    getSelectedDrawing() {
      if (!this.selectedDrawingId) return null;
      return this.drawings.find((d) => d.id === this.selectedDrawingId) || null;
    }

    updateSelectedDrawing(patch) {
      const d = this.getSelectedDrawing();
      if (!d || !patch) return;
      Object.assign(d, patch);
      if (patch.color) this.defaultDrawingStyle.color = patch.color;
      if (patch.lineWidth) this.defaultDrawingStyle.lineWidth = patch.lineWidth;
      if (patch.lineStyle) this.defaultDrawingStyle.lineStyle = patch.lineStyle;
      this.onDrawingsChange?.(this.drawings);
      this.onSelectionChange?.(d);
      this.requestDraw();
    }

    duplicateSelectedDrawing() {
      const d = this.getSelectedDrawing();
      if (!d) return null;
      const clone = JSON.parse(JSON.stringify(d));
      clone.id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      clone.locked = false;
      const dt = intervalToMs(this.interval) * 3;
      const span = Math.max(1e-6, (this._lastYMax - this._lastYMin) * 0.03);
      if (clone.p1) { clone.p1.t += dt; clone.p1.price += span; }
      if (clone.p2) { clone.p2.t += dt; clone.p2.price += span; }
      if (clone.p3) { clone.p3.t += dt; clone.p3.price += span; }
      if (Array.isArray(clone.points)) {
        clone.points = clone.points.map((pt) => ({ t: pt.t + dt, price: pt.price + span }));
      }
      this.drawings.push(clone);
      this.onDrawingsChange?.(this.drawings);
      this._selectDrawing(clone.id);
      return clone;
    }

    editSelectedNoteText() {
      const d = this.getSelectedDrawing();
      if (!d || d.type !== 'note') return;
      const next = window.prompt('Edit chart annotation note:', d.text || '');
      if (next !== null && next.trim()) {
        d.text = next.trim().slice(0, 48);
        this.onDrawingsChange?.(this.drawings);
        this.onSelectionChange?.(d);
        this.requestDraw();
      }
    }

    setDrawings(list) {
      this.drawings = Array.isArray(list) ? list.map((d) => JSON.parse(JSON.stringify(d))) : [];
      this.draftDrawing = null;
      this._brushDrawing = false;
      this._selectDrawing(null);
      this.requestDraw();
    }

    undoDrawing() {
      if (this.draftDrawing) {
        this.draftDrawing = null;
        this._brushDrawing = false;
        this.requestDraw();
        return;
      }
      if (this.drawings.length === 0) return;
      this.drawings.pop();
      this._selectDrawing(null);
      this.onDrawingsChange?.(this.drawings);
      this.requestDraw();
    }

    deleteSelectedDrawing() {
      if (!this.selectedDrawingId) return false;
      const before = this.drawings.length;
      this.drawings = this.drawings.filter((d) => d.id !== this.selectedDrawingId);
      this._selectDrawing(null);
      if (this.drawings.length !== before) {
        this.onDrawingsChange?.(this.drawings);
        this.requestDraw();
        return true;
      }
      return false;
    }

    clearDrawings() {
      this.drawings = [];
      this.draftDrawing = null;
      this._brushDrawing = false;
      this._selectDrawing(null);
      this.onDrawingsChange?.(this.drawings);
      this.requestDraw();
    }

    setCandles(candles, { resetView = true, fitAll = false } = {}) {
      this.rawCandles = candles.slice().sort((a, b) => a.t - b.t);
      this.hasMoreHistory = true;
      this.loadingHistory = false;
      if (this.rawCandles.length === 0 && !this.statusMessage) {
        this.statusMessage = 'No candle data for this timeframe. Try 1h or 1D.';
      }
      this._recomputeDerived();
      if (fitAll && this.rawCandles.length > 1) {
        this.fitAllCandles();
      } else if (resetView) {
        this.scrollOffset = 0;
        this.autoScale = true;
        this.barSpacing = this.compact ? 7 : 10.5;
        this.onAutoScaleChange?.(true);
      }
      this._emitHover(null);
      this.requestDraw();
    }

    fitAllCandles() {
      const n = this.displayCandles.length;
      if (n <= 1) return;
      const plotW = this._plotWidth();
      const targetSpacing = plotW / (n + this.rightMarginBars + 2);
      this.barSpacing = Math.max(0.35, Math.min(32, targetSpacing));
      this.scrollOffset = 0;
      this.autoScale = true;
      this.onAutoScaleChange?.(true);
      if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
      this.requestDraw();
    }

    prependCandles(olderCandles) {
      this.loadingHistory = false;
      if (!olderCandles || olderCandles.length === 0) {
        this.hasMoreHistory = false;
        this.requestDraw();
        return;
      }
      const existingMap = new Map();
      for (const c of olderCandles) existingMap.set(c.t, c);
      for (const c of this.rawCandles) existingMap.set(c.t, c);
      const merged = Array.from(existingMap.values()).sort((a, b) => a.t - b.t);
      if (merged.length === this.rawCandles.length) {
        this.hasMoreHistory = false;
      } else {
        this.rawCandles = merged;
        this._recomputeDerived();
        if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
      }
      this.requestDraw();
    }

    upsertLiveCandle(candle) {
      if (!candle || !Number.isFinite(candle.c)) return;
      const n = this.rawCandles.length;
      if (n === 0) {
        this.rawCandles = [candle];
      } else {
        const last = this.rawCandles[n - 1];
        if (candle.t === last.t) {
          this.rawCandles[n - 1] = {
            t: candle.t,
            T: candle.T || last.T,
            o: candle.o,
            h: Math.max(candle.h, candle.c),
            l: Math.min(candle.l, candle.c),
            c: candle.c,
            v: candle.v,
          };
        } else if (candle.t > last.t) {
          this.rawCandles.push(candle);
          if (this.scrollOffset > 0) this.scrollOffset += 1;
        } else {
          for (let i = n - 2; i >= Math.max(0, n - 8); i--) {
            if (this.rawCandles[i].t === candle.t) {
              this.rawCandles[i] = candle;
              break;
            }
          }
        }
      }
      this._recomputeDerived();
      if (this.hoveredIndex === null) this._emitHover(null);
      this.requestDraw();
    }

    applyLiveTickPrice(price) {
      if (!Number.isFinite(price) || this.rawCandles.length === 0) return;
      const last = this.rawCandles[this.rawCandles.length - 1];
      const intMs = intervalToMs(this.interval);
      const now = Date.now();
      if (now >= last.t + intMs) {
        const bucketStart = Math.floor(now / intMs) * intMs;
        if (bucketStart > last.t) {
          this.rawCandles.push({
            t: bucketStart,
            T: bucketStart + intMs - 1,
            o: last.c,
            h: Math.max(last.c, price),
            l: Math.min(last.c, price),
            c: price,
            v: 0,
          });
          if (this.scrollOffset > 0) this.scrollOffset += 1;
          this._recomputeDerived();
          if (this.hoveredIndex === null) this._emitHover(null);
          this.requestDraw();
          return;
        }
      }
      last.c = price;
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      this._recomputeDerived();
      if (this.hoveredIndex === null) this._emitHover(null);
      this.requestDraw();
    }

    zoomBy(factor, anchorX = null) {
      const plotW = this._plotWidth();
      const x = anchorX !== null ? Math.min(Math.max(anchorX, 0), plotW) : plotW * 0.7;
      const idxAtCursor = this._xToIndexFloat(x);
      const nextSpacing = Math.max(0.35, Math.min(64, this.barSpacing * factor));
      if (Math.abs(nextSpacing - this.barSpacing) < 0.001) return;
      this.barSpacing = nextSpacing;
      const n = this.displayCandles.length;
      if (n > 0) {
        const barsFromRight = (plotW - x) / this.barSpacing - this.rightMarginBars;
        const newScroll = (n - 1) - idxAtCursor - barsFromRight;
        this.scrollOffset = this._clampScroll(newScroll);
      }
      this._maybeLoadMoreHistory();
      if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
      this.requestDraw();
    }

    resetView() {
      this.scrollOffset = 0;
      this.barSpacing = this.compact ? 7 : 10.5;
      this.autoScale = true;
      this.onAutoScaleChange?.(true);
      if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
      this.requestDraw();
    }

    enableAutoScale() {
      this.autoScale = true;
      this.onAutoScaleChange?.(true);
      this.requestDraw();
    }

    _recomputeDerived() {
      this.displayCandles =
        this.chartType === 'heikin' ? computeHeikinAshi(this.rawCandles) : this.rawCandles;
      const closes = this.rawCandles.map((c) => c.c);
      this.ema20 = computeEMA(closes, 20);
      this.ema50 = computeEMA(closes, 50);
      this.sma100 = computeSMA(closes, 100);
      this.sma200 = computeSMA(closes, 200);
      this.vwap = computeVWAP(this.rawCandles);
      this.bb = computeBB(closes, 20, 2);
      this.ichimoku = computeIchimoku(this.rawCandles);
      this.psar = computePSAR(this.rawCandles);
      this.rsi = computeRSI(closes, 14);
      this.macd = computeMACD(closes, 12, 26, 9);
      this.stoch = computeStoch(this.rawCandles, 14, 3);
      this.atr = computeATR(this.rawCandles, 14);
      this.obv = computeOBV(this.rawCandles);
      const ttmEps = this.fundamentalContext?.ttmEps;
      this.peSeries =
        ttmEps && ttmEps > 0
          ? closes.map((p) => (Number.isFinite(p) ? p / ttmEps : null))
          : new Array(closes.length).fill(null);
      if (this.compareSeries.length > 0) {
        this._alignCompareSeries();
      }
    }

    // Dynamic pane layout (main price plot + stacked synchronized oscillator / valuation sub-panes)
    _layoutPanes() {
      const totalAvail = Math.max(80, this.height - this.timeAxisHeight - this.topPad);
      const subOrder = ['pe', 'rsi', 'macd', 'stoch', 'atr', 'obv'];
      const activeSubs = (this.compact || this.compareSeries.length > 0) ? [] : subOrder.filter((k) => Boolean(this.indicators[k]));
      const subCount = activeSubs.length;
      const maxSubShare = subCount >= 3 ? 0.48 : subCount === 2 ? 0.38 : 0.22;
      const subH = subCount > 0 ? Math.max(58, Math.min(104, Math.floor((totalAvail * maxSubShare) / subCount))) : 0;
      const mainH = Math.max(100, totalAvail - subCount * subH);

      const mainTop = this.topPad;
      const mainBottom = mainTop + mainH;

      let cursorY = mainBottom;
      const subPanes = {};
      for (const k of activeSubs) {
        subPanes[k] = { top: cursorY, height: subH, bottom: cursorY + subH };
        cursorY += subH;
      }

      return {
        mainTop,
        mainHeight: mainH,
        mainBottom,
        pePane: subPanes.pe || null,
        rsiPane: subPanes.rsi || null,
        macdPane: subPanes.macd || null,
        stochPane: subPanes.stoch || null,
        atrPane: subPanes.atr || null,
        obvPane: subPanes.obv || null,
        timeAxisTop: cursorY,
      };
    }

    _plotWidth() {
      return Math.max(40, this.width - this.priceAxisWidth);
    }

    _clampScroll(val) {
      const n = this.displayCandles.length;
      const minScroll = -this.rightMarginBars + 2;
      const maxScroll = Math.max(0, n - 5);
      return Math.max(minScroll, Math.min(maxScroll, val));
    }

    _indexToX(index) {
      const n = this.displayCandles.length;
      const plotW = this._plotWidth();
      const rightBarFloat = (n - 1) - this.scrollOffset;
      return plotW - (this.rightMarginBars + (rightBarFloat - index)) * this.barSpacing;
    }

    _xToIndexFloat(x) {
      const n = this.displayCandles.length;
      const plotW = this._plotWidth();
      const rightBarFloat = (n - 1) - this.scrollOffset;
      return rightBarFloat - ((plotW - x) / this.barSpacing - this.rightMarginBars);
    }

    // Timestamp <-> X mapping (allows drawings to stay anchored across pan/zoom/interval)
    _timeToX(ts) {
      const arr = this.displayCandles;
      const n = arr.length;
      if (n === 0) return 0;
      if (n === 1) return this._indexToX(0);
      if (ts <= arr[0].t) {
        const dt = Math.max(1, arr[1].t - arr[0].t);
        return this._indexToX((ts - arr[0].t) / dt);
      }
      if (ts >= arr[n - 1].t) {
        const dt = Math.max(1, arr[n - 1].t - arr[n - 2].t);
        return this._indexToX((n - 1) + (ts - arr[n - 1].t) / dt);
      }
      // Binary search
      let lo = 0;
      let hi = n - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].t <= ts) lo = mid;
        else hi = mid;
      }
      const span = Math.max(1, arr[hi].t - arr[lo].t);
      const frac = (ts - arr[lo].t) / span;
      return this._indexToX(lo + frac);
    }

    _xToTime(x) {
      const arr = this.displayCandles;
      const n = arr.length;
      if (n === 0) return Date.now();
      const idxF = this._xToIndexFloat(x);
      if (n === 1) return arr[0].t;
      if (idxF <= 0) {
        const dt = Math.max(1, arr[1].t - arr[0].t);
        return Math.round(arr[0].t + idxF * dt);
      }
      if (idxF >= n - 1) {
        const dt = Math.max(1, arr[n - 1].t - arr[n - 2].t);
        return Math.round(arr[n - 1].t + (idxF - (n - 1)) * dt);
      }
      const lo = Math.floor(idxF);
      const hi = Math.min(n - 1, lo + 1);
      const frac = idxF - lo;
      return Math.round(arr[lo].t + frac * (arr[hi].t - arr[lo].t));
    }

    _visibleIndexRange() {
      const n = this.displayCandles.length;
      if (n === 0) return { start: 0, end: -1 };
      const startF = this._xToIndexFloat(0);
      const endF = this._xToIndexFloat(this._plotWidth());
      const start = Math.max(0, Math.floor(startF) - 1);
      const end = Math.min(n - 1, Math.ceil(endF) + 1);
      return { start, end };
    }

    _computeYRange(start, end) {
      if (!this.autoScale && this.manualYMax > this.manualYMin) {
        return { yMin: this.manualYMin, yMax: this.manualYMax };
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = start; i <= end; i++) {
        const c = this.displayCandles[i];
        if (!c) continue;
        if (this.chartType === 'area') {
          if (c.c < lo) lo = c.c;
          if (c.c > hi) hi = c.c;
        } else {
          if (c.l < lo) lo = c.l;
          if (c.h > hi) hi = c.h;
        }
        if (this.indicators.bb && this.bb.upper[i] !== null) {
          if (this.bb.lower[i] < lo) lo = this.bb.lower[i];
          if (this.bb.upper[i] > hi) hi = this.bb.upper[i];
        }
        if (this.indicators.ema20 && this.ema20[i] !== null) {
          if (this.ema20[i] < lo) lo = this.ema20[i];
          if (this.ema20[i] > hi) hi = this.ema20[i];
        }
        if (this.indicators.ema50 && this.ema50[i] !== null) {
          if (this.ema50[i] < lo) lo = this.ema50[i];
          if (this.ema50[i] > hi) hi = this.ema50[i];
        }
        if (this.indicators.sma200 && this.sma200[i] !== null) {
          if (this.sma200[i] < lo) lo = this.sma200[i];
          if (this.sma200[i] > hi) hi = this.sma200[i];
        }
        if (this.indicators.vwap && this.vwap[i] !== null) {
          if (this.vwap[i] < lo) lo = this.vwap[i];
          if (this.vwap[i] > hi) hi = this.vwap[i];
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { yMin: 0, yMax: 100 };
      }
      if (hi === lo) {
        const eps = Math.max(Math.abs(hi) * 0.01, 0.05);
        lo -= eps;
        hi += eps;
      }
      let yMin, yMax;
      if (this.logScale && lo > 0) {
        const lLo = Math.log(lo);
        const lHi = Math.log(hi);
        const lSpan = Math.max(0.01, lHi - lLo);
        const botPad = this.indicators.volume ? 0.22 : 0.09;
        yMin = Math.exp(lLo - lSpan * botPad);
        yMax = Math.exp(lHi + lSpan * 0.08);
      } else {
        const span = hi - lo;
        const bottomPadFrac = this.indicators.volume ? 0.22 : 0.09;
        yMin = lo - span * bottomPadFrac;
        yMax = hi + span * 0.08;
      }
      this.manualYMin = yMin;
      this.manualYMax = yMax;
      return { yMin, yMax };
    }

    _priceToY(price, yMin, yMax, mainTop, mainHeight) {
      if (this.logScale && yMin > 0 && yMax > 0) {
        const p = Math.max(price, 1e-6);
        const lMin = Math.log(yMin);
        const lMax = Math.log(yMax);
        const frac = (Math.log(p) - lMin) / Math.max(1e-9, lMax - lMin);
        return mainTop + mainHeight * (1 - frac);
      }
      const frac = (price - yMin) / Math.max(1e-9, yMax - yMin);
      return mainTop + mainHeight * (1 - frac);
    }

    _yToPrice(y, yMin, yMax, mainTop, mainHeight) {
      const frac = 1 - (y - mainTop) / Math.max(1, mainHeight);
      if (this.logScale && yMin > 0 && yMax > 0) {
        const lMin = Math.log(yMin);
        const lMax = Math.log(yMax);
        return Math.exp(lMin + frac * (lMax - lMin));
      }
      return yMin + frac * (yMax - yMin);
    }

    _maybeLoadMoreHistory() {
      if (!this.onRequestMoreHistory || this.loadingHistory || !this.hasMoreHistory) return;
      if (this.rawCandles.length === 0) return;
      const { start } = this._visibleIndexRange();
      if (start <= 20 && Date.now() - this.lastHistoryReqAt > 1200) {
        this.loadingHistory = true;
        this.lastHistoryReqAt = Date.now();
        this.onRequestMoreHistory(this.rawCandles[0].t);
      }
    }

    _emitHover(index) {
      if (!this.onHover) return;
      const n = this.rawCandles.length;
      if (n === 0) {
        this.onHover(null);
        return;
      }
      const idx = index !== null && index >= 0 && index < n ? index : n - 1;
      const c = this.rawCandles[idx];
      const prev = idx > 0 ? this.rawCandles[idx - 1] : null;
      let compareItems = null;
      let compareAnchorTime = null;
      if (this.compareSeries.length > 0) {
        const anchorIdx = this._compareAnchorIndex(n);
        const visEndIdx = this._compareVisibleEndIndex(n, anchorIdx);
        const evalIdx = index !== null && index >= 0 && index < n ? index : visEndIdx;
        const evalCandle = this.rawCandles[evalIdx] || c;
        compareAnchorTime = this.rawCandles[anchorIdx]?.t || null;
        const baseAnchor = this.rawCandles[anchorIdx]?.c || evalCandle.c;
        const basePct = baseAnchor > 0 ? ((evalCandle.c - baseAnchor) / baseAnchor) * 100 : 0;
        compareItems = [
          { id: '__base__', ticker: this.baseLabel || 'Base', color: '#50e3c2', pct: basePct, price: evalCandle.c, isBase: true },
        ];
        for (const s of this.compareSeries) {
          let anchorPx = s.alignedCloses[anchorIdx];
          if (!Number.isFinite(anchorPx) || anchorPx <= 0) {
            for (let k = anchorIdx; k <= visEndIdx; k++) {
              if (Number.isFinite(s.alignedCloses[k]) && s.alignedCloses[k] > 0) {
                anchorPx = s.alignedCloses[k];
                break;
              }
            }
          }
          const curPx = s.alignedCloses[evalIdx];
          const pct = Number.isFinite(anchorPx) && anchorPx > 0 && Number.isFinite(curPx) ? ((curPx - anchorPx) / anchorPx) * 100 : null;
          compareItems.push({ id: s.id, ticker: s.ticker, color: s.color, pct, price: curPx, isBase: false });
        }
      }
      this.onHover({
        candle: c,
        prevClose: prev ? prev.c : c.o,
        ema20: this.ema20[idx],
        ema50: this.ema50[idx],
        sma100: this.sma100[idx],
        sma200: this.sma200[idx],
        vwap: this.vwap[idx],
        pe: this.peSeries[idx],
        rsi: this.rsi[idx],
        macd: this.macd.macd[idx],
        macdSignal: this.macd.signal[idx],
        macdHist: this.macd.hist[idx],
        stochK: this.stoch.k[idx],
        stochD: this.stoch.d[idx],
        atr: this.atr[idx],
        obv: this.obv[idx],
        isLive: index === null || idx === n - 1,
        compareItems,
        compareAnchorTime,
        interval: this.interval,
      });
    }

    _snapPoint(x, y, panes) {
      let t = this._xToTime(x);
      let price = this._yToPrice(y, this._lastYMin, this._lastYMax, panes.mainTop, panes.mainHeight);
      if (this.magnetMode && this.displayCandles.length > 0) {
        const idx = Math.max(0, Math.min(this.displayCandles.length - 1, Math.round(this._xToIndexFloat(x))));
        const c = this.displayCandles[idx];
        if (c) {
          t = c.t;
          const cands = [c.o, c.h, c.l, c.c];
          let best = cands[0];
          let bestDist = Infinity;
          for (const v of cands) {
            const dist = Math.abs(v - price);
            if (dist < bestDist) { bestDist = dist; best = v; }
          }
          price = best;
        }
      }
      return { t, price };
    }

    _getPositionTargetPrice(d) {
      if (d.p3 && Number.isFinite(d.p3.price)) return d.p3.price;
      const entry = d.p1.price;
      const stop = d.p2.price;
      return entry + (entry - stop) * 2;
    }

    _hitTestAnchor(d, x, y, panes) {
      if (!d) return null;
      const yMin = this._lastYMin;
      const yMax = this._lastYMax;
      const radius = 10;
      const check = (key, pt) => {
        if (!pt) return false;
        const ax = this._timeToX(pt.t);
        const ay = this._priceToY(pt.price, yMin, yMax, panes.mainTop, panes.mainHeight);
        return Math.hypot(x - ax, y - ay) <= radius;
      };
      if (d.type === 'hline' || d.type === 'vline' || d.type === 'brush') return null;
      if (d.type === 'position' && d.p1 && d.p2) {
        const tpPrice = this._getPositionTargetPrice(d);
        const tpX = Math.max(this._timeToX(d.p1.t), this._timeToX(d.p2.t), Math.min(this._timeToX(d.p1.t), this._timeToX(d.p2.t)) + 110);
        const tpY = this._priceToY(tpPrice, yMin, yMax, panes.mainTop, panes.mainHeight);
        if (Math.hypot(x - tpX, y - tpY) <= radius) return 'p3';
      }
      if (d.p3 && check('p3', d.p3)) return 'p3';
      if (d.p2 && check('p2', d.p2)) return 'p2';
      if (d.p1 && check('p1', d.p1)) return 'p1';
      return null;
    }

    _hitTestDrawing(x, y, panes) {
      if (!this.drawingsVisible) return null;
      const yMin = this._lastYMin;
      const yMax = this._lastYMax;
      const plotW = this._plotWidth();
      const threshold = 9;

      for (let i = this.drawings.length - 1; i >= 0; i--) {
        const d = this.drawings[i];
        if (d.type === 'hline') {
          const ly = this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (Math.abs(y - ly) <= threshold) return d.id;
        } else if (d.type === 'hray') {
          const lx = this._timeToX(d.p1.t);
          const ly = this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (x >= lx - 6 && Math.abs(y - ly) <= threshold) return d.id;
        } else if (d.type === 'vline') {
          const lx = this._timeToX(d.p1.t);
          if (Math.abs(x - lx) <= threshold) return d.id;
        } else if (d.type === 'note' || d.type === 'pricelabel') {
          const nx = this._timeToX(d.p1.t);
          const ny = this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (Math.abs(x - nx) <= 72 && Math.abs(y - (ny - 14)) <= 22) return d.id;
        } else if (d.type === 'brush' && Array.isArray(d.points) && d.points.length >= 2) {
          for (let j = 1; j < d.points.length; j++) {
            const x1 = this._timeToX(d.points[j - 1].t);
            const y1 = this._priceToY(d.points[j - 1].price, yMin, yMax, panes.mainTop, panes.mainHeight);
            const x2 = this._timeToX(d.points[j].t);
            const y2 = this._priceToY(d.points[j].price, yMin, yMax, panes.mainTop, panes.mainHeight);
            if (distToSegment(x, y, x1, y1, x2, y2) <= threshold) return d.id;
          }
        } else if (d.p1 && d.p2) {
          const x1 = this._timeToX(d.p1.t);
          const y1 = this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          const x2 = this._timeToX(d.p2.t);
          const y2 = this._priceToY(d.p2.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (d.type === 'trendline' || d.type === 'arrow') {
            if (d.extendLeft || d.extendRight) {
              const dx = x2 - x1;
              const dy = y2 - y1;
              const sx = d.extendLeft && Math.abs(dx) > 0.5 ? (dx > 0 ? 0 : plotW) : x1;
              const sy = d.extendLeft && Math.abs(dx) > 0.5 ? y1 + dy * ((sx - x1) / dx) : y1;
              const ex = d.extendRight && Math.abs(dx) > 0.5 ? (dx > 0 ? plotW : 0) : x2;
              const ey = d.extendRight && Math.abs(dx) > 0.5 ? y1 + dy * ((ex - x1) / dx) : y2;
              if (distToSegment(x, y, sx, sy, ex, ey) <= threshold) return d.id;
            } else if (distToSegment(x, y, x1, y1, x2, y2) <= threshold) {
              return d.id;
            }
          } else if (d.type === 'ray') {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const ex = Math.abs(dx) > 0.5 ? (dx >= 0 ? plotW : 0) : x2;
            const ey = Math.abs(dx) > 0.5 ? y1 + dy * ((ex - x1) / dx) : y2;
            if (distToSegment(x, y, x1, y1, ex, ey) <= threshold) return d.id;
          } else if (d.type === 'extline') {
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (Math.abs(dx) > 0.5) {
              const yL = y1 + dy * ((0 - x1) / dx);
              const yR = y1 + dy * ((plotW - x1) / dx);
              if (distToSegment(x, y, 0, yL, plotW, yR) <= threshold) return d.id;
            } else if (Math.abs(x - x1) <= threshold) {
              return d.id;
            }
          } else if (d.type === 'pchannel') {
            const y3 = d.p3 ? this._priceToY(d.p3.price, yMin, yMax, panes.mainTop, panes.mainHeight) : y2 - 36;
            const x3 = d.p3 ? this._timeToX(d.p3.t) : x2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const baseAtX3 = Math.abs(dx) > 0.5 ? y1 + dy * ((x3 - x1) / dx) : y1;
            const offY = y3 - baseAtX3;
            if (
              distToSegment(x, y, x1, y1, x2, y2) <= threshold ||
              distToSegment(x, y, x1, y1 + offY, x2, y2 + offY) <= threshold
            ) {
              return d.id;
            }
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            if (x >= minX && x <= maxX && Math.abs(dx) > 0.5) {
              const bY = y1 + dy * ((x - x1) / dx);
              const loY = Math.min(bY, bY + offY);
              const hiY = Math.max(bY, bY + offY);
              if (y >= loY && y <= hiY) return d.id;
            }
          } else if (d.type === 'ellipse') {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const rx = Math.max(6, Math.abs(x2 - x1) / 2);
            const ry = Math.max(6, Math.abs(y2 - y1) / 2);
            const norm = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
            if (norm <= 1.12) return d.id;
          } else if (d.type === 'position') {
            const leftX = Math.min(x1, x2);
            const rightX = Math.max(x1, x2, leftX + 110);
            const tpY = this._priceToY(this._getPositionTargetPrice(d), yMin, yMax, panes.mainTop, panes.mainHeight);
            const minY = Math.min(y1, y2, tpY) - 4;
            const maxY = Math.max(y1, y2, tpY) + 4;
            if (x >= leftX - 4 && x <= rightX + 4 && y >= minY && y <= maxY) return d.id;
          } else {
            // Rect / Fib / Measure / Channel
            const minX = d.type === 'channel' ? 0 : Math.min(x1, x2) - 4;
            const maxX = d.type === 'channel' ? plotW : Math.max(x1, x2) + 4;
            const minY = Math.min(y1, y2) - 4;
            const maxY = Math.max(y1, y2) + 4;
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return d.id;
          }
        }
      }
      return null;
    }

    _commitDraftDrawing(finished) {
      delete finished._step;
      this.draftDrawing = null;
      this._draftMouseDownPos = null;
      this._brushDrawing = false;
      this.drawingsVisible = true;
      this.drawings.push(finished);
      this.onDrawingsChange?.(this.drawings);
      if (this.stayInDrawingMode) {
        this._selectDrawing(null);
      } else {
        this.activeTool = 'cursor';
        this.onToolChange?.('cursor');
        this._selectDrawing(finished.id);
      }
      this.requestDraw();
    }

    _bindEvents() {
      this.canvas.addEventListener('contextmenu', (e) => {
        if (this.draftDrawing || this.activeTool !== 'cursor') {
          e.preventDefault();
          this.draftDrawing = null;
          this._brushDrawing = false;
          this.setActiveTool('cursor');
        }
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const panes = this._layoutPanes();
        const plotW = this._plotWidth();

        // Drawing mode handling inside main price plot
        if (!this.compact && this.activeTool !== 'cursor' && x < plotW && y >= panes.mainTop && y <= panes.mainBottom && this.displayCandles.length > 0) {
          const pt = this._snapPoint(x, y, panes);
          const baseStyle = {
            color: this.defaultDrawingStyle.color,
            lineWidth: this.defaultDrawingStyle.lineWidth,
            lineStyle: this.defaultDrawingStyle.lineStyle,
          };

          // Single-click tools
          if (this.activeTool === 'hline' || this.activeTool === 'hray' || this.activeTool === 'vline' || this.activeTool === 'pricelabel') {
            const item = {
              id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: this.activeTool,
              p1: pt,
              ...baseStyle,
            };
            this._commitDraftDrawing(item);
            e.preventDefault();
            return;
          }

          if (this.activeTool === 'note') {
            const txt = window.prompt('Chart annotation note:', 'Breakout');
            if (txt && txt.trim()) {
              const item = {
                id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'note',
                p1: pt,
                text: txt.trim().slice(0, 48),
                ...baseStyle,
              };
              this._commitDraftDrawing(item);
            } else if (!this.stayInDrawingMode) {
              this.setActiveTool('cursor');
            }
            e.preventDefault();
            return;
          }

          // Freehand Brush tool
          if (this.activeTool === 'brush') {
            this.draftDrawing = {
              id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'brush',
              p1: pt,
              points: [pt],
              ...baseStyle,
            };
            this._brushDrawing = true;
            this.requestDraw();
            e.preventDefault();
            return;
          }

          // 3-point Parallel Channel
          if (this.activeTool === 'pchannel') {
            if (!this.draftDrawing) {
              this.draftDrawing = {
                id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'pchannel',
                p1: pt,
                p2: pt,
                p3: null,
                _step: 2,
                ...baseStyle,
              };
              this._draftMouseDownPos = { x, y };
              this.requestDraw();
            } else if (this.draftDrawing._step === 2) {
              this.draftDrawing.p2 = pt;
              this.draftDrawing.p3 = pt;
              this.draftDrawing._step = 3;
              this._draftMouseDownPos = null;
              this.requestDraw();
            } else {
              this.draftDrawing.p3 = pt;
              this._commitDraftDrawing(this.draftDrawing);
            }
            e.preventDefault();
            return;
          }

          // Standard 2-point tools (supports BOTH click-drag AND click-then-click!)
          if (!this.draftDrawing) {
            this.draftDrawing = {
              id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: this.activeTool,
              p1: pt,
              p2: pt,
              ...baseStyle,
            };
            this._draftMouseDownPos = { x, y };
            this.requestDraw();
          } else {
            this.draftDrawing.p2 = pt;
            this._commitDraftDrawing(this.draftDrawing);
          }
          e.preventDefault();
          return;
        }

        // Cursor mode: check selected drawing anchor handles first, then body drag!
        if (!this.compact && this.activeTool === 'cursor' && this.drawingsVisible && x < plotW && y >= panes.mainTop && y <= panes.mainBottom) {
          const curSel = this.getSelectedDrawing();
          if (curSel && !this.drawingsLocked && !curSel.locked) {
            const handleKey = this._hitTestAnchor(curSel, x, y, panes);
            if (handleKey) {
              this.dragging = 'drawing-handle';
              this._dragDrawing = { drawing: curSel, handleKey };
              this.canvas.style.cursor = 'move';
              e.preventDefault();
              return;
            }
          }

          const hitId = this._hitTestDrawing(x, y, panes);
          if (hitId) {
            this._selectDrawing(hitId);
            const hitObj = this.drawings.find((d) => d.id === hitId);
            if (hitObj && !this.drawingsLocked && !hitObj.locked) {
              const startPt = this._snapPoint(x, y, panes);
              this.dragging = 'drawing-move';
              this._dragDrawing = {
                drawing: hitObj,
                startX: x,
                startY: y,
                startT: startPt.t,
                startPrice: startPt.price,
                origP1: hitObj.p1 ? { ...hitObj.p1 } : null,
                origP2: hitObj.p2 ? { ...hitObj.p2 } : null,
                origP3: hitObj.p3 ? { ...hitObj.p3 } : null,
                origPoints: Array.isArray(hitObj.points) ? hitObj.points.map((p) => ({ ...p })) : null,
              };
              this.canvas.style.cursor = 'grabbing';
              e.preventDefault();
              return;
            }
            e.preventDefault();
            return;
          } else if (this.selectedDrawingId) {
            this._selectDrawing(null);
          }
        }

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartScroll = this.scrollOffset;
        this.dragStartYMin = this.manualYMin;
        this.dragStartYMax = this.manualYMax;

        if (x >= plotW && y <= panes.mainBottom) {
          this.dragging = 'yscale';
          this.canvas.style.cursor = 'ns-resize';
        } else {
          this.dragging = 'pan';
          this.canvas.style.cursor = 'grabbing';
        }
        e.preventDefault();
      });

      this.canvas.addEventListener('dblclick', (e) => {
        if (this.activeTool !== 'cursor') return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const panes = this._layoutPanes();
        if (!this.compact && this.drawingsVisible && x < this._plotWidth()) {
          const hitId = this._hitTestDrawing(x, y, panes);
          if (hitId) {
            const hitObj = this.drawings.find((d) => d.id === hitId);
            if (hitObj && hitObj.type === 'note') {
              this._selectDrawing(hitId);
              this.editSelectedNoteText();
              return;
            }
          }
        }
        if (x >= this._plotWidth()) {
          this.enableAutoScale();
        } else {
          this.resetView();
        }
      });

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mouseX = x;
        this.mouseY = y;
        const panes = this._layoutPanes();
        const plotW = this._plotWidth();

        // Freehand brush stroke recording
        if (this._brushDrawing && this.draftDrawing && x < plotW && y >= panes.mainTop && y <= panes.mainBottom) {
          const pts = this.draftDrawing.points;
          const prev = pts[pts.length - 1];
          const px = this._timeToX(prev.t);
          const py = this._priceToY(prev.price, this._lastYMin, this._lastYMax, panes.mainTop, panes.mainHeight);
          if (Math.hypot(x - px, y - py) >= 3) {
            pts.push({ t: this._xToTime(x), price: this._yToPrice(y, this._lastYMin, this._lastYMax, panes.mainTop, panes.mainHeight) });
          }
          this.requestDraw();
          return;
        }

        if (!this.dragging) {
          if (x >= plotW && y <= panes.mainBottom) {
            this.canvas.style.cursor = 'ns-resize';
          } else if (!this.compact && this.activeTool === 'cursor' && this.drawingsVisible && x < plotW && y >= panes.mainTop && y <= panes.mainBottom) {
            const curSel = this.getSelectedDrawing();
            if (curSel && !this.drawingsLocked && !curSel.locked && this._hitTestAnchor(curSel, x, y, panes)) {
              this.canvas.style.cursor = 'move';
            } else if (this._hitTestDrawing(x, y, panes)) {
              this.canvas.style.cursor = 'grab';
            } else {
              this.canvas.style.cursor = 'crosshair';
            }
          } else {
            this.canvas.style.cursor = 'crosshair';
          }
        }

        // Update live draft drawing preview
        if (this.draftDrawing && !this._brushDrawing && x < plotW && y >= panes.mainTop && y <= panes.mainBottom) {
          const pt = this._snapPoint(x, y, panes);
          if (this.draftDrawing.type === 'pchannel' && this.draftDrawing._step === 3) {
            this.draftDrawing.p3 = pt;
          } else {
            this.draftDrawing.p2 = pt;
          }
        }

        if (x < plotW && y >= panes.mainTop && y <= panes.timeAxisTop) {
          const idx = Math.round(this._xToIndexFloat(x));
          if (idx >= 0 && idx < this.displayCandles.length) {
            this.hoveredIndex = idx;
            this._emitHover(idx);
          } else {
            this.hoveredIndex = null;
            this._emitHover(null);
          }
        } else {
          this.hoveredIndex = null;
          this._emitHover(null);
        }
        this.requestDraw();
      });

      this.canvas.addEventListener('mouseleave', () => {
        if (!this.dragging && !this._brushDrawing) {
          this.mouseX = null;
          this.mouseY = null;
          this.hoveredIndex = null;
          this._emitHover(null);
          this.requestDraw();
        }
      });

      this.canvas.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.15) {
            const deltaBars = e.deltaX / this.barSpacing;
            this.scrollOffset = this._clampScroll(this.scrollOffset - deltaBars);
            this._maybeLoadMoreHistory();
            if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
            this.requestDraw();
          } else {
            const zoomSpeed = e.ctrlKey ? 0.012 : 0.0022;
            const factor = Math.exp(-e.deltaY * zoomSpeed);
            this.zoomBy(factor, x);
          }
        },
        { passive: false }
      );

      this._onWindowMove = (e) => {
        if (!this.dragging) return;
        const panes = this._layoutPanes();
        const rect = this.canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        if (this.dragging === 'drawing-handle' && this._dragDrawing) {
          const { drawing, handleKey } = this._dragDrawing;
          const pt = this._snapPoint(cx, cy, panes);
          if (handleKey === 'p3' && drawing.type === 'position') {
            drawing.p3 = { t: drawing.p2.t, price: pt.price };
          } else {
            drawing[handleKey] = pt;
          }
          this.requestDraw();
          return;
        }

        if (this.dragging === 'drawing-move' && this._dragDrawing) {
          const dd = this._dragDrawing;
          const d = dd.drawing;
          const curT = this._xToTime(cx);
          const curPrice = this._yToPrice(cy, this._lastYMin, this._lastYMax, panes.mainTop, panes.mainHeight);
          const dt = curT - dd.startT;
          const dp = curPrice - dd.startPrice;
          const ratio = this.logScale && dd.startPrice > 0 ? curPrice / dd.startPrice : null;

          const shiftPt = (orig) => {
            if (!orig) return null;
            return {
              t: orig.t + dt,
              price: ratio !== null ? Math.max(1e-6, orig.price * ratio) : Math.max(1e-6, orig.price + dp),
            };
          };

          if (d.type === 'hline') {
            d.p1 = { t: dd.origP1.t, price: shiftPt(dd.origP1).price };
          } else if (d.type === 'vline') {
            d.p1 = { t: dd.origP1.t + dt, price: dd.origP1.price };
          } else {
            if (dd.origP1) d.p1 = shiftPt(dd.origP1);
            if (dd.origP2) d.p2 = shiftPt(dd.origP2);
            if (dd.origP3) d.p3 = shiftPt(dd.origP3);
            if (dd.origPoints) d.points = dd.origPoints.map((p) => shiftPt(p));
          }
          this.requestDraw();
          return;
        }

        if (this.dragging === 'pan') {
          const dx = e.clientX - this.dragStartX;
          const deltaBars = dx / this.barSpacing;
          this.scrollOffset = this._clampScroll(this.dragStartScroll + deltaBars);
          if (!this.autoScale) {
            const dy = e.clientY - this.dragStartY;
            const span = this.dragStartYMax - this.dragStartYMin;
            const pricePerPx = span / panes.mainHeight;
            this.manualYMin = this.dragStartYMin + dy * pricePerPx;
            this.manualYMax = this.dragStartYMax + dy * pricePerPx;
          }
          this._maybeLoadMoreHistory();
          if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
          this.requestDraw();
        } else if (this.dragging === 'yscale') {
          const dy = e.clientY - this.dragStartY;
          const scale = Math.exp(dy * 0.006);
          const mid = (this.dragStartYMin + this.dragStartYMax) / 2;
          const half = ((this.dragStartYMax - this.dragStartYMin) / 2) * scale;
          if (half > 1e-8) {
            this.autoScale = false;
            this.manualYMin = mid - half;
            this.manualYMax = mid + half;
            this.onAutoScaleChange?.(false);
            this.requestDraw();
          }
        }
      };

      this._onWindowUp = (e) => {
        // Complete freehand brush stroke on mouseup
        if (this._brushDrawing && this.draftDrawing) {
          const finished = this.draftDrawing;
          if (finished.points && finished.points.length >= 2) {
            this._commitDraftDrawing(finished);
          } else {
            this.draftDrawing = null;
            this._brushDrawing = false;
            this.requestDraw();
          }
          return;
        }

        // Support fluid click-and-drag completion for 2-point tools (and step 2 of pchannel)
        if (this.draftDrawing && this._draftMouseDownPos) {
          const rect = this.canvas.getBoundingClientRect();
          const ux = e.clientX - rect.left;
          const uy = e.clientY - rect.top;
          const dist = Math.hypot(ux - this._draftMouseDownPos.x, uy - this._draftMouseDownPos.y);
          this._draftMouseDownPos = null;
          if (dist >= 12) {
            const panes = this._layoutPanes();
            const pt = this._snapPoint(ux, uy, panes);
            if (this.draftDrawing.type === 'pchannel' && this.draftDrawing._step === 2) {
              this.draftDrawing.p2 = pt;
              this.draftDrawing.p3 = pt;
              this.draftDrawing._step = 3;
              this.requestDraw();
            } else {
              this.draftDrawing.p2 = pt;
              this._commitDraftDrawing(this.draftDrawing);
            }
          }
        }

        if (!this.dragging) return;
        const wasDrawingEdit = this.dragging === 'drawing-handle' || this.dragging === 'drawing-move';
        this.dragging = null;
        this._dragDrawing = null;
        this.canvas.style.cursor = 'crosshair';
        if (wasDrawingEdit) {
          this.onDrawingsChange?.(this.drawings);
          this.onSelectionChange?.(this.getSelectedDrawing());
        }
      };

      window.addEventListener('mousemove', this._onWindowMove);
      window.addEventListener('mouseup', this._onWindowUp);

      // Native Touch Gestures for iPhone, iPhone Duo & iPad (1-finger pan/draw, 2-finger pinch-zoom, double-tap reset)
      this.canvas.style.touchAction = 'none';
      let pinchState = null;
      let touchPan = null;
      let lastTapTs = 0;

      const touchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          touchPan = null;
          const rect = this.canvas.getBoundingClientRect();
          const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
          pinchState = {
            dist: Math.max(10, touchDist(e.touches[0], e.touches[1])),
            spacing: this.barSpacing,
            scroll: this.scrollOffset,
            anchorIdx: this._xToIndexFloat(midX),
            midX,
          };
          return;
        }
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const now = Date.now();
          if (this.activeTool === 'cursor' && now - lastTapTs < 280) {
            lastTapTs = 0;
            this.resetView();
            e.preventDefault();
            return;
          }
          lastTapTs = now;

          // If a drawing tool is active, forward touch directly to mouse drawing handlers
          if (!this.compact && this.activeTool !== 'cursor') {
            e.preventDefault();
            this.canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: t.clientX, clientY: t.clientY, bubbles: true }));
            return;
          }

          e.preventDefault();
          const rect = this.canvas.getBoundingClientRect();
          const x = t.clientX - rect.left;
          const y = t.clientY - rect.top;
          this.hoverX = x;
          this.hoverY = y;
          touchPan = {
            startX: t.clientX,
            startY: t.clientY,
            startScroll: this.scrollOffset,
          };
          const idx = Math.round(this._xToIndexFloat(x));
          if (idx >= 0 && idx < this.rawCandles.length) this._emitHover(idx);
          this.requestDraw();
        }
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchState) {
          e.preventDefault();
          const curDist = Math.max(10, touchDist(e.touches[0], e.touches[1]));
          const factor = curDist / pinchState.dist;
          const nextSpacing = Math.max(2.2, Math.min(44, pinchState.spacing * factor));
          const n = this.displayCandles.length;
          const plotW = this._plotWidth();
          this.barSpacing = nextSpacing;
          if (n > 0) {
            const barsFromRight = (plotW - pinchState.midX) / nextSpacing - this.rightMarginBars;
            this.scrollOffset = this._clampScroll((n - 1) - (pinchState.anchorIdx + barsFromRight));
          }
          this._maybeLoadMoreHistory();
          if (this.compareSeries.length > 0) this._emitHover(this.hoveredIndex);
          this.requestDraw();
          return;
        }
        if (e.touches.length === 1) {
          const t = e.touches[0];
          if (!this.compact && this.activeTool !== 'cursor') {
            e.preventDefault();
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
            return;
          }
          if (touchPan) {
            e.preventDefault();
            const dx = t.clientX - touchPan.startX;
            this.scrollOffset = this._clampScroll(touchPan.startScroll + dx / this.barSpacing);
            const rect = this.canvas.getBoundingClientRect();
            this.hoverX = t.clientX - rect.left;
            this.hoverY = t.clientY - rect.top;
            const idx = Math.round(this._xToIndexFloat(this.hoverX));
            if (idx >= 0 && idx < this.rawCandles.length) this._emitHover(idx);
            this._maybeLoadMoreHistory();
            this.requestDraw();
          }
        }
      }, { passive: false });

      this.canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) pinchState = null;
        if (e.touches.length === 0) {
          if (!this.compact && this.activeTool !== 'cursor' && e.changedTouches[0]) {
            const t = e.changedTouches[0];
            window.dispatchEvent(new MouseEvent('mouseup', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
          }
          touchPan = null;
        }
      }, { passive: true });
    }

    requestDraw() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this.draw();
      });
    }

    draw() {
      const ctx = this.ctx;
      const W = this.width;
      const H = this.height;
      if (W <= 0 || H <= 0) return;

      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      ctx.fillStyle = '#090d14';
      ctx.fillRect(0, 0, W, H);

      const plotW = this._plotWidth();
      const panes = this._layoutPanes();

      // Axis dividers
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotW + 0.5, 0);
      ctx.lineTo(plotW + 0.5, H);
      ctx.moveTo(0, panes.timeAxisTop + 0.5);
      ctx.lineTo(W, panes.timeAxisTop + 0.5);
      ctx.stroke();

      const n = this.displayCandles.length;
      if (n === 0) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.statusMessage || 'Loading live Hyperliquid candles...', plotW / 2, H / 2);
        ctx.restore();
        return;
      }

      const { start, end } = this._visibleIndexRange();
      const mc = getMarketColors();
      const isCompareMode = this.compareSeries.length > 0;

      if (isCompareMode) {
        this._drawCompareMainPlot(ctx, panes, start, end, plotW, W, H, n);
        ctx.restore();
        return;
      }

      const { yMin, yMax } = this._computeYRange(start, end);
      this._lastYMin = yMin;
      this._lastYMax = yMax;

      // Horizontal price grid + Y-axis labels
      const targetYLines = this.compact ? 4 : Math.max(5, Math.floor(panes.mainHeight / 56));
      const yStep = niceStep(yMax - yMin, targetYLines);
      const firstY = Math.ceil(yMin / yStep) * yStep;

      ctx.font = `${this.compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'middle';

      for (let p = firstY; p <= yMax; p += yStep) {
        const y = Math.round(this._priceToY(p, yMin, yMax, panes.mainTop, panes.mainHeight)) + 0.5;
        if (y < panes.mainTop + 6 || y > panes.mainBottom - 6) continue;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
        ctx.stroke();

        ctx.fillStyle = '#7c8ea6';
        ctx.textAlign = 'left';
        ctx.fillText(formatPrice(p), plotW + 7, y);
      }

      // Vertical time grid + X-axis labels
      const minLabelGapPx = this.compact ? 88 : 108;
      const barStep = Math.max(1, Math.ceil(minLabelGapPx / this.barSpacing));
      const firstBar = Math.floor(start / barStep) * barStep;
      let prevDayKey = null;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = Math.max(0, firstBar); i <= end; i += barStep) {
        const c = this.displayCandles[i];
        if (!c) continue;
        const x = Math.round(this._indexToX(i)) + 0.5;
        const d = new Date(c.t);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const showDate = dayKey !== prevDayKey;
        const lbl = formatAxisTime(c.t, this.interval, showDate);
        const halfW = ctx.measureText(lbl).width / 2;
        if (x < halfW + 6 || x > plotW - halfW - 6) continue;
        prevDayKey = dayKey;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, panes.mainTop);
        ctx.lineTo(x, panes.timeAxisTop);
        ctx.stroke();

        ctx.fillStyle = '#7c8ea6';
        ctx.fillText(lbl, x, panes.timeAxisTop + this.timeAxisHeight / 2 + 1);
      }

      // Clip to main price plot region
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, panes.mainTop, plotW, panes.mainHeight);
      ctx.clip();

      // Volume histogram
      if (this.indicators.volume) {
        let maxVol = 0;
        for (let i = start; i <= end; i++) {
          const v = this.rawCandles[i]?.v || 0;
          if (v > maxVol) maxVol = v;
        }
        if (maxVol > 0) {
          const volMaxH = panes.mainHeight * 0.17;
          const barW = Math.max(1, Math.min(this.barSpacing * 0.72, 20));
          for (let i = start; i <= end; i++) {
            const rc = this.rawCandles[i];
            if (!rc || rc.v <= 0) continue;
            const x = this._indexToX(i);
            const vh = (rc.v / maxVol) * volMaxH;
            const bull = rc.c >= rc.o;
            ctx.fillStyle = bull ? mc.volBull : mc.volBear;
            ctx.fillRect(x - barW / 2, panes.mainBottom - vh, barW, vh);
          }
        }
      }

      // Bollinger Bands
      if (this.indicators.bb) {
        this._drawBB(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight);
      }

      // Ichimoku Cloud & Volume Profile (drawn behind candles)
      if (this.indicators.ichimoku) {
        this._drawIchimoku(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight);
      }
      if (this.indicators.vpvr) {
        this._drawVolumeProfile(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, plotW);
      }

      // Price Series
      if (this.chartType === 'area') {
        this._drawAreaSeries(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, panes.mainBottom);
      } else {
        this._drawCandles(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight);
      }

      // Moving Averages, VWAP & Parabolic SAR
      if (this.indicators.ema20) {
        this._drawLineOverlay(ctx, this.ema20, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, '#38bdf8', 1.35);
      }
      if (this.indicators.ema50) {
        this._drawLineOverlay(ctx, this.ema50, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, '#f59e0b', 1.35);
      }
      if (this.indicators.sma100) {
        this._drawLineOverlay(ctx, this.sma100, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, '#22d3ee', 1.35);
      }
      if (this.indicators.sma200) {
        this._drawLineOverlay(ctx, this.sma200, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, '#f472b6', 1.5);
      }
      if (this.indicators.vwap) {
        this._drawLineOverlay(ctx, this.vwap, start, end, yMin, yMax, panes.mainTop, panes.mainHeight, 'rgba(226, 232, 240, 0.82)', 1.25, [4, 3]);
      }
      if (this.indicators.psar) {
        this._drawPSAR(ctx, start, end, yMin, yMax, panes.mainTop, panes.mainHeight);
      }

      // User price alert lines
      for (const al of this.alerts) {
        const ay = this._priceToY(al.price, yMin, yMax, panes.mainTop, panes.mainHeight);
        if (ay >= panes.mainTop && ay <= panes.mainBottom) {
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(0, Math.round(ay) + 0.5);
          ctx.lineTo(plotW, Math.round(ay) + 0.5);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = 'rgba(251, 191, 36, 0.92)';
          ctx.font = '10px -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`Alert ${al.direction === 'above' ? '▲' : '▼'} ${formatPrice(al.price)}`, 10, ay - 3);
        }
      }

      // Analyst Drawings (committed + live draft)
      if (!this.compact && this.drawingsVisible) {
        for (const d of this.drawings) {
          this._drawAnalystObject(ctx, d, yMin, yMax, panes, plotW, d.id === this.selectedDrawingId);
        }
        if (this.draftDrawing) {
          this._drawAnalystObject(ctx, this.draftDrawing, yMin, yMax, panes, plotW, true);
        }
      }

      // Live Price Horizontal Dashed Line
      const latest = this.rawCandles[n - 1];
      const livePrice = latest.c;
      const liveBull = latest.c >= latest.o;
      const liveColor = liveBull ? mc.bull : mc.bear;
      const liveY = this._priceToY(livePrice, yMin, yMax, panes.mainTop, panes.mainHeight);

      if (liveY >= panes.mainTop - 10 && liveY <= panes.mainBottom + 10) {
        ctx.save();
        ctx.strokeStyle = liveBull ? `rgba(${mc.bullRgb}, 0.65)` : `rgba(${mc.bearRgb}, 0.65)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(liveY) + 0.5);
        ctx.lineTo(plotW, Math.round(liveY) + 0.5);
        ctx.stroke();
        ctx.restore();
      }

      if (this.loadingHistory) {
        ctx.fillStyle = 'rgba(15, 23, 36, 0.85)';
        ctx.fillRect(10, panes.mainTop + 6, 136, 22);
        ctx.fillStyle = '#50e3c2';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Loading older bars...', 18, panes.mainTop + 17);
      }

      ctx.restore(); // end main plot clip

      // Draw Horizontal Line / Ray / Price Label Y-axis price tags
      if (!this.compact && this.drawingsVisible) {
        for (const d of this.drawings) {
          if (d.type !== 'hline' && d.type !== 'hray' && d.type !== 'pricelabel') continue;
          const ly = this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (ly >= panes.mainTop && ly <= panes.mainBottom) {
            const col = d.color || '#38bdf8';
            ctx.fillStyle = d.id === this.selectedDrawingId ? col : hexToRgba(col, 0.35);
            this._roundRect(ctx, plotW + 2, ly - 9, this.priceAxisWidth - 4, 18, 3);
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = d.id === this.selectedDrawingId ? '#061016' : '#f8fafc';
            ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatPrice(d.p1.price), plotW + 6, ly + 0.5);
          }
        }
      }

      // Draw Synchronized Valuation & Oscillator Sub-Panes
      if (panes.pePane) {
        this._drawPePane(ctx, panes.pePane, start, end, plotW, W);
      }
      if (panes.rsiPane) {
        this._drawRsiPane(ctx, panes.rsiPane, start, end, plotW, W);
      }
      if (panes.macdPane) {
        this._drawMacdPane(ctx, panes.macdPane, start, end, plotW, W);
      }
      if (panes.stochPane) {
        this._drawStochPane(ctx, panes.stochPane, start, end, plotW, W);
      }
      if (panes.atrPane) {
        this._drawSingleLinePane(ctx, panes.atrPane, this.atr, start, end, plotW, W, 'ATR (14)', '#fbbf24', (v) => formatPrice(v));
      }
      if (panes.obvPane) {
        this._drawSingleLinePane(ctx, panes.obvPane, this.obv, start, end, plotW, W, 'OBV', '#2dd4bf', (v) => formatCompact(v));
      }

      // Crosshair across ALL panes (synchronized X-axis!)
      if (
        this.mouseX !== null &&
        this.mouseY !== null &&
        this.mouseX < plotW &&
        this.mouseY >= panes.mainTop &&
        this.mouseY <= panes.timeAxisTop
      ) {
        const snapX =
          this.hoveredIndex !== null
            ? Math.round(this._indexToX(this.hoveredIndex)) + 0.5
            : Math.round(this.mouseX) + 0.5;
        const snapY = Math.round(this.mouseY) + 0.5;

        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(snapX, panes.mainTop);
        ctx.lineTo(snapX, panes.timeAxisTop);
        ctx.moveTo(0, snapY);
        ctx.lineTo(plotW, snapY);
        ctx.stroke();
        ctx.restore();
      }

      // Live price badge + countdown on right price axis
      const clampedLiveY = Math.max(panes.mainTop + 12, Math.min(panes.mainBottom - 12, liveY));
      const badgeH = this.compact ? 20 : 30;
      const badgeY = clampedLiveY - badgeH / 2;
      ctx.fillStyle = liveColor;
      this._roundRect(ctx, plotW + 2, badgeY, this.priceAxisWidth - 4, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = '#061016';
      ctx.font = `600 ${this.compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (this.compact) {
        ctx.fillText(formatPrice(livePrice), plotW + 6, clampedLiveY + 0.5);
      } else {
        ctx.fillText(formatPrice(livePrice), plotW + 7, badgeY + 10);
        const intMs = intervalToMs(this.interval);
        const rem = latest.t + intMs - Date.now();
        ctx.font = '500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = 'rgba(6, 16, 22, 0.78)';
        ctx.fillText(formatCountdown(rem), plotW + 7, badgeY + 22);
      }

      // Crosshair Y-axis & X-axis floating pills
      if (
        this.mouseX !== null &&
        this.mouseY !== null &&
        this.mouseX < plotW &&
        this.mouseY >= panes.mainTop &&
        this.mouseY <= panes.timeAxisTop
      ) {
        if (this.mouseY <= panes.mainBottom) {
          const hoverPrice = this._yToPrice(this.mouseY, yMin, yMax, panes.mainTop, panes.mainHeight);
          ctx.fillStyle = '#243247';
          this._roundRect(ctx, plotW + 2, this.mouseY - 10, this.priceAxisWidth - 4, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#f1f5f9';
          ctx.font = `600 ${this.compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatPrice(hoverPrice), plotW + 7, this.mouseY + 0.5);
        }

        if (this.hoveredIndex !== null && this.displayCandles[this.hoveredIndex]) {
          const hc = this.displayCandles[this.hoveredIndex];
          const label = formatCrosshairTime(hc.t, this.interval);
          const snapX = this._indexToX(this.hoveredIndex);
          ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          const tw = ctx.measureText(label).width + 14;
          const bx = Math.max(4, Math.min(plotW - tw - 4, snapX - tw / 2));
          ctx.fillStyle = '#243247';
          this._roundRect(ctx, bx, panes.timeAxisTop + 3, tw, this.timeAxisHeight - 5, 4);
          ctx.fill();
          ctx.fillStyle = '#f1f5f9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bx + tw / 2, panes.timeAxisTop + this.timeAxisHeight / 2 + 1);
        }
      }

      ctx.restore();
    }

    _drawRsiPane(ctx, pane, start, end, plotW, W) {
      ctx.save();
      // Top border separator
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pane.top + 0.5);
      ctx.lineTo(W, pane.top + 0.5);
      ctx.stroke();

      const padT = 14;
      const padB = 8;
      const h = pane.height - padT - padB;
      const valToY = (v) => pane.top + padT + h * (1 - v / 100);

      // Shaded 30-70 band
      const y70 = valToY(70);
      const y30 = valToY(30);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.05)';
      ctx.fillRect(0, y70, plotW, y30 - y70);

      // Dashed 70 / 50 / 30 lines
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      [
        { v: 70, c: 'rgba(244, 63, 94, 0.35)' },
        { v: 50, c: 'rgba(148, 163, 184, 0.16)' },
        { v: 30, c: 'rgba(16, 185, 129, 0.35)' },
      ].forEach(({ v, c }) => {
        const y = Math.round(valToY(v)) + 0.5;
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Y-axis ticks
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7c8ea6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('70', plotW + 7, y70);
      ctx.fillText('30', plotW + 7, y30);

      // RSI Line
      ctx.beginPath();
      ctx.rect(0, pane.top, plotW, pane.height);
      ctx.clip();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = start; i <= end; i++) {
        const v = this.rsi[i];
        if (v === null || v === undefined) continue;
        const x = this._indexToX(i);
        const y = valToY(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Label + active value
      const idx = this.hoveredIndex !== null ? this.hoveredIndex : this.rawCandles.length - 1;
      const curRsi = this.rsi[idx];
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#c084fc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`RSI (14)  ${curRsi != null ? curRsi.toFixed(1) : '—'}`, 10, pane.top + 4);
      ctx.restore();
    }

    _drawMacdPane(ctx, pane, start, end, plotW, W) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pane.top + 0.5);
      ctx.lineTo(W, pane.top + 0.5);
      ctx.stroke();

      let maxAbs = 0;
      for (let i = start; i <= end; i++) {
        const m = this.macd.macd[i];
        const s = this.macd.signal[i];
        const hi = this.macd.hist[i];
        if (m !== null) maxAbs = Math.max(maxAbs, Math.abs(m));
        if (s !== null) maxAbs = Math.max(maxAbs, Math.abs(s));
        if (hi !== null) maxAbs = Math.max(maxAbs, Math.abs(hi));
      }
      if (maxAbs <= 0) maxAbs = 1;

      const padT = 16;
      const padB = 8;
      const h = pane.height - padT - padB;
      const midY = pane.top + padT + h / 2;
      const valToY = (v) => midY - (v / (maxAbs * 1.15)) * (h / 2);

      // Zero line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(midY) + 0.5);
      ctx.lineTo(plotW, Math.round(midY) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis tick
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7c8ea6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('0.00', plotW + 7, midY);

      ctx.beginPath();
      ctx.rect(0, pane.top, plotW, pane.height);
      ctx.clip();

      // Histogram bars
      const mcMacd = getMarketColors();
      const barW = Math.max(1.5, Math.min(this.barSpacing * 0.65, 16));
      for (let i = start; i <= end; i++) {
        const v = this.macd.hist[i];
        if (v === null || v === undefined) continue;
        const x = this._indexToX(i);
        const y = valToY(v);
        ctx.fillStyle = v >= 0 ? `rgba(${mcMacd.bullRgb}, 0.48)` : `rgba(${mcMacd.bearRgb}, 0.48)`;
        ctx.fillRect(x - barW / 2, Math.min(y, midY), barW, Math.max(1, Math.abs(y - midY)));
      }

      // MACD & Signal curves
      const drawSeries = (arr, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let started = false;
        for (let i = start; i <= end; i++) {
          const v = arr[i];
          if (v === null || v === undefined) continue;
          const x = this._indexToX(i);
          const y = valToY(v);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawSeries(this.macd.macd, '#38bdf8');
      drawSeries(this.macd.signal, '#fb923c');

      // Live readout
      const idx = this.hoveredIndex !== null ? this.hoveredIndex : this.rawCandles.length - 1;
      const mv = this.macd.macd[idx];
      const sv = this.macd.signal[idx];
      const hv = this.macd.hist[idx];
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(
        `MACD (12,26,9)  ${mv != null ? mv.toFixed(2) : '—'}  Sig ${sv != null ? sv.toFixed(2) : '—'}  Hist ${hv != null ? hv.toFixed(2) : '—'}`,
        10,
        pane.top + 4
      );
      ctx.restore();
    }

    _drawIchimoku(ctx, start, end, yMin, yMax, mainTop, mainHeight) {
      const mc = getMarketColors();
      const { tenkan, kijun, spanA, spanB } = this.ichimoku;
      // Draw shaded Kumo cloud between Span A and Span B
      for (let i = Math.max(start, 1); i <= end; i++) {
        const a0 = spanA[i - 1], b0 = spanB[i - 1];
        const a1 = spanA[i], b1 = spanB[i];
        if (a0 == null || b0 == null || a1 == null || b1 == null) continue;
        const x0 = this._indexToX(i - 1);
        const x1 = this._indexToX(i);
        const ya0 = this._priceToY(a0, yMin, yMax, mainTop, mainHeight);
        const yb0 = this._priceToY(b0, yMin, yMax, mainTop, mainHeight);
        const ya1 = this._priceToY(a1, yMin, yMax, mainTop, mainHeight);
        const yb1 = this._priceToY(b1, yMin, yMax, mainTop, mainHeight);
        ctx.fillStyle = a1 >= b1 ? `rgba(${mc.bullRgb}, 0.10)` : `rgba(${mc.bearRgb}, 0.10)`;
        ctx.beginPath();
        ctx.moveTo(x0, ya0);
        ctx.lineTo(x1, ya1);
        ctx.lineTo(x1, yb1);
        ctx.lineTo(x0, yb0);
        ctx.closePath();
        ctx.fill();
      }
      this._drawLineOverlay(ctx, spanA, start, end, yMin, yMax, mainTop, mainHeight, `rgba(${mc.bullRgb}, 0.45)`, 1);
      this._drawLineOverlay(ctx, spanB, start, end, yMin, yMax, mainTop, mainHeight, `rgba(${mc.bearRgb}, 0.45)`, 1);
      this._drawLineOverlay(ctx, tenkan, start, end, yMin, yMax, mainTop, mainHeight, '#38bdf8', 1.15);
      this._drawLineOverlay(ctx, kijun, start, end, yMin, yMax, mainTop, mainHeight, '#fb7185', 1.15);
    }

    _drawPSAR(ctx, start, end, yMin, yMax, mainTop, mainHeight) {
      const mc = getMarketColors();
      const r = Math.max(1.6, Math.min(3, this.barSpacing * 0.22));
      for (let i = start; i <= end; i++) {
        const pt = this.psar[i];
        if (!pt) continue;
        const x = this._indexToX(i);
        const y = this._priceToY(pt.val, yMin, yMax, mainTop, mainHeight);
        ctx.fillStyle = pt.up ? mc.bull : mc.bear;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawVolumeProfile(ctx, start, end, yMin, yMax, mainTop, mainHeight, plotW) {
      const bins = 26;
      if (yMax <= yMin || end < start) return;
      const buyVol = new Array(bins).fill(0);
      const sellVol = new Array(bins).fill(0);
      const step = (yMax - yMin) / bins;

      for (let i = start; i <= end; i++) {
        const c = this.rawCandles[i];
        if (!c || c.v <= 0) continue;
        const tp = (c.h + c.l + c.c) / 3;
        const b = Math.max(0, Math.min(bins - 1, Math.floor((tp - yMin) / step)));
        if (c.c >= c.o) buyVol[b] += c.v;
        else sellVol[b] += c.v;
      }

      let maxBin = 0;
      let pocIdx = -1;
      for (let b = 0; b < bins; b++) {
        const tot = buyVol[b] + sellVol[b];
        if (tot > maxBin) { maxBin = tot; pocIdx = b; }
      }
      if (maxBin <= 0) return;

      const maxBarW = Math.min(115, plotW * 0.2);
      for (let b = 0; b < bins; b++) {
        const tot = buyVol[b] + sellVol[b];
        if (tot <= 0) continue;
        const pLo = yMin + b * step;
        const pHi = pLo + step;
        const yTop = this._priceToY(pHi, yMin, yMax, mainTop, mainHeight);
        const yBot = this._priceToY(pLo, yMin, yMax, mainTop, mainHeight);
        const h = Math.max(1.5, Math.abs(yBot - yTop) - 1);
        const totalW = (tot / maxBin) * maxBarW;
        const buyW = (buyVol[b] / tot) * totalW;
        const sellW = totalW - buyW;
        const isPoc = b === pocIdx;

        const mc = getMarketColors();
        ctx.fillStyle = isPoc ? 'rgba(251, 191, 36, 0.34)' : `rgba(${mc.bullRgb}, 0.18)`;
        ctx.fillRect(plotW - totalW, yTop, buyW, h);
        ctx.fillStyle = isPoc ? 'rgba(251, 191, 36, 0.24)' : `rgba(${mc.bearRgb}, 0.18)`;
        ctx.fillRect(plotW - sellW, yTop, sellW, h);
      }

      if (pocIdx >= 0) {
        const pocPrice = yMin + (pocIdx + 0.5) * step;
        const pocY = Math.round(this._priceToY(pocPrice, yMin, yMax, mainTop, mainHeight)) + 0.5;
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, pocY);
        ctx.lineTo(plotW, pocY);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`POC $${formatPrice(pocPrice)}`, plotW - 6, pocY - 2);
      }
    }

    _drawPePane(ctx, pane, start, end, plotW, W) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pane.top + 0.5);
      ctx.lineTo(W, pane.top + 0.5);
      ctx.stroke();

      let lo = Infinity;
      let hi = -Infinity;
      let sum = 0;
      let cnt = 0;
      for (let i = start; i <= end; i++) {
        const v = this.peSeries[i];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          sum += v;
          cnt++;
        }
      }

      if (cnt === 0) {
        ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = '#7c8ea6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('P/E Ratio (Live): Earnings data unavailable for this asset', 10, pane.top + 6);
        ctx.restore();
        return;
      }

      const avgPe = sum / cnt;
      const pad = Math.max((hi - lo) * 0.18, 0.5);
      const yMin = Math.max(0, lo - pad);
      const yMax = hi + pad;
      const padT = 16;
      const padB = 8;
      const h = pane.height - padT - padB;
      const valToY = (v) => pane.top + padT + h * (1 - (v - yMin) / Math.max(1e-6, yMax - yMin));

      // Average P/E dashed reference line
      const avgY = Math.round(valToY(avgPe)) + 0.5;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.38)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, avgY);
      ctx.lineTo(plotW, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis ticks
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7c8ea6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${hi.toFixed(1)}x`, plotW + 7, valToY(hi));
      ctx.fillText(`${lo.toFixed(1)}x`, plotW + 7, valToY(lo));

      ctx.beginPath();
      ctx.rect(0, pane.top, plotW, pane.height);
      ctx.clip();

      // Area fill + glowing P/E curve
      ctx.strokeStyle = '#50e3c2';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false;
      let firstX = 0;
      let lastX = 0;
      for (let i = start; i <= end; i++) {
        const v = this.peSeries[i];
        if (v == null) continue;
        const x = this._indexToX(i);
        const y = valToY(v);
        if (!started) { ctx.moveTo(x, y); firstX = x; started = true; }
        else ctx.lineTo(x, y);
        lastX = x;
      }
      ctx.stroke();
      if (started) {
        ctx.lineTo(lastX, pane.bottom);
        ctx.lineTo(firstX, pane.bottom);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, pane.top, 0, pane.bottom);
        grad.addColorStop(0, 'rgba(80, 227, 194, 0.22)');
        grad.addColorStop(1, 'rgba(80, 227, 194, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      const idx = this.hoveredIndex !== null ? this.hoveredIndex : this.rawCandles.length - 1;
      const curPe = this.peSeries[idx];
      const eps = this.fundamentalContext?.ttmEps;
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#50e3c2';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `Live P/E  ${curPe != null ? curPe.toFixed(2) + 'x' : '—'}   Avg ${avgPe.toFixed(1)}x   (TTM EPS $${eps ? eps.toFixed(2) : '—'})`,
        10,
        pane.top + 4
      );
      ctx.restore();
    }

    _drawStochPane(ctx, pane, start, end, plotW, W) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pane.top + 0.5);
      ctx.lineTo(W, pane.top + 0.5);
      ctx.stroke();

      const padT = 15;
      const padB = 8;
      const h = pane.height - padT - padB;
      const valToY = (v) => pane.top + padT + h * (1 - v / 100);

      const y80 = valToY(80);
      const y20 = valToY(20);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.fillRect(0, y80, plotW, y20 - y80);

      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.beginPath(); ctx.moveTo(0, Math.round(y80) + 0.5); ctx.lineTo(plotW, Math.round(y80) + 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.beginPath(); ctx.moveTo(0, Math.round(y20) + 0.5); ctx.lineTo(plotW, Math.round(y20) + 0.5); ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7c8ea6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('80', plotW + 7, y80);
      ctx.fillText('20', plotW + 7, y20);

      ctx.beginPath();
      ctx.rect(0, pane.top, plotW, pane.height);
      ctx.clip();

      const drawArr = (arr, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let started = false;
        for (let i = start; i <= end; i++) {
          const v = arr[i];
          if (v == null) continue;
          const x = this._indexToX(i);
          const y = valToY(v);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawArr(this.stoch.k, '#38bdf8');
      drawArr(this.stoch.d, '#fb923c');

      const idx = this.hoveredIndex !== null ? this.hoveredIndex : this.rawCandles.length - 1;
      const kv = this.stoch.k[idx];
      const dv = this.stoch.d[idx];
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Stoch (14,3)  %K ${kv != null ? kv.toFixed(1) : '—'}  %D ${dv != null ? dv.toFixed(1) : '—'}`, 10, pane.top + 4);
      ctx.restore();
    }

    _drawSingleLinePane(ctx, pane, arr, start, end, plotW, W, label, color, fmtFn) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pane.top + 0.5);
      ctx.lineTo(W, pane.top + 0.5);
      ctx.stroke();

      let lo = Infinity;
      let hi = -Infinity;
      for (let i = start; i <= end; i++) {
        const v = arr[i];
        if (v != null && Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        ctx.restore();
        return;
      }
      if (hi === lo) { lo -= 1; hi += 1; }
      const padT = 16;
      const padB = 8;
      const h = pane.height - padT - padB;
      const valToY = (v) => pane.top + padT + h * (1 - (v - lo) / (hi - lo));

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7c8ea6';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtFn(hi), plotW + 7, valToY(hi));
      ctx.fillText(fmtFn(lo), plotW + 7, valToY(lo));

      ctx.beginPath();
      ctx.rect(0, pane.top, plotW, pane.height);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.45;
      ctx.beginPath();
      let started = false;
      for (let i = start; i <= end; i++) {
        const v = arr[i];
        if (v == null) continue;
        const x = this._indexToX(i);
        const y = valToY(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const idx = this.hoveredIndex !== null ? this.hoveredIndex : this.rawCandles.length - 1;
      const cur = arr[idx];
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${label}  ${cur != null ? fmtFn(cur) : '—'}`, 10, pane.top + 4);
      ctx.restore();
    }

    _drawAnalystObject(ctx, d, yMin, yMax, panes, plotW, isSelected) {
      ctx.save();
      const baseColor = d.color || (d.type === 'vline' ? '#a78bfa' : '#38bdf8');
      const strokeColor = isSelected ? '#50e3c2' : baseColor;
      const lw = Number.isFinite(d.lineWidth) ? d.lineWidth : 1.75;
      const activeLw = isSelected ? Math.max(lw + 0.5, 2) : lw;
      const dash = lineDashForStyle(d.lineStyle || (d.type === 'vline' ? 'dashed' : 'solid'), activeLw);
      const y1 = d.p1 ? this._priceToY(d.p1.price, yMin, yMax, panes.mainTop, panes.mainHeight) : 0;

      const drawAnchor = (ax, ay, fill = '#090d14', ring = '#50e3c2') => {
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = fill;
        ctx.strokeStyle = ring;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };

      if (d.type === 'hline') {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y1) + 0.5);
        ctx.lineTo(plotW, Math.round(y1) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = strokeColor;
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${d.locked ? '🔒 ' : ''}S/R  $${formatPrice(d.p1.price)}`, 10, y1 - 3);
        ctx.restore();
        return;
      }

      if (d.type === 'hray') {
        const x1 = this._timeToX(d.p1.t);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x1, Math.round(y1) + 0.5);
        ctx.lineTo(plotW, Math.round(y1) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = strokeColor;
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`$${formatPrice(d.p1.price)}`, x1 + 6, y1 - 3);
        if (isSelected) drawAnchor(x1, y1);
        ctx.restore();
        return;
      }

      if (d.type === 'vline') {
        const lx = Math.round(this._timeToX(d.p1.t)) + 0.5;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(lx, panes.mainTop);
        ctx.lineTo(lx, panes.mainBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = strokeColor;
        ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(formatCrosshairTime(d.p1.t, this.interval), lx + 5, panes.mainTop + 6);
        ctx.restore();
        return;
      }

      if (d.type === 'pricelabel') {
        const nx = this._timeToX(d.p1.t);
        const ny = y1;
        const txt = `$${formatPrice(d.p1.price)}`;
        ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        const tw = ctx.measureText(txt).width + 16;
        const bx = nx + 10;
        const by = ny - 11;

        ctx.fillStyle = hexToRgba(baseColor, 0.22);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.4;
        this._roundRect(ctx, bx, by, tw, 22, 5);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(bx, ny);
        ctx.stroke();
        drawAnchor(nx, ny, strokeColor, '#090d14');

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, bx + tw / 2, ny + 0.5);
        ctx.restore();
        return;
      }

      if (d.type === 'note') {
        const nx = this._timeToX(d.p1.t);
        const ny = y1;
        const txt = d.text || 'Note';
        ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, sans-serif';
        const tw = ctx.measureText(txt).width + 18;
        const bx = nx - tw / 2;
        const by = ny - 28;
        ctx.fillStyle = isSelected ? '#134e4a' : hexToRgba(baseColor, 0.2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.3;
        this._roundRect(ctx, bx, by, tw, 21, 5);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(nx, by + 21);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, nx, by + 10.5);
        if (isSelected) drawAnchor(nx, ny);
        ctx.restore();
        return;
      }

      if (d.type === 'brush' && Array.isArray(d.points) && d.points.length >= 2) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(1.5, activeLw);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i < d.points.length; i++) {
          const px = this._timeToX(d.points[i].t);
          const py = this._priceToY(d.points[i].price, yMin, yMax, panes.mainTop, panes.mainHeight);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        return;
      }

      if (!d.p2) {
        ctx.restore();
        return;
      }

      const x1 = this._timeToX(d.p1.t);
      const x2 = this._timeToX(d.p2.t);
      const y2 = this._priceToY(d.p2.price, yMin, yMax, panes.mainTop, panes.mainHeight);

      if (d.type === 'trendline' || d.type === 'ray' || d.type === 'extline' || d.type === 'arrow') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        let sx = x1, sy = y1, ex = x2, ey = y2;
        const extL = d.type === 'extline' || Boolean(d.extendLeft);
        const extR = d.type === 'ray' || d.type === 'extline' || Boolean(d.extendRight);

        if (extL && Math.abs(dx) > 0.5) {
          sx = dx > 0 ? -40 : plotW + 40;
          sy = y1 + dy * ((sx - x1) / dx);
        }
        if (extR && Math.abs(dx) > 0.5) {
          ex = dx > 0 ? plotW + 40 : -40;
          ey = y1 + dy * ((ex - x1) / dx);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        if (d.type === 'arrow') {
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const headLen = Math.max(10, activeLw * 5);
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen * Math.cos(ang - 0.42), y2 - headLen * Math.sin(ang - 0.42));
          ctx.lineTo(x2 - headLen * Math.cos(ang + 0.42), y2 - headLen * Math.sin(ang + 0.42));
          ctx.closePath();
          ctx.fill();
        }

        // Slope % pill
        const pct = d.p1.price > 0 ? ((d.p2.price - d.p1.price) / d.p1.price) * 100 : 0;
        const sign = pct >= 0 ? '+' : '';
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        const txt = `${sign}${pct.toFixed(2)}%`;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 12;
        const tw = ctx.measureText(txt).width + 10;
        ctx.fillStyle = 'rgba(14, 20, 31, 0.88)';
        this._roundRect(ctx, mx - tw / 2, my - 8, tw, 16, 4);
        ctx.fill();
        ctx.fillStyle = pct >= 0 ? getMarketColors().bull : getMarketColors().bear;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, mx, my);

        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'pchannel') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const x3 = d.p3 ? this._timeToX(d.p3.t) : x2;
        const y3 = d.p3 ? this._priceToY(d.p3.price, yMin, yMax, panes.mainTop, panes.mainHeight) : y2 - 36;
        const baseAtX3 = Math.abs(dx) > 0.5 ? y1 + dy * ((x3 - x1) / dx) : y1;
        const offY = y3 - baseAtX3;

        // Shaded parallel parallelogram
        ctx.fillStyle = hexToRgba(baseColor, isSelected ? 0.16 : 0.1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + offY);
        ctx.lineTo(x1, y1 + offY);
        ctx.closePath();
        ctx.fill();

        // Top & bottom parallel boundaries
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x1, y1 + offY);
        ctx.lineTo(x2, y2 + offY);
        ctx.stroke();

        // Dashed midline
        ctx.strokeStyle = hexToRgba(baseColor, 0.55);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1 + offY / 2);
        ctx.lineTo(x2, y2 + offY / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
          if (d.p3) drawAnchor(x3, y3, '#090d14', '#fbbf24');
        }
      } else if (d.type === 'rect') {
        const leftX = Math.min(x1, x2);
        const topY = Math.min(y1, y2);
        const boxW = Math.abs(x2 - x1);
        const boxH = Math.abs(y2 - y1);
        ctx.fillStyle = hexToRgba(baseColor, isSelected ? 0.16 : 0.1);
        ctx.fillRect(leftX, topY, boxW, boxH);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.strokeRect(leftX + 0.5, topY + 0.5, boxW, boxH);
        ctx.setLineDash([]);

        const hiP = Math.max(d.p1.price, d.p2.price);
        const loP = Math.min(d.p1.price, d.p2.price);
        const spanPct = loP > 0 ? ((hiP - loP) / loP) * 100 : 0;
        if (boxW > 46) {
          ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = strokeColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`$${formatPrice(loP)}–$${formatPrice(hiP)} (${spanPct.toFixed(1)}%)`, leftX + 6, topY + 4);
        }
        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'ellipse') {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.max(2, Math.abs(x2 - x1) / 2);
        const ry = Math.max(2, Math.abs(y2 - y1) / 2);
        ctx.fillStyle = hexToRgba(baseColor, isSelected ? 0.16 : 0.1);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'channel') {
        const topY = Math.min(y1, y2);
        const botY = Math.max(y1, y2);
        ctx.fillStyle = hexToRgba(baseColor, isSelected ? 0.14 : 0.09);
        ctx.fillRect(0, topY, plotW, botY - topY);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = activeLw;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(0, topY + 0.5);
        ctx.lineTo(plotW, topY + 0.5);
        ctx.moveTo(0, botY + 0.5);
        ctx.lineTo(plotW, botY + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        const hiP = Math.max(d.p1.price, d.p2.price);
        const loP = Math.min(d.p1.price, d.p2.price);
        const spanPct = loP > 0 ? ((hiP - loP) / loP) * 100 : 0;
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Zone $${formatPrice(loP)} – $${formatPrice(hiP)} (${spanPct.toFixed(2)}%)`, 10, topY + 4);
        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'fib') {
        const leftX = Math.min(x1, x2);
        const rightX = Math.max(x1, x2, leftX + 120);
        const spanP = d.p1.price - d.p2.price;

        for (let k = 0; k < FIB_LEVELS.length; k++) {
          const lv = FIB_LEVELS[k];
          const p = d.p2.price + spanP * lv.r;
          const ly = this._priceToY(p, yMin, yMax, panes.mainTop, panes.mainHeight);

          if (k > 0 && lv.fill) {
            const prevP = d.p2.price + spanP * FIB_LEVELS[k - 1].r;
            const prevY = this._priceToY(prevP, yMin, yMax, panes.mainTop, panes.mainHeight);
            ctx.fillStyle = lv.fill;
            ctx.fillRect(leftX, Math.min(ly, prevY), rightX - leftX, Math.abs(ly - prevY));
          }

          ctx.strokeStyle = lv.color;
          ctx.lineWidth = lv.r === 0.618 || lv.r === 0.5 ? 1.4 : 1;
          ctx.beginPath();
          ctx.moveTo(leftX, Math.round(ly) + 0.5);
          ctx.lineTo(rightX, Math.round(ly) + 0.5);
          ctx.stroke();

          ctx.fillStyle = lv.color;
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${lv.label} ($${formatPrice(p)})`, leftX + 5, ly - 2);
        }

        // Diagonal guide line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'measure') {
        const diff = d.p2.price - d.p1.price;
        const pct = d.p1.price > 0 ? (diff / d.p1.price) * 100 : 0;
        const bull = diff >= 0;
        const leftX = Math.min(x1, x2);
        const topY = Math.min(y1, y2);
        const boxW = Math.abs(x2 - x1);
        const boxH = Math.abs(y2 - y1);

        const mc = getMarketColors();
        ctx.fillStyle = bull ? `rgba(${mc.bullRgb}, 0.14)` : `rgba(${mc.bearRgb}, 0.14)`;
        ctx.fillRect(leftX, topY, boxW, boxH);
        ctx.strokeStyle = bull ? `rgba(${mc.bullRgb}, 0.7)` : `rgba(${mc.bearRgb}, 0.7)`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(leftX + 0.5, topY + 0.5, boxW, boxH);

        // Callout badge
        const bars = Math.max(1, Math.round(Math.abs(this._xToIndexFloat(x2) - this._xToIndexFloat(x1))));
        const dur = formatDuration(d.p2.t - d.p1.t);
        const sign = bull ? '+' : '';
        const line1 = `${sign}$${formatPrice(diff)} (${sign}${pct.toFixed(2)}%)`;
        const line2 = `${bars} bars · ${dur}`;
        ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 18;
        const cx = leftX + boxW / 2;
        const cy = bull ? Math.max(panes.mainTop + 22, topY - 22) : Math.min(panes.mainBottom - 22, topY + boxH + 22);

        ctx.fillStyle = bull ? mc.bullDark : mc.bearDark;
        this._roundRect(ctx, cx - tw / 2, cy - 17, tw, 34, 5);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line1, cx, cy - 6);
        ctx.font = '500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
        ctx.fillText(line2, cx, cy + 8);

        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2);
        }
      } else if (d.type === 'position') {
        const mc = getMarketColors();
        // Click 1 = Entry, Click 2 = Stop Loss; Target defaults to 2:1 R:R and is independently draggable via p3!
        const entry = d.p1.price;
        const stop = d.p2.price;
        const risk = entry - stop; // >0 => Long, <0 => Short
        const target = this._getPositionTargetPrice(d);
        const isLong = risk >= 0;
        const rrRatio = Math.abs(risk) > 1e-8 ? Math.abs(target - entry) / Math.abs(risk) : 2;

        const leftX = Math.min(x1, x2);
        const rightX = Math.max(x1, x2, leftX + 110);
        const yEntry = y1;
        const yStop = y2;
        const yTarget = this._priceToY(target, yMin, yMax, panes.mainTop, panes.mainHeight);

        // Reward zone
        ctx.fillStyle = `rgba(${mc.bullRgb}, 0.16)`;
        ctx.fillRect(leftX, Math.min(yEntry, yTarget), rightX - leftX, Math.abs(yTarget - yEntry));
        ctx.strokeStyle = `rgba(${mc.bullRgb}, 0.72)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX + 0.5, Math.min(yEntry, yTarget) + 0.5, rightX - leftX, Math.abs(yTarget - yEntry));

        // Risk zone
        ctx.fillStyle = `rgba(${mc.bearRgb}, 0.16)`;
        ctx.fillRect(leftX, Math.min(yEntry, yStop), rightX - leftX, Math.abs(yStop - yEntry));
        ctx.strokeStyle = `rgba(${mc.bearRgb}, 0.72)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX + 0.5, Math.min(yEntry, yStop) + 0.5, rightX - leftX, Math.abs(yStop - yEntry));

        // Entry midline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(leftX, Math.round(yEntry) + 0.5);
        ctx.lineTo(rightX, Math.round(yEntry) + 0.5);
        ctx.stroke();

        const riskPct = entry > 0 ? Math.abs((stop - entry) / entry) * 100 : 0;
        const rewPct = entry > 0 ? Math.abs((target - entry) / entry) * 100 : 0;
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = mc.bull;
        ctx.fillText(`TP $${formatPrice(target)} (+${rewPct.toFixed(1)}%) · ${rrRatio.toFixed(1)}:1 R:R`, leftX + 6, (yEntry + yTarget) / 2);
        ctx.fillStyle = mc.bear;
        ctx.fillText(`SL $${formatPrice(stop)} (-${riskPct.toFixed(1)}%) · ${isLong ? 'LONG' : 'SHORT'}`, leftX + 6, (yEntry + yStop) / 2);

        if (isSelected) {
          drawAnchor(x1, y1);
          drawAnchor(x2, y2, '#090d14', mc.bear);
          drawAnchor(rightX, yTarget, '#090d14', mc.bull);
        }
      }

      ctx.restore();
    }

    _drawCandles(ctx, start, end, yMin, yMax, mainTop, mainHeight) {
      const mc = getMarketColors();
      const bodyW = Math.max(1.2, Math.min(this.barSpacing * 0.72, 26));
      const wickW = this.barSpacing >= 6 ? 1.25 : 1;

      for (let i = start; i <= end; i++) {
        const c = this.displayCandles[i];
        if (!c) continue;
        const x = this._indexToX(i);
        const yO = this._priceToY(c.o, yMin, yMax, mainTop, mainHeight);
        const yC = this._priceToY(c.c, yMin, yMax, mainTop, mainHeight);
        const yH = this._priceToY(c.h, yMin, yMax, mainTop, mainHeight);
        const yL = this._priceToY(c.l, yMin, yMax, mainTop, mainHeight);
        const bull = c.c >= c.o;
        const color = bull ? mc.bull : mc.bear;

        if (this.hoveredIndex === i) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
          ctx.fillRect(x - this.barSpacing / 2, mainTop, this.barSpacing, mainHeight);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = wickW;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yH);
        ctx.lineTo(Math.round(x) + 0.5, yL);
        ctx.stroke();

        const top = Math.min(yO, yC);
        const h = Math.max(1.2, Math.abs(yC - yO));
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyW / 2, top, bodyW, h);
      }
    }

    _drawAreaSeries(ctx, start, end, yMin, yMax, mainTop, mainHeight, plotBottom) {
      if (end < start) return;
      const mc = getMarketColors();
      const first = this.displayCandles[start];
      const last = this.displayCandles[end];
      const isUp = last.c >= first.c;
      const strokeCol = isUp ? mc.areaUp : mc.areaDown;

      ctx.beginPath();
      let firstX = 0;
      let lastX = 0;
      let lastY = 0;
      for (let i = start; i <= end; i++) {
        const c = this.displayCandles[i];
        const x = this._indexToX(i);
        const y = this._priceToY(c.c, yMin, yMax, mainTop, mainHeight);
        if (i === start) {
          firstX = x;
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
        lastY = y;
      }

      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.lineTo(lastX, plotBottom);
      ctx.lineTo(firstX, plotBottom);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, mainTop, 0, plotBottom);
      if (isUp) {
        grad.addColorStop(0, `rgba(${mc.areaUpRgb}, 0.26)`);
        grad.addColorStop(1, `rgba(${mc.areaUpRgb}, 0.0)`);
      } else {
        grad.addColorStop(0, `rgba(${mc.areaDownRgb}, 0.24)`);
        grad.addColorStop(1, `rgba(${mc.areaDownRgb}, 0.0)`);
      }
      ctx.fillStyle = grad;
      ctx.fill();

      if (end === this.displayCandles.length - 1) {
        ctx.fillStyle = isUp ? `rgba(${mc.areaUpRgb}, 0.28)` : `rgba(${mc.areaDownRgb}, 0.28)`;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = strokeCol;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawCompareMainPlot(ctx, panes, start, end, plotW, W, H, n) {
      const anchorIdx = this._compareAnchorIndex(n);
      const visEndIdx = this._compareVisibleEndIndex(n, anchorIdx);
      const baseAnchor = this.rawCandles[anchorIdx]?.c || 1;
      const basePct = new Array(n);
      for (let i = 0; i < n; i++) {
        basePct[i] = baseAnchor > 0 ? ((this.rawCandles[i].c - baseAnchor) / baseAnchor) * 100 : 0;
      }

      const seriesList = [
        { id: '__base__', ticker: this.baseLabel || 'Base', color: '#50e3c2', width: 2.3, pct: basePct, isBase: true },
      ];
      for (const s of this.compareSeries) {
        let anchorPx = s.alignedCloses[anchorIdx];
        if (!Number.isFinite(anchorPx) || anchorPx <= 0) {
          for (let k = anchorIdx; k <= visEndIdx; k++) {
            if (Number.isFinite(s.alignedCloses[k]) && s.alignedCloses[k] > 0) {
              anchorPx = s.alignedCloses[k];
              break;
            }
          }
        }
        if (!Number.isFinite(anchorPx) || anchorPx <= 0) continue;
        const pct = new Array(n);
        for (let i = 0; i < n; i++) {
          const px = s.alignedCloses[i];
          pct[i] = Number.isFinite(px) && px > 0 ? ((px - anchorPx) / anchorPx) * 100 : null;
        }
        seriesList.push({ id: s.id, ticker: s.ticker, color: s.color, width: 1.9, pct, isBase: false });
      }

      let lo = 0;
      let hi = 0;
      for (const ser of seriesList) {
        for (let i = start; i <= end; i++) {
          const v = ser.pct[i];
          if (v !== null && Number.isFinite(v)) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
      }
      const rawSpan = Math.max(0.4, hi - lo);
      const yMin = lo - rawSpan * 0.12;
      const yMax = hi + rawSpan * 0.12;
      this._lastYMin = yMin;
      this._lastYMax = yMax;

      const pctToY = (v) => panes.mainTop + panes.mainHeight * (1 - (v - yMin) / Math.max(1e-9, yMax - yMin));
      const yToPct = (y) => yMin + (1 - (y - panes.mainTop) / Math.max(1, panes.mainHeight)) * (yMax - yMin);
      const pctDecimals = rawSpan < 3 ? 2 : 1;
      const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(pctDecimals)}%`;

      // Horizontal % grid + right-axis ticks
      const targetYLines = this.compact ? 4 : Math.max(5, Math.floor(panes.mainHeight / 56));
      const yStep = niceStep(yMax - yMin, targetYLines);
      const firstY = Math.ceil(yMin / yStep) * yStep;

      ctx.font = `${this.compact ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'middle';
      for (let p = firstY; p <= yMax + 1e-6; p += yStep) {
        const y = Math.round(pctToY(p)) + 0.5;
        if (y < panes.mainTop + 6 || y > panes.mainBottom - 6) continue;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
        ctx.stroke();

        ctx.fillStyle = '#7c8ea6';
        ctx.textAlign = 'left';
        ctx.fillText(fmtPct(p), plotW + 7, y);
      }

      // Vertical time grid + X-axis labels
      const minLabelGapPx = this.compact ? 88 : 108;
      const barStep = Math.max(1, Math.ceil(minLabelGapPx / this.barSpacing));
      const firstBar = Math.floor(start / barStep) * barStep;
      let prevDayKey = null;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = Math.max(0, firstBar); i <= end; i += barStep) {
        const c = this.displayCandles[i];
        if (!c) continue;
        const x = Math.round(this._indexToX(i)) + 0.5;
        const d = new Date(c.t);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const showDate = dayKey !== prevDayKey;
        const lbl = formatAxisTime(c.t, this.interval, showDate);
        const halfW = ctx.measureText(lbl).width / 2;
        if (x < halfW + 6 || x > plotW - halfW - 6) continue;
        prevDayKey = dayKey;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, panes.mainTop);
        ctx.lineTo(x, panes.timeAxisTop);
        ctx.stroke();

        ctx.fillStyle = '#7c8ea6';
        ctx.fillText(lbl, x, panes.timeAxisTop + this.timeAxisHeight / 2 + 1);
      }

      // Clip main plot and draw 0% baseline + series curves
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, panes.mainTop, plotW, panes.mainHeight);
      ctx.clip();

      const yZero = Math.round(pctToY(0)) + 0.5;
      if (yZero >= panes.mainTop && yZero <= panes.mainBottom) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yZero);
        ctx.lineTo(plotW, yZero);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw overlays first, base symbol on top
      const drawOrder = [...seriesList.slice(1), seriesList[0]];
      for (const ser of drawOrder) {
        ctx.strokeStyle = ser.color;
        ctx.lineWidth = ser.width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        let firstX = 0;
        let lastX = 0;
        for (let i = start; i <= end; i++) {
          const v = ser.pct[i];
          if (v === null || !Number.isFinite(v)) continue;
          const x = this._indexToX(i);
          const y = pctToY(v);
          if (!started) {
            ctx.moveTo(x, y);
            firstX = x;
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
          lastX = x;
        }
        ctx.stroke();

        if (ser.isBase && started) {
          ctx.lineTo(lastX, panes.mainBottom);
          ctx.lineTo(firstX, panes.mainBottom);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, panes.mainTop, 0, panes.mainBottom);
          grad.addColorStop(0, 'rgba(80, 227, 194, 0.16)');
          grad.addColorStop(1, 'rgba(80, 227, 194, 0.0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Highlight dots at hovered index
      if (this.hoveredIndex !== null && this.hoveredIndex >= start && this.hoveredIndex <= end) {
        const hx = this._indexToX(this.hoveredIndex);
        for (const ser of seriesList) {
          const v = ser.pct[this.hoveredIndex];
          if (v === null || !Number.isFinite(v)) continue;
          const hy = pctToY(v);
          ctx.fillStyle = '#090d14';
          ctx.strokeStyle = ser.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();

      // Right-axis endpoint % badges (anchored to exact rightmost visible bar so badges match legend bar)
      // Adaptive height + bidirectional overlap clamping so up to 10 badges stay readable at any window height
      const latestIdx = visEndIdx;
      const badges = seriesList
        .map((ser) => {
          const val = ser.pct[latestIdx];
          if (val === null || !Number.isFinite(val)) return null;
          return { color: ser.color, val, y: pctToY(val), drawY: pctToY(val) };
        })
        .filter(Boolean)
        .sort((a, b) => a.y - b.y);
      if (badges.length > 0) {
        const availH = Math.max(24, panes.mainBottom - panes.mainTop - 6);
        const maxBadgeH = badges.length > 6 ? 16 : 18;
        const badgeH = Math.max(11, Math.min(maxBadgeH, Math.floor(availH / badges.length) - 1));
        const halfH = badgeH / 2;
        const step = Math.min(badgeH + 1, Math.max(11, Math.floor(availH / badges.length)));
        const minY = panes.mainTop + halfH + 2;
        const maxY = Math.max(minY, panes.mainBottom - halfH - 2);

        // Top-down pass
        for (let i = 0; i < badges.length; i++) {
          const prevLimit = i === 0 ? minY : badges[i - 1].drawY + step;
          badges[i].drawY = Math.max(minY, Math.min(maxY, Math.max(badges[i].y, prevLimit)));
        }
        // Bottom-up pass to prevent bottom crowding when 6-10 series cluster low
        for (let i = badges.length - 2; i >= 0; i--) {
          if (badges[i].drawY > badges[i + 1].drawY - step) {
            badges[i].drawY = Math.max(minY, badges[i + 1].drawY - step);
          }
        }

        const badgeFontSize = badgeH <= 13 ? 8.5 : (badgeH <= 15 ? 9.5 : 10);
        for (const b of badges) {
          const y = b.drawY;
          ctx.fillStyle = b.color;
          this._roundRect(ctx, plotW + 2, y - halfH, this.priceAxisWidth - 4, badgeH, 3);
          ctx.fill();
          ctx.fillStyle = '#061016';
          ctx.font = `700 ${badgeFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const dec = Math.abs(b.val) >= 100 ? 1 : (this.priceAxisWidth < 64 && Math.abs(b.val) >= 10 ? 1 : 2);
          ctx.fillText(`${b.val >= 0 ? '+' : ''}${b.val.toFixed(dec)}%`, plotW + 4, y + 0.5);
        }
      }

      // Crosshair lines & floating % / time pills
      if (
        this.mouseX !== null &&
        this.mouseY !== null &&
        this.mouseX < plotW &&
        this.mouseY >= panes.mainTop &&
        this.mouseY <= panes.timeAxisTop
      ) {
        const snapX =
          this.hoveredIndex !== null
            ? Math.round(this._indexToX(this.hoveredIndex)) + 0.5
            : Math.round(this.mouseX) + 0.5;
        const snapY = Math.round(this.mouseY) + 0.5;
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(snapX, panes.mainTop);
        ctx.lineTo(snapX, panes.timeAxisTop);
        ctx.moveTo(0, snapY);
        ctx.lineTo(plotW, snapY);
        ctx.stroke();
        ctx.restore();

        if (this.mouseY <= panes.mainBottom) {
          const hp = yToPct(this.mouseY);
          ctx.fillStyle = '#243247';
          this._roundRect(ctx, plotW + 2, this.mouseY - 10, this.priceAxisWidth - 4, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#f1f5f9';
          ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(fmtPct(hp), plotW + 6, this.mouseY + 0.5);
        }

        if (this.hoveredIndex !== null && this.displayCandles[this.hoveredIndex]) {
          const hc = this.displayCandles[this.hoveredIndex];
          const label = formatCrosshairTime(hc.t, this.interval);
          const sx = this._indexToX(this.hoveredIndex);
          ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          const tw = ctx.measureText(label).width + 14;
          const bx = Math.max(4, Math.min(plotW - tw - 4, sx - tw / 2));
          ctx.fillStyle = '#243247';
          this._roundRect(ctx, bx, panes.timeAxisTop + 3, tw, this.timeAxisHeight - 5, 4);
          ctx.fill();
          ctx.fillStyle = '#f1f5f9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bx + tw / 2, panes.timeAxisTop + this.timeAxisHeight / 2 + 1);
        }
      }
    }

    _drawLineOverlay(ctx, values, start, end, yMin, yMax, mainTop, mainHeight, color, lineWidth, dash = null) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (let i = start; i <= end; i++) {
        const v = values[i];
        if (v === null || v === undefined) continue;
        const x = this._indexToX(i);
        const y = this._priceToY(v, yMin, yMax, mainTop, mainHeight);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    _drawBB(ctx, start, end, yMin, yMax, mainTop, mainHeight) {
      const ptsUpper = [];
      const ptsLower = [];
      for (let i = start; i <= end; i++) {
        if (this.bb.upper[i] !== null && this.bb.lower[i] !== null) {
          const x = this._indexToX(i);
          ptsUpper.push([x, this._priceToY(this.bb.upper[i], yMin, yMax, mainTop, mainHeight)]);
          ptsLower.push([x, this._priceToY(this.bb.lower[i], yMin, yMax, mainTop, mainHeight)]);
        }
      }
      if (ptsUpper.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ptsUpper[0][0], ptsUpper[0][1]);
      for (let i = 1; i < ptsUpper.length; i++) ctx.lineTo(ptsUpper[i][0], ptsUpper[i][1]);
      for (let i = ptsLower.length - 1; i >= 0; i--) ctx.lineTo(ptsLower[i][0], ptsLower[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(167, 139, 250, 0.08)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(167, 139, 250, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ptsUpper[0][0], ptsUpper[0][1]);
      for (let i = 1; i < ptsUpper.length; i++) ctx.lineTo(ptsUpper[i][0], ptsUpper[i][1]);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ptsLower[0][0], ptsLower[0][1]);
      for (let i = 1; i < ptsLower.length; i++) ctx.lineTo(ptsLower[i][0], ptsLower[i][1]);
      ctx.stroke();

      this._drawLineOverlay(ctx, this.bb.mid, start, end, yMin, yMax, mainTop, mainHeight, 'rgba(167, 139, 250, 0.42)', 1);
      ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  HS.getMarketColors = getMarketColors;
  HS.formatPrice = formatPrice;
  HS.formatCompact = formatCompact;
  HS.intervalToMs = intervalToMs;
  HS.InteractiveFinancialChart = InteractiveFinancialChart;
})(window);
