/* HyperStocks Web Configuration
   - HS_STATIC_WEB: true enables direct browser-to-Hyperliquid mode (GitHub Pages / static hosts).
   - HS_WEB_API_BASE: optional Cloudflare Worker / proxy base URL for Nasdaq Insights & Yahoo backfill.
     Leave empty ('') for pure static GitHub Pages mode.
   - HS_LEGAL_STORAGE: 'local' remembers acceptance per browser until terms version changes,
     or set to 'session' to require re-acceptance on every new browser tab/session. */
window.HS_STATIC_WEB = true;
window.HS_WEB_API_BASE = '';
window.HS_LEGAL_STORAGE = 'local';
