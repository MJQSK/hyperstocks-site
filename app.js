/* HyperStocks — Main Application Controller (v3.0: Live Stock Insights, TradingView Indicators & Tools, Portfolio) */
(function (global) {
  const {
    InteractiveFinancialChart,
    getMarketColors,
    formatPrice,
    formatCompact,
    HyperliquidWSClient,
    fetchAllHip3Markets,
    fetchCandles,
    fetchCandlesWithHistory,
    fetchStockInsights,
    computeLiveValuation,
    detectSplitFactor,
    normalizeSplitPrevDayPx,
    fetchPortfolioBenchmarkSeries,
    resolveCoinTicker,
    loadNativePrefs,
    saveNativePrefs,
    playAlertSound,
    startWindowDrag,
    TradingCalculatorController,
  } = global.HS;

  const COMPARE_COLORS = ['#38bdf8', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185', '#4ade80', '#facc15', '#22d3ee', '#fb923c'];
  const COMPARE_MAX_OVERLAYS = 9;
  const COMPARE_MAX_TOTAL = COMPARE_MAX_OVERLAYS + 1;
  const COMPARE_QUICK_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'META', 'AMZN', 'BTC', 'ETH', 'SOL'];

  const DEFAULT_WATCHLIST = [
    'xyz:NVDA',
    'xyz:TSLA',
    'xyz:AAPL',
    'xyz:MSFT',
    'xyz:AMZN',
    'xyz:GOOGL',
    'xyz:META',
    'xyz:AMD',
    'xyz:PLTR',
    'xyz:COIN',
    'xyz:HOOD',
    'xyz:MSTR',
    'xyz:MU',
    'xyz:XYZ100',
    'xyz:SP500',
  ];

  const DEFAULT_GRID_PANES = [
    { symbol: 'xyz:NVDA', interval: '15m' },
    { symbol: 'xyz:TSLA', interval: '15m' },
    { symbol: 'xyz:AAPL', interval: '15m' },
    { symbol: 'xyz:XYZ100', interval: '15m' },
  ];

  const TOOL_HINTS = {
    trendline: 'Trendline: Click-drag or click 2 points · Esc to cancel',
    ray: 'Ray: Click anchor & forward direction · Esc to cancel',
    extline: 'Extended Line (∞): Click 2 points to project infinitely · Esc to cancel',
    hline: 'Horizontal S/R Line: Click any price level · Esc to cancel',
    hray: 'Horizontal Ray: Click start point to project right · Esc to cancel',
    vline: 'Vertical Date Marker: Click any bar to drop a catalyst line · Esc to cancel',
    pchannel: 'Parallel Channel: Click 2 trendline points, then 3rd point for width · Esc to cancel',
    channel: 'Horizontal Price Zone: Click top & bottom price · Esc to cancel',
    rect: 'Rectangle Box: Click-drag or click opposite corners · Esc to cancel',
    ellipse: 'Ellipse: Click-drag or click opposite bounds · Esc to cancel',
    arrow: 'Directional Arrow: Click start & target tip · Esc to cancel',
    brush: 'Freehand Brush: Hold & drag anywhere on chart to sketch · Esc to cancel',
    fib: 'Fibonacci Retracement: Click swing high & low · Esc to cancel',
    measure: 'Measure Ruler: Click start & end points · Esc to cancel',
    position: 'Risk/Reward Position: Click Entry then Stop (drag TP handle to customize R:R)',
    note: 'Text Callout Note: Click chart to add note (double-click later to edit)',
    pricelabel: 'Price Label: Click any point to tag exact price · Esc to cancel',
  };

  const DONUT_PALETTE = [
    '#50e3c2', '#38bdf8', '#a78bfa', '#fbbf24', '#f472b6',
    '#34d399', '#fb923c', '#818cf8', '#22d3ee', '#f87171',
  ];

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    const candidate = /^https?:\/\//i.test(s) ? s : (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(s) ? `https://${s}` : '');
    if (!candidate) return null;
    try {
      const u = new URL(candidate);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
    } catch (_) {
      return null;
    }
  }

  function formatUsd(val, showSign = false) {
    if (!Number.isFinite(val)) return '$0.00';
    const sign = val < 0 ? '-' : (showSign && val > 0 ? '+' : '');
    const abs = Math.abs(val);
    return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  class HyperStocksApp {
    constructor() {
      this.ws = new HyperliquidWSClient();
      this.markets = new Map();
      this.tickerFallbackIndex = new Map();
      this.activeDexs = [];

      // Persisted user preferences
      this.prefs = {
        watchlist: [...DEFAULT_WATCHLIST],
        activeSymbol: 'xyz:NVDA',
        interval: '15m',
        activeRange: null, // null | '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'ALL'
        chartType: 'candles',
        logScale: false,
        magnetMode: false,
        stayInDrawingMode: false,
        drawingsVisible: true,
        drawingsLocked: false,
        indicators: {
          ema20: true,
          ema50: false,
          sma100: false,
          sma200: false,
          vwap: false,
          bb: false,
          ichimoku: false,
          psar: false,
          volume: true,
          vpvr: false,
          pe: false,
          rsi: false,
          macd: false,
          stoch: false,
          atr: false,
          obv: false,
        },
        layout: 'single', // 'single' | 'grid' | 'insights' | 'portfolio'
        showBook: true,
        gridPanes: DEFAULT_GRID_PANES.map((p) => ({ ...p })),
        alerts: [],
        drawings: {}, // { [symbolId]: [drawingObj, ...] }
        holdings: [], // { id, symbol, side: 'long'|'short', qty, avgPrice, note }
        deviceOverride: 'auto', // 'auto' | 'iphone' | 'duo-folded' | 'duo-unfolded' | 'ipad'
        colorScheme: 'west', // 'west' (green up / red down) | 'asia' (red up / green down)
      };

      // Adaptive iOS / iPadOS / iPhone Duo hardware profile state
      this.deviceProfile = null;
      this.mobileMarketsOpen = false;

      // UI filters
      this.activeTab = 'stock';
      this.selectedDex = 'all';
      this.sortBy = 'volume';
      this.searchQuery = '';
      this.selectedGridIndex = 0;

      // Live single-view state
      this.mainChart = null;
      this.mainSubs = [];
      this.recentTrades = [];
      this.latestBook = null;
      this.dexMidSubs = [];
      this._loadSeq = 0;
      this.compareSymbols = []; // Up to 4 overlay symbols (5 total including base)
      this._compareSeq = 0;
      this._lastHoverInfo = null;

      // Live Stock Insights state
      this.activeInsights = null;
      this.activeInsightsSymbol = null;
      this.insightsSubTab = 'overview'; // 'overview' | 'earnings'
      this.earningsCadenceOverride = null; // null (auto by country) | '4Q' | '2H'
      this._insightsLoadSeq = 0;
      this._insightsRenderQueued = false;
      this._pendingInsightsFlash = null;

      // Live 2x2 grid state
      this.gridControllers = [];

      // Row caches
      this.rowElements = new Map();
      this._saveTimer = null;
      this._refreshTimer = null;
      this._portfolioRenderQueued = false;

      // Portfolio Performance vs. Benchmarks state
      this.pfPerfRange = '1Y';
      this.pfPerfMode = 'pct'; // 'pct' | 'usd'
      this.pfBenchmarks = { spy: true, qqq: true, mag7: true, msci: true };
      this.pfPerfData = null;
      this.pfPerfSignature = null;
      this.pfPerfHoverIdx = null;
      this._pfPerfSeq = 0;
    }

    async init() {
      const isWebBrowser =
        !window.webkit?.messageHandlers?.hlInfo &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:');
      if (/Win/i.test(navigator.platform || navigator.userAgent) || isWebBrowser) {
        document.body.classList.add('platform-win');
      }
      if (isWebBrowser) {
        document.body.classList.add('platform-web');
      }
      if (
        !window.HS_STATIC_WEB &&
        window.location.protocol === 'http:' &&
        (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
      ) {
        // Keepalive ping for Windows desktop host auto-shutdown on window close
        setInterval(() => { fetch('/api/ping').catch(() => {}); }, 4000);
        window.addEventListener('beforeunload', () => {
          try { navigator.sendBeacon('/api/closing'); } catch (_) {}
        });
      }
      this._cacheDOM();
      this._initLegalGateEarly();
      await this._restorePrefs();
      this._syncLegalGateAfterPrefs();
      this._bindUIEvents();
      this._initMainChart();
      this.calcTools = TradingCalculatorController ? new TradingCalculatorController(this) : null;
      this._bindWSHandlers();
      this._bindAppCommands();
      if (window.__hlPendingDeviceProfile) {
        this.applyDeviceProfile(window.__hlPendingDeviceProfile);
      } else if (isWebBrowser) {
        this._syncWebMobileLayout();
      }
      this._syncControlUI();

      this.ws.connect();
      await this.loadMarkets(true);

      // Periodic refresh of 24h volume, OI, funding, prevDayPx
      this._refreshTimer = setInterval(() => this.loadMarkets(false), 15_000);
    }

    _syncWebMobileLayout() {
      if (this.deviceProfile || !document.body.classList.contains('platform-web')) return;
      const isPhoneWidth = window.innerWidth <= 680;
      const wasCompact = document.body.classList.contains('ios-compact');
      document.body.classList.toggle('platform-ios', isPhoneWidth);
      document.body.classList.toggle('ios-compact', isPhoneWidth);
      document.body.classList.toggle('device-iphone', isPhoneWidth);
      if (!isPhoneWidth && this.mobileMarketsOpen) {
        this.mobileMarketsOpen = false;
      }
      if (isPhoneWidth && this.prefs.layout === 'grid') {
        this.setLayout('single');
      }
      if (wasCompact !== isPhoneWidth) {
        this._syncMobileTabbar();
      }
    }

    _cacheDOM() {
      this.el = {
        titlebar: document.getElementById('titlebar'),
        wsStatusPill: document.getElementById('wsStatusPill'),
        wsStatusText: document.getElementById('wsStatusText'),
        marketCountPill: document.getElementById('marketCountPill'),
        portfolioBanner: document.getElementById('portfolioBanner'),
        bannerTotalVal: document.getElementById('bannerTotalVal'),
        banner24hPnl: document.getElementById('banner24hPnl'),
        bannerTotalPnl: document.getElementById('bannerTotalPnl'),

        btnLayoutSingle: document.getElementById('btnLayoutSingle'),
        btnLayoutGrid: document.getElementById('btnLayoutGrid'),
        btnLayoutInsights: document.getElementById('btnLayoutInsights'),
        btnLayoutPortfolio: document.getElementById('btnLayoutPortfolio'),
        btnLayoutTools: document.getElementById('btnLayoutTools'),
        btnColorRegion: document.getElementById('btnColorRegion'),
        colorRegionLabel: document.getElementById('colorRegionLabel'),
        btnRefresh: document.getElementById('btnRefresh'),
        btnIosDeviceMode: document.getElementById('btnIosDeviceMode'),
        mobileTabbar: document.getElementById('mobileTabbar'),
        iosModeSheet: document.getElementById('iosModeSheet'),
        iosModeDetected: document.getElementById('iosModeDetected'),
        iosModeOptions: document.getElementById('iosModeOptions'),
        btnCloseIosModeSheet: document.getElementById('btnCloseIosModeSheet'),

        searchInput: document.getElementById('searchInput'),
        btnClearSearch: document.getElementById('btnClearSearch'),
        categoryTabs: document.getElementById('categoryTabs'),
        dexSelect: document.getElementById('dexSelect'),
        sortSelect: document.getElementById('sortSelect'),
        marketList: document.getElementById('marketList'),

        singleStage: document.getElementById('singleStage'),
        gridStage: document.getElementById('gridStage'),
        insightsStage: document.getElementById('insightsStage'),
        portfolioStage: document.getElementById('portfolioStage'),
        toolsStage: document.getElementById('toolsStage'),
        multiGrid: document.getElementById('multiGrid'),

        btnStarActive: document.getElementById('btnStarActive'),
        btnQuickInsights: document.getElementById('btnQuickInsights'),
        btnQuickAddHolding: document.getElementById('btnQuickAddHolding'),
        activeTicker: document.getElementById('activeTicker'),
        activeDexBadge: document.getElementById('activeDexBadge'),
        activeCompany: document.getElementById('activeCompany'),
        activePrice: document.getElementById('activePrice'),
        activeChange: document.getElementById('activeChange'),
        statOracle: document.getElementById('statOracle'),
        statMark: document.getElementById('statMark'),
        statVol: document.getElementById('statVol'),
        statOI: document.getElementById('statOI'),
        statFunding: document.getElementById('statFunding'),
        statLev: document.getElementById('statLev'),

        btnAlertToggle: document.getElementById('btnAlertToggle'),
        alertCountBadge: document.getElementById('alertCountBadge'),
        alertPopover: document.getElementById('alertPopover'),
        alertPopTicker: document.getElementById('alertPopTicker'),
        btnCloseAlertPop: document.getElementById('btnCloseAlertPop'),
        alertForm: document.getElementById('alertForm'),
        alertDirection: document.getElementById('alertDirection'),
        alertPriceInput: document.getElementById('alertPriceInput'),
        alertList: document.getElementById('alertList'),

        tfButtons: document.getElementById('tfButtons'),
        chartTypeButtons: document.getElementById('chartTypeButtons'),
        indicatorButtons: document.getElementById('indicatorButtons'),
        btnIndicatorsMenu: document.getElementById('btnIndicatorsMenu'),
        indCountBadge: document.getElementById('indCountBadge'),
        indicatorsPopover: document.getElementById('indicatorsPopover'),
        btnCloseIndPop: document.getElementById('btnCloseIndPop'),
        btnDrawMenu: document.getElementById('btnDrawMenu'),
        drawCountBadge: document.getElementById('drawCountBadge'),
        btnCompareMenu: document.getElementById('btnCompareMenu'),
        compareCountBadge: document.getElementById('compareCountBadge'),
        comparePopover: document.getElementById('comparePopover'),
        compareLimitHint: document.getElementById('compareLimitHint'),
        btnClearCompares: document.getElementById('btnClearCompares'),
        btnCloseComparePop: document.getElementById('btnCloseComparePop'),
        compareActiveChips: document.getElementById('compareActiveChips'),
        compareSearchInput: document.getElementById('compareSearchInput'),
        compareQuickRow: document.getElementById('compareQuickRow'),
        compareResultsList: document.getElementById('compareResultsList'),
        compareLegendBar: document.getElementById('compareLegendBar'),
        drawingToolsPopover: document.getElementById('drawingToolsPopover'),
        btnCloseDrawPop: document.getElementById('btnCloseDrawPop'),
        chkStayDraw: document.getElementById('chkStayDraw'),
        chkMagnetSnap: document.getElementById('chkMagnetSnap'),
        chkLockAllDraw: document.getElementById('chkLockAllDraw'),
        chkShowDraw: document.getElementById('chkShowDraw'),
        btnLogScale: document.getElementById('btnLogScale'),
        btnAutoScale: document.getElementById('btnAutoScale'),
        btnResetView: document.getElementById('btnResetView'),
        btnToggleBook: document.getElementById('btnToggleBook'),

        drawingRail: document.getElementById('drawingRail'),
        btnStayDraw: document.getElementById('btnStayDraw'),
        btnMagnetSnap: document.getElementById('btnMagnetSnap'),
        btnToggleDrawVis: document.getElementById('btnToggleDrawVis'),
        btnLockDrawings: document.getElementById('btnLockDrawings'),
        btnUndoDraw: document.getElementById('btnUndoDraw'),
        btnClearDraw: document.getElementById('btnClearDraw'),
        activeToolBanner: document.getElementById('activeToolBanner'),

        drawingStyleBar: document.getElementById('drawingStyleBar'),
        dsbColors: document.getElementById('dsbColors'),
        dsbWidths: document.getElementById('dsbWidths'),
        dsbStyles: document.getElementById('dsbStyles'),
        dsbExtSep: document.getElementById('dsbExtSep'),
        dsbExtGroup: document.getElementById('dsbExtGroup'),
        btnDsbExtLeft: document.getElementById('btnDsbExtLeft'),
        btnDsbExtRight: document.getElementById('btnDsbExtRight'),
        btnDsbEditText: document.getElementById('btnDsbEditText'),
        btnDsbLock: document.getElementById('btnDsbLock'),
        btnDsbDuplicate: document.getElementById('btnDsbDuplicate'),
        btnDsbDelete: document.getElementById('btnDsbDelete'),

        rangeButtons: document.getElementById('rangeButtons'),
        dataSourceBadge: document.getElementById('dataSourceBadge'),

        ohlcHud: document.getElementById('ohlcHud'),
        mainChartHost: document.getElementById('mainChartHost'),
        bookPanel: document.getElementById('bookPanel'),
        bookSpread: document.getElementById('bookSpread'),
        bookAsks: document.getElementById('bookAsks'),
        bookMidPrice: document.getElementById('bookMidPrice'),
        bookBids: document.getElementById('bookBids'),
        tradesList: document.getElementById('tradesList'),

        // Stock Insights Stage elements
        insTicker: document.getElementById('insTicker'),
        insDexBadge: document.getElementById('insDexBadge'),
        insExchangeBadge: document.getElementById('insExchangeBadge'),
        insSectorBadge: document.getElementById('insSectorBadge'),
        insIndustryBadge: document.getElementById('insIndustryBadge'),
        insCompanyName: document.getElementById('insCompanyName'),
        insLivePrice: document.getElementById('insLivePrice'),
        insLiveChange: document.getElementById('insLiveChange'),
        btnInsOpenChart: document.getElementById('btnInsOpenChart'),
        btnInsAddPortfolio: document.getElementById('btnInsAddPortfolio'),
        insValTitle: document.getElementById('insValTitle'),
        insValSub: document.getElementById('insValSub'),
        insValuationGrid: document.getElementById('insValuationGrid'),
        insRange52Wrap: document.getElementById('insRange52Wrap'),
        ins52LowLabel: document.getElementById('ins52LowLabel'),
        ins52Low: document.getElementById('ins52Low'),
        ins52Status: document.getElementById('ins52Status'),
        ins52HighLabel: document.getElementById('ins52HighLabel'),
        ins52High: document.getElementById('ins52High'),
        ins52Fill: document.getElementById('ins52Fill'),
        ins52Pin: document.getElementById('ins52Pin'),
        insAnalystTitle: document.getElementById('insAnalystTitle'),
        insAnalystCount: document.getElementById('insAnalystCount'),
        insAnalystBody: document.getElementById('insAnalystBody'),
        insEpsTitle: document.getElementById('insEpsTitle'),
        insEpsSub: document.getElementById('insEpsSub'),
        insEpsCanvas: document.getElementById('insEpsCanvas'),
        insFinSection: document.getElementById('insFinSection'),
        insMarginsStrip: document.getElementById('insMarginsStrip'),
        insFinHead: document.getElementById('insFinHead'),
        insFinBody: document.getElementById('insFinBody'),
        insHlMicroGrid: document.getElementById('insHlMicroGrid'),
        insRegionTag: document.getElementById('insRegionTag'),
        insDescription: document.getElementById('insDescription'),
        insProfileMeta: document.getElementById('insProfileMeta'),
        insSubTabs: document.getElementById('insSubTabs'),
        insCadencePill: document.getElementById('insCadencePill'),
        insOverviewPane: document.getElementById('insOverviewPane'),
        insEarningsPane: document.getElementById('insEarningsPane'),
        btnProfileToEarnings: document.getElementById('btnProfileToEarnings'),
        erHeaderTitle: document.getElementById('erHeaderTitle'),
        erCountryNote: document.getElementById('erCountryNote'),
        erCadenceToggle: document.getElementById('erCadenceToggle'),
        erKpiStrip: document.getElementById('erKpiStrip'),
        erCardsGrid: document.getElementById('erCardsGrid'),
        erFinTableTitle: document.getElementById('erFinTableTitle'),
        erFinTableSub: document.getElementById('erFinTableSub'),
        erFinHead: document.getElementById('erFinHead'),
        erFinBody: document.getElementById('erFinBody'),
        erFilingsSub: document.getElementById('erFilingsSub'),
        erFilingsList: document.getElementById('erFilingsList'),

        // Portfolio Tab elements
        pfTotalValue: document.getElementById('pfTotalValue'),
        pfCostSub: document.getElementById('pfCostSub'),
        pf24hPnl: document.getElementById('pf24hPnl'),
        pf24hPct: document.getElementById('pf24hPct'),
        pfTotalPnl: document.getElementById('pfTotalPnl'),
        pfTotalPct: document.getElementById('pfTotalPct'),
        pfTopMover: document.getElementById('pfTopMover'),
        pfTopMoverSub: document.getElementById('pfTopMoverSub'),

        pfPerfSub: document.getElementById('pfPerfSub'),
        pfPerfRanges: document.getElementById('pfPerfRanges'),
        pfPerfMode: document.getElementById('pfPerfMode'),
        pfBenchToggles: document.getElementById('pfBenchToggles'),
        pfLegendPort: document.getElementById('pfLegendPort'),
        pfLegendSpy: document.getElementById('pfLegendSpy'),
        pfLegendQqq: document.getElementById('pfLegendQqq'),
        pfLegendMag7: document.getElementById('pfLegendMag7'),
        pfLegendMsci: document.getElementById('pfLegendMsci'),
        pfPerfHoverHud: document.getElementById('pfPerfHoverHud'),
        pfPerfCanvas: document.getElementById('pfPerfCanvas'),
        pfBenchStats: document.getElementById('pfBenchStats'),

        pfFormCard: document.getElementById('pfFormCard'),
        pfFormTitle: document.getElementById('pfFormTitle'),
        btnToggleAddHolding: document.getElementById('btnToggleAddHolding'),
        btnCloseHoldingForm: document.getElementById('btnCloseHoldingForm'),
        pfHoldingsHint: document.getElementById('pfHoldingsHint'),
        holdingForm: document.getElementById('holdingForm'),
        holdingEditId: document.getElementById('holdingEditId'),
        holdingSymbolInput: document.getElementById('holdingSymbolInput'),
        hip3StockOptions: document.getElementById('hip3StockOptions'),
        holdingSide: document.getElementById('holdingSide'),
        holdingQty: document.getElementById('holdingQty'),
        holdingAvgPrice: document.getElementById('holdingAvgPrice'),
        btnUseLivePrice: document.getElementById('btnUseLivePrice'),
        holdingNote: document.getElementById('holdingNote'),
        btnSubmitHolding: document.getElementById('btnSubmitHolding'),
        btnCancelEdit: document.getElementById('btnCancelEdit'),

        pfDonutCanvas: document.getElementById('pfDonutCanvas'),
        pfDonutLegend: document.getElementById('pfDonutLegend'),
        pfPnlBars: document.getElementById('pfPnlBars'),
        holdingsTableBody: document.getElementById('holdingsTableBody'),

        toastContainer: document.getElementById('toastContainer'),
      };
    }

    async _restorePrefs() {
      const saved = await loadNativePrefs();
      if (!saved || typeof saved !== 'object') return;
      if (Array.isArray(saved.watchlist) && saved.watchlist.length > 0) this.prefs.watchlist = saved.watchlist;
      if (typeof saved.activeSymbol === 'string') this.prefs.activeSymbol = saved.activeSymbol;
      if (typeof saved.interval === 'string') this.prefs.interval = saved.interval;
      if (typeof saved.activeRange === 'string' || saved.activeRange === null) this.prefs.activeRange = saved.activeRange;
      if (typeof saved.chartType === 'string') this.prefs.chartType = saved.chartType;
      if (typeof saved.logScale === 'boolean') this.prefs.logScale = saved.logScale;
      if (typeof saved.magnetMode === 'boolean') this.prefs.magnetMode = saved.magnetMode;
      if (typeof saved.stayInDrawingMode === 'boolean') this.prefs.stayInDrawingMode = saved.stayInDrawingMode;
      if (typeof saved.drawingsVisible === 'boolean') this.prefs.drawingsVisible = saved.drawingsVisible;
      if (typeof saved.drawingsLocked === 'boolean') this.prefs.drawingsLocked = saved.drawingsLocked;
      if (saved.indicators && typeof saved.indicators === 'object') {
        this.prefs.indicators = { ...this.prefs.indicators, ...saved.indicators };
      }
      if (saved.layout === 'single' || saved.layout === 'grid' || saved.layout === 'insights' || saved.layout === 'portfolio' || saved.layout === 'tools') {
        this.prefs.layout = saved.layout;
      }
      if (typeof saved.showBook === 'boolean') this.prefs.showBook = saved.showBook;
      if (Array.isArray(saved.gridPanes) && saved.gridPanes.length === 4) this.prefs.gridPanes = saved.gridPanes;
      if (Array.isArray(saved.alerts)) this.prefs.alerts = saved.alerts;
      if (saved.drawings && typeof saved.drawings === 'object') this.prefs.drawings = saved.drawings;
      if (Array.isArray(saved.holdings)) this.prefs.holdings = saved.holdings;
      if (['auto', 'iphone', 'duo-folded', 'duo-unfolded', 'ipad'].includes(saved.deviceOverride)) {
        this.prefs.deviceOverride = saved.deviceOverride;
      }
      if (saved.colorScheme === 'asia' || saved.colorScheme === 'west') {
        this.prefs.colorScheme = saved.colorScheme;
      }
    }

    _persistPrefs() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        saveNativePrefs(this.prefs);
      }, 220);
    }

    _syncControlUI() {
      this.el.tfButtons.querySelectorAll('.tf-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tf === this.prefs.interval);
      });
      this.el.rangeButtons.querySelectorAll('.range-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.range === this.prefs.activeRange);
      });
      this.el.chartTypeButtons.querySelectorAll('.pill-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.type === this.prefs.chartType);
      });
      this.el.indicatorButtons.querySelectorAll('.pill-btn[data-ind]').forEach((btn) => {
        btn.classList.toggle('active', Boolean(this.prefs.indicators[btn.dataset.ind]));
      });
      if (this.el.indicatorsPopover) {
        this.el.indicatorsPopover.querySelectorAll('input[type="checkbox"][data-ind]').forEach((cb) => {
          cb.checked = Boolean(this.prefs.indicators[cb.dataset.ind]);
        });
      }
      if (this.el.indCountBadge) {
        const activeCount = Object.values(this.prefs.indicators).filter(Boolean).length;
        this.el.indCountBadge.textContent = String(activeCount);
      }
      if (this.el.btnMagnetSnap) {
        this.el.btnMagnetSnap.classList.toggle('active', Boolean(this.prefs.magnetMode));
      }
      if (this.el.btnStayDraw) {
        this.el.btnStayDraw.classList.toggle('active', Boolean(this.prefs.stayInDrawingMode));
      }
      if (this.el.btnToggleDrawVis) {
        this.el.btnToggleDrawVis.classList.toggle('active', Boolean(this.prefs.drawingsVisible));
      }
      if (this.el.btnLockDrawings) {
        this.el.btnLockDrawings.classList.toggle('active', Boolean(this.prefs.drawingsLocked));
      }
      if (this.el.chkStayDraw) this.el.chkStayDraw.checked = Boolean(this.prefs.stayInDrawingMode);
      if (this.el.chkMagnetSnap) this.el.chkMagnetSnap.checked = Boolean(this.prefs.magnetMode);
      if (this.el.chkLockAllDraw) this.el.chkLockAllDraw.checked = Boolean(this.prefs.drawingsLocked);
      if (this.el.chkShowDraw) this.el.chkShowDraw.checked = Boolean(this.prefs.drawingsVisible);
      this._syncDrawingCountBadge();
      this.el.btnLogScale.classList.toggle('active', Boolean(this.prefs.logScale));
      this.el.bookPanel.classList.toggle('hidden', !this.prefs.showBook);
      this.el.btnToggleBook.classList.toggle('active', this.prefs.showBook);

      this.el.btnLayoutSingle.classList.toggle('active', this.prefs.layout === 'single');
      this.el.btnLayoutGrid.classList.toggle('active', this.prefs.layout === 'grid');
      this.el.btnLayoutInsights.classList.toggle('active', this.prefs.layout === 'insights');
      this.el.btnLayoutPortfolio.classList.toggle('active', this.prefs.layout === 'portfolio');
      this.el.btnLayoutTools?.classList.toggle('active', this.prefs.layout === 'tools');

      this.el.singleStage.classList.toggle('hidden', this.prefs.layout !== 'single');
      this.el.gridStage.classList.toggle('hidden', this.prefs.layout !== 'grid');
      this.el.insightsStage.classList.toggle('hidden', this.prefs.layout !== 'insights');
      this.el.portfolioStage.classList.toggle('hidden', this.prefs.layout !== 'portfolio');
      this.el.toolsStage?.classList.toggle('hidden', this.prefs.layout !== 'tools');
      this._applyColorScheme(false);
      this._syncCompareUI();
      this._syncMobileTabbar();
    }

    _applyColorScheme(redrawCharts = false) {
      const isAsia = this.prefs.colorScheme === 'asia';
      document.body.classList.toggle('color-asia', isAsia);
      if (this.el.colorRegionLabel) {
        this.el.colorRegionLabel.textContent = isAsia ? 'Asia' : 'US';
      }
      if (this.el.btnColorRegion) {
        this.el.btnColorRegion.title = isAsia
          ? 'Market Colors: Asia (Red Up / Green Down). Click for Western (Green Up / Red Down).'
          : 'Market Colors: Western (Green Up / Red Down). Click for Asia (Red Up / Green Down).';
      }
      if (redrawCharts) {
        this.mainChart?.requestDraw();
        for (const pane of this.gridControllers) pane.chart?.requestDraw();
        if (this._lastHoverInfo) this._renderOhlcHud(this._lastHoverInfo);
        if (this.prefs.layout === 'portfolio') this._drawPortfolioPerfChart();
        if (this.prefs.layout === 'insights' && this.activeInsights) {
          this._renderEpsChart(this.activeInsights);
        }
      }
    }

    _syncMobileTabbar() {
      if (!this.el.mobileTabbar) return;
      const activeKey = this.mobileMarketsOpen ? 'markets' : (this.prefs.layout === 'grid' ? 'single' : this.prefs.layout);
      this.el.mobileTabbar.querySelectorAll('.mobile-tab-btn[data-mtab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mtab === activeKey);
      });
      document.body.classList.toggle('mobile-show-markets', Boolean(this.mobileMarketsOpen));
    }

    setMobileMarketsOpen(open) {
      this.mobileMarketsOpen = Boolean(open);
      this._syncMobileTabbar();
      if (!this.mobileMarketsOpen) {
        setTimeout(() => {
          this.mainChart?.resize();
          if (this.prefs.layout === 'portfolio') this._drawPortfolioPerfChart();
        }, 30);
      }
    }

    applyDeviceProfile(info) {
      if (!info || typeof info !== 'object') return;
      this.deviceProfile = info;
      document.body.classList.add('platform-ios');

      const override = this.prefs.deviceOverride || 'auto';
      const detected = info.detectedMode || 'iphone';
      const effective = override === 'auto' ? detected : override;
      const orient = info.orientation === 'landscape' ? 'landscape' : 'portrait';
      const isCompact = effective === 'iphone' || effective === 'duo-folded';

      document.body.classList.remove(
        'ios-compact',
        'device-iphone',
        'device-duo-folded',
        'device-duo-unfolded',
        'duo-portrait',
        'duo-landscape',
        'device-ipad'
      );

      if (isCompact) document.body.classList.add('ios-compact');
      if (effective === 'iphone') {
        document.body.classList.add('device-iphone');
      } else if (effective === 'duo-folded') {
        document.body.classList.add('device-duo-folded');
      } else if (effective === 'duo-unfolded') {
        document.body.classList.add('device-duo-unfolded');
        document.body.classList.add(orient === 'landscape' ? 'duo-landscape' : 'duo-portrait');
      } else if (effective === 'ipad') {
        document.body.classList.add('device-ipad');
      }

      if (!isCompact && this.mobileMarketsOpen) {
        this.mobileMarketsOpen = false;
      }

      // If folded or on compact iPhone while in 2x2 grid, switch gracefully to single chart
      if (isCompact && this.prefs.layout === 'grid') {
        this.setLayout('single');
      }

      const modeLabels = {
        iphone: 'iPhone',
        'duo-folded': 'Duo',
        'duo-unfolded': 'Duo',
        ipad: 'iPad',
      };
      if (this.el.btnIosDeviceMode) {
        const lbl = modeLabels[effective] || 'Layout';
        this.el.btnIosDeviceMode.textContent = lbl;
      }
      if (this.el.searchInput) {
        this.el.searchInput.placeholder = isCompact
          ? 'Search stock, ticker, DEX...'
          : 'Search stock, ticker, DEX...  ⌘K';
      }
      const toolsSub = document.querySelector('#toolsStage .tools-sub');
      if (toolsSub) {
        toolsSub.textContent = isCompact
          ? 'Live-priced sizing, swaps, DCA, risk & what-if targets · Tap Markets to switch stock'
          : 'Live-priced order sizing, stock-for-stock swaps, cost-basis averaging, risk sizing & what-if targets · Click any stock in the sidebar to load it live';
      }
      if (this.el.iosModeDetected) {
        const detLabel = modeLabels[detected] || detected;
        const w = Math.round(info.width || window.innerWidth);
        const h = Math.round(info.height || window.innerHeight);
        this.el.iosModeDetected.textContent = `Detected hardware: ${detLabel} (${w}×${h}pt · ${orient})`;
      }
      if (this.el.iosModeOptions) {
        this.el.iosModeOptions.querySelectorAll('.ios-mode-opt[data-devmode]').forEach((b) => {
          b.classList.toggle('active', b.dataset.devmode === override);
        });
      }

      this._syncMobileTabbar();
      setTimeout(() => {
        this.mainChart?.resize();
        for (const p of this.gridControllers) p.chart?.resize();
        if (this.prefs.layout === 'portfolio') this._drawPortfolioPerfChart();
      }, 45);
    }

    _bindUIEvents() {
      this.el.titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, .segmented')) return;
        startWindowDrag();
      });

      this.el.portfolioBanner.addEventListener('click', () => this.setLayout('portfolio'));
      this.el.btnLayoutSingle.addEventListener('click', () => this.setLayout('single'));
      this.el.btnLayoutGrid.addEventListener('click', () => this.setLayout('grid'));
      this.el.btnLayoutInsights.addEventListener('click', () => this.setLayout('insights'));
      this.el.btnLayoutPortfolio.addEventListener('click', () => this.setLayout('portfolio'));
      this.el.btnLayoutTools?.addEventListener('click', () => this.setLayout('tools'));
      this.el.btnColorRegion?.addEventListener('click', () => {
        this.prefs.colorScheme = this.prefs.colorScheme === 'asia' ? 'west' : 'asia';
        this._persistPrefs();
        this._applyColorScheme(true);
        this.showToast(
          this.prefs.colorScheme === 'asia'
            ? 'Market Colors: Asia (Red Up / Green Down)'
            : 'Market Colors: Western (Green Up / Red Down)'
        );
      });
      this.el.btnRefresh.addEventListener('click', () => this.manualRefresh());

      // Adaptive iOS / iPadOS / iPhone Duo bottom tab bar & layout mode sheet
      this.el.mobileTabbar?.addEventListener('click', (e) => {
        const btn = e.target.closest('.mobile-tab-btn[data-mtab]');
        if (!btn) return;
        const tab = btn.dataset.mtab;
        if (tab === 'markets') {
          this.setMobileMarketsOpen(!this.mobileMarketsOpen);
        } else {
          this.mobileMarketsOpen = false;
          if (this.prefs.layout === tab) {
            this._syncMobileTabbar();
          } else {
            this.setLayout(tab);
          }
        }
      });

      this.el.btnIosDeviceMode?.addEventListener('click', () => {
        this.el.iosModeSheet?.classList.remove('hidden');
      });
      this.el.btnCloseIosModeSheet?.addEventListener('click', () => {
        this.el.iosModeSheet?.classList.add('hidden');
      });
      this.el.iosModeSheet?.addEventListener('click', (e) => {
        if (e.target === this.el.iosModeSheet) {
          this.el.iosModeSheet.classList.add('hidden');
        }
      });
      this.el.iosModeOptions?.addEventListener('click', (e) => {
        const opt = e.target.closest('.ios-mode-opt[data-devmode]');
        if (!opt) return;
        const mode = opt.dataset.devmode;
        this.prefs.deviceOverride = mode;
        this._persistPrefs();
        this.applyDeviceProfile(this.deviceProfile || { detectedMode: 'iphone', width: window.innerWidth, height: window.innerHeight, orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait' });
        this.el.iosModeSheet?.classList.add('hidden');
      });

      // Quick "Insights" button in stock header
      this.el.btnQuickInsights?.addEventListener('click', () => this.setLayout('insights'));
      this.el.btnInsOpenChart?.addEventListener('click', () => this.setLayout('single'));
      this.el.btnInsAddPortfolio?.addEventListener('click', () => {
        const m = this.markets.get(this.prefs.activeSymbol);
        this.setLayout('portfolio');
        this.setHoldingFormOpen(true);
        if (m) {
          this.el.holdingSymbolInput.value = m.isSpot ? m.ticker : m.id;
          this.el.holdingAvgPrice.value = m.price.toFixed(m.price >= 10 ? 2 : 4);
          this.el.holdingQty.focus();
        }
      });

      // Insights Sub-Tabs (Overview & Valuation | Earnings Reports 4Q / 2H)
      this.el.insSubTabs?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ins-subtab-btn[data-instab]');
        if (!btn) return;
        this.setInsightsSubTab(btn.dataset.instab);
      });
      this.el.btnProfileToEarnings?.addEventListener('click', () => {
        this.setInsightsSubTab('earnings');
        const scroller = this.el.insightsStage?.querySelector('.insights-scroll');
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
      });
      this.el.erCadenceToggle?.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn[data-cadence]');
        if (!btn) return;
        this.earningsCadenceOverride = btn.dataset.cadence;
        this._renderEarningsReports(this.activeInsights);
      });

      // Quick "+ Portfolio" button in stock header
      this.el.btnQuickAddHolding.addEventListener('click', () => {
        const m = this.markets.get(this.prefs.activeSymbol);
        this.setLayout('portfolio');
        this.setHoldingFormOpen(true);
        if (m) {
          this.el.holdingSymbolInput.value = m.isSpot ? m.ticker : m.id;
          this.el.holdingAvgPrice.value = m.price.toFixed(m.price >= 10 ? 2 : 4);
          this.el.holdingQty.focus();
        }
      });

      this.el.btnToggleAddHolding?.addEventListener('click', () => {
        const isOpen = this.el.pfFormCard && !this.el.pfFormCard.classList.contains('hidden');
        this.setHoldingFormOpen(!isOpen, !isOpen);
      });

      this.el.btnCloseHoldingForm?.addEventListener('click', () => {
        this._resetHoldingForm();
        this.setHoldingFormOpen(false);
      });

      // Search
      this.el.searchInput.addEventListener('input', () => {
        this.searchQuery = this.el.searchInput.value.trim().toLowerCase();
        this.el.btnClearSearch.classList.toggle('hidden', !this.searchQuery);
        this.renderMarketList();
      });
      this.el.btnClearSearch.addEventListener('click', () => {
        this.el.searchInput.value = '';
        this.searchQuery = '';
        this.el.btnClearSearch.classList.add('hidden');
        this.renderMarketList();
        this.el.searchInput.focus();
      });

      // Sidebar tabs & filters
      this.el.categoryTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        this.activeTab = btn.dataset.tab;
        this.el.categoryTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.renderMarketList();
      });

      this.el.dexSelect.addEventListener('change', () => {
        this.selectedDex = this.el.dexSelect.value;
        this.renderMarketList();
      });

      this.el.sortSelect.addEventListener('change', () => {
        this.sortBy = this.el.sortSelect.value;
        this.renderMarketList();
      });

      this.el.btnStarActive.addEventListener('click', () => this.toggleWatchlist(this.prefs.activeSymbol));

      // Price alerts popover
      this.el.btnAlertToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = this.el.alertPopover.classList.contains('hidden');
        this.el.alertPopover.classList.toggle('hidden', !willOpen);
        if (willOpen) {
          const m = this.markets.get(this.prefs.activeSymbol);
          this.el.alertPopTicker.textContent = m ? m.ticker : this.prefs.activeSymbol;
          this.el.alertPriceInput.value = m ? m.price.toFixed(m.price >= 10 ? 2 : 4) : '';
          this.renderAlertPopoverList();
          this.el.alertPriceInput.focus();
        }
      });

      this.el.btnCloseAlertPop.addEventListener('click', () => this.el.alertPopover.classList.add('hidden'));

      document.addEventListener('click', (e) => {
        if (!this.el.alertPopover.classList.contains('hidden')) {
          if (!e.target.closest('#alertPopover') && !e.target.closest('#btnAlertToggle')) {
            this.el.alertPopover.classList.add('hidden');
          }
        }
        if (this.el.indicatorsPopover && !this.el.indicatorsPopover.classList.contains('hidden')) {
          if (!e.target.closest('#indicatorsPopover') && !e.target.closest('#btnIndicatorsMenu')) {
            this.el.indicatorsPopover.classList.add('hidden');
            this.el.btnIndicatorsMenu?.classList.remove('open');
          }
        }
        if (this.el.drawingToolsPopover && !this.el.drawingToolsPopover.classList.contains('hidden')) {
          if (!e.target.closest('#drawingToolsPopover') && !e.target.closest('#btnDrawMenu')) {
            this.el.drawingToolsPopover.classList.add('hidden');
            this.el.btnDrawMenu?.classList.remove('open');
          }
        }
        if (this.el.comparePopover && !this.el.comparePopover.classList.contains('hidden')) {
          if (!e.target.closest('#comparePopover') && !e.target.closest('#btnCompareMenu') && !e.target.closest('.compare-legend-add')) {
            this.el.comparePopover.classList.add('hidden');
            this.el.btnCompareMenu?.classList.remove('open');
          }
        }
      });

      this.el.alertForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = parseFloat(this.el.alertPriceInput.value);
        if (!Number.isFinite(price) || price <= 0) return;
        const direction = this.el.alertDirection.value;
        this.prefs.alerts.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: this.prefs.activeSymbol,
          price,
          direction,
        });
        this._persistPrefs();
        this.renderAlertPopoverList();
        this._syncActiveAlertsToChart();
        this.showToast(`Alert set: ${this._shortTicker(this.prefs.activeSymbol)} ${direction} $${formatPrice(price)}`);
      });

      // Candle Interval buttons
      this.el.tfButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.tf-btn');
        if (!btn) return;
        const tf = btn.dataset.tf;
        this.prefs.interval = tf;
        this.prefs.activeRange = null;
        this._persistPrefs();
        this._syncControlUI();
        this.loadSingleChart(this.prefs.activeSymbol, tf, null);
      });

      // Long-Range Lookback Presets (1D, 5D, 1M, 3M, 6M, 1Y, 3Y, 5Y, 10Y, ALL)
      this.el.rangeButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.range-btn');
        if (!btn) return;
        const rangeKey = btn.dataset.range;
        this.prefs.activeRange = rangeKey;
        this._persistPrefs();
        this._syncControlUI();
        this.loadSingleChart(this.prefs.activeSymbol, null, rangeKey);
      });

      // Chart Type buttons
      this.el.chartTypeButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        const type = btn.dataset.type;
        this.prefs.chartType = type;
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setChartType(type);
        for (const pane of this.gridControllers) pane.chart?.setChartType(type);
      });

      // Indicators quick toolbar & fx menu
      this.el.btnIndicatorsMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.drawingToolsPopover?.classList.add('hidden');
        this.el.btnDrawMenu?.classList.remove('open');
        this.el.comparePopover?.classList.add('hidden');
        this.el.btnCompareMenu?.classList.remove('open');
        const willOpen = this.el.indicatorsPopover.classList.contains('hidden');
        this.el.indicatorsPopover.classList.toggle('hidden', !willOpen);
        this.el.btnIndicatorsMenu.classList.toggle('open', willOpen);
      });

      this.el.btnCloseIndPop?.addEventListener('click', () => {
        this.el.indicatorsPopover.classList.add('hidden');
        this.el.btnIndicatorsMenu?.classList.remove('open');
      });

      // Drawing Tools Popover Menu
      this.el.btnDrawMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.indicatorsPopover?.classList.add('hidden');
        this.el.btnIndicatorsMenu?.classList.remove('open');
        this.el.comparePopover?.classList.add('hidden');
        this.el.btnCompareMenu?.classList.remove('open');
        const willOpen = this.el.drawingToolsPopover.classList.contains('hidden');
        this.el.drawingToolsPopover.classList.toggle('hidden', !willOpen);
        this.el.btnDrawMenu.classList.toggle('open', willOpen);
      });

      // Multi-Asset Compare Popover Menu (up to 5 total on chart)
      this.el.comparePopover?.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      this.el.btnCompareMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openComparePopover();
      });

      this.el.btnCloseComparePop?.addEventListener('click', () => {
        this.el.comparePopover?.classList.add('hidden');
        this.el.btnCompareMenu?.classList.remove('open');
      });

      this.el.btnClearCompares?.addEventListener('click', () => {
        this.clearCompareSymbols();
      });

      this.el.compareSearchInput?.addEventListener('input', () => {
        this._renderComparePopover();
      });

      this.el.btnCloseDrawPop?.addEventListener('click', () => {
        this.el.drawingToolsPopover.classList.add('hidden');
        this.el.btnDrawMenu?.classList.remove('open');
      });

      this.el.drawingToolsPopover?.addEventListener('click', (e) => {
        const item = e.target.closest('.draw-menu-item[data-tool]');
        if (!item) return;
        const tool = item.dataset.tool;
        this.mainChart?.setActiveTool(tool);
        this.el.drawingToolsPopover.classList.add('hidden');
        this.el.btnDrawMenu?.classList.remove('open');
      });

      const toggleStayDraw = (val) => {
        this.prefs.stayInDrawingMode = Boolean(val);
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setStayInDrawingMode(this.prefs.stayInDrawingMode);
      };
      const toggleMagnet = (val) => {
        this.prefs.magnetMode = Boolean(val);
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setMagnetMode(this.prefs.magnetMode);
      };
      const toggleDrawVis = (val) => {
        this.prefs.drawingsVisible = Boolean(val);
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setDrawingsVisible(this.prefs.drawingsVisible);
      };
      const toggleLockAll = (val) => {
        this.prefs.drawingsLocked = Boolean(val);
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setDrawingsLocked(this.prefs.drawingsLocked);
      };

      this.el.chkStayDraw?.addEventListener('change', (e) => toggleStayDraw(e.target.checked));
      this.el.chkMagnetSnap?.addEventListener('change', (e) => toggleMagnet(e.target.checked));
      this.el.chkShowDraw?.addEventListener('change', (e) => toggleDrawVis(e.target.checked));
      this.el.chkLockAllDraw?.addEventListener('change', (e) => toggleLockAll(e.target.checked));

      // Floating TradingView Object Style Bar
      this.el.dsbColors?.addEventListener('click', (e) => {
        const sw = e.target.closest('.dsb-swatch[data-color]');
        if (!sw) return;
        this.mainChart?.updateSelectedDrawing({ color: sw.dataset.color });
      });
      this.el.dsbWidths?.addEventListener('click', (e) => {
        const b = e.target.closest('.dsb-btn[data-width]');
        if (!b) return;
        this.mainChart?.updateSelectedDrawing({ lineWidth: Number(b.dataset.width) });
      });
      this.el.dsbStyles?.addEventListener('click', (e) => {
        const b = e.target.closest('.dsb-btn[data-style]');
        if (!b) return;
        this.mainChart?.updateSelectedDrawing({ lineStyle: b.dataset.style });
      });
      this.el.btnDsbExtLeft?.addEventListener('click', () => {
        const d = this.mainChart?.getSelectedDrawing();
        if (d) this.mainChart.updateSelectedDrawing({ extendLeft: !d.extendLeft });
      });
      this.el.btnDsbExtRight?.addEventListener('click', () => {
        const d = this.mainChart?.getSelectedDrawing();
        if (d) this.mainChart.updateSelectedDrawing({ extendRight: !d.extendRight });
      });
      this.el.btnDsbEditText?.addEventListener('click', () => this.mainChart?.editSelectedNoteText());
      this.el.btnDsbLock?.addEventListener('click', () => {
        const d = this.mainChart?.getSelectedDrawing();
        if (d) this.mainChart.updateSelectedDrawing({ locked: !d.locked });
      });
      this.el.btnDsbDuplicate?.addEventListener('click', () => this.mainChart?.duplicateSelectedDrawing());
      this.el.btnDsbDelete?.addEventListener('click', () => this.mainChart?.deleteSelectedDrawing());

      this.el.indicatorsPopover?.addEventListener('change', (e) => {
        const cb = e.target.closest('input[type="checkbox"][data-ind]');
        if (!cb) return;
        const key = cb.dataset.ind;
        this.prefs.indicators[key] = cb.checked;
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setIndicators(this.prefs.indicators);
        for (const pane of this.gridControllers) pane.chart?.setIndicators(this.prefs.indicators);
        if (key === 'pe' && cb.checked) {
          this._syncFundamentalContextForChart(this.prefs.activeSymbol);
        }
      });

      this.el.indicatorButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn[data-ind]');
        if (!btn) return;
        const key = btn.dataset.ind;
        this.prefs.indicators[key] = !this.prefs.indicators[key];
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setIndicators(this.prefs.indicators);
        for (const pane of this.gridControllers) pane.chart?.setIndicators(this.prefs.indicators);
        if (key === 'pe' && this.prefs.indicators.pe) {
          this._syncFundamentalContextForChart(this.prefs.activeSymbol);
        }
      });

      // Log Scale
      this.el.btnLogScale.addEventListener('click', () => {
        this.prefs.logScale = !this.prefs.logScale;
        this._persistPrefs();
        this._syncControlUI();
        this.mainChart?.setLogScale(this.prefs.logScale);
      });

      this.el.btnAutoScale.addEventListener('click', () => this.mainChart?.enableAutoScale());
      this.el.btnResetView.addEventListener('click', () => this.mainChart?.resetView());

      this.el.btnToggleBook.addEventListener('click', () => {
        this.prefs.showBook = !this.prefs.showBook;
        this._persistPrefs();
        this._syncControlUI();
        setTimeout(() => this.mainChart?.resize(), 30);
      });

      // TradingView Drawing Tool Rail
      this.el.drawingRail.addEventListener('click', (e) => {
        const btn = e.target.closest('.draw-btn');
        if (!btn) return;
        if (btn === this.el.btnStayDraw) {
          toggleStayDraw(!this.prefs.stayInDrawingMode);
          this.showToast(`Stay in Drawing Mode: ${this.prefs.stayInDrawingMode ? 'ON' : 'OFF'}`);
          return;
        }
        if (btn === this.el.btnMagnetSnap) {
          toggleMagnet(!this.prefs.magnetMode);
          this.showToast(`Magnet OHLC Snap: ${this.prefs.magnetMode ? 'ON' : 'OFF'}`);
          return;
        }
        if (btn === this.el.btnToggleDrawVis) {
          toggleDrawVis(!this.prefs.drawingsVisible);
          this.showToast(`Drawings: ${this.prefs.drawingsVisible ? 'Visible' : 'Hidden'}`);
          return;
        }
        if (btn === this.el.btnLockDrawings) {
          toggleLockAll(!this.prefs.drawingsLocked);
          this.showToast(`All Drawings: ${this.prefs.drawingsLocked ? 'Locked' : 'Unlocked'}`);
          return;
        }
        if (btn === this.el.btnUndoDraw) {
          this.mainChart?.undoDrawing();
          return;
        }
        if (btn === this.el.btnClearDraw) {
          this.mainChart?.clearDrawings();
          this.showToast(`Cleared drawings on ${this._shortTicker(this.prefs.activeSymbol)}`);
          return;
        }
        const tool = btn.dataset.tool;
        if (tool) this.mainChart?.setActiveTool(tool);
      });

      // Portfolio Form Events
      this.el.btnUseLivePrice.addEventListener('click', () => {
        const resolved = this._resolveHoldingSymbol(this.el.holdingSymbolInput.value);
        const m = resolved ? this.markets.get(resolved) : null;
        if (m) {
          this.el.holdingSymbolInput.value = m.isSpot ? m.ticker : m.id;
          this.el.holdingAvgPrice.value = m.price.toFixed(m.price >= 10 ? 2 : 4);
        } else {
          this.showToast('Pick a valid Hyperliquid asset first');
        }
      });

      this.el.btnCancelEdit.addEventListener('click', () => {
        this._resetHoldingForm();
        this.setHoldingFormOpen(false);
      });

      this.el.holdingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const resolved = this._resolveHoldingSymbol(this.el.holdingSymbolInput.value);
        if (!resolved || !this.markets.has(resolved)) {
          this.showToast('Stock not found on Hyperliquid. Pick one from the dropdown.');
          this.el.holdingSymbolInput.focus();
          return;
        }
        const side = this.el.holdingSide.value === 'short' ? 'short' : 'long';
        const qty = parseFloat(this.el.holdingQty.value);
        const avgPrice = parseFloat(this.el.holdingAvgPrice.value);
        const note = this.el.holdingNote.value.trim();
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avgPrice) || avgPrice <= 0) {
          this.showToast('Enter valid quantity and average entry price');
          return;
        }

        const editId = this.el.holdingEditId.value;
        if (editId) {
          const idx = this.prefs.holdings.findIndex((h) => h.id === editId);
          if (idx >= 0) {
            this.prefs.holdings[idx] = { id: editId, symbol: resolved, side, qty, avgPrice, note };
            this.showToast(`Updated ${this._shortTicker(resolved)} holding`);
          }
        } else {
          this.prefs.holdings.push({
            id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            symbol: resolved,
            side,
            qty,
            avgPrice,
            note,
          });
          this.showToast(`Added ${qty} ${this._shortTicker(resolved)} to Portfolio`);
        }

        this._persistPrefs();
        this._resetHoldingForm();
        this.setHoldingFormOpen(false);
        this.renderPortfolio(true);
      });

      // Portfolio Performance vs. Benchmarks controls
      this.el.pfPerfRanges?.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn[data-pfrange]');
        if (!btn) return;
        this.pfPerfRange = btn.dataset.pfrange;
        this.el.pfPerfRanges.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.loadPortfolioPerformance(true);
      });

      this.el.pfPerfMode?.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn[data-pfmode]');
        if (!btn) return;
        this.pfPerfMode = btn.dataset.pfmode;
        this.el.pfPerfMode.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this._drawPortfolioPerfChart();
      });

      this.el.pfBenchToggles?.addEventListener('click', (e) => {
        const btn = e.target.closest('.bench-chip[data-bench]');
        if (!btn) return;
        const key = btn.dataset.bench;
        this.pfBenchmarks[key] = !this.pfBenchmarks[key];
        btn.classList.toggle('active', this.pfBenchmarks[key]);
        this._drawPortfolioPerfChart();
      });

      const handlePfPerfScrub = (clientX) => {
        if (!this.pfPerfData || !this.pfPerfData.dates.length) return;
        const rect = this.el.pfPerfCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const isNarrow = rect.width < 480;
        const padL = isNarrow ? 48 : 62;
        const padR = isNarrow ? 56 : 72;
        const plotW = Math.max(10, rect.width - padL - padR);
        const frac = Math.max(0, Math.min(1, (x - padL) / plotW));
        const idx = Math.round(frac * (this.pfPerfData.dates.length - 1));
        if (idx !== this.pfPerfHoverIdx) {
          this.pfPerfHoverIdx = idx;
          this._drawPortfolioPerfChart();
        }
      };

      this.el.pfPerfCanvas?.addEventListener('mousemove', (e) => {
        handlePfPerfScrub(e.clientX);
      });

      this.el.pfPerfCanvas?.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) handlePfPerfScrub(e.touches[0].clientX);
      }, { passive: true });

      this.el.pfPerfCanvas?.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) handlePfPerfScrub(e.touches[0].clientX);
      }, { passive: true });

      this.el.pfPerfCanvas?.addEventListener('touchend', () => {
        if (this.pfPerfHoverIdx !== null) {
          this.pfPerfHoverIdx = null;
          this._drawPortfolioPerfChart();
        }
      });

      this.el.pfPerfCanvas?.addEventListener('mouseleave', () => {
        if (this.pfPerfHoverIdx !== null) {
          this.pfPerfHoverIdx = null;
          this._drawPortfolioPerfChart();
        }
      });

      // Live ResizeObserver so Portfolio & Insights charts resize smoothly with window dimensions
      if (typeof ResizeObserver !== 'undefined') {
        const pfWrap = this.el.pfPerfCanvas?.parentElement;
        const donutWrap = this.el.pfDonutCanvas?.parentElement;
        if (pfWrap || donutWrap) {
          this._pfResizeObs = new ResizeObserver(() => {
            if (this.prefs.layout === 'portfolio') {
              requestAnimationFrame(() => {
                this._drawPortfolioPerfChart();
                this._renderPortfolioDonut(this._computePortfolioStats());
              });
            }
          });
          if (pfWrap) this._pfResizeObs.observe(pfWrap);
          if (donutWrap && donutWrap !== pfWrap) this._pfResizeObs.observe(donutWrap);
        }

        const epsWrap = this.el.insEpsCanvas?.parentElement;
        if (epsWrap) {
          this._insResizeObs = new ResizeObserver(() => {
            if (this.prefs.layout === 'insights' && this.insightsSubTab === 'overview' && this.activeInsights) {
              requestAnimationFrame(() => this._renderEpsChart(this.activeInsights));
            }
          });
          this._insResizeObs.observe(epsWrap);
        }
      }

      // Keep high-DPI canvases and interactive charts crisp on window resize
      let resizeRaf = null;
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        this._syncWebMobileLayout();
        if (!resizeRaf) {
          resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            if (this.prefs.layout === 'single') {
              this.mainChart?.resize();
            } else if (this.prefs.layout === 'grid') {
              this.gridPanes.forEach((p) => p.chart?.resize());
            } else if (this.prefs.layout === 'portfolio') {
              this._drawPortfolioPerfChart();
              this._renderPortfolioDonut(this._computePortfolioStats());
            } else if (this.prefs.layout === 'insights' && this.insightsSubTab === 'overview' && this.activeInsights) {
              this._renderEpsChart(this.activeInsights);
            }
          });
        }
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (this.prefs.layout === 'single') {
            this.mainChart?.resize();
          } else if (this.prefs.layout === 'grid') {
            this.gridPanes.forEach((p) => p.chart?.resize());
          } else if (this.prefs.layout === 'insights' && this.insightsSubTab === 'overview' && this.activeInsights) {
            this._renderEpsChart(this.activeInsights);
          } else if (this.prefs.layout === 'portfolio') {
            this._renderPortfolioDonut(this._computePortfolioStats());
            this._drawPortfolioPerfChart();
          }
        }, 120);
      });

      // Global keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        const isTyping =
          document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT');

        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.el.searchInput.focus();
          this.el.searchInput.select();
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); this.setLayout('single'); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); this.setLayout('grid'); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); this.setLayout('insights'); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); this.setLayout('portfolio'); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); this.setLayout('tools'); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); this.manualRefresh(); return; }
        if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); this.mainChart?.zoomBy(1.25); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); this.mainChart?.zoomBy(0.8); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); this.mainChart?.resetView(); return; }

        if (isTyping) {
          if (e.key === 'Escape') document.activeElement.blur();
          return;
        }

        if (e.key === '/') {
          e.preventDefault();
          this.el.searchInput.focus();
        } else if (e.key === 'Escape') {
          this.el.alertPopover.classList.add('hidden');
          this.el.indicatorsPopover?.classList.add('hidden');
          this.el.btnIndicatorsMenu?.classList.remove('open');
          this.el.drawingToolsPopover?.classList.add('hidden');
          this.el.btnDrawMenu?.classList.remove('open');
          this.el.comparePopover?.classList.add('hidden');
          this.el.btnCompareMenu?.classList.remove('open');
          this.mainChart?.setActiveTool('cursor');
        } else if (this.prefs.layout === 'single') {
          const k = e.key.toLowerCase();
          if (k === 't') this.mainChart?.setActiveTool('trendline');
          else if (k === 'r') this.mainChart?.setActiveTool('ray');
          else if (k === 'e') this.mainChart?.setActiveTool('extline');
          else if (k === 'h') this.mainChart?.setActiveTool('hline');
          else if (k === 'j') this.mainChart?.setActiveTool('hray');
          else if (k === 'v') this.mainChart?.setActiveTool('vline');
          else if (k === 'p') this.mainChart?.setActiveTool('pchannel');
          else if (k === 'c') this.mainChart?.setActiveTool('channel');
          else if (k === 'b') this.mainChart?.setActiveTool('rect');
          else if (k === 'o') this.mainChart?.setActiveTool('ellipse');
          else if (k === 'a') this.mainChart?.setActiveTool('arrow');
          else if (k === 'd') this.mainChart?.setActiveTool('brush');
          else if (k === 'f') this.mainChart?.setActiveTool('fib');
          else if (k === 'm') this.mainChart?.setActiveTool('measure');
          else if (k === 'l') this.mainChart?.setActiveTool('position');
          else if (k === 'n') this.mainChart?.setActiveTool('note');
          else if (k === 'g') this.mainChart?.setActiveTool('pricelabel');
          else if (k === 'z') this.mainChart?.undoDrawing();
          else if (e.key === 'Backspace' || e.key === 'Delete') {
            this.mainChart?.deleteSelectedDrawing();
          }
        }
      });
    }

    _bindAppCommands() {
      window.__hlSetDeviceProfile = (info) => {
        this.applyDeviceProfile(info);
      };
      window.__hlAppCommand = (cmd) => {
        if (typeof cmd === 'string' && cmd.startsWith('open-symbol:')) {
          const rawSym = cmd.slice('open-symbol:'.length).trim();
          const resolved = this._resolveHoldingSymbol(rawSym) || rawSym;
          if (resolved) {
            this.mobileMarketsOpen = false;
            this.prefs.activeSymbol = resolved;
            if (this.prefs.layout !== 'single') {
              this.setLayout('single');
            } else {
              this._syncMobileTabbar();
              this.loadSingleChart(resolved, this.prefs.interval, this.prefs.activeRange);
            }
          }
          return;
        }
        switch (cmd) {
          case 'refresh': this.manualRefresh(); break;
          case 'search':
            if (document.body.classList.contains('ios-compact')) this.setMobileMarketsOpen(true);
            this.el.searchInput.focus();
            this.el.searchInput.select();
            break;
          case 'layout-single': this.mobileMarketsOpen = false; this.setLayout('single'); break;
          case 'layout-grid': this.mobileMarketsOpen = false; this.setLayout('grid'); break;
          case 'layout-insights': this.mobileMarketsOpen = false; this.setLayout('insights'); break;
          case 'layout-portfolio': this.mobileMarketsOpen = false; this.setLayout('portfolio'); break;
          case 'layout-tools': this.mobileMarketsOpen = false; this.setLayout('tools'); break;
          case 'zoom-in': this.mainChart?.zoomBy(1.25); break;
          case 'zoom-out': this.mainChart?.zoomBy(0.8); break;
          case 'zoom-reset': this.mainChart?.resetView(); break;
        }
      };
    }

    _initMainChart() {
      this.mainChart = new InteractiveFinancialChart(this.el.mainChartHost, {
        compact: false,
        onHover: (info) => this._renderOhlcHud(info),
        onAutoScaleChange: (isAuto) => {
          this.el.btnAutoScale.classList.toggle('active', isAuto);
        },
        onToolChange: (tool) => {
          this.el.drawingRail.querySelectorAll('.draw-btn[data-tool]').forEach((b) => {
            b.classList.toggle('active', b.dataset.tool === tool);
          });
          this.el.drawingToolsPopover?.querySelectorAll('.draw-menu-item[data-tool]').forEach((b) => {
            b.classList.toggle('active', b.dataset.tool === tool);
          });
          const hint = TOOL_HINTS[tool];
          if (hint) {
            this.el.activeToolBanner.textContent = hint;
            this.el.activeToolBanner.classList.remove('hidden');
          } else {
            this.el.activeToolBanner.classList.add('hidden');
          }
        },
        onSelectionChange: (drawing) => {
          this._renderDrawingStyleBar(drawing);
        },
        onDrawingsChange: (list) => {
          this.prefs.drawings[this.prefs.activeSymbol] = list;
          this._syncDrawingCountBadge();
          this._persistPrefs();
        },
        onRequestMoreHistory: async (oldestTs) => {
          try {
            const older = await fetchCandles(this.prefs.activeSymbol, this.prefs.interval, oldestTs - 1, 260, false);
            this.mainChart.prependCandles(older);
          } catch (_) {
            this.mainChart.prependCandles([]);
          }
        },
      });
      this.mainChart.setChartType(this.prefs.chartType);
      this.mainChart.setLogScale(this.prefs.logScale);
      this.mainChart.setMagnetMode(this.prefs.magnetMode);
      this.mainChart.setStayInDrawingMode(this.prefs.stayInDrawingMode);
      this.mainChart.setDrawingsVisible(this.prefs.drawingsVisible);
      this.mainChart.setDrawingsLocked(this.prefs.drawingsLocked);
      this.mainChart.setIndicators(this.prefs.indicators);
    }

    _syncDrawingCountBadge() {
      if (!this.el.drawCountBadge) return;
      const list = this.prefs.drawings[this.prefs.activeSymbol] || [];
      this.el.drawCountBadge.textContent = String(list.length);
      this.el.drawCountBadge.classList.toggle('hidden', list.length === 0);
    }

    _renderDrawingStyleBar(drawing) {
      const bar = this.el.drawingStyleBar;
      if (!bar) return;
      if (!drawing || this.prefs.layout !== 'single') {
        bar.classList.add('hidden');
        return;
      }
      bar.classList.remove('hidden');

      const curColor = (drawing.color || '#38bdf8').toLowerCase();
      this.el.dsbColors.querySelectorAll('.dsb-swatch').forEach((sw) => {
        sw.classList.toggle('active', sw.dataset.color.toLowerCase() === curColor);
      });

      const curW = Math.round(drawing.lineWidth || 2);
      this.el.dsbWidths.querySelectorAll('.dsb-btn').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.width) === curW);
      });

      const curS = drawing.lineStyle || 'solid';
      this.el.dsbStyles.querySelectorAll('.dsb-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.style === curS);
      });

      const showExt = drawing.type === 'trendline' || drawing.type === 'arrow';
      this.el.dsbExtSep.classList.toggle('hidden', !showExt);
      this.el.dsbExtGroup.classList.toggle('hidden', !showExt);
      if (showExt) {
        this.el.btnDsbExtLeft.classList.toggle('active', Boolean(drawing.extendLeft));
        this.el.btnDsbExtRight.classList.toggle('active', Boolean(drawing.extendRight));
      }

      this.el.btnDsbEditText.classList.toggle('hidden', drawing.type !== 'note');
      this.el.btnDsbLock.classList.toggle('active', Boolean(drawing.locked));
      this.el.btnDsbLock.textContent = drawing.locked ? 'Unlock' : 'Lock';
    }

    _bindWSHandlers() {
      this.ws.onStatus((state, latencyMs) => {
        const pill = this.el.wsStatusPill;
        pill.classList.remove('connected', 'connecting', 'reconnecting');
        pill.classList.add(state);
        if (state === 'connected') {
          this.el.wsStatusText.textContent = latencyMs ? `LIVE · ${latencyMs}ms` : 'LIVE';
        } else if (state === 'reconnecting') {
          this.el.wsStatusText.textContent = 'Reconnecting...';
        } else {
          this.el.wsStatusText.textContent = 'Connecting...';
        }
      });

      this.ws.onMessage((msg) => {
        const ch = msg?.channel;
        if (!ch || ch === 'subscriptionResponse' || ch === 'pong') return;

        if (ch === 'allMids' && msg.data?.mids) {
          this._handleAllMids(msg.data.mids);
        } else if (ch === 'activeAssetCtx' && msg.data?.coin && msg.data?.ctx) {
          this._handleActiveAssetCtx(msg.data.coin, msg.data.ctx);
        } else if (ch === 'candle' && msg.data) {
          this._handleCandleWS(msg.data);
        } else if (ch === 'l2Book' && msg.data) {
          this._handleL2Book(msg.data);
        } else if (ch === 'trades' && Array.isArray(msg.data)) {
          this._handleTrades(msg.data);
        }
      });
    }

    async manualRefresh() {
      this.showToast('Refreshing Hyperliquid HIP-3 markets...');
      this.ws.reconnect();
      await this.loadMarkets(false);
      if (this.prefs.layout === 'single') {
        await this.loadSingleChart(this.prefs.activeSymbol, this.prefs.interval, this.prefs.activeRange);
      } else if (this.prefs.layout === 'grid') {
        await this._loadAllGridPanes();
      } else if (this.prefs.layout === 'insights') {
        await this.loadInsights(this.prefs.activeSymbol);
      } else if (this.prefs.layout === 'tools') {
        this.calcTools?.renderAll();
      } else {
        this.renderPortfolio(true);
        await this.loadPortfolioPerformance(true);
      }
    }

    async loadMarkets(isInitial) {
      try {
        const { markets, activeDexs } = await fetchAllHip3Markets();
        if (markets.length === 0) {
          if (isInitial) {
            const retryAction = document.body.classList.contains('platform-ios') ? 'tap Refresh' : 'press ⌘R';
            this.el.marketList.innerHTML = `<div class="empty-state">No HIP-3 markets returned. Check internet connection and ${retryAction}.</div>`;
          }
          return;
        }

        this.activeDexs = activeDexs;
        const stockCount = markets.filter((m) => m.category === 'stock').length;
        const cryptoCount = markets.filter((m) => m.category === 'crypto' && m.isSpot).length;
        this.el.marketCountPill.textContent = cryptoCount > 0
          ? `${stockCount} Stocks · ${cryptoCount} Crypto`
          : `${stockCount} Stocks`;

        if (this.el.dexSelect.options.length <= 1) {
          for (const d of activeDexs) {
            const opt = document.createElement('option');
            opt.value = d.name;
            opt.textContent = `${d.name} · ${d.fullName} (${d.count})`;
            this.el.dexSelect.appendChild(opt);
          }
        }

        for (const m of markets) {
          const prev = this.markets.get(m.id);
          if (prev && prev.price !== m.price) {
            m.flashDir = m.price > prev.price ? 'up' : 'down';
            m.flashTs = Date.now();
          }
          this.markets.set(m.id, m);
          this.tickerFallbackIndex.set(m.id, m.id);
          const curMapped = this.markets.get(this.tickerFallbackIndex.get(m.ticker));
          if (!curMapped || m.isSpot || (!curMapped.isSpot && m.dex === 'xyz')) {
            this.tickerFallbackIndex.set(m.ticker, m.id);
          }
          this._checkPriceAlerts(m.id, m.price);
        }

        this._populateHoldingDatalist();

        if (!this.markets.has(this.prefs.activeSymbol)) {
          const fallback =
            this.markets.get('xyz:NVDA') ||
            markets.find((m) => m.category === 'stock') ||
            markets[0];
          if (fallback) this.prefs.activeSymbol = fallback.id;
        }

        this.renderMarketList();
        this._renderActiveHeader();
        this.renderPortfolio(true);

        if (isInitial) {
          let subscribedMainMids = false;
          for (const d of activeDexs) {
            if (d.name === 'spot') {
              if (!subscribedMainMids) {
                this.dexMidSubs.push(this.ws.subscribe({ type: 'allMids' }));
                subscribedMainMids = true;
              }
            } else {
              const key = this.ws.subscribe({ type: 'allMids', dex: d.name });
              this.dexMidSubs.push(key);
            }
          }

          if (this.prefs.layout === 'single') {
            await this.loadSingleChart(this.prefs.activeSymbol, this.prefs.interval, this.prefs.activeRange);
          } else if (this.prefs.layout === 'grid') {
            this._buildGridDOM();
            await this._loadAllGridPanes();
          } else if (this.prefs.layout === 'insights') {
            await this.loadInsights(this.prefs.activeSymbol);
          } else if (this.prefs.layout === 'tools') {
            this.calcTools?.renderAll();
          } else {
            this.renderPortfolio(true);
          }
        }
      } catch (err) {
        console.error('loadMarkets error:', err);
        if (isInitial) {
          const retryHint = document.body.classList.contains('platform-ios') ? 'Tap Refresh to retry.' : 'Press ⌘R to retry.';
          this.el.marketList.innerHTML = `<div class="empty-state">Could not reach Hyperliquid API.<br/>${escHtml(err?.message || 'Network error')}<br/><br/>${retryHint}</div>`;
        }
      }
    }

    _populateHoldingDatalist() {
      const sorted = Array.from(this.markets.values())
        .filter((m) => !(m.category === 'crypto' && !m.isSpot))
        .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm);
      this.el.hip3StockOptions.innerHTML = sorted
        .map((m) => `<option value="${m.isSpot ? m.ticker : m.id}">${m.ticker} (${m.dex})${m.companyName ? ' - ' + m.companyName : ''} · $${formatPrice(m.price)}</option>`)
        .join('');
    }

    _resolveHoldingSymbol(input) {
      const raw = (input || '').trim();
      if (!raw) return null;
      if (this.markets.has(raw)) return raw;
      const upper = raw.toUpperCase();
      // Prioritize Crypto Spot matches when user types BTC, ETH, SOL, BNB, XRP
      for (const [id, m] of this.markets.entries()) {
        if (m.isSpot && m.ticker.toUpperCase() === upper) return id;
      }
      if (this.markets.has(`xyz:${upper}`)) return `xyz:${upper}`;
      const lower = raw.toLowerCase();
      let bestId = null;
      let bestVol = -1;
      for (const [id, m] of this.markets.entries()) {
        if (id.toLowerCase() === lower) return id;
        if (m.ticker.toLowerCase() === lower) {
          const vol = m.dayNtlVlm || 0;
          if (vol > bestVol) {
            bestVol = vol;
            bestId = id;
          }
        }
      }
      return bestId;
    }

    _handleAllMids(mids) {
      const now = Date.now();
      let portfolioTouched = false;
      const heldSet = new Set(this.prefs.holdings.map((h) => h.symbol));
      if (this.prefs.layout === 'portfolio' && this.pfPerfData) {
        if (Array.isArray(this.pfPerfData.mag7Coins)) {
          for (const mc of this.pfPerfData.mag7Coins) heldSet.add(mc);
        }
        if (Array.isArray(this.pfPerfData.msciCoins)) {
          for (const mc of this.pfPerfData.msciCoins) heldSet.add(mc);
        }
        if (this.pfPerfData.isIntraday) {
          if (this.pfPerfData.spyCoin) heldSet.add(this.pfPerfData.spyCoin);
          if (this.pfPerfData.qqqCoin) heldSet.add(this.pfPerfData.qqqCoin);
        }
      }

      for (const [rawKey, pxStr] of Object.entries(mids)) {
        const id = this.markets.has(rawKey) ? rawKey : this.tickerFallbackIndex.get(rawKey);
        if (!id) continue;
        const m = this.markets.get(id);
        if (!m) continue;
        const px = parseFloat(pxStr);
        if (!Number.isFinite(px) || px <= 0 || px === m.price) continue;

        const dir = px > m.price ? 'up' : 'down';
        m.price = px;
        if (m.prevDayPx > 0) {
          m.change24h = px - m.prevDayPx;
          m.change24hPct = ((px - m.prevDayPx) / m.prevDayPx) * 100;
        }
        m.flashDir = dir;
        m.flashTs = now;

        this._patchSidebarRow(m, dir);
        this._checkPriceAlerts(id, px);
        if (heldSet.has(id)) portfolioTouched = true;

        if (this.prefs.layout === 'single') {
          if (id === this.prefs.activeSymbol) {
            this._renderActiveHeader(dir);
            this.mainChart?.applyLiveTickPrice(px);
          } else if (this.compareSymbols.includes(id)) {
            this.mainChart?.upsertCompareTick(id, px);
          }
        } else if (this.prefs.layout === 'insights' && id === this.prefs.activeSymbol) {
          this._scheduleInsightsRender(dir);
        } else if (this.prefs.layout === 'grid') {
          for (const pane of this.gridControllers) {
            if (pane.symbol === id) {
              this._updateGridPaneHeader(pane, m);
              pane.chart?.applyLiveTickPrice(px);
            }
          }
        }
      }

      if (portfolioTouched) this._schedulePortfolioRender();
      if (this.prefs.layout === 'tools') this.calcTools?.scheduleLiveTick();
    }

    _handleActiveAssetCtx(coin, ctx) {
      const m = this.markets.get(coin);
      if (!m) return;
      const markPx = parseFloat(ctx.markPx);
      const midPx = ctx.midPx !== null && ctx.midPx !== undefined ? parseFloat(ctx.midPx) : NaN;
      const oraclePx = parseFloat(ctx.oraclePx);
      const prevDayPx = parseFloat(ctx.prevDayPx);
      const nextPx = m.useOracleAsSpot && Number.isFinite(oraclePx) && oraclePx > 0
        ? oraclePx
        : (Number.isFinite(midPx) ? midPx : (Number.isFinite(markPx) ? markPx : m.price));
      const dir = nextPx > m.price ? 'up' : (nextPx < m.price ? 'down' : null);

      if (Number.isFinite(nextPx) && nextPx > 0) m.price = nextPx;
      if (Number.isFinite(markPx)) m.markPx = markPx;
      if (Number.isFinite(oraclePx)) m.oraclePx = oraclePx;
      if (Number.isFinite(prevDayPx) && prevDayPx > 0) {
        const adjPrev = normalizeSplitPrevDayPx(prevDayPx, m.price, m.category);
        m.prevDayPx = adjPrev;
        m.change24h = m.price - adjPrev;
        m.change24hPct = ((m.price - adjPrev) / adjPrev) * 100;
      }
      if (ctx.dayNtlVlm !== undefined) m.dayNtlVlm = parseFloat(ctx.dayNtlVlm) || m.dayNtlVlm;
      if (ctx.funding !== undefined) m.funding = parseFloat(ctx.funding) || 0;
      if (ctx.openInterest !== undefined) {
        const oi = parseFloat(ctx.openInterest) || 0;
        m.openInterestUsd = oi * m.markPx;
      }

      if (dir) {
        this._patchSidebarRow(m, dir);
        this._checkPriceAlerts(coin, m.price);
        if (this.prefs.holdings.some((h) => h.symbol === coin)) {
          this._schedulePortfolioRender();
        }
      }

      if (this.prefs.layout === 'single' && coin === this.prefs.activeSymbol) {
        this._renderActiveHeader(dir);
        if (Number.isFinite(m.price)) this.mainChart?.applyLiveTickPrice(m.price);
      } else if (this.prefs.layout === 'insights' && coin === this.prefs.activeSymbol) {
        this._scheduleInsightsRender(dir);
      } else if (this.prefs.layout === 'grid') {
        for (const pane of this.gridControllers) {
          if (pane.symbol === coin) {
            this._updateGridPaneHeader(pane, m);
            if (Number.isFinite(m.price)) pane.chart?.applyLiveTickPrice(m.price);
          }
        }
      }
    }

    _handleCandleWS(data) {
      const items = Array.isArray(data) ? data : [data];
      for (const d of items) {
        const coin = d.s;
        const interval = d.i;
        const candle = {
          t: Number(d.t),
          T: Number(d.T),
          o: parseFloat(d.o),
          h: parseFloat(d.h),
          l: parseFloat(d.l),
          c: parseFloat(d.c),
          v: parseFloat(d.v) || 0,
        };
        if (!Number.isFinite(candle.c)) continue;

        if (this.prefs.layout === 'single' && coin === this.prefs.activeSymbol && interval === this.prefs.interval) {
          this.mainChart?.upsertLiveCandle(candle);
        }
        if (this.prefs.layout === 'grid') {
          for (const pane of this.gridControllers) {
            if (pane.symbol === coin && pane.interval === interval) {
              pane.chart?.upsertLiveCandle(candle);
            }
          }
        }
      }
    }

    _handleL2Book(data) {
      if (data.coin !== this.prefs.activeSymbol) return;
      const levels = data.levels;
      if (!Array.isArray(levels) || levels.length < 2) return;
      this.latestBook = { bids: levels[0] || [], asks: levels[1] || [] };
      this._renderOrderBook(this.latestBook.bids, this.latestBook.asks);
    }

    _handleTrades(trades) {
      let changed = false;
      for (const tr of trades) {
        if (tr.coin !== this.prefs.activeSymbol) continue;
        this.recentTrades.unshift({
          px: parseFloat(tr.px),
          sz: parseFloat(tr.sz),
          side: tr.side,
          time: Number(tr.time),
        });
        changed = true;
      }
      if (!changed) return;
      if (this.recentTrades.length > 45) this.recentTrades.length = 45;
      this._renderTrades();

      const newest = this.recentTrades[0];
      if (newest && Number.isFinite(newest.px)) {
        this.mainChart?.applyLiveTickPrice(newest.px);
      }
    }

    // MARK: Single Chart Loading (with Multi-Year History Support)

    async loadSingleChart(symbol, interval, rangeKey = null) {
      const seq = ++this._loadSeq;

      for (const key of this.mainSubs) this.ws.unsubscribe(key);
      this.mainSubs = [];

      this.prefs.activeSymbol = symbol;
      if (interval) this.prefs.interval = interval;
      this.prefs.activeRange = rangeKey;
      this._persistPrefs();

      this.recentTrades = [];
      this.latestBook = null;
      this.el.bookAsks.innerHTML = '';
      this.el.bookBids.innerHTML = '';
      this.el.bookMidPrice.textContent = '—';
      this.el.bookSpread.textContent = 'Spread —';
      this.el.tradesList.innerHTML = '<div class="empty-state" style="padding:14px">Waiting for live trades...</div>';

      this._renderActiveHeader();
      this._highlightActiveRow();
      this._syncActiveAlertsToChart();
      if (this.compareSymbols.includes(symbol)) {
        this.compareSymbols = this.compareSymbols.filter((s) => s !== symbol);
      }
      this.mainChart.setBaseLabel(this._shortTicker(symbol));
      this._syncCompareUI();
      this.mainChart.setDrawings(this.prefs.drawings[symbol] || []);
      this._syncDrawingCountBadge();
      this.mainChart.setFundamentalContext(null);
      this._syncFundamentalContextForChart(symbol);

      const labelDesc = rangeKey ? `${rangeKey} range` : this.prefs.interval;
      this.mainChart.setStatusMessage(`Loading ${this._shortTicker(symbol)} (${labelDesc})...`);
      this.mainChart.setCandles([], { resetView: true });

      try {
        const res = await fetchCandlesWithHistory(symbol, this.prefs.interval, rangeKey);
        if (seq !== this._loadSeq) return; // stale request

        this.prefs.interval = res.interval;
        this._syncControlUI();

        this.el.dataSourceBadge.textContent = res.sourceLabel;
        this.el.dataSourceBadge.classList.toggle('stitched', res.hasBackfill);

        this.mainChart.setIntervalName(res.interval);
        this.mainChart.setStatusMessage('No recent candles on this timeframe. Try 1h or 1D.');
        this.mainChart.setCandles(res.candles, { resetView: !rangeKey, fitAll: Boolean(rangeKey) });

        if (this.compareSymbols.length > 0) {
          this.loadCompareSeries();
        } else {
          this.mainChart.setCompareSeries([]);
          this._renderCompareLegendBar(null);
        }

        // Subscribe live WS streams for this symbol & effective interval
        this.mainSubs.push(this.ws.subscribe({ type: 'candle', coin: symbol, interval: res.interval }));
        this.mainSubs.push(this.ws.subscribe({ type: 'activeAssetCtx', coin: symbol }));
        this.mainSubs.push(this.ws.subscribe({ type: 'l2Book', coin: symbol }));
        this.mainSubs.push(this.ws.subscribe({ type: 'trades', coin: symbol }));
      } catch (err) {
        if (seq !== this._loadSeq) return;
        const retryHint = document.body.classList.contains('platform-ios') ? 'Tap Refresh to retry.' : 'Press ⌘R to retry.';
        this.mainChart.setStatusMessage(`Unable to load candles. ${retryHint}`);
        this.showToast(`Failed to load candles for ${this._shortTicker(symbol)}: ${err.message}`);
      }
    }

    // MARK: Multi-Asset Chart Compare (Up to 10 Total: Base + 9 Overlays)

    _openComparePopover() {
      if (!this.el.comparePopover) return;
      this.el.indicatorsPopover?.classList.add('hidden');
      this.el.btnIndicatorsMenu?.classList.remove('open');
      this.el.drawingToolsPopover?.classList.add('hidden');
      this.el.btnDrawMenu?.classList.remove('open');
      const willOpen = this.el.comparePopover.classList.contains('hidden');
      this.el.comparePopover.classList.toggle('hidden', !willOpen);
      this.el.btnCompareMenu?.classList.toggle('open', willOpen);
      if (willOpen) {
        this._renderComparePopover();
        this.el.compareSearchInput?.focus();
      }
    }

    toggleCompareSymbol(symbolId) {
      if (!symbolId || symbolId === this.prefs.activeSymbol) return;
      const idx = this.compareSymbols.indexOf(symbolId);
      if (idx >= 0) {
        this.compareSymbols.splice(idx, 1);
      } else {
        if (this.compareSymbols.length >= COMPARE_MAX_OVERLAYS) {
          this.showToast(`You can compare up to ${COMPARE_MAX_TOTAL} assets at a time on one chart.`);
          return;
        }
        this.compareSymbols.push(symbolId);
      }
      this._syncCompareUI();
      this._renderComparePopover();
      this.loadCompareSeries();
    }

    clearCompareSymbols() {
      if (this.compareSymbols.length === 0) return;
      this.compareSymbols = [];
      this._compareSeq++;
      this.mainChart?.setCompareSeries([]);
      this._syncCompareUI();
      this._renderComparePopover();
      this._renderCompareLegendBar(null);
    }

    _syncCompareUI() {
      const count = this.compareSymbols.length;
      if (this.el.btnCompareMenu) {
        this.el.btnCompareMenu.classList.toggle('has-compares', count > 0);
      }
      if (this.el.compareCountBadge) {
        this.el.compareCountBadge.textContent = String(count + 1);
        this.el.compareCountBadge.classList.toggle('hidden', count === 0);
      }
      if (this.el.compareLimitHint) {
        this.el.compareLimitHint.textContent = `${count + 1} / ${COMPARE_MAX_TOTAL} assets`;
      }
      if (count === 0) {
        this._renderCompareLegendBar(null);
      }
    }

    async loadCompareSeries() {
      const seq = ++this._compareSeq;
      if (this.compareSymbols.length === 0) {
        this.mainChart?.setCompareSeries([]);
        this._renderCompareLegendBar(null);
        return;
      }
      const symbols = [...this.compareSymbols];
      const interval = this.prefs.interval;
      const rangeKey = this.prefs.activeRange;

      // Show immediate loading pills in the compare legend bar
      if (this.el.compareLegendBar) {
        this.el.ohlcHud?.classList.add('hidden');
        this.el.compareLegendBar.classList.remove('hidden');
        this.el.compareLegendBar.innerHTML = [
          `<span class="compare-legend-pill"><span class="cmp-dot" style="background:#50e3c2"></span><strong>${escHtml(this._shortTicker(this.prefs.activeSymbol))}</strong><span class="cmp-px">loading...</span></span>`,
          ...symbols.map((sym, idx) => `<span class="compare-legend-pill"><span class="cmp-dot" style="background:${COMPARE_COLORS[idx % COMPARE_COLORS.length]}"></span><strong>${escHtml(this._shortTicker(sym))}</strong><span class="cmp-px">loading...</span></span>`),
        ].join('');
      }

      const results = await Promise.all(
        symbols.map(async (sym, idx) => {
          try {
            const res = await fetchCandlesWithHistory(sym, interval, rangeKey);
            const candles = Array.isArray(res?.candles) ? res.candles : [];
            const liveM = this.markets.get(sym);
            if (candles.length > 0 && liveM && Number.isFinite(liveM.price) && liveM.price > 0) {
              candles[candles.length - 1] = { ...candles[candles.length - 1], c: liveM.price };
            }
            return {
              id: sym,
              ticker: this._shortTicker(sym),
              color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
              candles,
            };
          } catch (_) {
            return {
              id: sym,
              ticker: this._shortTicker(sym),
              color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
              candles: [],
            };
          }
        })
      );
      if (seq !== this._compareSeq) return;
      const emptyTickers = results.filter((r) => r.candles.length === 0).map((r) => r.ticker);
      if (emptyTickers.length > 0) {
        this.showToast(`No candle history available for ${emptyTickers.join(', ')} on this timeframe.`);
      }
      this.mainChart?.setCompareSeries(results);
    }

    _renderComparePopover() {
      if (!this.el.comparePopover || this.el.comparePopover.classList.contains('hidden')) return;
      const activeId = this.prefs.activeSymbol;
      const activeTicker = this._shortTicker(activeId);
      const total = this.compareSymbols.length + 1;

      if (this.el.compareLimitHint) {
        this.el.compareLimitHint.textContent = `${total} / ${COMPARE_MAX_TOTAL} assets`;
      }

      // Active chips (Base + selected overlays)
      if (this.el.compareActiveChips) {
        const chips = [
          `<span class="compare-active-chip base"><span class="cmp-dot" style="background:#50e3c2"></span>${escHtml(activeTicker)} <small style="color:var(--text-muted)">base</small></span>`,
          ...this.compareSymbols.map((sym, idx) => {
            const col = COMPARE_COLORS[idx % COMPARE_COLORS.length];
            return `<span class="compare-active-chip"><span class="cmp-dot" style="background:${col}"></span>${escHtml(this._shortTicker(sym))}<button type="button" data-cmprm="${escHtml(sym)}" title="Remove">×</button></span>`;
          }),
        ];
        this.el.compareActiveChips.innerHTML = chips.join('');
        this.el.compareActiveChips.querySelectorAll('button[data-cmprm]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCompareSymbol(btn.dataset.cmprm);
          });
        });
      }

      // Quick pick buttons
      if (this.el.compareQuickRow) {
        const qItems = [];
        for (const tk of COMPARE_QUICK_TICKERS) {
          const id = this._resolveHoldingSymbol(tk);
          if (!id || id === activeId) continue;
          const isSel = this.compareSymbols.includes(id);
          qItems.push(
            `<button type="button" class="compare-quick-btn ${isSel ? 'selected' : ''}" data-cmpid="${escHtml(id)}">${isSel ? '✓ ' : '+ '}${escHtml(tk)}</button>`
          );
        }
        this.el.compareQuickRow.innerHTML = qItems.join('');
        this.el.compareQuickRow.querySelectorAll('button[data-cmpid]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCompareSymbol(btn.dataset.cmpid);
          });
        });
      }

      // Searchable asset list (exclude stale non-spot crypto perps so BTC/ETH/SOL/BNB/XRP always resolve to live Spot)
      if (this.el.compareResultsList) {
        const q = (this.el.compareSearchInput?.value || '').trim().toLowerCase();
        const all = Array.from(this.markets.values())
          .filter((m) => m.id !== activeId && !(m.category === 'crypto' && !m.isSpot))
          .filter((m) => {
            if (!q) return true;
            return (
              m.ticker.toLowerCase().includes(q) ||
              m.id.toLowerCase().includes(q) ||
              (m.companyName || '').toLowerCase().includes(q) ||
              (m.dexLabel || '').toLowerCase().includes(q)
            );
          })
          .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)
          .slice(0, 30);

        if (all.length === 0) {
          this.el.compareResultsList.innerHTML = '<div class="empty-state" style="padding:12px">No matching assets</div>';
        } else {
          this.el.compareResultsList.innerHTML = all
            .map((m) => {
              const idx = this.compareSymbols.indexOf(m.id);
              const isSel = idx >= 0;
              const col = isSel ? COMPARE_COLORS[idx % COMPARE_COLORS.length] : null;
              const dexCls = this._dexBadgeClass(m.dex);
              const sign = m.change24hPct >= 0 ? '+' : '';
              return `
                <button type="button" class="compare-res-row ${isSel ? 'selected' : ''}" data-cmpid="${escHtml(m.id)}">
                  <span class="compare-res-left">
                    ${col ? `<span class="cmp-dot" style="width:7px;height:7px;border-radius:999px;background:${col};flex-shrink:0"></span>` : ''}
                    <strong>${escHtml(m.ticker)}</strong>
                    <span class="dex-badge ${dexCls}">${escHtml(m.dex)}</span>
                    <span class="compare-res-sub">${escHtml(m.companyName || m.dexLabel)}</span>
                  </span>
                  <span style="font-family:var(--font-mono);font-size:11px;display:flex;align-items:center;gap:8px;flex-shrink:0">
                    <span>$${formatPrice(m.price)}</span>
                    <span class="${m.change24hPct >= 0 ? 'pct-up' : 'pct-down'}">${sign}${m.change24hPct.toFixed(2)}%</span>
                  </span>
                </button>`;
            })
            .join('');
          this.el.compareResultsList.querySelectorAll('button[data-cmpid]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.toggleCompareSymbol(btn.dataset.cmpid);
            });
          });
        }
      }
    }

    _renderCompareLegendBar(items, anchorTime = null, interval = null) {
      const bar = this.el.compareLegendBar;
      if (!bar) return;
      if (!Array.isArray(items) || items.length <= 1) {
        bar.classList.add('hidden');
        bar.innerHTML = '';
        this.el.ohlcHud?.classList.remove('hidden');
        return;
      }
      this.el.ohlcHud?.classList.add('hidden');
      bar.classList.remove('hidden');
      bar.classList.toggle('dense', items.length >= 6);
      let anchorHtml = '';
      if (Number.isFinite(anchorTime)) {
        const d = new Date(anchorTime);
        const isDaily = interval === '1d' || interval === '1w' || interval === '1M';
        const fmt = isDaily
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
          : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        anchorHtml = `<span class="compare-legend-anchor" title="0.00% baseline timestamp">0% @ ${escHtml(fmt)}</span>`;
      }
      const pills = items.map((it) => {
        const pctStr = Number.isFinite(it.pct) ? `${it.pct >= 0 ? '+' : ''}${it.pct.toFixed(2)}%` : '—';
        const pxStr = Number.isFinite(it.price) ? `$${formatPrice(it.price)}` : '';
        const rmBtn = it.isBase ? '' : `<button type="button" class="cmp-rm" data-cmprm="${escHtml(it.id)}" title="Remove ${escHtml(it.ticker)}">×</button>`;
        return `
          <span class="compare-legend-pill">
            <span class="cmp-dot" style="background:${it.color}"></span>
            <strong>${escHtml(it.ticker)}</strong>
            <span class="cmp-pct" style="color:${it.color}">${pctStr}</span>
            ${pxStr ? `<span class="cmp-px">${pxStr}</span>` : ''}
            ${rmBtn}
          </span>`;
      });
      if (this.compareSymbols.length < COMPARE_MAX_OVERLAYS) {
        pills.push('<button type="button" class="compare-legend-add" id="btnCompareLegendAdd">+ Add</button>');
      }
      bar.innerHTML = `${anchorHtml}${pills.join('')}`;
      bar.querySelectorAll('button[data-cmprm]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCompareSymbol(btn.dataset.cmprm);
        });
      });
      bar.querySelector('#btnCompareLegendAdd')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openComparePopover();
      });
    }

    // MARK: Layout Switching (Single / 2x2 Grid / Portfolio)

    async setLayout(mode) {
      if (this.mobileMarketsOpen) {
        this.mobileMarketsOpen = false;
      }
      if (mode === this.prefs.layout) {
        this._syncMobileTabbar();
        return;
      }
      const prevMode = this.prefs.layout;
      this.prefs.layout = mode;
      this._persistPrefs();
      this._syncControlUI();

      // Dismiss any floating popovers / style bar when switching views
      this.el.alertPopover?.classList.add('hidden');
      this.el.indicatorsPopover?.classList.add('hidden');
      this.el.btnIndicatorsMenu?.classList.remove('open');
      this.el.drawingToolsPopover?.classList.add('hidden');
      this.el.btnDrawMenu?.classList.remove('open');
      this.el.comparePopover?.classList.add('hidden');
      this.el.btnCompareMenu?.classList.remove('open');
      this.el.drawingStyleBar?.classList.add('hidden');

      if (prevMode === 'grid') this._teardownGrid();
      if (prevMode === 'single' || prevMode === 'insights') {
        for (const key of this.mainSubs) this.ws.unsubscribe(key);
        this.mainSubs = [];
      }

      if (mode === 'grid') {
        this._buildGridDOM();
        await this._loadAllGridPanes();
      } else if (mode === 'single') {
        setTimeout(() => this.mainChart?.resize(), 20);
        await this.loadSingleChart(this.prefs.activeSymbol, this.prefs.interval, this.prefs.activeRange);
      } else if (mode === 'insights') {
        await this.loadInsights(this.prefs.activeSymbol);
      } else if (mode === 'portfolio') {
        this.renderPortfolio(true);
      } else if (mode === 'tools') {
        this.calcTools?.renderAll();
      }
    }

    // MARK: Live Stock Insights & Real-Time Fundamental Valuation

    async _syncFundamentalContextForChart(symbol) {
      try {
        const ins = await fetchStockInsights(symbol);
        if (this.prefs.activeSymbol !== symbol) return;
        if (ins && (ins.ttmEps || ins.forwardEps)) {
          const m = this.markets.get(symbol);
          const sf = m && ins.refPrice ? detectSplitFactor(ins.refPrice, m.price).factor : 1;
          this.mainChart?.setFundamentalContext({
            ticker: ins.ticker,
            ttmEps: Number.isFinite(ins.ttmEps) ? ins.ttmEps / sf : null,
            forwardEps: Number.isFinite(ins.forwardEps) ? ins.forwardEps / sf : null,
          });
        }
      } catch (_) {}
    }

    async loadInsights(symbol) {
      const seq = ++this._insightsLoadSeq;
      for (const key of this.mainSubs) this.ws.unsubscribe(key);
      this.mainSubs = [];

      this.prefs.activeSymbol = symbol;
      this._persistPrefs();
      this._highlightActiveRow();

      // Subscribe live activeAssetCtx so price, oracle, mark, funding, OI stream live
      this.mainSubs.push(this.ws.subscribe({ type: 'activeAssetCtx', coin: symbol }));

      if (this.activeInsightsSymbol !== symbol) {
        this.activeInsights = null;
        this.activeInsightsSymbol = symbol;
        this.earningsCadenceOverride = null;
      }

      // Render immediately with live Hyperliquid stats while Nasdaq fundamentals load
      this.renderInsights(null);

      try {
        const ins = await fetchStockInsights(symbol);
        if (seq !== this._insightsLoadSeq) return;
        this.activeInsights = ins;
        this.activeInsightsSymbol = symbol;
        if (ins && (ins.ttmEps || ins.forwardEps)) {
          const m = this.markets.get(symbol);
          const sf = m && ins.refPrice ? detectSplitFactor(ins.refPrice, m.price).factor : 1;
          this.mainChart?.setFundamentalContext({
            ticker: ins.ticker,
            ttmEps: Number.isFinite(ins.ttmEps) ? ins.ttmEps / sf : null,
            forwardEps: Number.isFinite(ins.forwardEps) ? ins.forwardEps / sf : null,
          });
        }
        this.renderInsights(null);
      } catch (err) {
        if (seq !== this._insightsLoadSeq) return;
        this.renderInsights(null);
      }
    }

    _scheduleInsightsRender(flashDir = null) {
      if (flashDir) this._pendingInsightsFlash = flashDir;
      if (this._insightsRenderQueued) return;
      this._insightsRenderQueued = true;
      requestAnimationFrame(() => {
        this._insightsRenderQueued = false;
        const dir = this._pendingInsightsFlash;
        this._pendingInsightsFlash = null;
        this.renderInsights(dir);
      });
    }

    renderInsights(flashDir = null) {
      if (this.prefs.layout !== 'insights') return;
      const m = this.markets.get(this.prefs.activeSymbol);
      const ins = this.activeInsights;
      const livePrice = m ? m.price : (ins?.refPrice || 0);
      const ticker = m ? m.ticker : this._shortTicker(this.prefs.activeSymbol);
      const dex = m ? m.dex : (this.prefs.activeSymbol.includes(':') ? this.prefs.activeSymbol.split(':')[0] : 'xyz');

      const fmtNum = (v, suffix = '', digits = 2) =>
        Number.isFinite(v) ? `${v.toFixed(digits)}${suffix}` : '—';
      const fmtDollarBig = (v) => {
        if (!Number.isFinite(v)) return '—';
        const neg = v < 0 ? '-' : '';
        return `${neg}$${formatCompact(Math.abs(v))}`;
      };
      const esc = (s) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      // 1. Hero Header
      this.el.insTicker.textContent = ticker;
      this.el.insDexBadge.textContent = dex;
      this.el.insDexBadge.className = `dex-badge ${this._dexBadgeClass(dex)}`;
      this.el.insExchangeBadge.textContent = ins?.exchange || (m?.dexLabel || 'HIP-3 Perp');

      if (ins?.sector) {
        this.el.insSectorBadge.textContent = ins.sector;
        this.el.insSectorBadge.classList.remove('hidden');
      } else {
        this.el.insSectorBadge.classList.add('hidden');
      }
      if (ins?.industry) {
        this.el.insIndustryBadge.textContent = ins.industry;
        this.el.insIndustryBadge.classList.remove('hidden');
      } else {
        this.el.insIndustryBadge.classList.add('hidden');
      }

      this.el.insCompanyName.textContent = ins?.companyName || m?.companyName || `${ticker} Perpetual Market`;

      this.el.insLivePrice.textContent = livePrice > 0 ? `$${formatPrice(livePrice)}` : '—';
      if (flashDir === 'up') {
        this.el.insLivePrice.style.color = 'var(--bull)';
        setTimeout(() => { this.el.insLivePrice.style.color = ''; }, 300);
      } else if (flashDir === 'down') {
        this.el.insLivePrice.style.color = 'var(--bear)';
        setTimeout(() => { this.el.insLivePrice.style.color = ''; }, 300);
      }

      const val = ins && livePrice > 0 ? computeLiveValuation(ins, livePrice) : {};
      const sf = val.splitFactor || 1;

      if (m) {
        let chg = m.change24h;
        let pct = m.change24hPct;
        let splitNote = '';
        // If Hyperliquid prevDayPx is still pre-split on split day, show accurate split-adjusted 24h change
        if (sf !== 1 && m.prevDayPx > 0 && livePrice > 0) {
          const prevSplit = detectSplitFactor(m.prevDayPx, livePrice);
          if (Math.abs(prevSplit.factor - sf) / Math.max(1e-6, sf) <= 0.15) {
            const adjPrev = m.prevDayPx / sf;
            chg = livePrice - adjPrev;
            pct = adjPrev > 0 ? (chg / adjPrev) * 100 : 0;
            splitNote = ` · ${val.splitLabel}`;
          }
        }
        const up = chg >= 0;
        const sign = up ? '+' : '-';
        this.el.insLiveChange.textContent = `${sign}$${formatPrice(Math.abs(chg))} (${up ? '+' : ''}${pct.toFixed(2)}%)${splitNote}`;
        this.el.insLiveChange.className = `big-change ${up ? 'up' : 'down'}`;
      } else {
        this.el.insLiveChange.textContent = '—';
        this.el.insLiveChange.className = 'big-change';
      }

      // 2. Adaptive Live Valuation / Market Analytics Grid
      const kind = ins?.assetKind || 'stock';
      const hl = ins?.hlStats || null;
      const cur = ins?.curated || null;
      const etf = ins?.etfMetrics || null;
      const fmtRet = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
      const retCls = (v) => (Number.isFinite(v) ? (v >= 0 ? 'up' : 'down') : '');

      let tiles = [];
      if (!ins || kind === 'stock') {
        if (this.el.insValTitle) {
          this.el.insValTitle.textContent = val.splitLabel
            ? `Live Valuation Multiples (${val.splitLabel} Adjusted)`
            : 'Live Valuation Multiples';
        }
        this.el.insValSub.textContent = !ins
          ? 'Fetching live fundamental data...'
          : `Recalculated tick-by-tick at live Hyperliquid price $${formatPrice(livePrice)}${val.splitLabel ? ` · Per-share metrics normalized for ${val.splitLabel}` : ''}`;
        const dispTtmEps = val.adjTtmEps ?? ins?.ttmEps;
        const dispFwdEps = val.adjForwardEps ?? ins?.forwardEps;
        const dispShares = val.adjImpliedShares ?? ins?.impliedShares;
        const dispDiv = val.adjAnnualDividend ?? ins?.annualDividend;
        const peSub = Number.isFinite(dispTtmEps)
          ? (dispTtmEps <= 0 ? `Neg EPS ($${dispTtmEps.toFixed(2)})` : `TTM EPS $${dispTtmEps.toFixed(2)}`)
          : 'Trailing 12M';
        const fpeSub = Number.isFinite(dispFwdEps)
          ? (dispFwdEps <= 0 ? `Neg Fwd ($${dispFwdEps.toFixed(2)})` : `Fwd EPS $${dispFwdEps.toFixed(2)}`)
          : 'Next 4Q est';
        const refPrevAdj = ins?.refPrice ? ins.refPrice / sf : null;
        tiles = [
          { label: 'Live Market Cap', num: fmtDollarBig(val.liveMarketCap), sub: dispShares ? `${formatCompact(dispShares)} shares` : 'Implied cap', live: true },
          { label: 'Live P/E (TTM)', num: fmtNum(val.liveTrailingPE, 'x'), sub: peSub, live: true, cls: 'accent' },
          { label: 'Live Forward P/E', num: fmtNum(val.liveForwardPE, 'x'), sub: fpeSub, live: true },
          { label: 'Live PEG Ratio', num: fmtNum(val.livePEG, 'x'), sub: 'Price / Earnings-Growth', live: true },
          { label: 'Live P/S (TTM)', num: fmtNum(val.livePS, 'x'), sub: ins?.financials?.latestRev ? `Rev ${fmtDollarBig(ins.financials.latestRev)}` : 'Price / Sales', live: true },
          { label: 'Live P/B Ratio', num: fmtNum(val.livePB, 'x'), sub: ins?.financials?.totalEquity ? `Equity ${fmtDollarBig(ins.financials.totalEquity)}` : 'Price / Book', live: true },
          { label: 'Live Ent. Value', num: fmtDollarBig(val.liveEV), sub: 'Cap + Debt − Cash', live: true },
          { label: 'Live EV / EBIT', num: fmtNum(val.liveEvToEbit, 'x'), sub: ins?.financials?.latestOpInc ? `EBIT ${fmtDollarBig(ins.financials.latestOpInc)}` : 'Operating multiple', live: true },
          { label: 'Earnings Yield', num: fmtNum(val.liveEarningsYield, '%'), sub: 'Inverse live P/E', live: true },
          { label: 'Dividend Yield', num: val.liveDivYield ? `${val.liveDivYield.toFixed(2)}%` : '0.00%', sub: dispDiv ? `$${dispDiv.toFixed(2)} / yr` : 'No regular div', live: true },
          { label: '30D Live Return', num: fmtRet(hl?.ret30d ?? hl?.ret7d), sub: hl?.vol30dAnn ? `30D Vol ${hl.vol30dAnn.toFixed(0)}%` : 'Hyperliquid live', cls: retCls(hl?.ret30d ?? hl?.ret7d) },
          {
            label: Number.isFinite(ins?.beta) ? 'Beta / Avg Vol' : 'US Share Volume',
            num: Number.isFinite(ins?.beta) ? ins.beta.toFixed(2) : (ins?.shareVolume ? formatCompact(ins.shareVolume) : '—'),
            sub: refPrevAdj ? `Prev Close $${formatPrice(refPrevAdj)}` : (ins?.avgDailyVol ? `50D Vol ${formatCompact(ins.avgDailyVol)}` : 'Exchange volume'),
          },
        ];
      } else if (kind === 'recent_ipo') {
        if (this.el.insValTitle) this.el.insValTitle.textContent = 'Live Public IPO Valuation & Market Analytics';
        this.el.insValSub.textContent = `${cur?.ipoStatus || ins.exchange} · Recalculated tick-by-tick at live Hyperliquid price $${formatPrice(livePrice)}`;
        const dispShares = val.adjImpliedShares ?? ins?.impliedShares;
        const liveMcap = val.liveMarketCap || ins?.refMarketCap || null;
        const liveArrMultiple = liveMcap && cur?.arrUsd > 0 ? liveMcap / cur.arrUsd : null;
        const vsIpoPct = cur?.ipoPrice > 0 && livePrice > 0 ? ((livePrice - cur.ipoPrice) / cur.ipoPrice) * 100 : null;
        const refPrevAdj = ins?.refPrice ? ins.refPrice / sf : null;
        tiles = [
          { label: 'Live Market Cap', num: liveMcap ? fmtDollarBig(liveMcap) : (cur?.refValuation || '—'), sub: dispShares ? `${formatCompact(dispShares)} shares (basic)` : 'Live implied cap', live: true, cls: 'accent' },
          liveArrMultiple != null
            ? { label: 'Live Val / ARR', num: `${liveArrMultiple.toFixed(1)}x`, sub: `vs $${formatCompact(cur.arrUsd)} Oct ARR`, live: true }
            : { label: 'IPO Listing', num: cur?.ipoDate || '2026 IPO', sub: cur?.nasdaqTicker ? `NASDAQ: ${cur.nasdaqTicker}` : ins.exchange, cls: 'sm-text' },
          vsIpoPct != null
            ? { label: `vs $${cur.ipoPrice.toFixed(0)} IPO Price`, num: fmtRet(vsIpoPct), sub: cur?.ipoRaised ? `Raised ${cur.ipoRaised} · ${cur.ipoDate}` : cur?.ipoDate, live: true, cls: retCls(vsIpoPct) }
            : { label: 'Listing Status', num: cur?.ipoStatus || ins.exchange, sub: 'Public Nasdaq equity', cls: 'sm-text' },
          { label: 'Est. Revenue / ARR', num: cur?.estRevenue || '—', sub: cur?.rev9m2026 ? `9M '26 Rev $${formatCompact(cur.rev9m2026)}` : 'Disclosed in S-1', cls: 'sm-text' },
          { label: 'US Share Volume', num: ins?.shareVolume ? formatCompact(ins.shareVolume) : '—', sub: refPrevAdj ? `Prev Close $${formatPrice(refPrevAdj)}` : 'Nasdaq spot vol' },
          { label: '7D HL Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          {
            label: hl?.ret30d != null ? '30D HL Return' : `${hl?.periodDays || 0}D HL Return`,
            num: fmtRet(hl?.ret30d ?? hl?.retInception),
            sub: hl?.ret30d != null ? 'Rolling 30-day move' : `Since launch (${hl?.periodDays || 0}D)`,
            live: true,
            cls: retCls(hl?.ret30d ?? hl?.retInception),
          },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: '24h HL Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: hl?.avgDailyHlUsdVol ? `Avg $${formatCompact(hl.avgDailyHlUsdVol)}/d` : 'On-chain liquidity', live: true },
          { label: 'Open Interest', num: m ? `$${formatCompact(m.openInterestUsd)}` : '—', sub: m ? `Max ${m.maxLeverage}x lev` : 'Active perp OI', live: true },
          { label: 'Leadership', num: cur?.ceo || '—', sub: cur?.founded ? `Founded ${cur.founded}` : cur?.country || '', cls: 'sm-text' },
          { label: 'Funding APR', num: m ? `${(m.funding * 24 * 365 * 100) >= 0 ? '+' : ''}${(m.funding * 24 * 365 * 100).toFixed(1)}%` : '—', sub: 'Annualized HL carry', cls: m ? (m.funding >= 0 ? 'up' : 'down') : '' },
        ];
      } else if (kind === 'valuation_perp') {
        const liveValUsd = livePrice > 0 ? livePrice * 1e9 : null;
        const liveArrMultiple = liveValUsd && cur?.arrUsd > 0 ? liveValUsd / cur.arrUsd : null;
        if (this.el.insValTitle) this.el.insValTitle.textContent = 'Live Implied Valuation Perp & Market Analytics';
        this.el.insValSub.textContent = `Quoted in $ Billions (${liveValUsd ? fmtDollarBig(liveValUsd) : '—'} implied valuation) · Public listing: ${cur?.ipoStatus || ins.exchange}`;
        tiles = [
          { label: 'Live Implied Valuation', num: liveValUsd ? fmtDollarBig(liveValUsd) : '—', sub: `$${formatPrice(livePrice)}B on Hyperliquid`, live: true, cls: 'accent' },
          liveArrMultiple != null
            ? { label: 'Live Val / ARR', num: `${liveArrMultiple.toFixed(1)}x`, sub: `vs $${formatCompact(cur.arrUsd)} Oct ARR`, live: true }
            : { label: 'Public Market Cap', num: ins?.refMarketCap ? fmtDollarBig(ins.refMarketCap) : (cur?.refValuation || '—'), sub: cur?.nasdaqTicker ? `NASDAQ: ${cur.nasdaqTicker}` : 'Reference cap', cls: 'sm-text' },
          { label: 'Est. Revenue / ARR', num: cur?.estRevenue || '—', sub: cur?.rev9m2026 ? `9M '26 Rev $${formatCompact(cur.rev9m2026)}` : 'Disclosed run-rate', cls: 'sm-text' },
          { label: 'Public Listing', num: cur?.ipoStatus || ins.exchange, sub: cur?.ipoPrice ? `IPO $${cur.ipoPrice.toFixed(0)} · ${cur.ipoRaised || ''}` : 'Nasdaq listed', cls: 'sm-text' },
          { label: '7D HL Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          {
            label: hl?.ret30d != null ? '30D HL Return' : `${hl?.periodDays || 0}D HL Return`,
            num: fmtRet(hl?.ret30d ?? hl?.retInception),
            sub: hl?.ret30d != null ? 'Rolling 30-day move' : `Since launch (${hl?.periodDays || 0}D)`,
            live: true,
            cls: retCls(hl?.ret30d ?? hl?.retInception),
          },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: '24h HL Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: hl?.avgDailyHlUsdVol ? `Avg $${formatCompact(hl.avgDailyHlUsdVol)}/d` : 'On-chain liquidity', live: true },
          { label: 'Open Interest', num: m ? `$${formatCompact(m.openInterestUsd)}` : '—', sub: m ? `Max ${m.maxLeverage}x lev` : 'Active perp OI', live: true },
          { label: 'Leadership', num: cur?.ceo || '—', sub: cur?.founded ? `Founded ${cur.founded}` : '', cls: 'sm-text' },
          { label: 'Headquarters', num: cur?.country || 'United States', sub: cur?.sector || '', cls: 'sm-text' },
          { label: 'Funding APR', num: m ? `${(m.funding * 24 * 365 * 100) >= 0 ? '+' : ''}${(m.funding * 24 * 365 * 100).toFixed(1)}%` : '—', sub: 'Annualized HL carry', cls: m ? (m.funding >= 0 ? 'up' : 'down') : '' },
        ];
      } else if (kind === 'preipo') {
        const isValQuoted = Boolean(ins?.isValuationPerp && livePrice > 50);
        const liveValUsd = isValQuoted ? livePrice * 1e9 : null;
        if (this.el.insValTitle) this.el.insValTitle.textContent = 'Pre-IPO Private Valuation & Live Market Analytics';
        this.el.insValSub.textContent = isValQuoted
          ? `Pre-IPO valuation perpetual ($${formatPrice(livePrice)}B = ${fmtDollarBig(liveValUsd)} live implied valuation)`
          : `Pre-IPO private equity perpetual · Live Hyperliquid price $${formatPrice(livePrice)}`;
        tiles = [
          isValQuoted
            ? { label: 'Live Implied Valuation', num: fmtDollarBig(liveValUsd), sub: `Last private: ${cur?.refValuation || 'Private'}`, live: true, cls: 'accent' }
            : { label: 'Private Benchmark', num: cur?.refValuation || 'Private', sub: 'Latest private mark', live: true, cls: 'accent sm-text' },
          { label: 'Est. Revenue Scale', num: cur?.estRevenue || 'Private', sub: 'Reported run-rate', live: true, cls: 'sm-text' },
          { label: 'IPO Outlook', num: cur?.ipoStatus || 'Private', sub: 'Listing status', cls: 'sm-text' },
          { label: '7D HL Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          {
            label: hl?.ret30d != null ? '30D HL Return' : `${hl?.periodDays || 0}D HL Return`,
            num: fmtRet(hl?.ret30d ?? hl?.retInception),
            sub: hl?.ret30d != null ? 'Live 30-day move' : `Since launch (${hl?.periodDays || 0}D)`,
            live: true,
            cls: retCls(hl?.ret30d ?? hl?.retInception),
          },
          { label: '90D / Since Launch', num: fmtRet(hl?.ret90d ?? hl?.retInception), sub: hl ? `${hl.periodDays}D HL history` : 'HL performance', live: true, cls: retCls(hl?.ret90d ?? hl?.retInception) },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: '24h HL Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: hl?.avgDailyHlUsdVol ? `Avg $${formatCompact(hl.avgDailyHlUsdVol)}/d` : 'On-chain liquidity', live: true },
          { label: 'Open Interest', num: m ? `$${formatCompact(m.openInterestUsd)}` : '—', sub: m ? `Max ${m.maxLeverage}x lev` : 'Active perp OI', live: true },
          { label: 'Leadership', num: cur?.ceo || cur?.country || '—', sub: cur?.founded ? `Founded ${cur.founded}` : 'Private company', cls: 'sm-text' },
          { label: 'Headquarters', num: cur?.country || 'Global', sub: cur?.sector || 'Pre-IPO', cls: 'sm-text' },
          { label: 'Funding APR', num: m ? `${(m.funding * 24 * 365 * 100) >= 0 ? '+' : ''}${(m.funding * 24 * 365 * 100).toFixed(1)}%` : '—', sub: 'Annualized HL carry', cls: m ? (m.funding >= 0 ? 'up' : 'down') : '' },
        ];
      } else if (kind === 'etf' || kind === 'index') {
        const proxyTag = etf?.proxySymbol ? ` (Proxy: ${etf.proxySymbol})` : '';
        if (this.el.insValTitle) this.el.insValTitle.textContent = kind === 'index' ? `Index Analytics & Benchmark Metrics${proxyTag}` : 'Live ETF Analytics & Fund Metrics';
        this.el.insValSub.textContent = `Live Hyperliquid price $${formatPrice(livePrice)}${proxyTag ? ` · Benchmark metrics via ${etf.proxySymbol}` : ''}`;
        tiles = [
          { label: kind === 'index' ? `${etf?.proxySymbol || 'ETF'} Proxy AUM` : 'Live Fund Cap', num: fmtDollarBig(val.liveMarketCap), sub: kind === 'index' ? 'Benchmark ETF scale' : 'Live NAV × shares', live: true, cls: 'accent' },
          { label: 'Expense Ratio', num: etf?.expenseRatio || '—', sub: 'Annual fund fee' },
          { label: 'Beta (vs S&P)', num: Number.isFinite(ins?.beta) ? ins.beta.toFixed(2) : '—', sub: etf?.stdDev ? `Std Dev ${etf.stdDev}` : 'Market sensitivity' },
          { label: 'Weighted Alpha', num: Number.isFinite(etf?.weightedAlpha) ? `${etf.weightedAlpha >= 0 ? '+' : ''}${etf.weightedAlpha.toFixed(2)}` : '—', sub: '1Y trend momentum', cls: retCls(etf?.weightedAlpha) },
          { label: '7D HL Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          { label: '30D HL Return', num: fmtRet(hl?.ret30d), sub: 'Live 30-day move', live: true, cls: retCls(hl?.ret30d) },
          { label: '90D HL Return', num: fmtRet(hl?.ret90d ?? hl?.retInception), sub: hl ? `${hl.periodDays}D HL history` : 'Trend return', live: true, cls: retCls(hl?.ret90d ?? hl?.retInception) },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: '20D Avg Equity Vol', num: etf?.avgVol20d ? formatCompact(etf.avgVol20d) : (ins?.avgDailyVol ? formatCompact(ins.avgDailyVol) : '—'), sub: etf?.avgVol65d ? `65D ${formatCompact(etf.avgVol65d)}` : 'Spot ETF liquidity' },
          { label: '24h HL Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: `DEX: ${dex}`, live: true },
          { label: 'Open Interest', num: m ? `$${formatCompact(m.openInterestUsd)}` : '—', sub: m ? `Max ${m.maxLeverage}x lev` : 'Active perp OI', live: true },
          { label: 'Funding APR', num: m ? `${(m.funding * 24 * 365 * 100) >= 0 ? '+' : ''}${(m.funding * 24 * 365 * 100).toFixed(1)}%` : '—', sub: 'Annualized HL carry', cls: m ? (m.funding >= 0 ? 'up' : 'down') : '' },
        ];
      } else if (kind === 'crypto' || m?.isSpot) {
        if (this.el.insValTitle) this.el.insValTitle.textContent = 'Live Crypto Spot Analytics & Momentum';
        this.el.insValSub.textContent = `${ins.exchange} · Live 24/7 spot price $${formatPrice(livePrice)}`;
        tiles = [
          { label: 'Spot Market', num: ins.exchange || 'Crypto Spot', sub: m?.dexLabel || '24/7 Spot Feed', live: true, cls: 'accent sm-text' },
          { label: '24h Return', num: m ? fmtRet(m.change24hPct) : '—', sub: m ? `Prev $${formatPrice(m.prevDayPx)}` : 'Rolling 24h', live: true, cls: retCls(m?.change24hPct) },
          { label: '7D Live Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          { label: '30D Live Return', num: fmtRet(hl?.ret30d), sub: 'Rolling 30-day move', live: true, cls: retCls(hl?.ret30d) },
          { label: '90D / Period Ret', num: fmtRet(hl?.ret90d ?? hl?.retInception), sub: hl ? `${hl.periodDays}D history` : 'Spot trend', live: true, cls: retCls(hl?.ret90d ?? hl?.retInception) },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: 'Period High', num: val.rangeHigh ? `$${formatPrice(val.rangeHigh)}` : '—', sub: Number.isFinite(val.pctFrom52High) ? `${val.pctFrom52High.toFixed(1)}% from high` : 'Range peak', live: true },
          { label: 'Period Low', num: val.rangeLow ? `$${formatPrice(val.rangeLow)}` : '—', sub: ins.rangeSource || 'Spot range', live: true },
          { label: '24h Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: hl?.avgDailyHlUsdVol ? `Avg $${formatCompact(hl.avgDailyHlUsdVol)}/d` : '24h turnover', live: true },
          { label: 'Settlement', num: 'Spot (1x)', sub: 'No funding fee', cls: 'sm-text' },
          { label: 'Asset Class', num: ins.sector || 'Digital Assets', sub: ins.industry || 'Layer 1 Crypto', cls: 'sm-text' },
          { label: 'Trading Hours', num: '24 / 7', sub: 'Continuous global spot', cls: 'sm-text' },
        ];
      } else {
        // Global Non-US Equity (SKHX, SMSN, TCNT, XIAOMI, etc.) or Macro / Commodity / FX / Perp
        if (this.el.insValTitle) {
          this.el.insValTitle.textContent = kind === 'intl_stock'
            ? 'Global Equity Profile & Live Hyperliquid Analytics'
            : 'Live Market Analytics & Momentum';
        }
        this.el.insValSub.textContent = `${ins.exchange} · Live Hyperliquid price $${formatPrice(livePrice)}`;
        tiles = [
          { label: kind === 'intl_stock' ? 'Home Listing' : 'Market Class', num: ins.exchange, sub: ins.country || 'Global', live: true, cls: 'accent sm-text' },
          { label: '7D HL Return', num: fmtRet(hl?.ret7d), sub: 'Live 7-day move', live: true, cls: retCls(hl?.ret7d) },
          { label: '30D HL Return', num: fmtRet(hl?.ret30d), sub: 'Live 30-day move', live: true, cls: retCls(hl?.ret30d) },
          { label: '90D / Period Ret', num: fmtRet(hl?.ret90d ?? hl?.retInception), sub: hl ? `${hl.periodDays}D HL history` : 'HL trend', live: true, cls: retCls(hl?.ret90d ?? hl?.retInception) },
          { label: '30D Volatility', num: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', sub: 'Annualized realized' },
          { label: 'Period High', num: val.rangeHigh ? `$${formatPrice(val.rangeHigh)}` : '—', sub: Number.isFinite(val.pctFrom52High) ? `${val.pctFrom52High.toFixed(1)}% from high` : 'HL peak', live: true },
          { label: 'Period Low', num: val.rangeLow ? `$${formatPrice(val.rangeLow)}` : '—', sub: ins.rangeSource || 'HL range', live: true },
          { label: '24h HL Volume', num: m ? `$${formatCompact(m.dayNtlVlm)}` : '—', sub: hl?.avgDailyHlUsdVol ? `Avg $${formatCompact(hl.avgDailyHlUsdVol)}/d` : `DEX: ${dex}`, live: true },
          { label: 'Open Interest', num: m ? `$${formatCompact(m.openInterestUsd)}` : '—', sub: m ? `Max ${m.maxLeverage}x lev` : 'Perp OI', live: true },
          { label: 'Funding APR', num: m ? `${(m.funding * 24 * 365 * 100) >= 0 ? '+' : ''}${(m.funding * 24 * 365 * 100).toFixed(1)}%` : '—', sub: 'Annualized HL carry', cls: m ? (m.funding >= 0 ? 'up' : 'down') : '' },
          { label: 'Market Role', num: cur?.refValuation || ins.sector || 'Perpetual', sub: ins.industry || 'HIP-3 market', cls: 'sm-text' },
          { label: 'Reporting Cadence', num: ins.earningsReports?.defaultCadence || '—', sub: ins.country || 'Global', cls: 'sm-text' },
        ];
      }

      this.el.insValuationGrid.innerHTML = tiles
        .map((t) => `
          <div class="val-tile ${t.live ? 'live-highlight' : ''}">
            <span class="val-label">${t.label}</span>
            <span class="val-num ${t.cls || ''}">${t.num}</span>
            <span class="val-sub">${t.sub}</span>
          </div>
        `)
        .join('');

      // 52-Week / Live HL Period Range Slider
      if (val.rangeLow && val.rangeHigh && Number.isFinite(val.range52PosPct)) {
        const rngLbl = ins?.rangeSource === '52W' ? '52-Week' : `${ins?.rangeSource || 'Period'}`;
        if (this.el.ins52LowLabel) this.el.ins52LowLabel.textContent = `${rngLbl} Low`;
        if (this.el.ins52HighLabel) this.el.ins52HighLabel.textContent = `${rngLbl} High`;
        this.el.insRange52Wrap.classList.remove('hidden');
        this.el.ins52Low.textContent = `$${formatPrice(val.rangeLow)}`;
        this.el.ins52High.textContent = `$${formatPrice(val.rangeHigh)}`;
        const fromHi = val.pctFrom52High;
        const fromHiStr = fromHi >= 0 ? `+${fromHi.toFixed(1)}% above ${rngLbl} High` : `${fromHi.toFixed(1)}% from ${rngLbl} High`;
        this.el.ins52Status.textContent = `${val.range52PosPct.toFixed(0)}th percentile · ${fromHiStr}`;
        this.el.ins52Fill.style.width = `${val.range52PosPct.toFixed(1)}%`;
        this.el.ins52Pin.style.left = `${val.range52PosPct.toFixed(1)}%`;
      } else {
        this.el.insRange52Wrap.classList.add('hidden');
      }

      // 3. Wall Street Consensus OR Business Drivers & Catalysts (for Pre-IPO / ETF / Index / Global / Macro)
      const an = ins?.analyst;
      const totalAnalysts = (an?.buy || 0) + (an?.hold || 0) + (an?.sell || 0);
      const hasWallSt = Boolean(an && (an.rating || an.meanTarget || totalAnalysts > 0));

      if (!ins) {
        if (this.el.insAnalystTitle) this.el.insAnalystTitle.textContent = 'Wall Street Consensus & Live Target Upside';
        this.el.insAnalystCount.textContent = '—';
        this.el.insAnalystBody.innerHTML = '<div class="empty-state">Loading analyst consensus...</div>';
      } else if (hasWallSt) {
        if (this.el.insAnalystTitle) this.el.insAnalystTitle.textContent = 'Wall Street Consensus & Live Target Upside';
        this.el.insAnalystCount.textContent = totalAnalysts > 0 ? `${totalAnalysts} Wall Street Analysts` : 'Consensus Target';

        const rText = an.rating || 'Neutral';
        const rLower = rText.toLowerCase();
        const badgeCls = rLower.includes('buy') || rLower.includes('outperform') ? 'buy' : (rLower.includes('sell') || rLower.includes('under') ? 'sell' : 'hold');
        const upPct = val.targetUpsidePct;
        const upCls = Number.isFinite(upPct) ? (upPct >= 0 ? 'pct-up' : 'pct-down') : '';
        const upStr = Number.isFinite(upPct) ? `${upPct >= 0 ? '+' : ''}${upPct.toFixed(1)}%` : '—';

        const buyPct = totalAnalysts > 0 ? ((an.buy || 0) / totalAnalysts) * 100 : 0;
        const holdPct = totalAnalysts > 0 ? ((an.hold || 0) / totalAnalysts) * 100 : 0;
        const sellPct = totalAnalysts > 0 ? ((an.sell || 0) / totalAnalysts) * 100 : 0;

        let targetHtml = '';
        const lowT = val.adjLowTarget ?? an.lowTarget;
        const meanT = val.adjMeanTarget ?? an.meanTarget;
        const highT = val.adjHighTarget ?? an.highTarget;
        if (lowT && highT && highT > lowT) {
          const minT = Math.min(lowT, livePrice || lowT);
          const maxT = Math.max(highT, livePrice || highT);
          const span = Math.max(1e-6, maxT - minT);
          const meanPos = meanT ? Math.max(0, Math.min(100, ((meanT - minT) / span) * 100)) : 50;
          const livePos = livePrice > 0 ? Math.max(0, Math.min(100, ((livePrice - minT) / span) * 100)) : 50;
          targetHtml = `
            <div class="target-block">
              <div class="target-labels">
                <span>Low <strong>$${formatPrice(lowT)}</strong></span>
                <span>Mean Target <strong>$${meanT ? formatPrice(meanT) : '—'}</strong></span>
                <span>High <strong>$${formatPrice(highT)}</strong></span>
              </div>
              <div class="target-track">
                <div class="target-mean-tick" style="left:${meanPos.toFixed(1)}%" title="Consensus Mean Target"></div>
                <div class="target-live-pin" style="left:${livePos.toFixed(1)}%" title="Live Hyperliquid Price: $${formatPrice(livePrice)}"></div>
              </div>
              <div class="target-labels" style="font-size:10px">
                <span style="color:var(--cyan)">● Live HL: $${formatPrice(livePrice)}</span>
                <span>│ White tick = Mean Target${val.splitLabel ? ` (${val.splitLabel} Adj)` : ''}</span>
              </div>
            </div>
          `;
        } else if (meanT) {
          targetHtml = `
            <div class="target-block">
              <div class="target-labels">
                <span>1Y Target <strong>$${formatPrice(meanT)}</strong></span>
                <span style="color:var(--cyan)">Live HL: $${formatPrice(livePrice)}</span>
              </div>
            </div>
          `;
        }

        const countsHtml = totalAnalysts > 0 ? `
          <div class="consensus-bar">
            <div class="cb-buy" style="width:${buyPct.toFixed(1)}%"></div>
            <div class="cb-hold" style="width:${holdPct.toFixed(1)}%"></div>
            <div class="cb-sell" style="width:${sellPct.toFixed(1)}%"></div>
          </div>
          <div class="consensus-counts">
            <span class="pct-up">Buy: <strong>${an.buy || 0}</strong> (${buyPct.toFixed(0)}%)</span>
            <span style="color:var(--amber)">Hold: <strong>${an.hold || 0}</strong> (${holdPct.toFixed(0)}%)</span>
            <span class="pct-down">Sell: <strong>${an.sell || 0}</strong> (${sellPct.toFixed(0)}%)</span>
          </div>
        ` : '';

        this.el.insAnalystBody.innerHTML = `
          <div class="analyst-top">
            <span class="consensus-badge ${badgeCls}">${esc(rText)}</span>
            <div class="upside-kpi">
              <div class="upside-big ${upCls}">${upStr}</div>
              <div class="upside-sub">Implied Live Target ${Number.isFinite(upPct) && upPct < 0 ? 'Downside' : 'Upside'}</div>
            </div>
          </div>
          ${countsHtml}
          ${targetHtml}
        `;
      } else if (cur?.keyDrivers && cur.keyDrivers.length > 0) {
        if (this.el.insAnalystTitle) this.el.insAnalystTitle.textContent = 'Key Business Drivers & Catalysts';
        this.el.insAnalystCount.textContent = cur.ipoStatus || cur.exchange || ins.sector || '';
        this.el.insAnalystBody.innerHTML = `
          <div class="driver-list">
            ${cur.keyDrivers.map((d) => `<div class="driver-item"><span class="driver-dot"></span><span>${esc(d)}</span></div>`).join('')}
          </div>
        `;
      } else {
        if (this.el.insAnalystTitle) this.el.insAnalystTitle.textContent = 'Multi-Horizon Live Performance';
        this.el.insAnalystCount.textContent = hl ? `${hl.periodDays}D Hyperliquid History` : 'Live Feed';
        const perfRows = [
          { lbl: '24-Hour Return', val: m ? fmtRet(m.change24hPct) : '—', cls: retCls(m?.change24hPct) },
          { lbl: '7-Day Return', val: fmtRet(hl?.ret7d), cls: retCls(hl?.ret7d) },
          { lbl: '30-Day Return', val: fmtRet(hl?.ret30d), cls: retCls(hl?.ret30d) },
          { lbl: '90-Day / Period Return', val: fmtRet(hl?.ret90d ?? hl?.retInception), cls: retCls(hl?.ret90d ?? hl?.retInception) },
          { lbl: '30-Day Realized Volatility', val: hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}% ann.` : '—', cls: '' },
        ];
        this.el.insAnalystBody.innerHTML = `
          <div class="driver-list">
            ${perfRows.map((pr) => `<div class="driver-item" style="justify-content:space-between"><span>${pr.lbl}</span><strong class="${pr.cls}" style="font-family:var(--font-mono)">${pr.val}</strong></div>`).join('')}
          </div>
        `;
      }

      // 4. Quarterly EPS Actual vs Consensus Chart (or 90-Day Live Price Trend if no EPS!)
      this._renderEpsChart(ins, sf, val.splitLabel);

      // 5. Financial Health Margins Strip & 4-Year Income Statement Table (hide empty shell for Pre-IPO / ETF / Index / Macro)
      const f = ins?.financials;
      const hasMargins = Boolean(f && (f.grossMargin != null || f.operatingMargin != null || f.profitMargin != null || f.totalCash != null));
      const hasIncomeTbl = Boolean(f && Array.isArray(f.periods) && f.periods.length > 0 && (f.revenue || f.netIncome));
      if (this.el.insFinSection) {
        const showFinCard = !ins || kind === 'stock' || hasMargins || hasIncomeTbl;
        this.el.insFinSection.classList.toggle('hidden', !showFinCard);
      }

      if (hasMargins) {
        const marginItems = [
          { k: 'Gross Margin', v: fmtNum(f.grossMargin, '%', 1) },
          { k: 'Operating Margin', v: fmtNum(f.operatingMargin, '%', 1) },
          { k: 'Net Profit Margin', v: fmtNum(f.profitMargin, '%', 1) },
          { k: 'Return on Equity', v: fmtNum(f.roe, '%', 1) },
          { k: 'Rev Growth YoY', v: f.revGrowthYoY != null ? `${f.revGrowthYoY >= 0 ? '+' : ''}${f.revGrowthYoY.toFixed(1)}%` : '—' },
          { k: 'Cash & ST Inv', v: fmtDollarBig(f.totalCash) },
          { k: 'Total Debt', v: fmtDollarBig(f.totalDebt) },
          { k: 'Free Cash Flow', v: fmtDollarBig(f.freeCashFlow) },
        ];
        this.el.insMarginsStrip.innerHTML = marginItems
          .map((it) => `<div class="margin-pill"><span>${it.k}</span><strong>${it.v}</strong></div>`)
          .join('');
      } else {
        this.el.insMarginsStrip.innerHTML = '';
      }

      if (hasIncomeTbl) {
        const cols = f.periods.slice(0, 4);
        this.el.insFinHead.innerHTML = `<tr><th>Annual Metric (USD)</th>${cols.map((p) => `<th class="num">${esc(p)}</th>`).join('')}</tr>`;
        const rows = [
          { name: 'Total Revenue', arr: f.revenue },
          { name: 'Gross Profit', arr: f.grossProfit },
          { name: 'R&D Expense', arr: f.rd },
          { name: 'Operating Income (EBIT)', arr: f.operatingIncome },
          { name: 'Net Income', arr: f.netIncome },
        ].filter((r) => Array.isArray(r.arr));

        this.el.insFinBody.innerHTML = rows
          .map((r) => `
            <tr>
              <td><strong>${r.name}</strong></td>
              ${cols.map((_, idx) => `<td class="num">${fmtDollarBig(r.arr[idx])}</td>`).join('')}
            </tr>
          `)
          .join('');
      } else {
        this.el.insFinHead.innerHTML = '';
        this.el.insFinBody.innerHTML = `<tr><td class="empty-state">${ins ? 'Annual financial statements not filed via US SEC for this ticker.' : 'Loading 4-year financial statements...'}</td></tr>`;
      }

      // 6. Hyperliquid Market Microstructure (Spot vs Perp)
      if (m) {
        let microTiles;
        if (m.isSpot) {
          microTiles = [
            { label: 'Live Spot Price', num: `$${formatPrice(m.price)}`, sub: m.dexLabel || 'Spot feed' },
            { label: '24h Reference Close', num: `$${formatPrice(m.prevDayPx)}`, sub: 'Rolling 24h open' },
            { label: '24h Change ($)', num: `${m.change24h >= 0 ? '+' : '-'}$${formatPrice(Math.abs(m.change24h))}`, sub: `${m.change24hPct >= 0 ? '+' : ''}${m.change24hPct.toFixed(2)}% (24h)`, cls: m.change24h >= 0 ? 'up' : 'down' },
            { label: '24h Volume', num: `$${formatCompact(m.dayNtlVlm)}`, sub: 'Spot turnover' },
            { label: 'Market Type', num: 'Spot', sub: 'Direct spot pricing' },
            { label: 'Funding Rate', num: 'None (0%)', sub: 'No perp carry cost' },
            { label: 'Leverage', num: '1x Spot', sub: 'Unleveraged spot' },
            { label: 'Feed Source', num: m.useOracleAsSpot ? 'Spot Index' : 'HL Spot', sub: m.useOracleAsSpot ? 'Hyperliquid oracle' : 'Native USDC book' },
          ];
        } else {
          const basisPct = m.oraclePx > 0 ? ((m.markPx - m.oraclePx) / m.oraclePx) * 100 : 0;
          const fund1h = m.funding * 100;
          const fundApr = m.funding * 24 * 365 * 100;
          microTiles = [
            { label: 'Oracle Price', num: `$${formatPrice(m.oraclePx)}`, sub: 'Spot reference feed' },
            { label: 'Mark Price', num: `$${formatPrice(m.markPx)}`, sub: 'Hyperliquid mark' },
            { label: 'Mark / Oracle Basis', num: `${basisPct >= 0 ? '+' : ''}${basisPct.toFixed(3)}%`, sub: 'Perp premium', cls: basisPct >= 0 ? 'up' : 'down' },
            { label: '1h Funding Rate', num: `${fund1h >= 0 ? '+' : ''}${fund1h.toFixed(4)}%`, sub: 'Hourly settlement', cls: fund1h >= 0 ? 'up' : 'down' },
            { label: 'Annualized Funding', num: `${fundApr >= 0 ? '+' : ''}${fundApr.toFixed(1)}%`, sub: 'Implied funding APR', cls: fundApr >= 0 ? 'up' : 'down' },
            { label: '24h HL Volume', num: `$${formatCompact(m.dayNtlVlm)}`, sub: `DEX: ${m.dex}` },
            { label: 'Open Interest', num: `$${formatCompact(m.openInterestUsd)}`, sub: 'Active perp notional' },
            { label: 'Max Leverage', num: `${m.maxLeverage}x`, sub: 'HIP-3 margin cap' },
          ];
        }
        this.el.insHlMicroGrid.innerHTML = microTiles
          .map((t) => `
            <div class="val-tile">
              <span class="val-label">${t.label}</span>
              <span class="val-num ${t.cls || ''}">${t.num}</span>
              <span class="val-sub">${t.sub}</span>
            </div>
          `)
          .join('');
      } else {
        this.el.insHlMicroGrid.innerHTML = '';
      }

      // 7. Company Profile
      this.el.insRegionTag.textContent = ins?.country || ins?.region || ins?.exchange || '—';
      if (!ins) {
        this.el.insDescription.textContent = 'Loading company profile...';
        this.el.insProfileMeta.innerHTML = '';
      } else {
        this.el.insDescription.textContent = ins.description || `${ins.companyName || ticker} trades as a perpetual contract on Hyperliquid HIP-3 (${dex}).`;
        const metaParts = [];
        if (ins.country) metaParts.push(`<span>Country: <strong>${esc(ins.country)}</strong></span>`);
        if (ins.sector) metaParts.push(`<span>Sector: <strong>${esc(ins.sector)}</strong></span>`);
        if (ins.industry) metaParts.push(`<span>Industry: <strong>${esc(ins.industry)}</strong></span>`);
        if (ins.exDividendDate && ins.exDividendDate !== 'N/A') metaParts.push(`<span>Ex-Div: <strong>${esc(ins.exDividendDate)}</strong></span>`);
        if (ins.website) {
          const href = safeHttpUrl(ins.website);
          if (href) metaParts.push(`<a class="ins-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(ins.website.replace(/^https?:\/\//, ''))} ↗</a>`);
        }
        this.el.insProfileMeta.innerHTML = metaParts.join('');
      }

      // 8. Sync Earnings Reports sub-tab (avoid rewriting links on pure price-tick flashes)
      if (!flashDir) {
        this._renderEarningsReports(ins);
      }
    }

    setInsightsSubTab(tab) {
      this.insightsSubTab = tab === 'earnings' ? 'earnings' : 'overview';
      this.el.insSubTabs?.querySelectorAll('.ins-subtab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.instab === this.insightsSubTab);
      });
      this.el.insOverviewPane?.classList.toggle('hidden', this.insightsSubTab !== 'overview');
      this.el.insEarningsPane?.classList.toggle('hidden', this.insightsSubTab !== 'earnings');
      if (this.insightsSubTab === 'earnings') {
        this._renderEarningsReports(this.activeInsights);
      } else if (this.activeInsights) {
        setTimeout(() => this._renderEpsChart(this.activeInsights), 20);
      }
    }

    _renderEarningsReports(ins) {
      const er = ins?.earningsReports;
      const defaultCadence = er?.defaultCadence || '4Q';
      const activeCadence = this.earningsCadenceOverride || defaultCadence;

      if (this.el.insCadencePill) {
        this.el.insCadencePill.textContent = defaultCadence;
      }

      this.el.erCadenceToggle?.querySelectorAll('.seg-btn[data-cadence]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.cadence === activeCadence);
      });

      const esc = (s) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const fmtDollarBig = (v) => {
        if (!Number.isFinite(v)) return '—';
        const neg = v < 0 ? '-' : '';
        return `${neg}$${formatCompact(Math.abs(v))}`;
      };
      const fmtPct = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)}%` : '—');

      if (!ins || !er) {
        this.el.erHeaderTitle.textContent = 'Recent Earnings Reports';
        this.el.erCountryNote.textContent = 'Loading earnings reports & regulatory filings...';
        this.el.erKpiStrip.innerHTML = '';
        this.el.erCardsGrid.innerHTML = '<div class="pf-card empty-state" style="grid-column:1/-1">Fetching recent earnings reports...</div>';
        this.el.erFinHead.innerHTML = '';
        this.el.erFinBody.innerHTML = '';
        this.el.erFilingsList.innerHTML = '<div class="empty-state">Loading filings...</div>';
        return;
      }

      const mLive = this.markets.get(this.prefs.activeSymbol);
      const splitInfo = mLive && ins?.refPrice && !ins?.isIndexProxy
        ? detectSplitFactor(ins.refPrice, mLive.price)
        : { factor: 1, label: null };
      const sfEr = splitInfo.factor || 1;

      const is2H = activeCadence === '2H';
      const reports = is2H ? (er.semiAnnual || []) : (er.quarterly || []);
      const countryLabel = er.country || ins.region || 'International';
      const autoNote = defaultCadence === '2H'
        ? `Auto-detected Semi-Annual (2H) cadence for ${countryLabel}`
        : `Auto-detected Quarterly (4Q) cadence for ${countryLabel}`;

      this.el.erHeaderTitle.textContent = is2H
        ? `${ins.ticker} · Last 2 Half-Year (2H) Earnings Reports`
        : `${ins.ticker} · Last 4 Quarterly (4Q) Earnings Reports`;
      this.el.erCountryNote.textContent = `${autoNote}${this.earningsCadenceOverride ? ` · Viewing ${activeCadence}` : ''}${splitInfo.label ? ` · EPS normalized for ${splitInfo.label}` : ''}`;

      // Summary KPIs across visible window
      const withSurp = reports.filter((r) => Number.isFinite(r.surprisePct));
      const beats = withSurp.filter((r) => r.surprisePct > 0.01).length;
      const avgSurp = withSurp.length > 0
        ? withSurp.reduce((s, r) => s + r.surprisePct, 0) / withSurp.length
        : null;
      const finSourceCols = is2H ? reports : (er.finQCols && er.finQCols.length > 0 ? er.finQCols : reports);
      const revSum = finSourceCols.filter((r) => Number.isFinite(r.revenue)).reduce((s, r) => s + r.revenue, 0);
      const latestRevRow = finSourceCols.find((r) => Number.isFinite(r.revenue));
      const latestNetRow = finSourceCols.find((r) => Number.isFinite(r.netMargin));

      const kpis = [
        { k: 'Country / Cadence', v: `${countryLabel} (${defaultCadence})` },
        { k: 'EPS Beat Record', v: withSurp.length > 0 ? `${beats} / ${withSurp.length} Beats` : '—' },
        { k: 'Avg EPS Surprise', v: avgSurp != null ? `${avgSurp >= 0 ? '+' : ''}${avgSurp.toFixed(1)}%` : '—' },
        { k: is2H ? '2H Combined Rev' : '4Q Combined Rev', v: revSum > 0 ? fmtDollarBig(revSum) : fmtDollarBig(ins.financials?.latestRev) },
        { k: is2H ? 'Latest Half Rev' : 'Latest Qtr Rev', v: latestRevRow ? fmtDollarBig(latestRevRow.revenue) : '—' },
        { k: 'Latest Net Margin', v: latestNetRow ? fmtPct(latestNetRow.netMargin) : fmtPct(ins.financials?.profitMargin) },
      ];
      this.el.erKpiStrip.innerHTML = kpis
        .map((it) => `<div class="margin-pill"><span>${esc(it.k)}</span><strong>${esc(it.v)}</strong></div>`)
        .join('');

      // Hide 4Q/2H toggle when there are no structured quarterly/half-year earnings rows yet
      this.el.erCadenceToggle?.classList.toggle('hidden', reports.length === 0);

      // Period Cards (Last 4Q or Last 2H) — OR Public IPO Prospectus / Pre-IPO Milestones
      const cur = ins.curated;
      if (reports.length === 0 && cur?.milestones && cur.milestones.length > 0) {
        const isPublic = Boolean(cur.isPublicIpo);
        const liveVal = mLive && ins.isValuationPerp && mLive.price > 50
          ? fmtDollarBig(mLive.price * 1e9)
          : (mLive && ins.impliedShares ? fmtDollarBig(mLive.price * ins.impliedShares) : (ins.refMarketCap ? fmtDollarBig(ins.refMarketCap) : (cur.refValuation || '—')));
        const secCount = Array.isArray(er.filings) ? er.filings.length : 0;
        const altKpis = [
          { k: 'Listing / Country', v: `${cur.exchange || countryLabel}` },
          { k: isPublic ? 'Live Market Cap' : 'Valuation Benchmark', v: liveVal },
          { k: 'Revenue / ARR Scale', v: cur.estRevenue || '—' },
          { k: 'IPO Status', v: cur.ipoDate ? `IPO ${cur.ipoDate}` : (cur.ipoStatus || 'Private') },
          { k: '7D HL Return', v: Number.isFinite(ins.hlStats?.ret7d) ? `${ins.hlStats.ret7d >= 0 ? '+' : ''}${ins.hlStats.ret7d.toFixed(2)}%` : '—' },
          { k: 'SEC Filings', v: secCount > 0 ? `${secCount} Official Filings` : (isPublic ? 'Pending' : 'Pre-IPO') },
        ];
        this.el.erKpiStrip.innerHTML = altKpis
          .map((it) => `<div class="margin-pill"><span>${esc(it.k)}</span><strong>${esc(it.v)}</strong></div>`)
          .join('');

        this.el.erHeaderTitle.textContent = isPublic
          ? `${ins.ticker} · IPO Prospectus, S-1 Highlights & Milestones`
          : `${ins.ticker} · Pre-IPO Milestones, Valuation & Catalysts`;
        this.el.erCountryNote.textContent = isPublic
          ? `${cur.companyName} went public on ${cur.ipoDate || 'Nasdaq'} (${cur.exchange}). First post-IPO 10-Q pending, with S-1 revenue highlights and official SEC filings below.`
          : `${cur.companyName} is privately held (${cur.country}). Public 10-Q/10-K SEC earnings are not filed yet.`;
        this.el.erCardsGrid.innerHTML = cur.milestones
          .map((ms, idx) => `
            <article class="er-card ${idx === 0 ? 'latest' : ''}">
              <div class="er-card-top">
                <div class="er-period-title">${esc(ms.period)}</div>
                <span class="er-beat-badge beat">${esc(ms.tag)}</span>
              </div>
              <p class="ins-desc" style="margin-top:2px">${esc(ms.detail)}</p>
            </article>
          `)
          .join('');
      } else if (reports.length === 0) {
        const hl = ins.hlStats;
        const fmtRet = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
        this.el.erCardsGrid.innerHTML = `
          <article class="er-card latest" style="grid-column:1/-1">
            <div class="er-card-top">
              <div>
                <div class="er-period-title">${esc(ins.companyName)} · Reporting Overview</div>
                <div class="er-period-sub">${esc(ins.exchange)} · ${esc(countryLabel)} (${defaultCadence} standard)</div>
              </div>
              <span class="er-beat-badge neutral">${esc(ins.assetKind.toUpperCase())}</span>
            </div>
            <div class="er-metrics-grid">
              <div class="er-metric"><span>7D HL Return</span><strong>${fmtRet(hl?.ret7d)}</strong><small>Live market move</small></div>
              <div class="er-metric"><span>30D HL Return</span><strong>${fmtRet(hl?.ret30d)}</strong><small>Rolling 30 days</small></div>
              <div class="er-metric"><span>30D Volatility</span><strong>${hl?.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—'}</strong><small>Annualized</small></div>
            </div>
            <p class="ins-desc" style="margin-top:4px">${
              ins.assetKind === 'intl_stock'
                ? `${esc(ins.companyName)} files primary ${defaultCadence} financial reports on its home exchange (${esc(ins.exchange)}) rather than US SEC EDGAR.`
                : `${esc(ins.companyName)} does not publish corporate quarterly EPS filings. Live price, range, volatility, and market analytics are tracked above.`
            }</p>
          </article>
        `;
      } else {
        this.el.erCardsGrid.innerHTML = reports
          .map((r, idx) => {
            const surp = r.surprisePct;
            let badgeCls = 'neutral';
            let badgeText = 'REPORTED';
            if (Number.isFinite(surp)) {
              if (surp > 0.05) { badgeCls = 'beat'; badgeText = `BEAT +${surp.toFixed(2)}%`; }
              else if (surp < -0.05) { badgeCls = 'miss'; badgeText = `MISS ${surp.toFixed(2)}%`; }
              else { badgeCls = 'neutral'; badgeText = 'IN-LINE 0.0%'; }
            }
            const title = is2H
              ? `${r.halfTag || (idx === 0 ? 'Latest Half' : 'Prior Half')} · ${r.periodLabel}`
              : `${idx === 0 ? 'Latest Quarter · ' : ''}${r.periodLabel}`;
            const sub = [
              r.dateReported ? `Reported ${r.dateReported}` : null,
              r.periodEnd && r.periodEnd !== r.periodLabel ? `Period End ${r.periodEnd}` : null,
            ].filter(Boolean).join(' · ') || 'Official Financial Period';

            const prev = reports[idx + 1];
            let revSeqNote = 'Period sales';
            if (Number.isFinite(r.revenue) && Number.isFinite(prev?.revenue) && prev.revenue > 0) {
              const chg = ((r.revenue - prev.revenue) / prev.revenue) * 100;
              revSeqNote = `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% vs prior`;
            }

            const isPending10Q =
              r.revenue == null &&
              r.netIncome == null &&
              r.grossProfit == null &&
              r.operatingIncome == null &&
              r.operatingCashFlow == null &&
              Number.isFinite(r.epsActual);

            if (isPending10Q) {
              const latest8K = Array.isArray(er.filings)
                ? er.filings.find((fl) => fl.formType === '8-K' && (fl.htmlUrl || fl.pdfUrl))
                : null;
              const releaseUrl = latest8K?.htmlUrl || latest8K?.pdfUrl || null;
              return `
                <article class="er-card ${idx === 0 ? 'latest' : ''}">
                  <div class="er-card-top">
                    <div>
                      <div class="er-period-title">${esc(title)}</div>
                      <div class="er-period-sub">${esc(sub)}</div>
                    </div>
                    <span class="er-beat-badge ${badgeCls}">${badgeText}</span>
                  </div>
                  <div class="er-pending-row">
                    <div class="er-metric" style="min-width:130px">
                      <span>EPS Actual</span>
                      <strong>$${(r.epsActual / sfEr).toFixed(2)}</strong>
                      <small>${Number.isFinite(r.epsEstimate) ? `Est $${(r.epsEstimate / sfEr).toFixed(2)}` : 'Headline EPS'}</small>
                    </div>
                    <div class="er-pending-box">
                      <div class="er-pending-title">Awaiting Formal SEC Form 10-Q Filing</div>
                      <div class="er-pending-desc">Headline EPS is live from the ${r.dateReported ? `${esc(r.dateReported)} ` : ''}earnings release. Full Revenue, Gross Profit, Operating Income &amp; Cash Flow will populate automatically once the 10-Q is filed.</div>
                      ${safeHttpUrl(releaseUrl) ? `<a class="er-pending-link" href="${esc(safeHttpUrl(releaseUrl))}" target="_blank" rel="noopener noreferrer">Open Form 8-K Press Release (${esc(latest8K.filed)}) →</a>` : ''}
                    </div>
                  </div>
                </article>
              `;
            }

            return `
              <article class="er-card ${idx === 0 ? 'latest' : ''}">
                <div class="er-card-top">
                  <div>
                    <div class="er-period-title">${esc(title)}</div>
                    <div class="er-period-sub">${esc(sub)}</div>
                  </div>
                  <span class="er-beat-badge ${badgeCls}">${badgeText}</span>
                </div>
                <div class="er-metrics-grid">
                  <div class="er-metric">
                    <span>EPS Actual</span>
                    <strong>${Number.isFinite(r.epsActual) ? `$${(r.epsActual / sfEr).toFixed(2)}` : '—'}</strong>
                    <small>${Number.isFinite(r.epsEstimate) ? `Est $${(r.epsEstimate / sfEr).toFixed(2)}` : 'No consensus'}</small>
                  </div>
                  <div class="er-metric">
                    <span>Revenue</span>
                    <strong>${fmtDollarBig(r.revenue)}</strong>
                    <small>${revSeqNote}</small>
                  </div>
                  <div class="er-metric">
                    <span>Net Income</span>
                    <strong>${fmtDollarBig(r.netIncome)}</strong>
                    <small>${Number.isFinite(r.netMargin) ? `Net ${r.netMargin.toFixed(1)}%` : 'Bottom line'}</small>
                  </div>
                  <div class="er-metric">
                    <span>Gross Profit</span>
                    <strong>${fmtDollarBig(r.grossProfit)}</strong>
                    <small>${Number.isFinite(r.grossMargin) ? `GM ${r.grossMargin.toFixed(1)}%` : 'Gross margin'}</small>
                  </div>
                  <div class="er-metric">
                    <span>Operating Inc</span>
                    <strong>${fmtDollarBig(r.operatingIncome)}</strong>
                    <small>${Number.isFinite(r.operatingMargin) ? `EBIT ${r.operatingMargin.toFixed(1)}%` : 'Operating'}</small>
                  </div>
                  <div class="er-metric">
                    <span>Op Cash Flow</span>
                    <strong>${fmtDollarBig(r.operatingCashFlow)}</strong>
                    <small>${r.revenue == null && idx === 0 && r.dateReported ? '10-Q pending' : 'Cash generated'}</small>
                  </div>
                </div>
              </article>
            `;
          })
          .join('');
      }

      // Period Financial Breakdown Table
      const tableCols = is2H
        ? reports.filter((r) => r.revenue != null || r.netIncome != null)
        : (er.finQCols && er.finQCols.length > 0 ? er.finQCols : reports.filter((r) => r.revenue != null || r.netIncome != null));

      this.el.erFinTableTitle.textContent = is2H
        ? 'Half-Year (2H) Income & Cash Flow Breakdown'
        : 'Quarterly (4Q) Income & Cash Flow Breakdown';
      this.el.erFinTableSub.textContent = tableCols.length > 0
        ? `Showing ${tableCols.length} most recent filed ${is2H ? 'half-year' : 'quarterly'} statements (USD)`
        : 'Detailed interim statement breakdown';

      if (tableCols.length > 0) {
        this.el.erFinHead.innerHTML = `<tr><th>Metric</th>${tableCols.map((c) => `<th class="num">${esc(c.periodEnd || c.periodLabel)}</th>`).join('')}</tr>`;
        const tableRows = [
          { name: 'Total Revenue', fn: (c) => fmtDollarBig(c.revenue) },
          { name: 'Gross Profit', fn: (c) => fmtDollarBig(c.grossProfit) },
          { name: 'Gross Margin', fn: (c) => fmtPct(c.grossMargin) },
          { name: 'R&D Expense', fn: (c) => fmtDollarBig(c.rd) },
          { name: 'Operating Income (EBIT)', fn: (c) => fmtDollarBig(c.operatingIncome) },
          { name: 'Operating Margin', fn: (c) => fmtPct(c.operatingMargin) },
          { name: 'Net Income', fn: (c) => fmtDollarBig(c.netIncome) },
          { name: 'Net Profit Margin', fn: (c) => fmtPct(c.netMargin) },
          { name: 'Operating Cash Flow', fn: (c) => fmtDollarBig(c.operatingCashFlow) },
        ];
        this.el.erFinBody.innerHTML = tableRows
          .map((row) => `<tr><td><strong>${row.name}</strong></td>${tableCols.map((c) => `<td class="num">${row.fn(c)}</td>`).join('')}</tr>`)
          .join('');
      } else if (ins.hlStats) {
        const hl = ins.hlStats;
        const m = this.markets.get(this.prefs.activeSymbol);
        const fmtRet = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
        this.el.erFinTableTitle.textContent = 'Live Hyperliquid Multi-Horizon Market Summary';
        this.el.erFinTableSub.textContent = `Computed live from ${hl.periodDays} daily Hyperliquid candles`;
        this.el.erFinHead.innerHTML = '<tr><th>Market Metric</th><th class="num">Value</th><th class="num">Context</th></tr>';
        const rows = [
          ['24h Return', m ? fmtRet(m.change24hPct) : '—', 'Live 24h change'],
          ['7-Day Return', fmtRet(hl.ret7d), 'Rolling 7D'],
          ['30-Day Return', fmtRet(hl.ret30d), 'Rolling 30D'],
          ['90D / Inception Return', fmtRet(hl.ret90d ?? hl.retInception), `${hl.periodDays}D window`],
          ['Period High / Low', hl.periodHigh && hl.periodLow ? `$${formatPrice(hl.periodHigh)} / $${formatPrice(hl.periodLow)}` : '—', 'Hyperliquid range'],
          ['30D Realized Volatility', hl.vol30dAnn ? `${hl.vol30dAnn.toFixed(1)}%` : '—', 'Annualized'],
          ['Avg Daily HL Volume', hl.avgDailyHlUsdVol ? `$${formatCompact(hl.avgDailyHlUsdVol)}` : '—', 'Notional USD/day'],
        ];
        this.el.erFinBody.innerHTML = rows
          .map(([k, v, sub]) => `<tr><td><strong>${k}</strong></td><td class="num">${v}</td><td class="num" style="color:var(--text-muted)">${sub}</td></tr>`)
          .join('');
      } else {
        this.el.erFinHead.innerHTML = '';
        this.el.erFinBody.innerHTML = `<tr><td class="empty-state">Interim financial statement tables are not published via US 10-Q for ${esc(ins.ticker)}. See official ${er.filings?.length ? '6-K / 20-F ' : ''}filings below or the Annual Income Statement in Overview.</td></tr>`;
      }

      // Official Earnings Filings List (clickable HTML & PDF links)
      const filings = Array.isArray(er.filings) ? er.filings : [];
      this.el.erFilingsSub.textContent = filings.length > 0
        ? `${filings.length} recent official reports · Click to open full report in browser`
        : (ins.website ? 'Official investor & company resources' : '10-Q · 10-K · 8-K · 6-K · 20-F');

      if (filings.length === 0) {
        const siteHref = ins.website ? safeHttpUrl(ins.website) : null;
        if (siteHref) {
          this.el.erFilingsList.innerHTML = `
            <div class="er-filing-row">
              <div class="er-filing-left">
                <span class="er-form-tag annual">${esc(ins.assetKind === 'preipo' ? 'PRIVATE' : 'IR')}</span>
                <div>
                  <div style="font-weight:700;color:var(--text-primary);font-size:12px">${esc(ins.companyName)} · Official Website &amp; Releases</div>
                  <div style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono)">${esc(ins.exchange)} · ${esc(countryLabel)}</div>
                </div>
              </div>
              <div class="er-filing-links">
                <a class="er-open-link" href="${esc(siteHref)}" target="_blank" rel="noopener noreferrer">Open Official Site ↗</a>
              </div>
            </div>
          `;
        } else {
          this.el.erFilingsList.innerHTML = '<div class="empty-state">No US SEC corporate filings apply to this synthetic / index / macro instrument.</div>';
        }
      } else {
        this.el.erFilingsList.innerHTML = filings
          .map((fl) => {
            const tagCls = (fl.formType === '10-K' || fl.formType === '20-F' || fl.formType === '40-F')
              ? 'annual'
              : (fl.formType === '8-K' ? 'release' : '');
            const safeHtml = safeHttpUrl(fl.htmlUrl);
            const safePdf = safeHttpUrl(fl.pdfUrl);
            return `
              <div class="er-filing-row">
                <div class="er-filing-left">
                  <span class="er-form-tag ${tagCls}">${esc(fl.formType)}</span>
                  <div>
                    <div style="font-weight:700;color:var(--text-primary);font-size:12px">${esc(fl.label)}</div>
                    <div style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono)">Filed ${esc(fl.filed)}${fl.period ? ` · Period ${esc(fl.period)}` : ''}</div>
                  </div>
                </div>
                <div class="er-filing-links">
                  ${safeHtml ? `<a class="er-open-link" href="${esc(safeHtml)}" target="_blank" rel="noopener noreferrer">Open Report ↗</a>` : ''}
                  ${safePdf ? `<a class="er-open-link pdf" href="${esc(safePdf)}" target="_blank" rel="noopener noreferrer">PDF ↗</a>` : ''}
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    _renderEpsChart(ins, splitFactor = null, splitLabel = null) {
      const canvas = this.el.insEpsCanvas;
      if (!canvas) return;
      const mLive = this.markets.get(this.prefs.activeSymbol);
      const autoSplit = (splitFactor == null && mLive && ins?.refPrice && !ins?.isIndexProxy)
        ? detectSplitFactor(ins.refPrice, mLive.price)
        : { factor: splitFactor || 1, label: splitLabel };
      const sf = autoSplit.factor || 1;
      const sLbl = autoSplit.label || null;
      const wrap = canvas.parentElement;
      const W = Math.max(260, wrap ? wrap.clientWidth : 480);
      const H = Math.max(170, wrap ? wrap.clientHeight : 196);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const list = Array.isArray(ins?.epsQuarters) ? ins.epsQuarters : [];
      const prev = list.filter((q) => q.type === 'PreviousQuarter').slice(-4);
      const next = list.filter((q) => q.type === 'UpcomingQuarter').slice(0, 4);
      const items = [...prev, ...next];

      if (items.length === 0) {
        // Fallback: Draw crisp 90-Day Live Hyperliquid Price Trend Curve (so SPCX, ANTH, ETFs, Indices & Macro NEVER have a blank chart!)
        const spark = ins?.hlStats?.sparkSeries;
        if (Array.isArray(spark) && spark.length >= 2) {
          if (this.el.insEpsTitle) this.el.insEpsTitle.textContent = `Live ${spark.length}-Day Hyperliquid Price Trend`;
          const firstC = spark[0].c;
          const lastC = spark[spark.length - 1].c;
          const chgPct = firstC > 0 ? ((lastC - firstC) / firstC) * 100 : 0;
          if (this.el.insEpsSub) {
            this.el.insEpsSub.textContent = `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}% over last ${spark.length} days`;
          }
          const vals = spark.map((p) => p.c);
          const minV = Math.min(...vals);
          const maxV = Math.max(...vals);
          const pad = Math.max((maxV - minV) * 0.14, maxV * 0.01);
          const yLo = Math.max(0, minV - pad);
          const yHi = maxV + pad;
          const padL = 56, padR = 14, padT = 16, padB = 26;
          const plotW = W - padL - padR;
          const plotH = H - padT - padB;
          const xOf = (i) => padL + (plotW * i) / (spark.length - 1);
          const yOf = (v) => padT + plotH * (1 - (v - yLo) / Math.max(1e-6, yHi - yLo));

          // Grid & Y labels
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
          ctx.lineWidth = 1;
          for (let g = 0; g <= 3; g++) {
            const gv = yLo + ((yHi - yLo) * g) / 3;
            const gy = yOf(gv);
            ctx.beginPath();
            ctx.moveTo(padL, gy);
            ctx.lineTo(W - padR, gy);
            ctx.stroke();
            ctx.fillStyle = '#64748b';
            ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`$${formatPrice(gv)}`, padL - 6, gy);
          }

          const mc = getMarketColors();
          const isUp = lastC >= firstC;
          const lineCol = isUp ? mc.bull : mc.bear;
          ctx.beginPath();
          spark.forEach((pt, idx) => {
            const x = xOf(idx);
            const y = yOf(pt.c);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = lineCol;
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.stroke();

          ctx.lineTo(xOf(spark.length - 1), padT + plotH);
          ctx.lineTo(xOf(0), padT + plotH);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
          grad.addColorStop(0, isUp ? `rgba(${mc.bullRgb}, 0.28)` : `rgba(${mc.bearRgb}, 0.25)`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fill();

          // Start & End date labels
          const fmtD = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          ctx.fillStyle = '#64748b';
          ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText(fmtD(spark[0].t), padL, H - padB + 6);
          ctx.textAlign = 'right';
          ctx.fillText(fmtD(spark[spark.length - 1].t), W - padR, H - padB + 6);

          ctx.restore();
          return;
        }

        if (this.el.insEpsTitle) this.el.insEpsTitle.textContent = 'Quarterly EPS Actuals & Forward Estimates';
        if (this.el.insEpsSub) this.el.insEpsSub.textContent = 'Actual vs Consensus ($)';
        ctx.fillStyle = '#64748b';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ins ? 'Loading live Hyperliquid price history...' : 'Loading quarterly EPS & price data...', W / 2, H / 2);
        ctx.restore();
        return;
      }

      if (this.el.insEpsTitle) this.el.insEpsTitle.textContent = 'Quarterly EPS Actuals & Forward Estimates';
      if (this.el.insEpsSub) this.el.insEpsSub.textContent = sLbl ? `Actual vs Consensus ($) · ${sLbl} Adj` : 'Actual vs Consensus ($)';

      const vals = [];
      for (const q of items) {
        if (Number.isFinite(Number(q.earnings)) && q.type === 'PreviousQuarter') vals.push(Number(q.earnings) / sf);
        if (Number.isFinite(Number(q.consensus))) vals.push(Number(q.consensus) / sf);
      }
      let minV = Math.min(0, ...vals);
      let maxV = Math.max(0.1, ...vals);
      const pad = Math.max(0.05, (maxV - minV) * 0.18);
      maxV += pad;
      if (minV < 0) minV -= pad * 0.6;

      const padL = 44;
      const padR = 14;
      const padT = 24;
      const padB = 34;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const valToY = (v) => padT + plotH * (1 - (v - minV) / Math.max(1e-6, maxV - minV));
      const zeroY = valToY(0);

      // Legend
      const mcEps = getMarketColors();
      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = mcEps.bull;
      ctx.fillRect(padL, 6, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Actual Beat', padL + 12, 10);
      ctx.fillStyle = mcEps.bear;
      ctx.fillRect(padL + 84, 6, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Actual Miss', padL + 96, 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(padL + 168, 6, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Consensus / Fwd Est', padL + 180, 10);

      // Horizontal grid + zero axis
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 3; g++) {
        const gv = minV + ((maxV - minV) * g) / 3;
        const gy = valToY(gv);
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(W - padR, gy);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`$${gv.toFixed(2)}`, padL - 6, gy);
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      ctx.lineTo(W - padR, zeroY);
      ctx.stroke();

      const slotW = plotW / items.length;
      const barW = Math.min(18, Math.max(7, slotW * 0.3));

      items.forEach((q, idx) => {
        const cx = padL + slotW * (idx + 0.5);
        const isPast = q.type === 'PreviousQuarter';
        const actual = isPast && Number.isFinite(Number(q.earnings)) ? Number(q.earnings) / sf : null;
        const est = Number.isFinite(Number(q.consensus)) ? Number(q.consensus) / sf : null;

        if (isPast && actual !== null && est !== null) {
          // Draw consensus bar left, actual bar right
          const yEst = valToY(est);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.fillRect(cx - barW - 1, Math.min(yEst, zeroY), barW, Math.max(2, Math.abs(zeroY - yEst)));

          const beat = actual >= est;
          const yAct = valToY(actual);
          ctx.fillStyle = beat ? mcEps.bull : mcEps.bear;
          ctx.fillRect(cx + 1, Math.min(yAct, zeroY), barW, Math.max(2, Math.abs(zeroY - yAct)));

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = actual >= 0 ? 'bottom' : 'top';
          ctx.fillText(`$${actual.toFixed(2)}`, cx + 1 + barW / 2, actual >= 0 ? yAct - 3 : yAct + 3);
        } else if (est !== null) {
          // Forward estimate bar (dashed outline + translucent cyan fill)
          const yEst = valToY(est);
          const top = Math.min(yEst, zeroY);
          const h = Math.max(2, Math.abs(zeroY - yEst));
          ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.fillRect(cx - barW * 0.65, top, barW * 1.3, h);
          ctx.strokeStyle = '#38bdf8';
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(cx - barW * 0.65, top, barW * 1.3, h);
          ctx.setLineDash([]);

          ctx.fillStyle = '#7dd3fc';
          ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = est >= 0 ? 'bottom' : 'top';
          ctx.fillText(`$${est.toFixed(2)}`, cx, est >= 0 ? yEst - 3 : yEst + 3);
        }

        // Quarter label
        const lbl = String(q.period || '').replace(/\s+/g, ' ');
        ctx.fillStyle = isPast ? '#94a3b8' : '#7dd3fc';
        ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(lbl.slice(0, 8), cx, H - padB + 7);
        if (!isPast) {
          ctx.fillStyle = '#5a6c85';
          ctx.font = '600 8.5px -apple-system, sans-serif';
          ctx.fillText('EST', cx, H - padB + 19);
        }
      });

      ctx.restore();
    }

    _teardownGrid() {
      for (const pane of this.gridControllers) {
        for (const key of pane.subs) this.ws.unsubscribe(key);
        pane.chart?.destroy();
      }
      this.gridControllers = [];
      this.el.multiGrid.innerHTML = '';
    }

    _buildGridDOM() {
      this._teardownGrid();
      const tfs = ['1m', '5m', '15m', '1h', '4h', '1d'];

      this.prefs.gridPanes.forEach((cfg, idx) => {
        const paneEl = document.createElement('div');
        paneEl.className = `grid-pane ${idx === this.selectedGridIndex ? 'selected' : ''}`;
        paneEl.innerHTML = `
          <div class="pane-header">
            <div class="pane-left">
              <span class="pane-ticker">—</span>
              <span class="dex-badge">xyz</span>
              <span class="pane-price">—</span>
              <span class="pane-pct">—</span>
            </div>
            <div class="pane-controls">
              ${tfs.map((tf) => `<button class="pane-tf ${tf === cfg.interval ? 'active' : ''}" data-tf="${tf}">${tf === '1d' ? '1D' : tf}</button>`).join('')}
              <button class="pane-max-btn" title="Open in Single View">⤢</button>
            </div>
          </div>
          <div class="pane-chart-wrap"></div>
        `;

        paneEl.addEventListener('mousedown', () => {
          this.selectedGridIndex = idx;
          this.el.multiGrid.querySelectorAll('.grid-pane').forEach((p, i) => p.classList.toggle('selected', i === idx));
        });

        const chartWrap = paneEl.querySelector('.pane-chart-wrap');
        const chart = new InteractiveFinancialChart(chartWrap, {
          compact: true,
          onRequestMoreHistory: async (oldestTs) => {
            const ctrl = this.gridControllers[idx];
            if (!ctrl) return;
            try {
              const older = await fetchCandles(ctrl.symbol, ctrl.interval, oldestTs - 1, 200, false);
              ctrl.chart.prependCandles(older);
            } catch (_) {
              ctrl.chart.prependCandles([]);
            }
          },
        });
        chart.setChartType(this.prefs.chartType);
        chart.setIndicators(this.prefs.indicators);

        const ctrl = {
          index: idx,
          symbol: cfg.symbol,
          interval: cfg.interval,
          chart,
          subs: [],
          el: paneEl,
          tickerEl: paneEl.querySelector('.pane-ticker'),
          dexEl: paneEl.querySelector('.dex-badge'),
          priceEl: paneEl.querySelector('.pane-price'),
          pctEl: paneEl.querySelector('.pane-pct'),
        };

        paneEl.querySelectorAll('.pane-tf').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tf = btn.dataset.tf;
            paneEl.querySelectorAll('.pane-tf').forEach((b) => b.classList.toggle('active', b === btn));
            this._loadGridPane(ctrl, ctrl.symbol, tf);
          });
        });

        paneEl.querySelector('.pane-max-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.prefs.activeSymbol = ctrl.symbol;
          this.prefs.interval = ctrl.interval;
          this.prefs.activeRange = null;
          this.setLayout('single');
        });

        this.gridControllers.push(ctrl);
        this.el.multiGrid.appendChild(paneEl);
      });
    }

    async _loadAllGridPanes() {
      await Promise.all(
        this.gridControllers.map((ctrl) => {
          const sym = this.markets.has(ctrl.symbol) ? ctrl.symbol : this.prefs.activeSymbol;
          return this._loadGridPane(ctrl, sym, ctrl.interval);
        })
      );
    }

    async _loadGridPane(ctrl, symbol, interval) {
      for (const key of ctrl.subs) this.ws.unsubscribe(key);
      ctrl.subs = [];

      ctrl.symbol = symbol;
      ctrl.interval = interval;
      this.prefs.gridPanes[ctrl.index] = { symbol, interval };
      this._persistPrefs();

      const m = this.markets.get(symbol);
      this._updateGridPaneHeader(ctrl, m);

      ctrl.chart.setIntervalName(interval);
      ctrl.chart.setCandles([], { resetView: true });
      ctrl.chart.setAlerts(this.prefs.alerts.filter((a) => a.symbol === symbol));

      ctrl.subs.push(this.ws.subscribe({ type: 'candle', coin: symbol, interval }));
      ctrl.subs.push(this.ws.subscribe({ type: 'activeAssetCtx', coin: symbol }));

      try {
        const candles = await fetchCandles(symbol, interval, Date.now(), 220);
        if (ctrl.symbol !== symbol || ctrl.interval !== interval) return;
        ctrl.chart.setCandles(candles, { resetView: true });
      } catch (_) {}
    }

    _updateGridPaneHeader(ctrl, m) {
      if (!m) return;
      ctrl.tickerEl.textContent = m.ticker;
      ctrl.dexEl.textContent = m.dex;
      ctrl.dexEl.className = `dex-badge ${this._dexBadgeClass(m.dex)}`;
      ctrl.priceEl.textContent = `$${formatPrice(m.price)}`;
      const sign = m.change24hPct >= 0 ? '+' : '';
      ctrl.pctEl.textContent = `${sign}${m.change24hPct.toFixed(2)}%`;
      ctrl.pctEl.className = `pane-pct ${m.change24hPct >= 0 ? 'pct-up' : 'pct-down'}`;
    }

    // MARK: Real-Time Portfolio Calculations, Banner & Tab Rendering

    _schedulePortfolioRender() {
      if (this._portfolioRenderQueued) return;
      this._portfolioRenderQueued = true;
      requestAnimationFrame(() => {
        this._portfolioRenderQueued = false;
        this.renderPortfolio(false);
      });
    }

    _computePortfolioStats() {
      const items = [];
      let totalValue = 0;
      let totalCost = 0;
      let totalPnl = 0;
      let totalPnl24h = 0;
      let prevTotalValue = 0;

      for (const h of this.prefs.holdings) {
        const m = this.markets.get(h.symbol);
        const livePrice = m ? m.price : h.avgPrice;
        const prevDayPx = m && m.prevDayPx > 0 ? m.prevDayPx : livePrice;
        const costBasis = h.qty * h.avgPrice;
        const isShort = h.side === 'short';

        const posTotalPnl = isShort ? h.qty * (h.avgPrice - livePrice) : h.qty * (livePrice - h.avgPrice);
        const marketValue = isShort ? Math.max(0, costBasis + posTotalPnl) : h.qty * livePrice;
        const pos24hPnl = isShort ? h.qty * (prevDayPx - livePrice) : h.qty * (livePrice - prevDayPx);
        const prevPosVal = isShort
          ? Math.max(0, costBasis + h.qty * (h.avgPrice - prevDayPx))
          : h.qty * prevDayPx;

        const posTotalPct = costBasis > 0 ? (posTotalPnl / costBasis) * 100 : 0;
        const pos24hPct = prevPosVal > 0 ? (pos24hPnl / prevPosVal) * 100 : 0;

        totalValue += marketValue;
        totalCost += costBasis;
        totalPnl += posTotalPnl;
        totalPnl24h += pos24hPnl;
        prevTotalValue += prevPosVal;

        items.push({
          ...h,
          market: m,
          ticker: m ? m.ticker : this._shortTicker(h.symbol),
          dex: m ? m.dex : (h.symbol.includes(':') ? h.symbol.split(':')[0] : 'xyz'),
          companyName: m ? m.companyName : '',
          livePrice,
          costBasis,
          marketValue,
          posTotalPnl,
          posTotalPct,
          pos24hPnl,
          pos24hPct,
        });
      }

      for (const it of items) {
        it.weight = totalValue > 0 ? (it.marketValue / totalValue) * 100 : 0;
      }

      const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
      const pnl24hPct = prevTotalValue > 0 ? (totalPnl24h / prevTotalValue) * 100 : 0;

      return { items, totalValue, totalCost, totalPnl, totalPnlPct, totalPnl24h, pnl24hPct };
    }

    renderPortfolio(fullTableRebuild = false) {
      const stats = this._computePortfolioStats();

      // 1. Always update Top Banner across every tab
      this.el.bannerTotalVal.textContent = formatUsd(stats.totalValue);

      const cls24 = stats.totalPnl24h > 0.005 ? 'up' : (stats.totalPnl24h < -0.005 ? 'down' : 'neutral');
      const s24 = stats.pnl24hPct > 0 ? '+' : '';
      this.el.banner24hPnl.textContent = `${formatUsd(stats.totalPnl24h, true)} (${s24}${stats.pnl24hPct.toFixed(2)}%)`;
      this.el.banner24hPnl.className = `pb-pnl ${cls24}`;

      const clsTot = stats.totalPnl > 0.005 ? 'up' : (stats.totalPnl < -0.005 ? 'down' : 'neutral');
      const sTot = stats.totalPnlPct > 0 ? '+' : '';
      this.el.bannerTotalPnl.textContent = `${formatUsd(stats.totalPnl, true)} (${sTot}${stats.totalPnlPct.toFixed(2)}%)`;
      this.el.bannerTotalPnl.className = `pb-pnl ${clsTot}`;

      // Only render the Portfolio tab internals if visible
      if (this.prefs.layout !== 'portfolio') return;

      // 2. KPI Cards
      this.el.pfTotalValue.textContent = formatUsd(stats.totalValue);
      this.el.pfCostSub.textContent = `Cost Basis: ${formatUsd(stats.totalCost)} · ${stats.items.length} ${stats.items.length === 1 ? 'Holding' : 'Holdings'}`;

      this.el.pf24hPnl.textContent = formatUsd(stats.totalPnl24h, true);
      this.el.pf24hPnl.className = `kpi-value ${cls24}`;
      this.el.pf24hPct.textContent = `${s24}${stats.pnl24hPct.toFixed(2)}% over last 24h`;
      this.el.pf24hPct.className = `kpi-sub ${cls24}`;

      this.el.pfTotalPnl.textContent = formatUsd(stats.totalPnl, true);
      this.el.pfTotalPnl.className = `kpi-value ${clsTot}`;
      this.el.pfTotalPct.textContent = `${sTot}${stats.totalPnlPct.toFixed(2)}% vs avg cost`;
      this.el.pfTotalPct.className = `kpi-sub ${clsTot}`;

      if (stats.items.length > 0) {
        const top = stats.items.slice().sort((a, b) => Math.abs(b.pos24hPct) - Math.abs(a.pos24hPct))[0];
        const mCls = top.pos24hPct >= 0 ? 'up' : 'down';
        this.el.pfTopMover.textContent = `${top.ticker} ${top.pos24hPct >= 0 ? '+' : ''}${top.pos24hPct.toFixed(2)}%`;
        this.el.pfTopMover.className = `kpi-value ${mCls}`;
        this.el.pfTopMoverSub.textContent = `24h Impact: ${formatUsd(top.pos24hPnl, true)}`;
        this.el.pfTopMoverSub.className = `kpi-sub ${mCls}`;
      } else {
        this.el.pfTopMover.textContent = '—';
        this.el.pfTopMover.className = 'kpi-value neutral';
        this.el.pfTopMoverSub.textContent = 'Add holdings to track live';
        this.el.pfTopMoverSub.className = 'kpi-sub neutral';
      }

      // 3. Portfolio Performance Over Time vs. Benchmarks (S&P 500, Nasdaq-100, MSCI World)
      this._syncPortfolioPerformance(stats);

      // 4. Analytics Charts (Allocation Donut & P/L Bars)
      this._renderPortfolioDonut(stats);
      this._renderPortfolioPnlBars(stats);

      // 5. Holdings Table
      this._renderHoldingsTable(stats, fullTableRebuild);
    }

    _getPortfolioPerfSignature() {
      const hKey = this.prefs.holdings
        .map((h) => `${h.symbol}:${h.side}:${h.qty}:${h.avgPrice}`)
        .sort()
        .join('|');
      return `${this.pfPerfRange}::${hKey}`;
    }

    _patchMag7Live(d) {
      const m7 = d?.benchmarks?.mag7;
      if (!m7 || !Array.isArray(m7.constituents) || m7.constituents.length === 0) return;
      const lastIdx = d.dates.length - 1;
      if (lastIdx < 1) return;
      let sumNorm = 0;
      let count = 0;
      for (const c of m7.constituents) {
        const bm = this.markets.get(c.coin);
        if (bm && Number.isFinite(bm.price) && bm.price > 0 && c.startPx > 0) {
          sumNorm += bm.price / c.startPx;
          count++;
        }
      }
      if (count > 0) {
        const idxVal = (sumNorm / count) * 100;
        const pct = idxVal - 100;
        m7.prices[lastIdx] = idxVal;
        m7.pct[lastIdx] = pct;
        m7.dollar[lastIdx] = d.stats.startVal * (1 + pct / 100);
        m7.totalReturnPct = pct;
        d.stats.mag7ReturnPct = pct;
        if (Number.isFinite(d.stats.portReturnPct)) {
          d.stats.alphaVsMag7 = d.stats.portReturnPct - pct;
        }
      }
    }

    _patchMsciLive(d) {
      const msci = d?.benchmarks?.msci;
      if (!msci || !Array.isArray(msci.constituents) || msci.constituents.length === 0) return;
      const lastIdx = d.dates.length - 1;
      if (lastIdx < 1) return;
      let factor = 0;
      let wUsed = 0;
      for (const c of msci.constituents) {
        const bm = this.markets.get(c.coin);
        if (bm && Number.isFinite(bm.price) && bm.price > 0 && c.refPx > 0) {
          factor += c.weight * (bm.price / c.refPx);
          wUsed += c.weight;
        }
      }
      if (wUsed > 0) {
        const normFactor = factor / wUsed;
        const baseRatio = Number.isFinite(msci.anchorBaseRatio) && msci.anchorBaseRatio > 0 ? msci.anchorBaseRatio : 1;
        const pct = (baseRatio * normFactor - 1) * 100;
        const startPx = msci.prices[0] > 0 ? msci.prices[0] : 100;
        msci.prices[lastIdx] = startPx * (1 + pct / 100);
        msci.pct[lastIdx] = pct;
        msci.dollar[lastIdx] = d.stats.startVal * (1 + pct / 100);
        msci.totalReturnPct = pct;
        d.stats.msciReturnPct = pct;
        if (Number.isFinite(d.stats.portReturnPct)) {
          d.stats.alphaVsMsci = d.stats.portReturnPct - pct;
        }
      }
    }

    _syncPortfolioPerformance(stats) {
      if (this.prefs.holdings.length === 0) {
        this.pfPerfData = null;
        this.pfPerfSignature = null;
        this._drawPortfolioPerfChart();
        return;
      }
      const sig = this._getPortfolioPerfSignature();
      if (sig !== this.pfPerfSignature) {
        this.loadPortfolioPerformance(false);
        return;
      }
      // Patch rightmost live point smoothly on every WebSocket price tick
      if (this.pfPerfData && stats.totalValue > 0) {
        const d = this.pfPerfData;
        const last = d.portfolioVal.length - 1;
        d.portfolioVal[last] = stats.totalValue;
        const base = d.portfolioVal[0] > 0 ? d.portfolioVal[0] : 1;
        const pct = ((stats.totalValue - base) / base) * 100;
        d.portfolioPct[last] = pct;
        d.stats.endVal = stats.totalValue;
        d.stats.portReturnPct = pct;
        d.stats.portDollarChange = stats.totalValue - d.portfolioVal[0];
        this._patchMag7Live(d);
        this._patchMsciLive(d);
        if (d.benchmarks.spy) d.stats.alphaVsSpy = pct - d.benchmarks.spy.totalReturnPct;
        if (d.benchmarks.qqq) d.stats.alphaVsQqq = pct - d.benchmarks.qqq.totalReturnPct;
        if (d.benchmarks.mag7) d.stats.alphaVsMag7 = pct - d.benchmarks.mag7.totalReturnPct;
        if (d.benchmarks.msci) d.stats.alphaVsMsci = pct - d.benchmarks.msci.totalReturnPct;
        this._drawPortfolioPerfChart();
      }
    }

    async loadPortfolioPerformance(force = false) {
      if (this.prefs.holdings.length === 0) {
        this.pfPerfData = null;
        this.pfPerfSignature = null;
        this._drawPortfolioPerfChart();
        return;
      }
      const sig = this._getPortfolioPerfSignature();
      if (!force && sig === this.pfPerfSignature && this.pfPerfData) {
        this._drawPortfolioPerfChart();
        return;
      }
      const seq = ++this._pfPerfSeq;
      this.pfPerfSignature = sig;
      this.pfPerfHoverIdx = null;
      if (this.el.pfPerfSub) {
        this.el.pfPerfSub.textContent = `Loading ${this.pfPerfRange} portfolio history & S&P 500, Nasdaq-100, Mag 7 (7 Perps), MSCI World benchmarks...`;
      }
      this._drawPortfolioPerfChart(true);

      try {
        const data = await fetchPortfolioBenchmarkSeries(this.prefs.holdings, this.markets, this.pfPerfRange);
        if (seq !== this._pfPerfSeq) return;
        this.pfPerfData = data;
        if (this.el.pfPerfSub) {
          this.el.pfPerfSub.textContent = `Current holdings weighted ${this.pfPerfRange} performance vs. S&P 500 (SPY), Nasdaq-100 (QQQ), Mag 7 (7 Perps) & MSCI World (URTH)`;
        }
        this._drawPortfolioPerfChart(false);
      } catch (err) {
        if (seq !== this._pfPerfSeq) return;
        if (this.el.pfPerfSub) {
          const retryHint = document.body.classList.contains('platform-ios') ? 'Tap Refresh to retry.' : 'Press ⌘R to retry.';
          this.el.pfPerfSub.textContent = `Unable to load benchmark history. ${retryHint}`;
        }
        this._drawPortfolioPerfChart(false);
      }
    }

    _drawPortfolioPerfChart(isLoading = false) {
      const canvas = this.el.pfPerfCanvas;
      if (!canvas) return;
      const wrap = canvas.parentElement;
      const W = Math.max(300, wrap ? wrap.clientWidth : 900);
      const H = Math.max(110, wrap ? wrap.clientHeight : 220);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const fmtSignPct = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
      const d = this.pfPerfData;

      if (this.prefs.holdings.length === 0) {
        if (this.el.pfLegendPort) this.el.pfLegendPort.textContent = '—';
        if (this.el.pfLegendSpy) this.el.pfLegendSpy.textContent = '—';
        if (this.el.pfLegendQqq) this.el.pfLegendQqq.textContent = '—';
        if (this.el.pfLegendMag7) this.el.pfLegendMag7.textContent = '—';
        if (this.el.pfLegendMsci) this.el.pfLegendMsci.textContent = '—';
        if (this.el.pfPerfHoverHud) this.el.pfPerfHoverHud.textContent = 'Add holdings below to compare against S&P 500, Nasdaq-100, Mag 7 & MSCI World';
        if (this.el.pfBenchStats) this.el.pfBenchStats.innerHTML = '';
        ctx.fillStyle = '#64748b';
        ctx.font = '12.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add your holdings below to chart performance over time vs. S&P 500, Nasdaq-100, Mag 7 & MSCI World', W / 2, H / 2);
        ctx.restore();
        return;
      }

      if (isLoading || !d || d.dates.length < 2) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isLoading ? `Loading ${this.pfPerfRange} portfolio & benchmark history...` : 'Benchmark history unavailable', W / 2, H / 2);
        ctx.restore();
        return;
      }

      const isUsd = this.pfPerfMode === 'usd';
      const isIntraday = Boolean(d.isIntraday);

      // Update subtitle context for intraday vs multi-day benchmark source
      if (this.el.pfPerfSub) {
        const msciTag = d.benchmarks.msci?.isEstimated ? 'MSCI World (Est. Perp)' : 'MSCI World (URTH)';
        this.el.pfPerfSub.textContent = isIntraday
          ? `Live intraday Hyperliquid performance vs. S&P 500 (xyz:SP500), Nasdaq-100 (xyz:XYZ100), Mag 7 (7 Perps) & ${msciTag}`
          : `Current holdings performance vs. S&P 500 (SPY), Nasdaq-100 (QQQ), Mag 7 (7 Perps) & ${msciTag}`;
      }

      // Live-patch the final LIVE point on intraday ranges from streaming WebSocket prices
      const lastIdx = d.dates.length - 1;
      if (isIntraday && lastIdx >= 1 && this.markets.size > 0) {
        let livePortVal = 0;
        for (const h of this.prefs.holdings) {
          const m = this.markets.get(h.symbol);
          const px = m ? m.price : h.avgPrice;
          const cost = h.qty * h.avgPrice;
          livePortVal += h.side === 'short' ? Math.max(0, cost + h.qty * (h.avgPrice - px)) : h.qty * px;
        }
        if (livePortVal > 0 && d.stats.startVal > 0) {
          d.portfolioVal[lastIdx] = livePortVal;
          const livePortPct = ((livePortVal - d.stats.startVal) / d.stats.startVal) * 100;
          d.portfolioPct[lastIdx] = livePortPct;
          d.stats.endVal = livePortVal;
          d.stats.portReturnPct = livePortPct;
          d.stats.portDollarChange = livePortVal - d.stats.startVal;

          const patchBench = (b, coin) => {
            if (!b || !coin) return;
            const bm = this.markets.get(coin);
            if (bm && bm.price > 0 && b.prices[0] > 0) {
              b.prices[lastIdx] = bm.price;
              const pct = ((bm.price - b.prices[0]) / b.prices[0]) * 100;
              b.pct[lastIdx] = pct;
              b.dollar[lastIdx] = d.stats.startVal * (1 + pct / 100);
              b.totalReturnPct = pct;
            }
          };
          patchBench(d.benchmarks.spy, d.spyCoin);
          patchBench(d.benchmarks.qqq, d.qqqCoin);
          this._patchMag7Live(d);
          this._patchMsciLive(d);
          if (d.benchmarks.spy) {
            d.stats.spyReturnPct = d.benchmarks.spy.totalReturnPct;
            d.stats.alphaVsSpy = livePortPct - d.stats.spyReturnPct;
          }
          if (d.benchmarks.qqq) {
            d.stats.qqqReturnPct = d.benchmarks.qqq.totalReturnPct;
            d.stats.alphaVsQqq = livePortPct - d.stats.qqqReturnPct;
          }
          if (d.benchmarks.mag7) {
            d.stats.mag7ReturnPct = d.benchmarks.mag7.totalReturnPct;
            d.stats.alphaVsMag7 = livePortPct - d.stats.mag7ReturnPct;
          }
          if (d.benchmarks.msci) {
            d.stats.msciReturnPct = d.benchmarks.msci.totalReturnPct;
            d.stats.alphaVsMsci = livePortPct - d.stats.msciReturnPct;
          }
        }
      } else if (!isIntraday && lastIdx >= 1 && this.markets.size > 0) {
        this._patchMag7Live(d);
        this._patchMsciLive(d);
      }

      const portSeries = isUsd ? d.portfolioVal : d.portfolioPct;
      const activeSeries = [
        { key: 'port', label: 'Portfolio', color: '#50e3c2', width: 2.4, data: portSeries, fill: true },
      ];
      if (this.pfBenchmarks.spy && d.benchmarks.spy) {
        activeSeries.push({ key: 'spy', label: 'S&P 500', color: '#38bdf8', width: 1.5, data: isUsd ? d.benchmarks.spy.dollar : d.benchmarks.spy.pct });
      }
      if (this.pfBenchmarks.qqq && d.benchmarks.qqq) {
        activeSeries.push({ key: 'qqq', label: 'Nasdaq-100', color: '#a78bfa', width: 1.5, data: isUsd ? d.benchmarks.qqq.dollar : d.benchmarks.qqq.pct });
      }
      if (this.pfBenchmarks.mag7 && d.benchmarks.mag7) {
        activeSeries.push({ key: 'mag7', label: 'Mag 7', color: '#f472b6', width: 1.5, data: isUsd ? d.benchmarks.mag7.dollar : d.benchmarks.mag7.pct });
      }
      if (this.pfBenchmarks.msci && d.benchmarks.msci) {
        const msciLabel = d.benchmarks.msci.isEstimated ? 'MSCI World (Est.)' : 'MSCI World';
        activeSeries.push({ key: 'msci', label: msciLabel, color: '#fbbf24', width: 1.5, data: isUsd ? d.benchmarks.msci.dollar : d.benchmarks.msci.pct });
      }

      // Update Legend Badges
      const s = d.stats;
      if (this.el.pfLegendPort) {
        this.el.pfLegendPort.textContent = fmtSignPct(s.portReturnPct);
        this.el.pfLegendPort.style.color = s.portReturnPct >= 0 ? 'var(--bull)' : 'var(--bear)';
      }
      if (this.el.pfLegendSpy) this.el.pfLegendSpy.textContent = fmtSignPct(s.spyReturnPct);
      if (this.el.pfLegendQqq) this.el.pfLegendQqq.textContent = fmtSignPct(s.qqqReturnPct);
      if (this.el.pfLegendMag7) this.el.pfLegendMag7.textContent = fmtSignPct(s.mag7ReturnPct);
      if (this.el.pfLegendMsci) {
        this.el.pfLegendMsci.textContent = s.msciReturnPct != null ? fmtSignPct(s.msciReturnPct) : (isIntraday ? 'Mkt Closed' : '—');
      }

      // Update Risk & Alpha Stats Strip
      if (this.el.pfBenchStats) {
        const alphaColor = (v) => (Number.isFinite(v) ? (v >= 0 ? 'var(--bull)' : 'var(--bear)') : 'var(--text-primary)');
        const items = [
          { k: `Portfolio (${d.rangeKey})`, v: `${fmtSignPct(s.portReturnPct)} (${formatUsd(s.portDollarChange, true)})`, c: alphaColor(s.portReturnPct) },
          { k: 'Alpha vs S&P 500', v: fmtSignPct(s.alphaVsSpy), c: alphaColor(s.alphaVsSpy) },
          { k: 'Alpha vs Nasdaq-100', v: fmtSignPct(s.alphaVsQqq), c: alphaColor(s.alphaVsQqq) },
          { k: 'Alpha vs Mag 7', v: fmtSignPct(s.alphaVsMag7), c: alphaColor(s.alphaVsMag7) },
          { k: 'Alpha vs MSCI World', v: s.alphaVsMsci != null ? fmtSignPct(s.alphaVsMsci) : (isIntraday ? 'Mkt Closed' : '—'), c: alphaColor(s.alphaVsMsci) },
          { k: 'Max Drawdown', v: Number.isFinite(s.maxDrawdownPct) ? `${s.maxDrawdownPct.toFixed(2)}%` : '—', c: 'var(--bear)' },
          { k: 'Beta vs S&P 500', v: Number.isFinite(s.betaVsSpy) ? s.betaVsSpy.toFixed(2) : '—', c: 'var(--text-primary)' },
          isIntraday
            ? { k: `${d.rangeKey} Volatility`, v: s.periodVolPct != null ? `${s.periodVolPct.toFixed(2)}%` : '—', c: 'var(--text-primary)' }
            : { k: 'Vol / Sharpe', v: s.annVolPct != null ? `${s.annVolPct.toFixed(1)}% · ${s.sharpeRatio != null ? s.sharpeRatio.toFixed(2) : '—'}` : '—', c: 'var(--text-primary)' },
        ];
        this.el.pfBenchStats.innerHTML = items
          .map((it) => `<div class="margin-pill"><span>${it.k}</span><strong style="color:${it.c}">${it.v}</strong></div>`)
          .join('');
      }

      // Compute Y bounds across all active series
      let minV = Infinity;
      let maxV = -Infinity;
      for (const ser of activeSeries) {
        for (const v of ser.data) {
          if (Number.isFinite(v)) {
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
          }
        }
      }
      if (!isUsd) {
        minV = Math.min(minV, 0);
        maxV = Math.max(maxV, 0);
      }
      const minPctSpan = isIntraday
        ? ((d.rangeKey === '15m' || d.rangeKey === '30m') ? 0.08 : ((d.rangeKey === '1H' || d.rangeKey === '3H') ? 0.2 : 0.5))
        : 2;
      const span = Math.max(isUsd ? Math.max(10, maxV * 0.005) : minPctSpan, maxV - minV);
      minV -= span * 0.12;
      maxV += span * 0.12;

      const isNarrow = W < 480;
      const padL = isNarrow ? 48 : 62;
      const padR = isNarrow ? 56 : 72;
      const padT = 16;
      const padB = 26;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const n = d.dates.length;
      const xOf = (i) => padL + (plotW * i) / Math.max(1, n - 1);
      const yOf = (v) => padT + plotH * (1 - (v - minV) / Math.max(1e-6, maxV - minV));

      // Horizontal Grid & Y Labels
      const pctDecimals = span < 3 ? 2 : 1;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const gv = minV + ((maxV - minV) * g) / 4;
        const gy = Math.round(yOf(gv)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(W - padR, gy);
        ctx.stroke();

        ctx.fillStyle = '#7c8ea6';
        ctx.font = `${isNarrow ? 9.5 : 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const lbl = isUsd ? `$${formatCompact(gv)}` : `${gv >= 0 ? '+' : ''}${gv.toFixed(pctDecimals)}%`;
        ctx.fillText(lbl, padL - 6, gy);
      }

      // 0% reference baseline
      if (!isUsd && minV < 0 && maxV > 0) {
        const zy = Math.round(yOf(0)) + 0.5;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, zy);
        ctx.lineTo(W - padR, zy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // X-axis date / time ticks (adaptive count prevents label collisions on narrow iPhones)
      const tickCount = Math.min(isNarrow ? 4 : 6, n);
      ctx.fillStyle = '#64748b';
      ctx.font = `${isNarrow ? 9.5 : 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'top';
      for (let t = 0; t < tickCount; t++) {
        const idx = Math.round((t * (n - 1)) / Math.max(1, tickCount - 1));
        const x = xOf(idx);
        let dtStr;
        if (idx === n - 1) {
          dtStr = 'LIVE';
        } else if (isIntraday) {
          dtStr = d.dates[idx];
        } else {
          dtStr = new Date(`${d.dates[idx]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.rangeKey === '3Y' ? '2-digit' : undefined, timeZone: 'UTC' });
        }
        ctx.textAlign = t === 0 ? 'left' : (t === tickCount - 1 ? 'right' : 'center');
        ctx.fillText(dtStr, x, H - padB + 7);
      }

      // Draw Benchmark Lines first, Portfolio Line on top
      const drawOrder = [...activeSeries.slice(1), activeSeries[0]];
      for (const ser of drawOrder) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = xOf(i);
          const y = yOf(ser.data[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ser.color;
        ctx.lineWidth = ser.width;
        ctx.lineJoin = 'round';
        ctx.stroke();

        if (ser.fill) {
          ctx.lineTo(xOf(n - 1), padT + plotH);
          ctx.lineTo(xOf(0), padT + plotH);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
          grad.addColorStop(0, 'rgba(80, 227, 194, 0.22)');
          grad.addColorStop(1, 'rgba(80, 227, 194, 0.0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Right-edge endpoint labels (non-overlapping)
      const endpoints = activeSeries
        .map((ser) => ({
          color: ser.color,
          val: ser.data[n - 1],
          y: yOf(ser.data[n - 1]),
        }))
        .sort((a, b) => a.y - b.y);
      let lastLabelY = -999;
      for (const ep of endpoints) {
        const y = Math.max(padT + 8, Math.min(padT + plotH - 8, Math.max(ep.y, lastLabelY + 15)));
        lastLabelY = y;
        const txt = isUsd ? `$${formatCompact(ep.val)}` : fmtSignPct(ep.val);
        ctx.fillStyle = ep.color;
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, W - padR + 7, y);
      }

      // Hover Crosshair & Floating HUD
      const hIdx = this.pfPerfHoverIdx;
      if (hIdx !== null && hIdx >= 0 && hIdx < n) {
        const hx = Math.round(xOf(hIdx)) + 0.5;
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        const hudParts = [hIdx === n - 1 ? 'LIVE' : d.dates[hIdx]];
        for (const ser of activeSeries) {
          const v = ser.data[hIdx];
          const py = yOf(v);
          ctx.fillStyle = '#090d14';
          ctx.strokeStyle = ser.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const vStr = isUsd ? formatUsd(v) : fmtSignPct(v);
          hudParts.push(`<span style="color:${ser.color}">${ser.label}: <strong>${vStr}</strong></span>`);
        }
        if (this.el.pfPerfHoverHud) {
          this.el.pfPerfHoverHud.innerHTML = hudParts.join(' &nbsp;·&nbsp; ');
        }
      } else if (this.el.pfPerfHoverHud) {
        const alphaStr = Number.isFinite(s.alphaVsSpy)
          ? `Alpha vs S&P 500: <strong style="color:${s.alphaVsSpy >= 0 ? 'var(--bull)' : 'var(--bear)'}">${fmtSignPct(s.alphaVsSpy)}</strong>`
          : '';
        this.el.pfPerfHoverHud.innerHTML = `${d.dates[0]} → LIVE ${alphaStr ? `&nbsp;·&nbsp; ${alphaStr}` : ''}`;
      }

      ctx.restore();
    }

    _renderPortfolioDonut(stats) {
      const canvas = this.el.pfDonutCanvas;
      const dpr = window.devicePixelRatio || 1;
      const layoutH = canvas.parentElement ? canvas.parentElement.clientHeight : 104;
      const layoutW = canvas.parentElement ? canvas.parentElement.clientWidth : 240;
      const maxByW = layoutW > 140 ? Math.floor(layoutW * 0.36) : 92;
      const size = Math.max(74, Math.min(104, layoutH > 40 ? layoutH - 6 : 92, maxByW));
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      }
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const lw = Math.max(12, Math.round(size * 0.115));
      const r = Math.max(28, size / 2 - lw / 2 - 4);

      if (stats.items.length === 0 || stats.totalValue <= 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#5a6c85';
        ctx.font = '600 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Holdings', cx, cy);
        ctx.restore();
        this.el.pfDonutLegend.innerHTML = '<div class="empty-state" style="padding:16px">Add a holding above to view live portfolio allocation.</div>';
        return;
      }

      const sorted = stats.items.slice().sort((a, b) => b.marketValue - a.marketValue);
      let startAng = -Math.PI / 2;
      const legendHtml = [];

      sorted.forEach((it, idx) => {
        const frac = it.marketValue / stats.totalValue;
        const sweep = frac * Math.PI * 2;
        const col = DONUT_PALETTE[idx % DONUT_PALETTE.length];

        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAng, startAng + Math.max(0.02, sweep - 0.025));
        ctx.stroke();
        startAng += sweep;

        legendHtml.push(`
          <div class="legend-item">
            <span class="legend-left">
              <span class="legend-swatch" style="background:${col}"></span>
              <strong>${it.ticker}</strong>
              <span class="dex-badge ${this._dexBadgeClass(it.dex)}">${it.dex}</span>
            </span>
            <span class="legend-val">${it.weight.toFixed(1)}% · $${formatCompact(it.marketValue)}</span>
          </div>
        `);
      });

      const valFontPx = size < 115 ? 11 : 12.5;
      const subFontPx = size < 115 ? 8.5 : 9.5;
      ctx.fillStyle = '#eef2f7';
      ctx.font = `700 ${valFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${formatCompact(stats.totalValue)}`, cx, cy - 5);
      ctx.fillStyle = '#7c8ea6';
      ctx.font = `600 ${subFontPx}px -apple-system, sans-serif`;
      ctx.fillText(`${sorted.length} ${sorted.length === 1 ? 'POSITION' : 'POSITIONS'}`, cx, cy + 9);

      ctx.restore();
      this.el.pfDonutLegend.innerHTML = legendHtml.join('');
    }

    _renderPortfolioPnlBars(stats) {
      if (stats.items.length === 0) {
        this.el.pfPnlBars.innerHTML = '<div class="empty-state" style="padding:18px">Live P/L attribution by stock will appear here.</div>';
        return;
      }
      const sorted = stats.items.slice().sort((a, b) => b.posTotalPnl - a.posTotalPnl);
      const maxAbs = Math.max(1, ...sorted.map((it) => Math.abs(it.posTotalPnl)));
      this.el.pfPnlBars.innerHTML = sorted
        .map((it) => {
          const pctW = Math.max(3, (Math.abs(it.posTotalPnl) / maxAbs) * 100);
          const up = it.posTotalPnl >= 0;
          return `
            <div class="pnl-bar-row">
              <strong>${it.ticker}</strong>
              <div class="pnl-bar-track">
                <div class="pnl-bar-fill ${up ? 'up' : 'down'}" style="width:${pctW.toFixed(1)}%"></div>
              </div>
              <span class="${up ? 'pct-up' : 'pct-down'}" style="text-align:right;font-family:var(--font-mono);font-weight:600">
                ${formatUsd(it.posTotalPnl, true)}
              </span>
            </div>
          `;
        })
        .join('');
    }

    setHoldingFormOpen(open, focusInput = false) {
      if (!this.el.pfFormCard) return;
      const shouldOpen = open || this.prefs.holdings.length === 0;
      this.el.pfFormCard.classList.toggle('hidden', !shouldOpen);
      if (this.el.btnToggleAddHolding) {
        this.el.btnToggleAddHolding.textContent = shouldOpen ? 'Hide Form' : '+ Add Holding';
      }
      if (shouldOpen && focusInput) {
        this.el.holdingSymbolInput?.focus();
      }
      requestAnimationFrame(() => {
        if (this.prefs.layout === 'portfolio') {
          this._drawPortfolioPerfChart();
          this._renderPortfolioDonut(this._computePortfolioStats());
        }
      });
    }

    _renderHoldingsTable(stats) {
      if (stats.items.length === 0) {
        this.setHoldingFormOpen(true);
        if (this.el.pfHoldingsHint) {
          this.el.pfHoldingsHint.textContent = 'Add your first holding above';
        }
        this.el.holdingsTableBody.innerHTML = `
          <tr>
            <td colspan="10" class="empty-state">
              Your portfolio is empty. Add your Hyperliquid stock holdings above (e.g. <strong>xyz:NVDA</strong>, <strong>xyz:TSLA</strong>, <strong>xyz:AAPL</strong>) to track live total value, 24h P/L, and total P/L in real time.
            </td>
          </tr>
        `;
        return;
      }

      if (this.el.pfHoldingsHint) {
        this.el.pfHoldingsHint.textContent = stats.items.length > 3
          ? `Showing top 3 of ${stats.items.length} · Scroll down for more ↓`
          : `${stats.items.length} ${stats.items.length === 1 ? 'holding' : 'holdings'} · Click any row for live chart`;
      }

      const sorted = stats.items.slice().sort((a, b) => b.marketValue - a.marketValue);
      this.el.holdingsTableBody.innerHTML = sorted
        .map((it) => {
          const cls24 = it.pos24hPnl >= 0 ? 'pct-up' : 'pct-down';
          const clsTot = it.posTotalPnl >= 0 ? 'pct-up' : 'pct-down';
          const s24 = it.pos24hPct >= 0 ? '+' : '';
          const sTot = it.posTotalPct >= 0 ? '+' : '';
          return `
            <tr data-symbol="${escHtml(it.symbol)}" data-id="${escHtml(it.id)}">
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <strong>${escHtml(it.ticker)}</strong>
                  <span class="dex-badge ${this._dexBadgeClass(it.dex)}">${escHtml(it.dex)}</span>
                </div>
                <div style="font-size:10.5px;color:var(--text-muted)">${escHtml(it.note || it.companyName || '')}</div>
              </td>
              <td><span class="side-pill ${it.side}">${it.side}</span></td>
              <td class="num">${it.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
              <td class="num">$${formatPrice(it.avgPrice)}</td>
              <td class="num" style="font-weight:700">$${formatPrice(it.livePrice)}</td>
              <td class="num" style="font-weight:700">${formatUsd(it.marketValue)}</td>
              <td class="num">
                <span class="weight-cell">
                  <span class="weight-mini-bar"><span class="weight-mini-fill" style="width:${Math.min(100, it.weight).toFixed(1)}%"></span></span>
                  ${it.weight.toFixed(1)}%
                </span>
              </td>
              <td class="num ${cls24}">
                <div>${formatUsd(it.pos24hPnl, true)}</div>
                <div style="font-size:10.5px">${s24}${it.pos24hPct.toFixed(2)}%</div>
              </td>
              <td class="num ${clsTot}">
                <div>${formatUsd(it.posTotalPnl, true)}</div>
                <div style="font-size:10.5px">${sTot}${it.posTotalPct.toFixed(2)}%</div>
              </td>
              <td class="num" style="white-space:nowrap">
                <button class="tbl-action-btn info" data-info="${it.symbol}" title="Open Live Stock Insights">Info</button>
                <button class="tbl-action-btn edit" data-edit="${it.id}">Edit</button>
                <button class="tbl-action-btn del" data-del="${it.id}">Del</button>
              </td>
            </tr>
          `;
        })
        .join('');

      this.el.holdingsTableBody.querySelectorAll('tr[data-symbol]').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const sym = tr.dataset.symbol;
          this.prefs.activeSymbol = sym;
          this.setLayout('single');
        });
      });

      this.el.holdingsTableBody.querySelectorAll('button[data-info]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.prefs.activeSymbol = btn.dataset.info;
          this.setLayout('insights');
        });
      });

      this.el.holdingsTableBody.querySelectorAll('button[data-edit]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const h = this.prefs.holdings.find((x) => x.id === btn.dataset.edit);
          if (!h) return;
          this.el.holdingEditId.value = h.id;
          const hm = this.markets.get(h.symbol);
          this.el.holdingSymbolInput.value = hm?.isSpot ? hm.ticker : h.symbol;
          this.el.holdingSide.value = h.side;
          this.el.holdingQty.value = h.qty;
          this.el.holdingAvgPrice.value = h.avgPrice;
          this.el.holdingNote.value = h.note || '';
          this.el.pfFormTitle.textContent = `Edit ${this._shortTicker(h.symbol)} Holding`;
          this.el.btnSubmitHolding.textContent = 'Save Changes';
          this.el.btnCancelEdit.classList.remove('hidden');
          this.setHoldingFormOpen(true);
          this.el.holdingQty.focus();
        });
      });

      this.el.holdingsTableBody.querySelectorAll('button[data-del]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.del;
          this.prefs.holdings = this.prefs.holdings.filter((x) => x.id !== id);
          if (this.el.holdingEditId.value === id) this._resetHoldingForm();
          this._persistPrefs();
          this.renderPortfolio(true);
          this.showToast('Holding removed');
        });
      });
    }

    _resetHoldingForm() {
      this.el.holdingEditId.value = '';
      this.el.holdingForm.reset();
      this.el.pfFormTitle.textContent = 'Add Portfolio Holding';
      this.el.btnSubmitHolding.textContent = 'Add Holding';
      this.el.btnCancelEdit.classList.add('hidden');
    }

    // MARK: Sidebar Rendering & Filtering

    renderMarketList() {
      const watchSet = new Set(this.prefs.watchlist);
      let list = Array.from(this.markets.values());

      if (this.activeTab === 'watchlist') {
        list = list.filter((m) => watchSet.has(m.id));
      } else if (this.activeTab === 'stock') {
        list = list.filter((m) => m.category === 'stock');
      } else if (this.activeTab === 'crypto') {
        list = list.filter((m) => m.category === 'crypto' && m.isSpot);
      } else if (this.activeTab === 'commodity_fx') {
        list = list.filter((m) => m.category === 'commodity_fx');
      } else if (this.activeTab === 'all') {
        list = list.filter((m) => !(m.category === 'crypto' && !m.isSpot));
      }

      if (this.selectedDex !== 'all') {
        list = list.filter((m) => m.dex === this.selectedDex);
      }

      if (this.searchQuery) {
        const q = this.searchQuery;
        list = list.filter(
          (m) =>
            m.ticker.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            m.companyName.toLowerCase().includes(q) ||
            m.dexLabel.toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => {
        if (this.sortBy === 'volume') return b.dayNtlVlm - a.dayNtlVlm;
        if (this.sortBy === 'change') return b.change24hPct - a.change24hPct;
        if (this.sortBy === 'price') return b.price - a.price;
        return a.ticker.localeCompare(b.ticker);
      });

      this.rowElements.clear();
      if (list.length === 0) {
        this.el.marketList.innerHTML =
          this.activeTab === 'watchlist'
            ? '<div class="empty-state">No stocks in Watchlist.<br/>Click ☆ next to any stock to pin it here.</div>'
            : '<div class="empty-state">No matching markets found.</div>';
        return;
      }

      const frag = document.createDocumentFragment();
      for (const m of list) {
        const starred = watchSet.has(m.id);
        const isActive = (this.prefs.layout === 'single' || this.prefs.layout === 'insights') && m.id === this.prefs.activeSymbol;
        const row = document.createElement('div');
        row.className = `market-row ${isActive ? 'active' : ''}`;
        row.dataset.id = m.id;

        const sign = m.change24hPct >= 0 ? '+' : '';
        const pctCls = m.change24hPct >= 0 ? 'pct-up' : 'pct-down';
        const subText = m.companyName || m.dexLabel;

        row.innerHTML = `
          <div class="row-left">
            <button class="star-btn ${starred ? 'starred' : ''}" title="${starred ? 'Remove from Watchlist' : 'Add to Watchlist'}">${starred ? '★' : '☆'}</button>
            <div class="row-info">
              <div class="row-title">
                <span class="row-ticker">${m.ticker}</span>
                <span class="dex-badge ${this._dexBadgeClass(m.dex)}">${m.dex}</span>
              </div>
              <div class="row-sub">${subText}</div>
            </div>
          </div>
          <div class="row-right">
            <div class="row-price">$${formatPrice(m.price)}</div>
            <div class="row-meta">
              <span class="${pctCls}">${sign}${m.change24hPct.toFixed(2)}%</span>
              <span class="row-vol">$${formatCompact(m.dayNtlVlm)}</span>
            </div>
          </div>
        `;

        row.querySelector('.star-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleWatchlist(m.id);
        });

        row.addEventListener('click', () => {
          if (this.mobileMarketsOpen) {
            this.mobileMarketsOpen = false;
            this._syncMobileTabbar();
          }
          if (this.prefs.layout === 'grid') {
            const pane = this.gridControllers[this.selectedGridIndex] || this.gridControllers[0];
            if (pane) this._loadGridPane(pane, m.id, pane.interval);
          } else if (this.prefs.layout === 'insights') {
            this.loadInsights(m.id);
          } else if (this.prefs.layout === 'portfolio') {
            this.prefs.activeSymbol = m.id;
            this.setLayout('single');
          } else if (this.prefs.layout === 'tools') {
            this.prefs.activeSymbol = m.id;
            this._highlightActiveRow();
            this.calcTools?.onSidebarSelect(m.id);
          } else {
            this.loadSingleChart(m.id, this.prefs.interval, this.prefs.activeRange);
          }
        });

        this.rowElements.set(m.id, {
          row,
          priceEl: row.querySelector('.row-price'),
          pctEl: row.querySelector('.row-meta span:first-child'),
        });
        frag.appendChild(row);
      }

      this.el.marketList.innerHTML = '';
      this.el.marketList.appendChild(frag);
    }

    _patchSidebarRow(m, dir) {
      const entry = this.rowElements.get(m.id);
      if (!entry) return;
      entry.priceEl.textContent = `$${formatPrice(m.price)}`;
      const sign = m.change24hPct >= 0 ? '+' : '';
      entry.pctEl.textContent = `${sign}${m.change24hPct.toFixed(2)}%`;
      entry.pctEl.className = m.change24hPct >= 0 ? 'pct-up' : 'pct-down';

      entry.row.classList.remove('flash-up', 'flash-down');
      void entry.row.offsetWidth;
      entry.row.classList.add(dir === 'up' ? 'flash-up' : 'flash-down');
    }

    _highlightActiveRow() {
      for (const [id, entry] of this.rowElements.entries()) {
        entry.row.classList.toggle('active', id === this.prefs.activeSymbol);
      }
    }

    toggleWatchlist(symbolId) {
      const idx = this.prefs.watchlist.indexOf(symbolId);
      if (idx >= 0) this.prefs.watchlist.splice(idx, 1);
      else this.prefs.watchlist.unshift(symbolId);
      this._persistPrefs();
      this.renderMarketList();
      this._renderActiveHeader();
    }

    // MARK: Active Header, HUD, Order Book & Trades

    _renderActiveHeader(flashDir = null) {
      const m = this.markets.get(this.prefs.activeSymbol);
      if (!m) return;

      const starred = this.prefs.watchlist.includes(m.id);
      this.el.btnStarActive.textContent = starred ? '★' : '☆';
      this.el.btnStarActive.classList.toggle('starred', starred);

      this.el.activeTicker.textContent = m.ticker;
      this.el.activeDexBadge.textContent = m.dex;
      this.el.activeDexBadge.className = `dex-badge ${this._dexBadgeClass(m.dex)}`;
      this.el.activeCompany.textContent = m.companyName ? `${m.companyName} · ${m.dexLabel}` : `${m.dexLabel} ${m.isSpot ? 'Spot' : 'Perp'}`;

      this.el.activePrice.textContent = `$${formatPrice(m.price)}`;
      if (flashDir === 'up') {
        this.el.activePrice.style.color = 'var(--bull)';
        setTimeout(() => (this.el.activePrice.style.color = ''), 320);
      } else if (flashDir === 'down') {
        this.el.activePrice.style.color = 'var(--bear)';
        setTimeout(() => (this.el.activePrice.style.color = ''), 320);
      }

      const up = m.change24h >= 0;
      const sign = up ? '+' : '-';
      this.el.activeChange.textContent = `${sign}$${formatPrice(Math.abs(m.change24h))} (${up ? '+' : ''}${m.change24hPct.toFixed(2)}%)`;
      this.el.activeChange.className = `big-change ${up ? 'up' : 'down'}`;

      this.el.statOracle.textContent = `$${formatPrice(m.oraclePx)}`;
      this.el.statMark.textContent = `$${formatPrice(m.markPx)}`;
      this.el.statVol.textContent = `$${formatCompact(m.dayNtlVlm)}`;
      if (m.isSpot) {
        this.el.statOI.textContent = 'Spot';
        this.el.statFunding.textContent = '0.0000%';
        this.el.statFunding.style.color = 'var(--text-secondary)';
        this.el.statLev.textContent = '1x Spot';
      } else {
        this.el.statOI.textContent = `$${formatCompact(m.openInterestUsd)}`;
        const fundPct = m.funding * 100;
        const fSign = fundPct >= 0 ? '+' : '';
        this.el.statFunding.textContent = `${fSign}${fundPct.toFixed(4)}%`;
        this.el.statFunding.style.color = fundPct >= 0 ? 'var(--bull)' : 'var(--bear)';
        this.el.statLev.textContent = `${m.maxLeverage}x`;
      }
    }

    _renderOhlcHud(info) {
      this._lastHoverInfo = info;
      if (!info || !info.candle) {
        this.el.ohlcHud.innerHTML = '';
        this._renderCompareLegendBar(null);
        return;
      }
      this._renderCompareLegendBar(info.compareItems || null, info.compareAnchorTime || null, info.interval || this.prefs.interval);
      const c = info.candle;
      const diff = c.c - c.o;
      const pct = c.o > 0 ? (diff / c.o) * 100 : 0;
      const col = diff >= 0 ? 'var(--bull)' : 'var(--bear)';
      const sign = diff >= 0 ? '+' : '';

      let extra = '';
      if (this.prefs.indicators.pe && info.pe != null) {
        extra += `<span class="hud-item" style="color:var(--accent)">P/E<b>${info.pe.toFixed(1)}x</b></span>`;
      }
      if (this.prefs.indicators.ema20 && info.ema20 != null) {
        extra += `<span class="hud-item" style="color:var(--cyan)">EMA20<b>${formatPrice(info.ema20)}</b></span>`;
      }
      if (this.prefs.indicators.ema50 && info.ema50 != null) {
        extra += `<span class="hud-item" style="color:var(--amber)">EMA50<b>${formatPrice(info.ema50)}</b></span>`;
      }
      if (this.prefs.indicators.sma100 && info.sma100 != null) {
        extra += `<span class="hud-item" style="color:#22d3ee">SMA100<b>${formatPrice(info.sma100)}</b></span>`;
      }
      if (this.prefs.indicators.sma200 && info.sma200 != null) {
        extra += `<span class="hud-item" style="color:#f472b6">SMA200<b>${formatPrice(info.sma200)}</b></span>`;
      }
      if (this.prefs.indicators.vwap && info.vwap != null) {
        extra += `<span class="hud-item" style="color:#e2e8f0">VWAP<b>${formatPrice(info.vwap)}</b></span>`;
      }
      if (this.prefs.indicators.rsi && info.rsi != null) {
        extra += `<span class="hud-item" style="color:#c084fc">RSI<b>${info.rsi.toFixed(1)}</b></span>`;
      }
      if (this.prefs.indicators.stoch && info.stochK != null) {
        extra += `<span class="hud-item" style="color:#fb923c">STOCH<b>${info.stochK.toFixed(0)}/${(info.stochD ?? info.stochK).toFixed(0)}</b></span>`;
      }
      if (this.prefs.indicators.atr && info.atr != null) {
        extra += `<span class="hud-item" style="color:#f59e0b">ATR<b>${formatPrice(info.atr)}</b></span>`;
      }

      this.el.ohlcHud.innerHTML = `
        <span class="hud-item">O<b style="color:${col}">${formatPrice(c.o)}</b></span>
        <span class="hud-item">H<b style="color:${col}">${formatPrice(c.h)}</b></span>
        <span class="hud-item">L<b style="color:${col}">${formatPrice(c.l)}</b></span>
        <span class="hud-item">C<b style="color:${col}">${formatPrice(c.c)}</b></span>
        <span class="hud-item"><b style="color:${col}">${sign}${pct.toFixed(2)}%</b></span>
        <span class="hud-item">Vol<b>${formatCompact(c.v)}</b></span>
        ${extra}
      `;
    }

    _renderOrderBook(bids, asks) {
      const topAsks = asks.slice(0, 9).reverse();
      const topBids = bids.slice(0, 9);

      let maxSz = 0;
      for (const a of topAsks) maxSz = Math.max(maxSz, parseFloat(a.sz) || 0);
      for (const b of topBids) maxSz = Math.max(maxSz, parseFloat(b.sz) || 0);
      if (maxSz <= 0) maxSz = 1;

      this.el.bookAsks.innerHTML = topAsks
        .map((a) => {
          const px = parseFloat(a.px);
          const sz = parseFloat(a.sz);
          const pct = Math.min(100, (sz / maxSz) * 100);
          return `<div class="book-row ask"><div class="book-depth" style="width:${pct.toFixed(1)}%"></div><span>${formatPrice(px)}</span><span>${formatCompact(sz)}</span></div>`;
        })
        .join('');

      this.el.bookBids.innerHTML = topBids
        .map((b) => {
          const px = parseFloat(b.px);
          const sz = parseFloat(b.sz);
          const pct = Math.min(100, (sz / maxSz) * 100);
          return `<div class="book-row bid"><div class="book-depth" style="width:${pct.toFixed(1)}%"></div><span>${formatPrice(px)}</span><span>${formatCompact(sz)}</span></div>`;
        })
        .join('');

      if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0].px);
        const bestAsk = parseFloat(asks[0].px);
        const mid = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;
        const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;
        this.el.bookMidPrice.textContent = `$${formatPrice(mid)}`;
        this.el.bookSpread.textContent = `Spread ${spreadBps.toFixed(1)} bps`;
      }
    }

    _renderTrades() {
      this.el.tradesList.innerHTML = this.recentTrades
        .slice(0, 32)
        .map((t) => {
          const d = new Date(t.time);
          const ts = d.toTimeString().slice(0, 8);
          const cls = t.side === 'B' ? 'buy' : 'sell';
          return `<div class="trade-row ${cls}"><span>${formatPrice(t.px)}</span><span>${formatCompact(t.sz)}</span><span>${ts}</span></div>`;
        })
        .join('');
    }

    // MARK: Price Alerts

    _syncActiveAlertsToChart() {
      const activeAlerts = this.prefs.alerts.filter((a) => a.symbol === this.prefs.activeSymbol);
      this.mainChart?.setAlerts(activeAlerts);
      this.el.btnAlertToggle.classList.toggle('has-alerts', activeAlerts.length > 0);
      this.el.alertCountBadge.textContent = String(activeAlerts.length);
      this.el.alertCountBadge.classList.toggle('hidden', activeAlerts.length === 0);
    }

    renderAlertPopoverList() {
      const list = this.prefs.alerts.filter((a) => a.symbol === this.prefs.activeSymbol);
      if (list.length === 0) {
        this.el.alertList.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">No active alerts for this stock.</div>';
        return;
      }
      this.el.alertList.innerHTML = list
        .map(
          (a) => `
        <div class="alert-item">
          <span>${a.direction === 'above' ? '▲ Above' : '▼ Below'} $${formatPrice(a.price)}</span>
          <button class="alert-del" data-id="${a.id}" title="Delete alert">×</button>
        </div>
      `
        )
        .join('');

      this.el.alertList.querySelectorAll('.alert-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.prefs.alerts = this.prefs.alerts.filter((a) => a.id !== btn.dataset.id);
          this._persistPrefs();
          this.renderAlertPopoverList();
          this._syncActiveAlertsToChart();
        });
      });
    }

    _checkPriceAlerts(symbol, price) {
      if (this.prefs.alerts.length === 0) return;
      let triggeredAny = false;
      const remaining = [];
      for (const al of this.prefs.alerts) {
        if (al.symbol !== symbol) {
          remaining.push(al);
          continue;
        }
        const hit =
          (al.direction === 'above' && price >= al.price) ||
          (al.direction === 'below' && price <= al.price);
        if (hit) {
          triggeredAny = true;
          playAlertSound();
          const arrow = al.direction === 'above' ? '▲' : '▼';
          this.showToast(
            `PRICE ALERT: ${arrow} ${this._shortTicker(symbol)} hit $${formatPrice(price)} (target $${formatPrice(al.price)})`,
            true
          );
        } else {
          remaining.push(al);
        }
      }
      if (triggeredAny) {
        this.prefs.alerts = remaining;
        this._persistPrefs();
        this._syncActiveAlertsToChart();
        if (!this.el.alertPopover.classList.contains('hidden')) {
          this.renderAlertPopoverList();
        }
      }
    }

    _dexBadgeClass(dex) {
      if (dex === 'spot') return 'dex-spot';
      if (dex === 'xyz') return 'dex-xyz';
      return '';
    }

    _shortTicker(id) {
      const m = this.markets.get(id);
      if (m?.ticker) return m.ticker;
      return resolveCoinTicker(id);
    }

    // MARK: Universal First-Launch Legal Disclosure Gate (macOS, Windows, Android, iOS & Web)

    _legalVersion() {
      return '2026-11-27-v2';
    }

    _getLegalStore() {
      try {
        return window.HS_LEGAL_STORAGE === 'session' ? window.sessionStorage : window.localStorage;
      } catch (_) {
        return null;
      }
    }

    _hasLocalLegalConsent() {
      const store = this._getLegalStore();
      const ver = this._legalVersion();
      if (!store) return false;
      for (const key of ['HyperStocksLegalConsentV1', 'HyperStocksWebLegalConsentV1']) {
        try {
          const raw = store.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === ver && parsed.accepted === true) return true;
        } catch (_) {}
      }
      return false;
    }

    _hasLegalConsent() {
      return this._hasLocalLegalConsent() || this.prefs?.legalConsentVersion === this._legalVersion();
    }

    _saveLegalConsent() {
      const ver = this._legalVersion();
      const payload = JSON.stringify({
        version: ver,
        accepted: true,
        acceptedAt: new Date().toISOString(),
      });
      const store = this._getLegalStore();
      if (store) {
        try {
          store.setItem('HyperStocksLegalConsentV1', payload);
          store.setItem('HyperStocksWebLegalConsentV1', payload);
        } catch (_) {}
      }
      if (this.prefs) {
        this.prefs.legalConsentVersion = ver;
        this._persistPrefs();
      }
    }

    _clearLegalConsent() {
      for (const s of [window.localStorage, window.sessionStorage]) {
        try {
          s.removeItem('HyperStocksLegalConsentV1');
          s.removeItem('HyperStocksWebLegalConsentV1');
        } catch (_) {}
      }
      if (this.prefs) {
        this.prefs.legalConsentVersion = null;
        this._persistPrefs();
      }
    }

    _setAppLegalLocked(locked) {
      if (locked && document.activeElement && document.activeElement.blur) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      document.body.classList.toggle('hs-legal-locked', locked);
      const appEl = document.getElementById('app');
      if (appEl) {
        if (locked) {
          appEl.setAttribute('aria-hidden', 'true');
          appEl.setAttribute('inert', '');
        } else {
          appEl.removeAttribute('aria-hidden');
          appEl.removeAttribute('inert');
        }
      }
    }

    _initLegalGateEarly() {
      const openReview = (e) => {
        if (e) e.preventDefault();
        this.el.iosModeSheet?.classList.add('hidden');
        this._openLegalGate(this._hasLegalConsent());
      };
      document.getElementById('btnLegalDisclosure')?.addEventListener('click', openReview);
      document.getElementById('btnIosLegalLink')?.addEventListener('click', openReview);
      window.openHyperStocksLegalGate = () => this._openLegalGate(this._hasLegalConsent());

      if (!this._hasLocalLegalConsent()) {
        this._openLegalGate(false);
      }
    }

    _syncLegalGateAfterPrefs() {
      // If native UserDefaults / Windows prefs already recorded consent for this version, sync localStorage & unlock
      if (this.prefs?.legalConsentVersion === this._legalVersion() && !this._hasLocalLegalConsent()) {
        this._saveLegalConsent();
        const overlay = document.getElementById('hsLegalGate');
        if (overlay) overlay.classList.add('hidden');
        this._setAppLegalLocked(false);
      }
    }

    _openLegalGate(isReviewMode = false) {
      let overlay = document.getElementById('hsLegalGate');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hsLegalGate';
        overlay.className = 'hs-legal-backdrop hidden';
        document.body.appendChild(overlay);
      }
      overlay.onclick = null;

      const isHostedWeb =
        Boolean(window.HS_STATIC_WEB) ||
        (window.location.protocol === 'https:' && !window.webkit?.messageHandlers?.hlInfo);
      const appLabel = isHostedWeb ? 'HyperStocks Web' : 'HyperStocks';
      const siteBase = isHostedWeb ? '' : 'https://mjqsk.github.io/hyperstocks-site/';
      const termsHref = `${siteBase}terms.html`;
      const privacyHref = `${siteBase}privacy.html`;
      const supportHref = `${siteBase}support.html`;

      overlay.innerHTML = `
        <div class="hs-legal-card" role="dialog" aria-modal="true" aria-labelledby="hsLegalTitle">
          <div class="hs-legal-head">
            <div class="hs-legal-badge">Required Legal Disclosure &amp; Risk Warning</div>
            <h2 id="hsLegalTitle">${appLabel} Terms, Risk Warning &amp; Liability Disclaimer</h2>
            <div class="hs-legal-meta">Effective November 27, 2026 · Version 1.0 · Please read carefully before accessing ${appLabel}</div>
          </div>
          <div class="hs-legal-body" id="hsLegalScroll">
            <div class="hs-legal-callout">
              <strong>Notice Before Proceeding (Not-for-Profit Educational &amp; Teaching Resource Only):</strong> HyperStocks and its web and downloadable applications are strictly <strong>not-for-profit, non-commercial educational and teaching resources</strong> created for learning and classroom study. This application does <strong>not</strong> provide financial, investment, trading, tax, accounting, or legal advice, and does <strong>not</strong> execute trades or hold funds. By continuing, you accept all risks and acknowledge that the creator, developer, operator, and contributors assume zero liability and you waive all claims against them.
            </div>
            <div class="hs-legal-sec">
              <h3>1. Not-for-Profit Educational &amp; Teaching Use Only (No Financial Advice)</h3>
              <p>This application, website, and all related downloads (.dmg, .exe, .apk, and mobile builds) are operated strictly on a not-for-profit, non-commercial basis solely as educational and teaching resources. All displayed quotes, candlestick charts, technical indicators, multi-asset comparisons, valuation metrics, analyst summaries, benchmark proxies, portfolio calculations, and trading calculator outputs are provided purely for instructional and informational purposes. Nothing displayed constitutes a solicitation, recommendation, endorsement, or offer to buy, sell, or hold any stock, security, cryptocurrency, perpetual contract, derivative, or other financial instrument. No fiduciary, advisory, client, or professional relationship is created by your use of HyperStocks.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>2. Not a Broker, Exchange, or Regulated Advisor</h3>
              <p>HyperStocks does not execute orders, route transactions, connect wallets, hold customer funds, or provide brokerage, exchange, custody, or investment advisory services. Neither HyperStocks nor its creator, developer, operator, or contributors are registered as a broker-dealer, investment advisor, commodity trading advisor, or financial institution with the SEC, CFTC, FINRA, MAS, FCA, or any other regulatory authority in any jurisdiction.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>3. Third-Party Data Accuracy, Synthetic Markets &amp; Delays</h3>
              <p>Market data displayed in HyperStocks streams directly from third-party public APIs, including Hyperliquid public perpetual and spot feeds and, in native builds, publicly accessible historical market and filing endpoints. Decentralized perpetual contracts, synthetic stock proxies, and composite benchmarks (such as equal-weighted Magnificent 7 or 24/7 MSCI World proxies) can diverge materially from official prices on regulated stock exchanges (including NYSE and NASDAQ), especially during off-hours, weekends, low-liquidity periods, corporate actions, or stock splits. Data and calculations may be delayed, incomplete, interrupted, stale, mispriced, or contain software or rounding errors. You must independently verify all prices, metrics, and filings with licensed brokers, regulated exchanges, and official disclosures before making any financial decision.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>4. Substantial Risk of Financial Loss</h3>
              <p>Trading equities, digital assets, perpetual futures, and leveraged derivatives involves significant risk and can result in the rapid and complete loss of your capital. Past performance, backtested or historical benchmark comparisons, and calculator simulations are not indicative of future results. You are solely responsible for your own investment research, risk management, tax reporting, and trading decisions.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>5. No Affiliation or Endorsement</h3>
              <p>HyperStocks is an independent, non-commercial educational project and is not affiliated with, sponsored by, endorsed by, or officially connected to Hyperliquid, any HIP-3 deployer, Apple, Google, Microsoft, NASDAQ, S&amp;P Dow Jones Indices, MSCI, or any company, ETF, exchange, or index referenced in the app. All third-party names, tickers, and trademarks remain the property of their respective owners.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>6. Experimental Software, Device Risk &amp; Disclaimer of Warranties</h3>
              <p>HyperStocks (including the website and all downloadable .dmg, .exe, .apk, and mobile builds) is independent, experimental software provided strictly on an "as is" and "as available" basis without warranties of any kind, whether express, implied, or statutory, including without limitation implied warranties of merchantability, fitness for a particular purpose, accuracy, reliability, compatibility, security updates, uninterrupted operation, or non-infringement. You access, download, install, and run HyperStocks strictly at your own sole risk, and the creator, developer, operator, and contributors are not responsible for any damage to, incompatibility with, or impact on your computer, phone, tablet, watch, operating system, hardware, battery, network, other apps, or stored files and data.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>7. Zero Liability &amp; Release of Claims</h3>
              <p>Under no circumstances and under no legal theory (whether in contract, tort, negligence, strict liability, or otherwise) shall the creator, developer, operator, or contributors of HyperStocks have any liability whatsoever for any direct, indirect, incidental, special, consequential, exemplary, or punitive damages, including trading losses, lost profits, lost opportunities, device or system damage, data loss, or business interruption, arising out of or relating to your access to, use of, inability to use, or reliance upon HyperStocks or any data or calculations shown here. Your sole and exclusive remedy for dissatisfaction with HyperStocks is to stop using it.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>8. Indemnification</h3>
              <p>You agree to defend, indemnify, and hold harmless the creator, developer, operator, and contributors of HyperStocks from and against any claims, demands, damages, losses, liabilities, costs, or expenses (including reasonable legal fees) arising out of or related to your use or misuse of HyperStocks, your reliance on any displayed data, your violation of these terms, or your violation of any law or third-party right.</p>
            </div>
            <div class="hs-legal-sec">
              <h3>9. Local Law Compliance, Privacy, Severability &amp; Changes</h3>
              <p>You are solely responsible for confirming that accessing HyperStocks and viewing decentralized market data is lawful in your country or region, and you confirm you are of legal age of majority (or have required guardian consent) to accept these terms. No accounts, logins, or personal tracking are used, and any watchlist or portfolio entries you enter stay stored locally on your own device or browser. If any portion of these terms is held unenforceable under local law, all remaining provisions continue in full force and effect. The operator may update, restrict, or discontinue HyperStocks or these terms at any time without notice.</p>
            </div>
          </div>
          <div class="hs-legal-foot">
            <div class="hs-legal-checks">
              <label class="hs-legal-check">
                <input type="checkbox" id="hsLegalChk1" ${isReviewMode ? 'checked' : ''} />
                <span>I have read, understood, and agree to this Legal Disclosure, the <a href="${termsHref}" target="_blank" rel="noopener noreferrer">Terms of Use</a>, and the <a href="${privacyHref}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>
              </label>
              <label class="hs-legal-check">
                <input type="checkbox" id="hsLegalChk2" ${isReviewMode ? 'checked' : ''} />
                <span>I acknowledge HyperStocks is strictly a not-for-profit educational and teaching resource, provides no financial or investment advice, and I assume sole responsibility and risk for any decisions I make.</span>
              </label>
            </div>
            <div class="hs-legal-actions">
              <div class="hs-legal-links">
                <a href="${termsHref}" target="_blank" rel="noopener noreferrer">Full Terms</a>
                <a href="${privacyHref}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                <a href="${supportHref}" target="_blank" rel="noopener noreferrer">About &amp; Support</a>
              </div>
              <div class="hs-legal-btns">
                <button type="button" class="hs-legal-btn decline" id="hsLegalDecline">${isReviewMode ? 'Revoke &amp; Lock' : 'Decline'}</button>
                <button type="button" class="hs-legal-btn agree" id="hsLegalAgree" ${isReviewMode ? '' : 'disabled'}>${isReviewMode ? 'Confirm &amp; Return' : (isHostedWeb ? 'I Agree &amp; Enter Site' : 'I Agree &amp; Continue')}</button>
              </div>
            </div>
          </div>
        </div>`;

      overlay.classList.remove('hidden');
      this._setAppLegalLocked(true);

      const chk1 = document.getElementById('hsLegalChk1');
      const chk2 = document.getElementById('hsLegalChk2');
      const btnAgree = document.getElementById('hsLegalAgree');
      const btnDecline = document.getElementById('hsLegalDecline');
      const syncBtn = () => {
        if (btnAgree) btnAgree.disabled = !(chk1 && chk1.checked && chk2 && chk2.checked);
      };
      chk1?.addEventListener('change', syncBtn);
      chk2?.addEventListener('change', syncBtn);
      syncBtn();

      btnAgree?.addEventListener('click', () => {
        if (!(chk1 && chk1.checked && chk2 && chk2.checked)) return;
        this._saveLegalConsent();
        overlay.classList.add('hidden');
        this._setAppLegalLocked(false);
        window.dispatchEvent(new Event('resize'));
      });

      btnDecline?.addEventListener('click', () => {
        this._clearLegalConsent();
        overlay.innerHTML = `
          <div class="hs-legal-card" role="dialog" aria-modal="true" aria-labelledby="hsDeclinedTitle">
            <div class="hs-legal-declined">
              <div class="hs-legal-badge">Access Declined</div>
              <h3 id="hsDeclinedTitle">You must accept the Legal Disclosure to use ${appLabel}</h3>
              <p>Because you declined the legal disclosure and terms of use, access to ${appLabel} remains locked. You may close this ${isHostedWeb ? 'browser tab' : 'application'} or review the disclosure again below.</p>
              <div class="hs-legal-btns" style="margin-left:0;margin-top:6px">
                ${isHostedWeb ? `<a href="${supportHref}" class="hs-legal-btn decline" style="text-decoration:none">About &amp; Support</a>` : ''}
                <button type="button" class="hs-legal-btn agree" id="hsLegalReviewAgain">Review Disclosure Again</button>
              </div>
            </div>
          </div>`;
        document.getElementById('hsLegalReviewAgain')?.addEventListener('click', () => {
          this._openLegalGate(false);
        });
      });
    }

    showToast(message, isAlert = false) {
      const el = document.createElement('div');
      el.className = `toast ${isAlert ? 'alert-toast' : ''}`;
      el.textContent = message;
      this.el.toastContainer.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.25s ease';
        setTimeout(() => el.remove(), 260);
      }, isAlert ? 6500 : 2800);
    }
  }

  const app = new HyperStocksApp();
  app.init();
})(window);
