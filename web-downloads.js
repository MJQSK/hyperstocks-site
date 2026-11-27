/* HyperStocks Web Downloads & About Modal */
(function () {
  var DL_BASE = 'https://github.com/MJQSK/hyperstocks-site/releases/latest/download';

  function setLocked(locked) {
    if (locked && document.activeElement && document.activeElement.blur) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    document.body.classList.toggle('hs-legal-locked', locked);
    var appEl = document.getElementById('app');
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

  function openDownloadsModal() {
    var overlay = document.getElementById('hsLegalGate');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hsLegalGate';
      overlay.className = 'hs-legal-backdrop hidden';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML =
      '<div class="hs-legal-card hs-dl-modal-card" role="dialog" aria-modal="true" aria-labelledby="hsDlTitle">' +
        '<div class="hs-legal-head">' +
          '<div class="hs-legal-badge" style="background:rgba(var(--bull-rgb),0.14);color:var(--bull);border-color:rgba(var(--bull-rgb),0.35)">Full-Featured Desktop &amp; Mobile App</div>' +
          '<h2 id="hsDlTitle">Download the HyperStocks App</h2>' +
          '<div class="hs-legal-meta">Use HyperStocks directly in your browser or install the full desktop and mobile app for your device</div>' +
        '</div>' +
        '<div class="hs-legal-body">' +
          '<div class="hs-edu-box">' +
            '<strong>Not-for-Profit Educational &amp; Teaching Resource Only:</strong> HyperStocks is a free, independent, non-commercial educational and teaching project with no ads, no accounts, no wallets, and no monetization. Informational and educational use only, not financial advice.' +
          '</div>' +
          '<div class="hs-dl-grid">' +
            '<a class="hs-dl-card" href="' + DL_BASE + '/HyperStocks.dmg">' +
              '<div class="hs-dl-title">macOS <span class="hs-dl-ext">.dmg</span></div>' +
              '<div class="hs-dl-sub">Apple Silicon &amp; Intel Universal · Developer ID Signed &amp; Apple Notarized</div>' +
              '<div class="hs-dl-cta">Download .dmg ↓</div>' +
            '</a>' +
            '<a class="hs-dl-card" href="' + DL_BASE + '/HyperStocks.exe">' +
              '<div class="hs-dl-title">Windows <span class="hs-dl-ext">.exe</span></div>' +
              '<div class="hs-dl-sub">Windows 10 / 11 (64-bit) · Standalone Desktop Executable</div>' +
              '<div class="hs-dl-cta">Download .exe ↓</div>' +
            '</a>' +
            '<a class="hs-dl-card" href="' + DL_BASE + '/HyperStocks.apk">' +
              '<div class="hs-dl-title">Android <span class="hs-dl-ext">.apk</span></div>' +
              '<div class="hs-dl-sub">Direct Android Installer Package (Phones &amp; Tablets)</div>' +
              '<div class="hs-dl-cta">Download .apk ↓</div>' +
            '</a>' +
            '<div class="hs-dl-card coming-soon" aria-disabled="true">' +
              '<div class="hs-dl-title">iOS &amp; iPadOS <span class="hs-dl-ext">iPhone &amp; iPad</span></div>' +
              '<div class="hs-dl-sub">Use HyperStocks directly in Safari on iPhone and iPad today.</div>' +
              '<div class="hs-dl-cta">Coming Soon</div>' +
            '</div>' +
          '</div>' +
          '<div class="hs-legal-callout">' +
            '<strong>Experimental Software &amp; Download Disclaimer:</strong> All downloadable builds (.dmg, .exe, .apk) are independent, experimental software provided strictly "as is" and "as available" without warranty or guarantee of bug-free operation, compatibility, security updates, or ongoing maintenance. You download, install, and run these files strictly at your own sole risk. The creator, developer, operator, and contributors assume zero liability and are not responsible or liable under any circumstances for any damage to, impact on, or incompatibility with your computer, phone, tablet, operating system, software, network, battery, or stored files and data. By downloading any file above, you accept these conditions and the <a href="terms.html" target="_blank" rel="noopener noreferrer">Full Terms &amp; Disclaimer</a>.' +
          '</div>' +
          '<div class="hs-legal-sec">' +
            '<p>Need help, FAQs, or want to see all release packages? Visit the <a href="support.html" target="_blank" rel="noopener noreferrer">About &amp; Support Page</a> or <a href="https://github.com/MJQSK/hyperstocks-site/releases/latest" target="_blank" rel="noopener noreferrer">GitHub Releases</a>.</p>' +
          '</div>' +
        '</div>' +
        '<div class="hs-legal-foot">' +
          '<div class="hs-legal-actions">' +
            '<div class="hs-legal-links">' +
              '<a href="support.html" target="_blank" rel="noopener noreferrer">About &amp; Support</a>' +
              '<a href="terms.html" target="_blank" rel="noopener noreferrer">Terms &amp; Disclaimer</a>' +
              '<a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>' +
            '</div>' +
            '<div class="hs-legal-btns">' +
              '<button type="button" class="hs-legal-btn agree" id="hsDlClose">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    overlay.classList.remove('hidden');
    setLocked(true);

    var closeModal = function () {
      overlay.classList.add('hidden');
      setLocked(false);
    };
    var btnClose = document.getElementById('hsDlClose');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    overlay.onclick = function (ev) {
      if (ev.target === overlay) {
        overlay.onclick = null;
        closeModal();
      }
    };
  }

  function initDownloads() {
    var triggers = [
      document.getElementById('btnWebDownloads'),
      document.getElementById('btnSidebarDownloadApp'),
    ];
    triggers.forEach(function (btn) {
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          openDownloadsModal();
        });
      }
    });

    var card = document.getElementById('webSidebarDownloadCard');
    var dismissBtn = document.getElementById('btnDismissSidebarDl');
    try { window.sessionStorage.removeItem('hsHideSidebarDlCard'); } catch (_) {}
    if (dismissBtn && card) {
      dismissBtn.addEventListener('click', function (e) {
        e.preventDefault();
        card.classList.add('hidden');
      });
    }
  }

  window.openHyperStocksDownloads = openDownloadsModal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDownloads);
  } else {
    initDownloads();
  }
})();
