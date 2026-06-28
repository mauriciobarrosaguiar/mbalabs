(function () {
  "use strict";

  const style = document.createElement("style");
  style.id = "bike-lavagestor-menu-fix-style";
  style.textContent = `
    @media (max-width: 900px) {
      .bike-menu-toggle-lines,
      .bike-menu-toggle-lines::before,
      .bike-menu-toggle-lines::after {
        background: var(--primary-strong) !important;
        transform: none !important;
        opacity: 1 !important;
      }
      body.bike-mobile-menu-open .bike-menu-toggle-lines {
        background: var(--primary-strong) !important;
      }
      body.bike-mobile-menu-open .bike-menu-toggle-lines::before,
      body.bike-mobile-menu-open .bike-menu-toggle-lines::after {
        transform: none !important;
      }
      .bike-menu-backdrop {
        display: block !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 120 !important;
        background: rgba(8,20,16,.34) !important;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease;
      }
      body.bike-mobile-menu-open .bike-menu-backdrop {
        opacity: 1;
        pointer-events: auto;
      }
      .bike-mobile-menu-panel {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        left: auto !important;
        z-index: 140 !important;
        width: min(86vw, 360px) !important;
        height: 100dvh !important;
        max-height: none !important;
        padding: 16px !important;
        border-radius: 0 !important;
        border: 0 !important;
        border-left: 1px solid rgba(15,138,95,.14) !important;
        background: #fff !important;
        box-shadow: -18px 0 50px rgba(12,30,24,.22) !important;
        transform: translateX(104%);
        transition: transform .22s ease;
        overflow-y: auto !important;
      }
      body.bike-mobile-menu-open .bike-mobile-menu-panel {
        transform: translateX(0) !important;
      }
      .bike-mobile-menu-panel .nav {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }
      .bike-mobile-menu-panel .nav-button {
        width: 100% !important;
        min-height: 46px !important;
        justify-content: flex-start !important;
        text-align: left !important;
        padding: 12px 14px !important;
        border-radius: 14px !important;
      }
      .bike-lava-menu-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 14px;
        margin-bottom: 14px;
        border-bottom: 1px solid var(--line);
      }
      .bike-lava-menu-head strong { display: block; font-size: 22px; }
      .bike-lava-menu-head span { display: block; margin-top: 2px; color: var(--muted); font-size: 13px; }
      .bike-lava-menu-close {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: var(--primary-soft);
        color: var(--primary-strong);
        font-size: 30px;
        line-height: 1;
      }
    }
  `;
  document.head.appendChild(style);

  function enhancePanel() {
    const panel = document.querySelector(".bike-mobile-menu-panel");
    if (!panel || panel.querySelector(".bike-lava-menu-head")) return;
    const title = document.createElement("div");
    title.className = "bike-lava-menu-head";
    title.innerHTML = `<div><strong>Menu</strong><span>BikeComanda</span></div><button class="bike-lava-menu-close" type="button" aria-label="Fechar menu">×</button>`;
    panel.prepend(title);
    title.querySelector("button")?.addEventListener("click", function () {
      document.body.classList.remove("bike-mobile-menu-open");
    });
  }

  const originalRender = typeof render === "function" ? render : null;
  if (originalRender && !window.__bikeLavaMenuFixPatched) {
    render = function (...args) {
      const result = originalRender.apply(this, args);
      setTimeout(enhancePanel, 0);
      return result;
    };
    window.__bikeLavaMenuFixPatched = true;
  }
  setTimeout(enhancePanel, 0);
})();
