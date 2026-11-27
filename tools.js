/* HyperStocks — Live-Priced Trading Calculator Suite (Cash/Shares, Stock Swap, DCA, Risk Sizing, Profit Target) */
(function (global) {
  const HS = (global.HS = global.HS || {});

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(val, showSign = false) {
    if (!Number.isFinite(val)) return '—';
    const sign = val < 0 ? '-' : (showSign && val > 0 ? '+' : '');
    const abs = Math.abs(val);
    return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtPx(val) {
    if (!Number.isFinite(val) || val <= 0) return '—';
    if (typeof HS.formatPrice === 'function') return `$${HS.formatPrice(val)}`;
    return `$${val.toFixed(val >= 10 ? 2 : 4)}`;
  }

  function fmtShares(val, maxDec = 4) {
    if (!Number.isFinite(val)) return '—';
    const abs = Math.abs(val);
    const dec = abs >= 1000 ? 2 : (abs >= 10 ? 3 : maxDec);
    return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec });
  }

  function fmtPct(val, showSign = true) {
    if (!Number.isFinite(val)) return '—';
    const sign = val > 0 && showSign ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  }

  function rawPxString(val) {
    if (!Number.isFinite(val) || val <= 0) return '';
    return val >= 100 ? val.toFixed(2) : (val >= 1 ? val.toFixed(3) : val.toFixed(5));
  }

  // MARK: Pure Mathematical Engines (Exported for Unit Testing)

  const CalcMath = {
    cashAndShares({ mode, price, qty, cashBudget, leverage = 1, feeBps = 0 }) {
      const P = Number(price);
      const L = Math.max(1, Number(leverage) || 1);
      const f = Math.max(0, Number(feeBps) || 0) / 10000;
      if (!Number.isFinite(P) || P <= 0) return { valid: false, error: 'Enter a valid stock price.' };

      if (mode === 'cash_to_shares') {
        const B = Number(cashBudget);
        if (!Number.isFinite(B) || B <= 0) return { valid: false, error: 'Enter a cash budget greater than $0.' };
        const denom = P * (1 / L + f);
        const exactShares = denom > 0 ? B / denom : 0;
        const wholeShares = Math.floor(exactShares);
        const notional = exactShares * P;
        const marginReq = notional / L;
        const fee = notional * f;
        const wholeNotional = wholeShares * P;
        const wholeCashUsed = wholeNotional * (1 / L + f);
        const leftoverCash = Math.max(0, B - wholeCashUsed);
        return {
          valid: true,
          mode,
          price: P,
          leverage: L,
          feeBps: f * 10000,
          exactShares,
          wholeShares,
          notional,
          marginReq,
          fee,
          totalCash: B,
          wholeNotional,
          wholeCashUsed,
          leftoverCash,
          effectivePrice: exactShares > 0 ? (notional + fee) / exactShares : P,
        };
      }

      // Default: shares_to_cash
      const Q = Number(qty);
      if (!Number.isFinite(Q) || Q <= 0) return { valid: false, error: 'Enter a share quantity greater than 0.' };
      const notional = Q * P;
      const marginReq = notional / L;
      const fee = notional * f;
      const totalCash = marginReq + fee;
      return {
        valid: true,
        mode: 'shares_to_cash',
        price: P,
        leverage: L,
        feeBps: f * 10000,
        exactShares: Q,
        wholeShares: Math.floor(Q),
        notional,
        marginReq,
        fee,
        totalCash,
        effectivePrice: (notional + fee) / Q,
      };
    },

    stockSwap({ direction, inputUnit, amount, buyPrice, sellPrice, feeBps = 0, extraCash = 0, ownedSellShares = null, ownedSellAvg = null }) {
      const Pb = Number(buyPrice);
      const Ps = Number(sellPrice);
      const f = Math.min(0.25, Math.max(0, Number(feeBps) || 0) / 10000);
      const addCash = Math.max(0, Number(extraCash) || 0);
      const amt = Number(amount);

      if (!Number.isFinite(Pb) || Pb <= 0) return { valid: false, error: 'Enter a valid Buy stock price.' };
      if (!Number.isFinite(Ps) || Ps <= 0) return { valid: false, error: 'Enter a valid Sell stock price.' };
      if (!Number.isFinite(amt) || amt <= 0) return { valid: false, error: 'Enter an amount greater than 0.' };

      if (direction === 'sell_to_buy') {
        let sellShares = 0;
        if (inputUnit === 'usd') {
          sellShares = amt / Ps;
        } else if (inputUnit === 'pct') {
          if (!Number.isFinite(ownedSellShares) || ownedSellShares <= 0) {
            return { valid: false, error: 'Select a portfolio holding to sell by percentage.' };
          }
          sellShares = ownedSellShares * (Math.min(100, amt) / 100);
        } else {
          sellShares = amt;
        }
        const sellNotional = sellShares * Ps;
        const sellFee = sellNotional * f;
        const netProceeds = sellNotional - sellFee + addCash;
        const exactBuyShares = netProceeds / (Pb * (1 + f));
        const wholeBuyShares = Math.floor(exactBuyShares);
        const buyNotional = exactBuyShares * Pb;
        const buyFee = buyNotional * f;
        const wholeBuyCost = wholeBuyShares * Pb * (1 + f);
        const residualCash = Math.max(0, netProceeds - wholeBuyCost);
        const ratio = Ps / Pb; // 1 sell share = X buy shares

        const holdingImpact = (Number.isFinite(ownedSellShares) && ownedSellShares > 0) ? {
          owned: ownedSellShares,
          pctSold: (sellShares / ownedSellShares) * 100,
          remaining: ownedSellShares - sellShares,
          shortfallShares: Math.max(0, sellShares - ownedSellShares),
          shortfallUsd: Math.max(0, sellShares - ownedSellShares) * Ps,
          realizedPnl: Number.isFinite(ownedSellAvg) ? sellShares * (Ps - ownedSellAvg) : null,
        } : null;

        return {
          valid: true,
          direction,
          buyPrice: Pb,
          sellPrice: Ps,
          sellShares,
          wholeSellShares: Math.ceil(sellShares),
          sellNotional,
          buyShares: exactBuyShares,
          wholeBuyShares,
          buyNotional,
          netProceeds,
          totalFees: sellFee + buyFee,
          residualCash,
          extraCash: addCash,
          swapRatioBuyToSell: Pb / Ps,
          swapRatioSellToBuy: ratio,
          holdingImpact,
        };
      }

      // Default: buy_to_sell ("I want to buy X shares / $Y of Buy stock — how many shares of Sell stock do I sell?")
      const buyShares = inputUnit === 'usd' ? amt / Pb : amt;
      const buyNotional = buyShares * Pb;
      const buyFee = buyNotional * f;
      const totalBuyCost = buyNotional + buyFee;
      const netFromSaleNeeded = Math.max(0, totalBuyCost - addCash);
      const exactSellShares = netFromSaleNeeded / (Ps * (1 - f));
      const wholeSellShares = Math.ceil(exactSellShares);
      const sellNotional = exactSellShares * Ps;
      const sellFee = sellNotional * f;
      const wholeSellNet = wholeSellShares * Ps * (1 - f);
      const residualCash = Math.max(0, wholeSellNet + addCash - totalBuyCost);

      const holdingImpact = (Number.isFinite(ownedSellShares) && ownedSellShares > 0) ? {
        owned: ownedSellShares,
        pctSold: (exactSellShares / ownedSellShares) * 100,
        remaining: ownedSellShares - exactSellShares,
        shortfallShares: Math.max(0, exactSellShares - ownedSellShares),
        shortfallUsd: Math.max(0, exactSellShares - ownedSellShares) * Ps,
        realizedPnl: Number.isFinite(ownedSellAvg) ? exactSellShares * (Ps - ownedSellAvg) : null,
      } : null;

      return {
        valid: true,
        direction: 'buy_to_sell',
        buyPrice: Pb,
        sellPrice: Ps,
        buyShares,
        buyNotional,
        totalBuyCost,
        netFromSaleNeeded,
        sellShares: exactSellShares,
        wholeSellShares,
        sellNotional,
        totalFees: buyFee + sellFee,
        residualCash,
        extraCash: addCash,
        swapRatioBuyToSell: Pb / Ps,
        swapRatioSellToBuy: Ps / Pb,
        holdingImpact,
      };
    },

    dcaAverageDown({ currentQty, currentAvg, addMode, addAmount, buyPrice, livePrice, targetAvg }) {
      const Q0 = Number(currentQty);
      const P0 = Number(currentAvg);
      const Pb = Number(buyPrice);
      const Plive = Number.isFinite(Number(livePrice)) && Number(livePrice) > 0 ? Number(livePrice) : Pb;
      const amt = Number(addAmount);

      if (!Number.isFinite(Q0) || Q0 <= 0) return { valid: false, error: 'Enter your current shares (> 0).' };
      if (!Number.isFinite(P0) || P0 <= 0) return { valid: false, error: 'Enter your current average cost (> $0).' };
      if (!Number.isFinite(Pb) || Pb <= 0) return { valid: false, error: 'Enter a valid buy price.' };

      const oldCost = Q0 * P0;
      const addShares = (Number.isFinite(amt) && amt > 0) ? (addMode === 'usd' ? amt / Pb : amt) : 0;
      const addCash = addShares * Pb;
      const newQty = Q0 + addShares;
      const newCost = oldCost + addCash;
      const newAvg = newQty > 0 ? newCost / newQty : P0;
      const avgDelta = newAvg - P0;
      const avgDeltaPct = (avgDelta / P0) * 100;
      const oldBreakevenPct = Plive > 0 ? ((P0 - Plive) / Plive) * 100 : 0;
      const newBreakevenPct = Plive > 0 ? ((newAvg - Plive) / Plive) * 100 : 0;

      // Reverse Target Avg Solver
      let targetResult = null;
      const T = Number(targetAvg);
      if (Number.isFinite(T) && T > 0) {
        const betweenDown = Pb < T && T < P0;
        const betweenUp = P0 < T && T < Pb;
        if (betweenDown || betweenUp) {
          const sharesReq = (Q0 * (P0 - T)) / (T - Pb);
          targetResult = {
            reachable: true,
            targetAvg: T,
            sharesNeeded: sharesReq,
            cashNeeded: sharesReq * Pb,
            resultingTotalShares: Q0 + sharesReq,
          };
        } else {
          const lo = Math.min(P0, Pb);
          const hi = Math.max(P0, Pb);
          targetResult = {
            reachable: false,
            reason: `Target avg must be strictly between ${fmtPx(lo)} and ${fmtPx(hi)}.`,
          };
        }
      }

      return {
        valid: true,
        oldQty: Q0,
        oldAvg: P0,
        oldCost,
        addShares,
        addCash,
        newQty,
        newCost,
        newAvg,
        avgDelta,
        avgDeltaPct,
        oldBreakevenPct,
        newBreakevenPct,
        targetResult,
      };
    },

    positionRisk({ side, accountSize, riskMode, riskValue, entryPrice, stopPrice, targetPrice, leverage = 1 }) {
      const acct = Number(accountSize);
      const rv = Number(riskValue);
      const E = Number(entryPrice);
      const S = Number(stopPrice);
      const T = Number(targetPrice);
      const L = Math.max(1, Number(leverage) || 1);
      const isShort = side === 'short';

      if (!Number.isFinite(E) || E <= 0) return { valid: false, error: 'Enter a valid entry price.' };
      if (!Number.isFinite(S) || S <= 0) return { valid: false, error: 'Enter a valid stop-loss price.' };
      if (!Number.isFinite(rv) || rv <= 0) return { valid: false, error: 'Enter a risk amount greater than 0.' };
      if (riskMode === 'pct' && (!Number.isFinite(acct) || acct <= 0)) {
        return { valid: false, error: 'Enter an account size greater than $0.' };
      }

      const riskPerShare = isShort ? (S - E) : (E - S);
      if (riskPerShare <= 0) {
        return {
          valid: false,
          error: isShort
            ? 'For a Short trade, Stop-Loss must be ABOVE Entry Price.'
            : 'For a Long trade, Stop-Loss must be BELOW Entry Price.',
        };
      }

      const riskDollars = riskMode === 'pct' ? acct * (rv / 100) : rv;
      const riskPctOfAcct = acct > 0 ? (riskDollars / acct) * 100 : null;
      const optShares = riskDollars / riskPerShare;
      const wholeShares = Math.floor(optShares);
      const notional = optShares * E;
      const marginNeeded = notional / L;
      const acctAllocPct = acct > 0 ? (notional / acct) * 100 : null;
      const stopDistPct = (riskPerShare / E) * 100;

      let rewardPerShare = null;
      let estProfit = null;
      let rrRatio = null;
      let breakevenWinRate = null;
      let targetDistPct = null;
      if (Number.isFinite(T) && T > 0) {
        const rps = isShort ? (E - T) : (T - E);
        if (rps > 0) {
          rewardPerShare = rps;
          estProfit = optShares * rps;
          rrRatio = rps / riskPerShare;
          breakevenWinRate = (1 / (1 + rrRatio)) * 100;
          targetDistPct = (rps / E) * 100;
        }
      }

      // Approximate isolated-perp liquidation price (assuming ~10% maintenance margin buffer)
      const estLiqPrice = L > 1
        ? (isShort ? E * (1 + 0.9 / L) : Math.max(0, E * (1 - 0.9 / L)))
        : null;

      return {
        valid: true,
        side,
        entryPrice: E,
        stopPrice: S,
        targetPrice: Number.isFinite(T) && T > 0 ? T : null,
        leverage: L,
        riskDollars,
        riskPctOfAcct,
        riskPerShare,
        stopDistPct,
        optShares,
        wholeShares,
        notional,
        marginNeeded,
        acctAllocPct,
        exceedsCash: acct > 0 && marginNeeded > acct,
        rewardPerShare,
        targetDistPct,
        estProfit,
        rrRatio,
        breakevenWinRate,
        estLiqPrice,
      };
    },

    profitTarget({ side, inputUnit, amount, entryPrice, targetPrice, leverage = 1, feeBps = 0, desiredProfit = null }) {
      const E = Number(entryPrice);
      const T = Number(targetPrice);
      const amt = Number(amount);
      const L = Math.max(1, Number(leverage) || 1);
      const f = Math.max(0, Number(feeBps) || 0) / 10000;
      const isShort = side === 'short';

      if (!Number.isFinite(E) || E <= 0) return { valid: false, error: 'Enter a valid entry price.' };
      if (!Number.isFinite(T) || T <= 0) return { valid: false, error: 'Enter a valid target price.' };
      if (!Number.isFinite(amt) || amt <= 0) return { valid: false, error: 'Enter shares or investment amount (> 0).' };

      const shares = inputUnit === 'usd' ? amt / E : amt;
      const entryNotional = shares * E;
      const marginUsed = entryNotional / L;
      const exitNotional = shares * T;
      const grossPnl = isShort ? shares * (E - T) : shares * (T - E);
      const roundTripFees = (entryNotional + exitNotional) * f;
      const netPnl = grossPnl - roundTripFees;
      const projectedEquity = Math.max(0, marginUsed + netPnl);
      const priceMovePct = ((T - E) / E) * 100;
      const roePct = marginUsed > 0 ? (netPnl / marginUsed) * 100 : 0;

      // Reverse Solver: price needed to make desiredProfit ($)
      let goalResult = null;
      const G = Number(desiredProfit);
      if (Number.isFinite(G) && G > 0 && shares > 0) {
        // netPnl = shares*(T - E) - f*shares*(E + T) = G  (long)
        // T*(1 - f) = E*(1 + f) + G/shares
        // short: netPnl = shares*(E - T) - f*shares*(E + T) = G => T*(1 + f) = E*(1 - f) - G/shares
        let neededPrice = null;
        if (!isShort) {
          neededPrice = (E * (1 + f) + G / shares) / Math.max(1e-6, 1 - f);
        } else {
          neededPrice = (E * (1 - f) - G / shares) / (1 + f);
        }
        if (neededPrice > 0) {
          goalResult = {
            reachable: true,
            desiredProfit: G,
            neededPrice,
            neededMovePct: ((neededPrice - E) / E) * 100,
          };
        } else {
          goalResult = {
            reachable: false,
            reason: `Max possible profit on this short is ${fmtMoney(entryNotional * (1 - f))} (stock to $0).`,
          };
        }
      }

      const moves = [-25, -15, -10, -5, 5, 10, 20, 35, 50, 100];
      const matrix = moves.map((mPct) => {
        const px = E * (1 + mPct / 100);
        const gPnl = isShort ? shares * (E - px) : shares * (px - E);
        const fees = (entryNotional + shares * px) * f;
        const nPnl = gPnl - fees;
        const val = Math.max(0, marginUsed + nPnl);
        const roe = marginUsed > 0 ? (nPnl / marginUsed) * 100 : 0;
        return { mPct, px, netPnl: nPnl, val, roe };
      });

      return {
        valid: true,
        side,
        shares,
        entryPrice: E,
        targetPrice: T,
        entryNotional,
        marginUsed,
        grossPnl,
        roundTripFees,
        netPnl,
        projectedEquity,
        priceMovePct,
        roePct,
        goalResult,
        matrix,
      };
    },
  };

  // MARK: UI Controller for #toolsStage

  class TradingCalculatorController {
    constructor(app) {
      this.app = app;
      this.activeTab = 'cash';
      this.initialized = false;

      // Track whether each price input is synced live to WebSocket ticks
      this.liveLock = {
        cash: true,
        swapBuy: true,
        swapSell: true,
        dca: true,
        risk: true,
        target: true,
      };

      this.state = {
        cashMode: 'shares_to_cash',
        swapDir: 'buy_to_sell',
        swapUnit: 'shares',
        lastSwapFocus: 'buy',
        dcaAddMode: 'shares',
        riskSide: 'long',
        riskMode: 'pct',
        targetSide: 'long',
        targetUnit: 'shares',
      };

      this._renderQueued = false;
      this._cacheDOM();
      this._bindEvents();
    }

    _cacheDOM() {
      const g = (id) => document.getElementById(id);
      this.el = {
        tabs: g('calcModeTabs'),
        panels: {
          cash: g('calcPanelCash'),
          swap: g('calcPanelSwap'),
          dca: g('calcPanelDca'),
          risk: g('calcPanelRisk'),
          target: g('calcPanelTarget'),
        },

        // Mode 1: Cash & Shares
        cashModeSeg: g('calcCashModeSeg'),
        cashSym: g('calcCashSym'),
        cashPrice: g('calcCashPrice'),
        cashLiveBadge: g('calcCashLiveBadge'),
        cashAmountLabel: g('calcCashAmountLabel'),
        cashAmount: g('calcCashAmount'),
        cashLev: g('calcCashLev'),
        cashLevPills: g('calcCashLevPills'),
        cashFeeBps: g('calcCashFeeBps'),
        cashFeePills: g('calcCashFeePills'),
        cashOut: g('calcCashOut'),
        btnCashAddPf: g('btnCalcCashAddPf'),
        btnCashOpenChart: g('btnCalcCashOpenChart'),

        // Mode 2: Stock Swap
        swapDirSeg: g('calcSwapDirSeg'),
        swapHoldingsPills: g('calcSwapHoldingsPills'),
        swapBuySym: g('calcSwapBuySym'),
        swapBuyPrice: g('calcSwapBuyPrice'),
        swapBuyLiveBadge: g('calcSwapBuyLiveBadge'),
        swapSellSym: g('calcSwapSellSym'),
        swapSellPrice: g('calcSwapSellPrice'),
        swapSellLiveBadge: g('calcSwapSellLiveBadge'),
        btnSwapFlip: g('btnCalcSwapFlip'),
        swapUnitSeg: g('calcSwapUnitSeg'),
        swapAmountLabel: g('calcSwapAmountLabel'),
        swapAmount: g('calcSwapAmount'),
        swapPctPills: g('calcSwapPctPills'),
        swapExtraCash: g('calcSwapExtraCash'),
        swapFeeBps: g('calcSwapFeeBps'),
        swapOut: g('calcSwapOut'),
        swapLadderBody: g('calcSwapLadderBody'),
        swapLadderTitle: g('calcSwapLadderTitle'),

        // Mode 3: DCA / Average Down
        dcaHoldingsPills: g('calcDcaHoldingsPills'),
        dcaSym: g('calcDcaSym'),
        dcaCurQty: g('calcDcaCurQty'),
        dcaCurAvg: g('calcDcaCurAvg'),
        dcaAddModeSeg: g('calcDcaAddModeSeg'),
        dcaAddLabel: g('calcDcaAddLabel'),
        dcaAddAmount: g('calcDcaAddAmount'),
        dcaBuyPrice: g('calcDcaBuyPrice'),
        dcaLiveBadge: g('calcDcaLiveBadge'),
        dcaTargetAvg: g('calcDcaTargetAvg'),
        dcaOut: g('calcDcaOut'),

        // Mode 4: Position & Risk Sizing
        riskSym: g('calcRiskSym'),
        riskSideSeg: g('calcRiskSideSeg'),
        riskAcct: g('calcRiskAcct'),
        btnRiskUsePf: g('btnCalcRiskUsePf'),
        riskModeSeg: g('calcRiskModeSeg'),
        riskVal: g('calcRiskVal'),
        riskPctPills: g('calcRiskPctPills'),
        riskEntry: g('calcRiskEntry'),
        riskLiveBadge: g('calcRiskLiveBadge'),
        riskStop: g('calcRiskStop'),
        riskStopPills: g('calcRiskStopPills'),
        riskTarget: g('calcRiskTarget'),
        riskRPills: g('calcRiskRPills'),
        riskLev: g('calcRiskLev'),
        riskOut: g('calcRiskOut'),

        // Mode 5: Profit Target & What-If
        targetHoldingsPills: g('calcTargetHoldingsPills'),
        targetSym: g('calcTargetSym'),
        targetSideSeg: g('calcTargetSideSeg'),
        targetUnitSeg: g('calcTargetUnitSeg'),
        targetAmtLabel: g('calcTargetAmtLabel'),
        targetAmt: g('calcTargetAmt'),
        targetEntry: g('calcTargetEntry'),
        targetLiveBadge: g('calcTargetLiveBadge'),
        targetExit: g('calcTargetExit'),
        targetMovePills: g('calcTargetMovePills'),
        targetLev: g('calcTargetLev'),
        targetFeeBps: g('calcTargetFeeBps'),
        targetGoalProfit: g('calcTargetGoalProfit'),
        targetOut: g('calcTargetOut'),
        targetMatrixBody: g('calcTargetMatrixBody'),
      };
    }

    _resolveMarket(raw) {
      const id = this.app._resolveHoldingSymbol(raw);
      return id ? this.app.markets.get(id) : null;
    }

    _syncSymbolPrice(symInput, priceInput, lockKey, badgeEl) {
      const m = this._resolveMarket(symInput.value);
      if (m && this.liveLock[lockKey]) {
        priceInput.value = rawPxString(m.price);
      }
      this._updateLiveBadge(badgeEl, lockKey, m);
      return m;
    }

    _updateLiveBadge(badgeEl, lockKey, m) {
      if (!badgeEl) return;
      if (!m) {
        badgeEl.textContent = 'Custom';
        badgeEl.classList.remove('live');
        badgeEl.title = 'Enter a Hyperliquid ticker or custom price';
        return;
      }
      if (this.liveLock[lockKey]) {
        badgeEl.textContent = `● Live ${fmtPx(m.price)}`;
        badgeEl.classList.add('live');
        badgeEl.title = 'Streaming live Hyperliquid price (type in price box to override)';
      } else {
        badgeEl.textContent = `Use Live (${fmtPx(m.price)})`;
        badgeEl.classList.remove('live');
        badgeEl.title = 'Click to snap back to live Hyperliquid price';
      }
    }

    _bindEvents() {
      const e = this.el;
      if (!e.tabs) return;

      // Top Calculator Sub-Tabs
      e.tabs.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-tab-btn[data-calctab]');
        if (!btn) return;
        this.setTab(btn.dataset.calctab);
      });

      const wirePriceField = (symEl, pxEl, lockKey, badgeEl, onChange) => {
        symEl?.addEventListener('input', () => {
          this.liveLock[lockKey] = true;
          this._syncSymbolPrice(symEl, pxEl, lockKey, badgeEl);
          onChange();
        });
        symEl?.addEventListener('change', () => {
          const m = this._resolveMarket(symEl.value);
          if (m) symEl.value = m.isSpot ? m.ticker : m.id;
          this.liveLock[lockKey] = true;
          this._syncSymbolPrice(symEl, pxEl, lockKey, badgeEl);
          onChange();
        });
        pxEl?.addEventListener('input', () => {
          this.liveLock[lockKey] = false;
          this._updateLiveBadge(badgeEl, lockKey, this._resolveMarket(symEl.value));
          onChange();
        });
        badgeEl?.addEventListener('click', () => {
          this.liveLock[lockKey] = true;
          this._syncSymbolPrice(symEl, pxEl, lockKey, badgeEl);
          onChange();
        });
      };

      // --- Mode 1: Cash & Shares ---
      e.cashModeSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-mode]');
        if (!btn) return;
        this.state.cashMode = btn.dataset.mode;
        e.cashModeSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        if (this.state.cashMode === 'cash_to_shares') {
          e.cashAmountLabel.textContent = 'Cash Budget ($)';
          if (Number(e.cashAmount.value) <= 500) e.cashAmount.value = '10000';
        } else {
          e.cashAmountLabel.textContent = 'Quantity (Shares)';
          if (Number(e.cashAmount.value) >= 1000) e.cashAmount.value = '50';
        }
        this.renderCash();
      });

      wirePriceField(e.cashSym, e.cashPrice, 'cash', e.cashLiveBadge, () => this.renderCash());
      [e.cashAmount, e.cashLev, e.cashFeeBps].forEach((el) => el?.addEventListener('input', () => this.renderCash()));

      e.cashLevPills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-lev]');
        if (!btn) return;
        const val = btn.dataset.lev;
        if (val === 'max') {
          const m = this._resolveMarket(e.cashSym.value);
          e.cashLev.value = String(m?.maxLeverage || 10);
        } else {
          e.cashLev.value = val;
        }
        this.renderCash();
      });

      e.cashFeePills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-bps]');
        if (!btn) return;
        e.cashFeeBps.value = btn.dataset.bps;
        this.renderCash();
      });

      e.btnCashAddPf?.addEventListener('click', () => {
        const m = this._resolveMarket(e.cashSym.value);
        const res = this._computeCash();
        if (!m || !res.valid) {
          this.app.showToast('Pick a valid Hyperliquid stock first.');
          return;
        }
        this.app.setLayout('portfolio');
        this.app.setHoldingFormOpen?.(true);
        this.app.el.holdingSymbolInput.value = m.id;
        this.app.el.holdingSide.value = 'long';
        this.app.el.holdingQty.value = Number(res.exactShares.toFixed(4));
        this.app.el.holdingAvgPrice.value = rawPxString(res.price);
        this.app.el.holdingQty.focus();
      });

      e.btnCashOpenChart?.addEventListener('click', () => {
        const m = this._resolveMarket(e.cashSym.value);
        if (m) {
          this.app.prefs.activeSymbol = m.id;
          this.app.setLayout('single');
        }
      });

      // --- Mode 2: Stock Swap ---
      e.swapDirSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-dir]');
        if (!btn) return;
        this.state.swapDir = btn.dataset.dir;
        e.swapDirSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this._syncSwapUnitUI();
        this.renderSwap();
      });

      e.swapUnitSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-unit]');
        if (!btn) return;
        this.state.swapUnit = btn.dataset.unit;
        this._syncSwapUnitUI();
        this.renderSwap();
      });

      e.swapPctPills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-pct]');
        if (!btn) return;
        this.state.swapDir = 'sell_to_buy';
        this.state.swapUnit = 'pct';
        e.swapDirSeg?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.dir === 'sell_to_buy'));
        e.swapAmount.value = btn.dataset.pct;
        this._syncSwapUnitUI();
        this.renderSwap();
      });

      e.btnSwapFlip?.addEventListener('click', () => {
        const tmpSym = e.swapBuySym.value;
        const tmpPx = e.swapBuyPrice.value;
        const tmpLock = this.liveLock.swapBuy;
        e.swapBuySym.value = e.swapSellSym.value;
        e.swapBuyPrice.value = e.swapSellPrice.value;
        this.liveLock.swapBuy = this.liveLock.swapSell;
        e.swapSellSym.value = tmpSym;
        e.swapSellPrice.value = tmpPx;
        this.liveLock.swapSell = tmpLock;
        this._syncSymbolPrice(e.swapBuySym, e.swapBuyPrice, 'swapBuy', e.swapBuyLiveBadge);
        this._syncSymbolPrice(e.swapSellSym, e.swapSellPrice, 'swapSell', e.swapSellLiveBadge);
        this.renderSwap();
      });

      e.swapBuySym?.addEventListener('focus', () => { this.state.lastSwapFocus = 'buy'; });
      e.swapSellSym?.addEventListener('focus', () => { this.state.lastSwapFocus = 'sell'; });
      wirePriceField(e.swapBuySym, e.swapBuyPrice, 'swapBuy', e.swapBuyLiveBadge, () => this.renderSwap());
      wirePriceField(e.swapSellSym, e.swapSellPrice, 'swapSell', e.swapSellLiveBadge, () => this.renderSwap());
      [e.swapAmount, e.swapExtraCash, e.swapFeeBps].forEach((el) => el?.addEventListener('input', () => this.renderSwap()));

      // --- Mode 3: DCA / Average Down ---
      e.dcaAddModeSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-mode]');
        if (!btn) return;
        this.state.dcaAddMode = btn.dataset.mode;
        e.dcaAddModeSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        e.dcaAddLabel.textContent = this.state.dcaAddMode === 'usd' ? 'Cash to Add ($)' : 'New Shares to Buy';
        this.renderDca();
      });
      wirePriceField(e.dcaSym, e.dcaBuyPrice, 'dca', e.dcaLiveBadge, () => this.renderDca());
      [e.dcaCurQty, e.dcaCurAvg, e.dcaAddAmount, e.dcaTargetAvg].forEach((el) =>
        el?.addEventListener('input', () => this.renderDca())
      );

      // --- Mode 4: Position & Risk Sizing ---
      e.riskSideSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-side]');
        if (!btn) return;
        this.state.riskSide = btn.dataset.side;
        e.riskSideSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this._autoAdjustRiskStopTarget();
        this.renderRisk();
      });

      e.riskModeSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-rmode]');
        if (!btn) return;
        this.state.riskMode = btn.dataset.rmode;
        e.riskModeSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        e.riskVal.value = this.state.riskMode === 'pct' ? '1' : '500';
        this.renderRisk();
      });

      e.btnRiskUsePf?.addEventListener('click', () => {
        const stats = this.app._computePortfolioStats();
        if (stats.totalValue > 0) {
          e.riskAcct.value = stats.totalValue.toFixed(2);
          this.renderRisk();
        } else {
          this.app.showToast('Add holdings in Portfolio to auto-fill account size.');
        }
      });

      e.riskPctPills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-rpct]');
        if (!btn) return;
        this.state.riskMode = 'pct';
        e.riskModeSeg?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.rmode === 'pct'));
        e.riskVal.value = btn.dataset.rpct;
        this.renderRisk();
      });

      e.riskStopPills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-spct]');
        if (!btn) return;
        const entry = parseFloat(e.riskEntry.value);
        if (!Number.isFinite(entry) || entry <= 0) return;
        const pct = parseFloat(btn.dataset.spct) / 100;
        const stop = this.state.riskSide === 'short' ? entry * (1 + pct) : entry * (1 - pct);
        e.riskStop.value = rawPxString(stop);
        this.renderRisk();
      });

      e.riskRPills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-rmult]');
        if (!btn) return;
        const entry = parseFloat(e.riskEntry.value);
        const stop = parseFloat(e.riskStop.value);
        const mult = parseFloat(btn.dataset.rmult);
        if (!Number.isFinite(entry) || !Number.isFinite(stop) || entry <= 0) return;
        const r = Math.abs(entry - stop);
        if (r <= 0) return;
        const tgt = this.state.riskSide === 'short' ? Math.max(0.01, entry - r * mult) : entry + r * mult;
        e.riskTarget.value = rawPxString(tgt);
        this.renderRisk();
      });

      wirePriceField(e.riskSym, e.riskEntry, 'risk', e.riskLiveBadge, () => {
        this._autoAdjustRiskStopTarget();
        this.renderRisk();
      });
      [e.riskAcct, e.riskVal, e.riskStop, e.riskTarget, e.riskLev].forEach((el) =>
        el?.addEventListener('input', () => this.renderRisk())
      );

      // --- Mode 5: Profit Target & What-If ---
      e.targetSideSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-side]');
        if (!btn) return;
        this.state.targetSide = btn.dataset.side;
        e.targetSideSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.renderTarget();
      });

      e.targetUnitSeg?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.seg-btn[data-unit]');
        if (!btn) return;
        this.state.targetUnit = btn.dataset.unit;
        e.targetUnitSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        e.targetAmtLabel.textContent = this.state.targetUnit === 'usd' ? 'Investment ($)' : 'Quantity (Shares)';
        this.renderTarget();
      });

      e.targetMovePills?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.calc-chip[data-move]');
        if (!btn) return;
        const entry = parseFloat(e.targetEntry.value);
        if (!Number.isFinite(entry) || entry <= 0) return;
        const pct = parseFloat(btn.dataset.move) / 100;
        e.targetExit.value = rawPxString(Math.max(0.01, entry * (1 + pct)));
        this.renderTarget();
      });

      wirePriceField(e.targetSym, e.targetEntry, 'target', e.targetLiveBadge, () => {
        const entry = parseFloat(e.targetEntry.value);
        if (Number.isFinite(entry) && entry > 0) {
          e.targetExit.value = rawPxString(entry * 1.2);
        }
        this.renderTarget();
      });
      [e.targetAmt, e.targetExit, e.targetLev, e.targetFeeBps, e.targetGoalProfit].forEach((el) =>
        el?.addEventListener('input', () => this.renderTarget())
      );
    }

    _syncSwapUnitUI() {
      const e = this.el;
      const isSellToBuy = this.state.swapDir === 'sell_to_buy';
      const pctBtn = e.swapUnitSeg?.querySelector('[data-unit="pct"]');
      if (pctBtn) pctBtn.classList.toggle('hidden', !isSellToBuy);
      if (!isSellToBuy && this.state.swapUnit === 'pct') {
        this.state.swapUnit = 'shares';
      }
      e.swapUnitSeg?.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.unit === this.state.swapUnit);
      });
      e.swapPctPills?.classList.toggle('hidden', !isSellToBuy);

      if (isSellToBuy) {
        if (this.state.swapUnit === 'usd') e.swapAmountLabel.textContent = 'Dollar Value to Sell ($)';
        else if (this.state.swapUnit === 'pct') e.swapAmountLabel.textContent = '% of Holding to Sell';
        else e.swapAmountLabel.textContent = 'Shares to Sell';
      } else {
        e.swapAmountLabel.textContent = this.state.swapUnit === 'usd' ? 'Dollar Value to Buy ($)' : 'Shares to Buy';
      }
    }

    _autoAdjustRiskStopTarget() {
      const entry = parseFloat(this.el.riskEntry.value);
      if (!Number.isFinite(entry) || entry <= 0) return;
      const isShort = this.state.riskSide === 'short';
      const curStop = parseFloat(this.el.riskStop.value);
      const invalidStop = !Number.isFinite(curStop) || curStop <= 0 || (isShort ? curStop <= entry : curStop >= entry);
      if (invalidStop) {
        this.el.riskStop.value = rawPxString(isShort ? entry * 1.05 : entry * 0.95);
        this.el.riskTarget.value = rawPxString(isShort ? entry * 0.90 : entry * 1.10);
      }
    }

    setTab(tab) {
      if (!this.el.panels[tab]) return;
      this.activeTab = tab;
      this.el.tabs.querySelectorAll('.calc-tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.calctab === tab);
      });
      for (const [k, panel] of Object.entries(this.el.panels)) {
        panel?.classList.toggle('hidden', k !== tab);
      }
      this.renderAll();
    }

    ensureDefaults() {
      if (this.initialized || this.app.markets.size === 0) return;
      this.initialized = true;

      const primary = this.app.markets.get(this.app.prefs.activeSymbol)
        || this.app.markets.get('xyz:NVDA')
        || Array.from(this.app.markets.values())[0];
      const secondary = (primary?.id !== 'xyz:TSLA' && this.app.markets.get('xyz:TSLA'))
        || (primary?.id !== 'xyz:AAPL' && this.app.markets.get('xyz:AAPL'))
        || Array.from(this.app.markets.values()).find((m) => m.id !== primary?.id)
        || primary;

      const firstHolding = this.app.prefs.holdings[0];
      const holdMkt = firstHolding ? this.app.markets.get(firstHolding.symbol) : null;

      // Seed defaults cleanly
      if (primary) {
        this.el.cashSym.value = primary.id;
        this.el.cashPrice.value = rawPxString(primary.price);

        this.el.swapBuySym.value = primary.id;
        this.el.swapBuyPrice.value = rawPxString(primary.price);

        this.el.riskSym.value = primary.id;
        this.el.riskEntry.value = rawPxString(primary.price);
        this.el.riskStop.value = rawPxString(primary.price * 0.95);
        this.el.riskTarget.value = rawPxString(primary.price * 1.10);

        this.el.targetSym.value = holdMkt ? holdMkt.id : primary.id;
        this.el.targetEntry.value = rawPxString(firstHolding ? firstHolding.avgPrice : primary.price);
        if (firstHolding) {
          this.liveLock.target = false;
          this.el.targetAmt.value = String(firstHolding.qty);
        }
        const tBase = firstHolding ? firstHolding.avgPrice : primary.price;
        this.el.targetExit.value = rawPxString(tBase * 1.25);

        this.el.dcaSym.value = holdMkt ? holdMkt.id : primary.id;
        this.el.dcaBuyPrice.value = rawPxString((holdMkt || primary).price);
        if (firstHolding) {
          this.el.dcaCurQty.value = String(firstHolding.qty);
          this.el.dcaCurAvg.value = rawPxString(firstHolding.avgPrice);
        } else {
          this.el.dcaCurAvg.value = rawPxString(primary.price * 1.15);
        }
      }

      const sellSeed = (holdMkt && holdMkt.id !== primary?.id) ? holdMkt : secondary;
      if (sellSeed) {
        this.el.swapSellSym.value = sellSeed.id;
        this.el.swapSellPrice.value = rawPxString(sellSeed.price);
      }

      const pfStats = this.app._computePortfolioStats();
      if (pfStats.totalValue > 0) {
        this.el.riskAcct.value = pfStats.totalValue.toFixed(2);
      }
      this._syncSwapUnitUI();
    }

    onSidebarSelect(symbolId) {
      const m = this.app.markets.get(symbolId);
      if (!m) return;
      this.ensureDefaults();
      const e = this.el;
      const dispId = m.isSpot ? m.ticker : m.id;
      if (this.activeTab === 'cash') {
        e.cashSym.value = dispId;
        this.liveLock.cash = true;
        this._syncSymbolPrice(e.cashSym, e.cashPrice, 'cash', e.cashLiveBadge);
      } else if (this.activeTab === 'swap') {
        if (this.state.lastSwapFocus === 'sell') {
          e.swapSellSym.value = dispId;
          this.liveLock.swapSell = true;
          this._syncSymbolPrice(e.swapSellSym, e.swapSellPrice, 'swapSell', e.swapSellLiveBadge);
        } else {
          e.swapBuySym.value = dispId;
          this.liveLock.swapBuy = true;
          this._syncSymbolPrice(e.swapBuySym, e.swapBuyPrice, 'swapBuy', e.swapBuyLiveBadge);
        }
      } else if (this.activeTab === 'dca') {
        e.dcaSym.value = dispId;
        this.liveLock.dca = true;
        this._syncSymbolPrice(e.dcaSym, e.dcaBuyPrice, 'dca', e.dcaLiveBadge);
        const h = this.app.prefs.holdings.find((x) => x.symbol === m.id);
        if (h) {
          e.dcaCurQty.value = String(h.qty);
          e.dcaCurAvg.value = rawPxString(h.avgPrice);
        }
      } else if (this.activeTab === 'risk') {
        e.riskSym.value = dispId;
        this.liveLock.risk = true;
        this._syncSymbolPrice(e.riskSym, e.riskEntry, 'risk', e.riskLiveBadge);
        e.riskStop.value = rawPxString(this.state.riskSide === 'short' ? m.price * 1.05 : m.price * 0.95);
        e.riskTarget.value = rawPxString(this.state.riskSide === 'short' ? m.price * 0.90 : m.price * 1.10);
      } else if (this.activeTab === 'target') {
        e.targetSym.value = dispId;
        this.liveLock.target = true;
        this._syncSymbolPrice(e.targetSym, e.targetEntry, 'target', e.targetLiveBadge);
        e.targetExit.value = rawPxString(m.price * 1.25);
      }
      this.renderAll();
    }

    scheduleLiveTick() {
      if (this.app.prefs.layout !== 'tools') return;
      if (this._renderQueued) return;
      this._renderQueued = true;
      requestAnimationFrame(() => {
        this._renderQueued = false;
        this.renderAll(true);
      });
    }

    renderAll(fromLiveTick = false) {
      this.ensureDefaults();
      if (!fromLiveTick) this._renderHoldingQuickPills();

      const e = this.el;
      if (this.activeTab === 'cash') {
        this._syncSymbolPrice(e.cashSym, e.cashPrice, 'cash', e.cashLiveBadge);
        this.renderCash();
      } else if (this.activeTab === 'swap') {
        this._syncSymbolPrice(e.swapBuySym, e.swapBuyPrice, 'swapBuy', e.swapBuyLiveBadge);
        this._syncSymbolPrice(e.swapSellSym, e.swapSellPrice, 'swapSell', e.swapSellLiveBadge);
        this.renderSwap();
      } else if (this.activeTab === 'dca') {
        this._syncSymbolPrice(e.dcaSym, e.dcaBuyPrice, 'dca', e.dcaLiveBadge);
        this.renderDca();
      } else if (this.activeTab === 'risk') {
        this._syncSymbolPrice(e.riskSym, e.riskEntry, 'risk', e.riskLiveBadge);
        this.renderRisk();
      } else if (this.activeTab === 'target') {
        this._syncSymbolPrice(e.targetSym, e.targetEntry, 'target', e.targetLiveBadge);
        this.renderTarget();
      }
    }

    _renderHoldingQuickPills() {
      const holdings = this.app.prefs.holdings || [];
      const build = (container, label, onPick) => {
        if (!container) return;
        if (holdings.length === 0) {
          container.classList.add('hidden');
          return;
        }
        container.classList.remove('hidden');
        container.innerHTML = `<span class="calc-holdings-lbl">${escHtml(label)}:</span>` +
          holdings.map((h) => {
            const m = this.app.markets.get(h.symbol);
            const t = m ? m.ticker : this.app._shortTicker(h.symbol);
            const val = m ? h.qty * m.price : h.qty * h.avgPrice;
            return `<button type="button" class="calc-hold-pill" data-hid="${escHtml(h.id)}"><strong>${escHtml(t)}</strong> <span>${fmtShares(h.qty, 2)} sh · ${fmtMoney(val)}</span></button>`;
          }).join('');
        container.querySelectorAll('.calc-hold-pill').forEach((btn) => {
          btn.addEventListener('click', () => {
            const h = holdings.find((x) => x.id === btn.dataset.hid);
            if (h) onPick(h);
          });
        });
      };

      build(this.el.swapHoldingsPills, 'Sell from Portfolio', (h) => {
        this.el.swapSellSym.value = h.symbol;
        this.liveLock.swapSell = true;
        this._syncSymbolPrice(this.el.swapSellSym, this.el.swapSellPrice, 'swapSell', this.el.swapSellLiveBadge);
        this.renderSwap();
      });

      build(this.el.dcaHoldingsPills, 'Load Holding', (h) => {
        this.el.dcaSym.value = h.symbol;
        this.el.dcaCurQty.value = String(h.qty);
        this.el.dcaCurAvg.value = rawPxString(h.avgPrice);
        this.liveLock.dca = true;
        this._syncSymbolPrice(this.el.dcaSym, this.el.dcaBuyPrice, 'dca', this.el.dcaLiveBadge);
        this.renderDca();
      });

      build(this.el.targetHoldingsPills, 'Load Holding', (h) => {
        this.el.targetSym.value = h.symbol;
        this.state.targetSide = h.side || 'long';
        this.state.targetUnit = 'shares';
        this.el.targetSideSeg?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.side === this.state.targetSide));
        this.el.targetUnitSeg?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.unit === 'shares'));
        this.el.targetAmtLabel.textContent = 'Quantity (Shares)';
        this.el.targetAmt.value = String(h.qty);
        this.liveLock.target = false;
        this.el.targetEntry.value = rawPxString(h.avgPrice);
        const m = this.app.markets.get(h.symbol);
        this._updateLiveBadge(this.el.targetLiveBadge, 'target', m);
        const refPx = m ? m.price : h.avgPrice;
        this.el.targetExit.value = rawPxString(refPx * 1.25);
        this.renderTarget();
      });
    }

    _computeCash() {
      const e = this.el;
      return CalcMath.cashAndShares({
        mode: this.state.cashMode,
        price: parseFloat(e.cashPrice.value),
        qty: parseFloat(e.cashAmount.value),
        cashBudget: parseFloat(e.cashAmount.value),
        leverage: parseFloat(e.cashLev.value) || 1,
        feeBps: parseFloat(e.cashFeeBps.value) || 0,
      });
    }

    renderCash() {
      const e = this.el;
      const m = this._resolveMarket(e.cashSym.value);
      const ticker = m ? m.ticker : (e.cashSym.value.trim().toUpperCase() || 'STOCK');
      const res = this._computeCash();
      if (!res.valid) {
        e.cashOut.innerHTML = `<div class="calc-empty">${escHtml(res.error)}</div>`;
        return;
      }

      const isCashToShares = res.mode === 'cash_to_shares';
      const heroLabel = isCashToShares ? `MAX SHARES OF ${ticker}` : `TOTAL CASH NEEDED FOR ${fmtShares(res.exactShares)} ${ticker}`;
      const heroVal = isCashToShares ? `${fmtShares(res.exactShares)} shares` : fmtMoney(res.totalCash);
      const heroSub = isCashToShares
        ? `Whole shares: <strong>${res.wholeShares.toLocaleString('en-US')} sh</strong> (${fmtMoney(res.wholeCashUsed)}) · Leftover cash: <strong>${fmtMoney(res.leftoverCash)}</strong>`
        : `${res.leverage > 1 ? `${res.leverage}× margin ${fmtMoney(res.marginReq)} on ${fmtMoney(res.notional)} notional` : `1× spot notional ${fmtMoney(res.notional)}`}${res.fee > 0 ? ` + ${fmtMoney(res.fee)} fee` : ''}`;

      // Portfolio weight context
      const pf = this.app._computePortfolioStats();
      const existing = m ? this.app.prefs.holdings.filter((h) => h.symbol === m.id) : [];
      const existingQty = existing.reduce((s, h) => s + h.qty, 0);
      const newPfTotal = pf.totalValue + res.notional;
      const newWeight = newPfTotal > 0 ? ((res.notional + (m ? existingQty * m.price : 0)) / newPfTotal) * 100 : null;
      const maxLevWarn = (m && res.leverage > m.maxLeverage)
        ? `<div class="calc-warn">⚠ ${escHtml(ticker)} max Hyperliquid leverage is ${m.maxLeverage}× (you entered ${res.leverage}×).</div>`
        : '';

      e.cashOut.innerHTML = `
        <div class="calc-hero-box">
          <div class="calc-hero-label">${escHtml(heroLabel)}</div>
          <div class="calc-hero-val">${heroVal}</div>
          <div class="calc-hero-sub">${heroSub}</div>
        </div>
        ${maxLevWarn}
        <div class="calc-kpi-grid">
          <div class="calc-kpi">
            <span>Notional Position Value</span>
            <strong>${fmtMoney(res.notional)}</strong>
            <small>${fmtShares(res.exactShares)} sh × ${fmtPx(res.price)}</small>
          </div>
          <div class="calc-kpi">
            <span>${res.leverage > 1 ? `Initial Margin (${res.leverage}×)` : 'Cash Required (1× Spot)'}</span>
            <strong class="accent">${fmtMoney(res.marginReq)}</strong>
            <small>${res.leverage > 1 ? `${(100 / res.leverage).toFixed(1)}% collateral` : 'No leverage'}</small>
          </div>
          <div class="calc-kpi">
            <span>Est. Trading Fee</span>
            <strong>${fmtMoney(res.fee)}</strong>
            <small>${res.feeBps.toFixed(2)} bps (${(res.feeBps / 100).toFixed(3)}%)</small>
          </div>
          <div class="calc-kpi">
            <span>Effective Fill Price</span>
            <strong>${fmtPx(res.effectivePrice)}</strong>
            <small>Incl. fee per share</small>
          </div>
          ${newWeight !== null && pf.totalValue > 0 ? `
          <div class="calc-kpi wide">
            <span>Portfolio Impact</span>
            <strong>${newWeight.toFixed(1)}% weight${existingQty > 0 ? ` · ${fmtShares(existingQty + res.exactShares)} total sh` : ''}</strong>
            <small>Current portfolio ${fmtMoney(pf.totalValue)} → Projected ${fmtMoney(newPfTotal)}</small>
          </div>` : ''}
        </div>
      `;
    }

    renderSwap() {
      const e = this.el;
      const buyM = this._resolveMarket(e.swapBuySym.value);
      const sellM = this._resolveMarket(e.swapSellSym.value);
      const buyT = buyM ? buyM.ticker : (e.swapBuySym.value.trim().toUpperCase() || 'BUY');
      const sellT = sellM ? sellM.ticker : (e.swapSellSym.value.trim().toUpperCase() || 'SELL');

      // Check if user holds sellM in portfolio (combine multiple lots if present)
      let ownedSellShares = null;
      let ownedSellAvg = null;
      if (sellM) {
        const lots = this.app.prefs.holdings.filter((h) => h.symbol === sellM.id && h.side !== 'short');
        if (lots.length > 0) {
          ownedSellShares = lots.reduce((s, h) => s + h.qty, 0);
          const totalCost = lots.reduce((s, h) => s + h.qty * h.avgPrice, 0);
          ownedSellAvg = ownedSellShares > 0 ? totalCost / ownedSellShares : null;
        }
      }

      const res = CalcMath.stockSwap({
        direction: this.state.swapDir,
        inputUnit: this.state.swapUnit,
        amount: parseFloat(e.swapAmount.value),
        buyPrice: parseFloat(e.swapBuyPrice.value),
        sellPrice: parseFloat(e.swapSellPrice.value),
        feeBps: parseFloat(e.swapFeeBps.value) || 0,
        extraCash: parseFloat(e.swapExtraCash.value) || 0,
        ownedSellShares,
        ownedSellAvg,
      });

      if (!res.valid) {
        e.swapOut.innerHTML = `<div class="calc-empty">${escHtml(res.error)}</div>`;
        if (e.swapLadderBody) e.swapLadderBody.innerHTML = '';
        return;
      }

      const isBuyToSell = res.direction === 'buy_to_sell';
      const heroLabel = isBuyToSell
        ? `SELL ${sellT} TO BUY ${fmtShares(res.buyShares)} ${buyT}`
        : `BUY ${buyT} BY SELLING ${fmtShares(res.sellShares)} ${sellT}`;
      const heroVal = isBuyToSell
        ? `${fmtShares(res.sellShares)} shares of ${sellT}`
        : `${fmtShares(res.buyShares)} shares of ${buyT}`;
      const heroSub = isBuyToSell
        ? `Whole shares to sell: <strong>${res.wholeSellShares.toLocaleString('en-US')} ${sellT}</strong> (leaves <strong>${fmtMoney(res.residualCash)}</strong> leftover cash)`
        : `Whole shares you can buy: <strong>${res.wholeBuyShares.toLocaleString('en-US')} ${buyT}</strong> (leaves <strong>${fmtMoney(res.residualCash)}</strong> leftover cash)`;

      let holdingHtml = '';
      if (res.holdingImpact) {
        const hi = res.holdingImpact;
        const shortWarn = hi.shortfallShares > 0
          ? `<div class="calc-warn">⚠ You own ${fmtShares(hi.owned)} ${escHtml(sellT)}, short by <strong>${fmtShares(hi.shortfallShares)} sh (${fmtMoney(hi.shortfallUsd)})</strong>. Add cash or reduce buy size.</div>`
          : '';
        const pnlCls = hi.realizedPnl != null ? (hi.realizedPnl >= 0 ? 'up' : 'down') : '';
        holdingHtml = `
          ${shortWarn}
          <div class="calc-holding-strip">
            <div>
              <span>Your ${escHtml(sellT)} Holding</span>
              <strong>${fmtShares(hi.owned)} sh → ${fmtShares(Math.max(0, hi.remaining))} sh left</strong>
            </div>
            <div>
              <span>% of Position Sold</span>
              <strong>${Math.min(999, hi.pctSold).toFixed(1)}%</strong>
            </div>
            ${hi.realizedPnl != null ? `
            <div>
              <span>Est. Realized P/L</span>
              <strong class="${pnlCls}">${fmtMoney(hi.realizedPnl, true)}</strong>
            </div>` : ''}
          </div>
        `;
      }

      e.swapOut.innerHTML = `
        <div class="calc-hero-box">
          <div class="calc-hero-label">${escHtml(heroLabel)}</div>
          <div class="calc-hero-val">${escHtml(heroVal)}</div>
          <div class="calc-hero-sub">${heroSub}</div>
        </div>
        ${holdingHtml}
        <div class="calc-kpi-grid">
          <div class="calc-kpi">
            <span>Buy ${escHtml(buyT)} Value</span>
            <strong class="up">${fmtMoney(res.buyNotional)}</strong>
            <small>${fmtShares(res.buyShares)} sh @ ${fmtPx(res.buyPrice)}</small>
          </div>
          <div class="calc-kpi">
            <span>Sell ${escHtml(sellT)} Value</span>
            <strong class="down">${fmtMoney(res.sellNotional)}</strong>
            <small>${fmtShares(res.sellShares)} sh @ ${fmtPx(res.sellPrice)}</small>
          </div>
          <div class="calc-kpi">
            <span>Share Swap Ratio</span>
            <strong class="accent">1 ${escHtml(buyT)} = ${fmtShares(res.swapRatioBuyToSell, 3)} ${escHtml(sellT)}</strong>
            <small>1 ${escHtml(sellT)} = ${fmtShares(res.swapRatioSellToBuy, 3)} ${escHtml(buyT)}</small>
          </div>
          <div class="calc-kpi">
            <span>Round-Trip Fees & Extra Cash</span>
            <strong>${fmtMoney(res.totalFees)}</strong>
            <small>${res.extraCash > 0 ? `+ ${fmtMoney(res.extraCash)} cash added` : 'Zero extra cash added'}</small>
          </div>
        </div>
      `;

      // Quick Share-for-Share Conversion Ladder
      if (e.swapLadderBody && e.swapLadderTitle) {
        const feeBps = parseFloat(e.swapFeeBps.value) || 0;
        const extraCash = parseFloat(e.swapExtraCash.value) || 0;
        e.swapLadderTitle.textContent = isBuyToSell
          ? `Quick Conversion Table: Buying ${buyT} → Selling ${sellT}`
          : `Quick Conversion Table: Selling ${sellT} → Buying ${buyT}`;

        const steps = [1, 5, 10, 25, 50, 100];
        e.swapLadderBody.innerHTML = steps.map((q) => {
          const r = CalcMath.stockSwap({
            direction: res.direction,
            inputUnit: 'shares',
            amount: q,
            buyPrice: res.buyPrice,
            sellPrice: res.sellPrice,
            feeBps,
            extraCash,
          });
          if (isBuyToSell) {
            return `
              <tr>
                <td><strong>${q} ${escHtml(buyT)}</strong></td>
                <td class="num">${fmtMoney(r.buyNotional)}</td>
                <td class="num accent"><strong>${fmtShares(r.sellShares, 3)} ${escHtml(sellT)}</strong></td>
                <td class="num">${r.wholeSellShares} sh</td>
                <td class="num">${fmtMoney(r.residualCash)}</td>
              </tr>`;
          }
          return `
            <tr>
              <td><strong>${q} ${escHtml(sellT)}</strong></td>
              <td class="num">${fmtMoney(r.sellNotional)}</td>
              <td class="num accent"><strong>${fmtShares(r.buyShares, 3)} ${escHtml(buyT)}</strong></td>
              <td class="num">${r.wholeBuyShares} sh</td>
              <td class="num">${fmtMoney(r.residualCash)}</td>
            </tr>`;
        }).join('');
      }
    }

    renderDca() {
      const e = this.el;
      const m = this._resolveMarket(e.dcaSym.value);
      const ticker = m ? m.ticker : (e.dcaSym.value.trim().toUpperCase() || 'STOCK');
      const res = CalcMath.dcaAverageDown({
        currentQty: parseFloat(e.dcaCurQty.value),
        currentAvg: parseFloat(e.dcaCurAvg.value),
        addMode: this.state.dcaAddMode,
        addAmount: parseFloat(e.dcaAddAmount.value),
        buyPrice: parseFloat(e.dcaBuyPrice.value),
        livePrice: m ? m.price : parseFloat(e.dcaBuyPrice.value),
        targetAvg: parseFloat(e.dcaTargetAvg.value),
      });

      if (!res.valid) {
        e.dcaOut.innerHTML = `<div class="calc-empty">${escHtml(res.error)}</div>`;
        return;
      }

      const deltaCls = res.avgDelta <= 0 ? 'up' : 'down';
      let targetHtml = '';
      if (res.targetResult) {
        if (res.targetResult.reachable) {
          const tr = res.targetResult;
          targetHtml = `
            <div class="calc-solver-card">
              <div class="calc-solver-title">Target Average Price Solver (${fmtPx(tr.targetAvg)})</div>
              <div class="calc-solver-body">
                To reach an average cost of <strong>${fmtPx(tr.targetAvg)}</strong> at ${fmtPx(parseFloat(e.dcaBuyPrice.value))}, buy
                <strong class="accent">${fmtShares(tr.sharesNeeded)} shares</strong> (${fmtMoney(tr.cashNeeded)} cash) →
                <strong>${fmtShares(tr.resultingTotalShares)} total shares</strong>.
              </div>
            </div>`;
        } else {
          targetHtml = `<div class="calc-warn">${escHtml(res.targetResult.reason)}</div>`;
        }
      }

      e.dcaOut.innerHTML = `
        <div class="calc-hero-box">
          <div class="calc-hero-label">NEW BLENDED AVERAGE COST · ${escHtml(ticker)}</div>
          <div class="calc-hero-val">${fmtPx(res.newAvg)}</div>
          <div class="calc-hero-sub">
            From ${fmtPx(res.oldAvg)} (<span class="${deltaCls}">${res.avgDelta >= 0 ? '+' : '-'}${fmtMoney(Math.abs(res.avgDelta))} / ${fmtPct(res.avgDeltaPct)}</span>)
          </div>
        </div>
        <div class="calc-kpi-grid">
          <div class="calc-kpi">
            <span>New Total Shares</span>
            <strong>${fmtShares(res.newQty)} sh</strong>
            <small>${fmtShares(res.oldQty)} existing + ${fmtShares(res.addShares)} new</small>
          </div>
          <div class="calc-kpi">
            <span>Cash Needed for Add-On</span>
            <strong class="accent">${fmtMoney(res.addCash)}</strong>
            <small>Total basis: ${fmtMoney(res.newCost)}</small>
          </div>
          <div class="calc-kpi">
            <span>Old Move to Breakeven</span>
            <strong>${fmtPct(res.oldBreakevenPct)}</strong>
            <small>To reach ${fmtPx(res.oldAvg)}</small>
          </div>
          <div class="calc-kpi">
            <span>New Move to Breakeven</span>
            <strong class="${res.newBreakevenPct <= res.oldBreakevenPct ? 'up' : ''}">${fmtPct(res.newBreakevenPct)}</strong>
            <small>To reach ${fmtPx(res.newAvg)}</small>
          </div>
        </div>
        ${targetHtml}
      `;
    }

    renderRisk() {
      const e = this.el;
      const m = this._resolveMarket(e.riskSym.value);
      const ticker = m ? m.ticker : (e.riskSym.value.trim().toUpperCase() || 'STOCK');
      const res = CalcMath.positionRisk({
        side: this.state.riskSide,
        accountSize: parseFloat(e.riskAcct.value),
        riskMode: this.state.riskMode,
        riskValue: parseFloat(e.riskVal.value),
        entryPrice: parseFloat(e.riskEntry.value),
        stopPrice: parseFloat(e.riskStop.value),
        targetPrice: parseFloat(e.riskTarget.value),
        leverage: parseFloat(e.riskLev.value) || 1,
      });

      if (!res.valid) {
        e.riskOut.innerHTML = `<div class="calc-empty">${escHtml(res.error)}</div>`;
        return;
      }

      const warnHtml = res.exceedsCash
        ? `<div class="calc-warn">⚠ Required margin (${fmtMoney(res.marginNeeded)}) exceeds your account size (${fmtMoney(parseFloat(e.riskAcct.value))}). Widen stop, reduce risk, or increase leverage.</div>`
        : '';

      let rrBarHtml = '';
      if (res.rrRatio && res.rrRatio > 0) {
        const riskW = (1 / (1 + res.rrRatio)) * 100;
        const rewardW = 100 - riskW;
        rrBarHtml = `
          <div class="calc-rr-bar-wrap">
            <div class="calc-rr-labels">
              <span class="down">Risk ${fmtMoney(res.riskDollars)} (-${res.stopDistPct.toFixed(2)}%)</span>
              <strong>1 : ${res.rrRatio.toFixed(2)} R · Breakeven Win Rate ${res.breakevenWinRate.toFixed(1)}%</strong>
              <span class="up">Reward ${fmtMoney(res.estProfit)} (+${res.targetDistPct.toFixed(2)}%)</span>
            </div>
            <div class="calc-rr-bar">
              <div class="calc-rr-loss" style="width:${riskW.toFixed(1)}%"></div>
              <div class="calc-rr-win" style="width:${rewardW.toFixed(1)}%"></div>
            </div>
          </div>`;
      }

      e.riskOut.innerHTML = `
        <div class="calc-hero-box">
          <div class="calc-hero-label">OPTIMAL ${res.side.toUpperCase()} POSITION SIZE · ${escHtml(ticker)}</div>
          <div class="calc-hero-val">${fmtShares(res.optShares)} shares</div>
          <div class="calc-hero-sub">
            Whole shares: <strong>${res.wholeShares.toLocaleString('en-US')} sh</strong> · Notional: <strong>${fmtMoney(res.notional)}</strong>${res.acctAllocPct ? ` (${res.acctAllocPct.toFixed(1)}% of account)` : ''}
          </div>
        </div>
        ${warnHtml}
        ${rrBarHtml}
        <div class="calc-kpi-grid">
          <div class="calc-kpi">
            <span>Max Dollar Risk at Stop</span>
            <strong class="down">-${fmtMoney(res.riskDollars)}</strong>
            <small>${res.riskPctOfAcct ? `${res.riskPctOfAcct.toFixed(2)}% of account · ` : ''}${fmtPx(res.riskPerShare)}/sh</small>
          </div>
          <div class="calc-kpi">
            <span>Projected Profit at Target</span>
            <strong class="up">${res.estProfit ? fmtMoney(res.estProfit, true) : '—'}</strong>
            <small>${res.rrRatio ? `${res.rrRatio.toFixed(2)}R multiple` : 'Enter a valid target price'}</small>
          </div>
          <div class="calc-kpi">
            <span>${res.leverage > 1 ? `Margin Required (${res.leverage}×)` : 'Cash Required (1×)'}</span>
            <strong class="accent">${fmtMoney(res.marginNeeded)}</strong>
            <small>Notional ${fmtMoney(res.notional)}</small>
          </div>
          <div class="calc-kpi">
            <span>${res.estLiqPrice != null ? 'Est. Liquidation Price' : 'Stop-Loss Distance'}</span>
            <strong>${res.estLiqPrice != null ? fmtPx(res.estLiqPrice) : `${res.stopDistPct.toFixed(2)}%`}</strong>
            <small>${res.estLiqPrice != null ? `Approx. at ${res.leverage}× isolated` : `Stop @ ${fmtPx(res.stopPrice)}`}</small>
          </div>
        </div>
      `;
    }

    renderTarget() {
      const e = this.el;
      const m = this._resolveMarket(e.targetSym.value);
      const ticker = m ? m.ticker : (e.targetSym.value.trim().toUpperCase() || 'STOCK');
      const res = CalcMath.profitTarget({
        side: this.state.targetSide,
        inputUnit: this.state.targetUnit,
        amount: parseFloat(e.targetAmt.value),
        entryPrice: parseFloat(e.targetEntry.value),
        targetPrice: parseFloat(e.targetExit.value),
        leverage: parseFloat(e.targetLev.value) || 1,
        feeBps: parseFloat(e.targetFeeBps.value) || 0,
        desiredProfit: parseFloat(e.targetGoalProfit.value),
      });

      if (!res.valid) {
        e.targetOut.innerHTML = `<div class="calc-empty">${escHtml(res.error)}</div>`;
        if (e.targetMatrixBody) e.targetMatrixBody.innerHTML = '';
        return;
      }

      const pnlCls = res.netPnl >= 0 ? 'up' : 'down';
      let goalHtml = '';
      if (res.goalResult) {
        if (res.goalResult.reachable) {
          const gr = res.goalResult;
          goalHtml = `
            <div class="calc-solver-card">
              <div class="calc-solver-title">Profit Goal Solver (+${fmtMoney(gr.desiredProfit)})</div>
              <div class="calc-solver-body">
                To net <strong class="up">${fmtMoney(gr.desiredProfit, true)}</strong> on ${fmtShares(res.shares)} ${escHtml(ticker)},
                price needs to reach <strong class="accent">${fmtPx(gr.neededPrice)}</strong> (${fmtPct(gr.neededMovePct)} from entry).
              </div>
            </div>`;
        } else {
          goalHtml = `<div class="calc-warn">${escHtml(res.goalResult.reason)}</div>`;
        }
      }

      e.targetOut.innerHTML = `
        <div class="calc-hero-box">
          <div class="calc-hero-label">PROJECTED NET P/L · ${res.side.toUpperCase()} ${fmtShares(res.shares)} ${escHtml(ticker)}</div>
          <div class="calc-hero-val ${pnlCls}">${fmtMoney(res.netPnl, true)} <span class="calc-hero-pct">(${fmtPct(res.roePct)})</span></div>
          <div class="calc-hero-sub">
            ${fmtPx(res.entryPrice)} → ${fmtPx(res.targetPrice)} (${fmtPct(res.priceMovePct)}) · Final Value: <strong>${fmtMoney(res.projectedEquity)}</strong>
          </div>
        </div>
        <div class="calc-kpi-grid">
          <div class="calc-kpi">
            <span>Initial Capital / Margin</span>
            <strong>${fmtMoney(res.marginUsed)}</strong>
            <small>Notional ${fmtMoney(res.entryNotional)}</small>
          </div>
          <div class="calc-kpi">
            <span>Projected Final Equity</span>
            <strong class="${pnlCls}">${fmtMoney(res.projectedEquity)}</strong>
            <small>After ${fmtMoney(res.roundTripFees)} est. fees</small>
          </div>
          <div class="calc-kpi">
            <span>Return on Margin (ROE)</span>
            <strong class="${pnlCls}">${fmtPct(res.roePct)}</strong>
            <small>Stock move ${fmtPct(res.priceMovePct)}</small>
          </div>
          <div class="calc-kpi">
            <span>Gross P/L (Pre-Fee)</span>
            <strong class="${res.grossPnl >= 0 ? 'up' : 'down'}">${fmtMoney(res.grossPnl, true)}</strong>
            <small>${fmtShares(res.shares)} shares</small>
          </div>
        </div>
        ${goalHtml}
      `;

      if (e.targetMatrixBody) {
        e.targetMatrixBody.innerHTML = res.matrix.map((row) => {
          const cls = row.netPnl >= 0 ? 'pct-up' : 'pct-down';
          return `
            <tr>
              <td class="${row.mPct >= 0 ? 'pct-up' : 'pct-down'}"><strong>${row.mPct > 0 ? '+' : ''}${row.mPct}%</strong></td>
              <td class="num">${fmtPx(row.px)}</td>
              <td class="num">${fmtMoney(row.val)}</td>
              <td class="num ${cls}"><strong>${fmtMoney(row.netPnl, true)}</strong></td>
              <td class="num ${cls}">${fmtPct(row.roe)}</td>
            </tr>`;
        }).join('');
      }
    }
  }

  HS.CalcMath = CalcMath;
  HS.TradingCalculatorController = TradingCalculatorController;
})(window);
