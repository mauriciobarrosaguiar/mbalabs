(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-mobile-menu-style";
  const BACKDROP_CLASS = "bike-menu-backdrop";
  const OPEN_CLASS = "bike-mobile-menu-open";

  function injectMobileMenuStyles() {
    const oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .bike-menu-toggle,
      .bike-mobile-menu-panel,
      .bike-menu-backdrop { display: none; }

      @media (max-width: 900px) {
        body.${OPEN_CLASS} { overflow: hidden !important; }

        .sidebar {
          position: sticky !important;
          top: 0 !important;
          z-index: 90 !important;
          min-height: 68px !important;
          padding: 12px 18px !important;
          border-right: 0 !important;
          border-bottom: 1px solid rgba(15, 138, 95, 0.12) !important;
          background: rgba(255, 255, 255, 0.98) !important;
          box-shadow: 0 8px 24px rgba(14, 35, 28, 0.10) !important;
          overflow: visible !important;
        }

        .sidebar .brand-mark {
          display: flex !important;
          width: 100% !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          margin: 0 !important;
          color: var(--primary-strong) !important;
          font-size: 24px !important;
          font-weight: 900 !important;
        }

        .sidebar .brand-icon {
          width: 34px !important;
          height: 34px !important;
          border: 0 !important;
          border-radius: 12px !important;
          background: var(--primary-soft) !important;
          color: var(--primary-strong) !important;
          font-size: 18px !important;
          font-weight: 900 !important;
        }

        .user-card,
        .mobile-nav { display: none !important; }

        .bike-menu-toggle {
          display: inline-grid !important;
          place-items: center;
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          border: 1px solid rgba(15, 138, 95, 0.22);
          border-radius: 15px;
          background: #ffffff;
          color: var(--primary-strong);
          box-shadow: 0 10px 24px rgba(15, 32, 25, 0.10);
          cursor: pointer;
        }

        .bike-menu-toggle span,
        .bike-menu-toggle span::before,
        .bike-menu-toggle span::after {
          display: block;
          width: 20px;
          height: 2px;
          border-radius: 999px;
          background: currentColor !important;
        }

        .bike-menu-toggle span { position: relative; }
        .bike-menu-toggle span::before,
        .bike-menu-toggle span::after { content: ""; position: absolute; left: 0; }
        .bike-menu-toggle span::before { top: -6px; }
        .bike-menu-toggle span::after { top: 6px; }

        .bike-menu-backdrop {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          z-index: 120 !important;
          background: rgba(8, 20, 16, 0.34) !important;
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s ease;
        }

        body.${OPEN_CLASS} .bike-menu-backdrop {
          opacity: 1;
          pointer-events: auto;
        }

        .bike-mobile-menu-panel {
          display: flex !important;
          flex-direction: column !important;
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          z-index: 140 !important;
          width: min(86vw, 360px) !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)) !important;
          border: 0 !important;
          border-left: 1px solid rgba(15, 138, 95, 0.14) !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: -18px 0 50px rgba(12, 30, 24, 0.22) !important;
          transform: translateX(104%);
          transition: transform .22s ease;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-y !important;
        }

        body.${OPEN_CLASS} .bike-mobile-menu-panel { transform: translateX(0) !important; }

        .bike-menu-head {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 14px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--line);
          background: #ffffff;
        }

        .bike-menu-head strong { display: block; font-size: 22px; }
        .bike-menu-head span { display: block; margin-top: 2px; color: var(--muted); font-size: 13px; }
        .bike-menu-close {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 30px;
          line-height: 1;
          cursor: pointer;
        }

        .bike-mobile-menu-panel .nav {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        .bike-mobile-menu-panel .nav-button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 46px !important;
          justify-content: flex-start !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(15, 138, 95, 0.10) !important;
          border-radius: 14px !important;
          background: #f7fbf9 !important;
          color: #213d34 !important;
          text-align: left !important;
          white-space: normal !important;
        }

        .bike-mobile-menu-panel .nav-button.is-active {
          background: var(--primary-soft) !important;
          border-color: rgba(15, 138, 95, 0.28) !important;
          color: var(--primary-strong) !important;
        }

        .bike-mobile-menu-panel > .btn.full {
          width: 100% !important;
          margin-top: 12px !important;
          border-radius: 14px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function closeMenu() {
    document.body.classList.remove(OPEN_CLASS);
    syncToggle();
  }

  function toggleMenu() {
    document.body.classList.toggle(OPEN_CLASS);
    syncToggle();
  }

  function syncToggle() {
    const isOpen = document.body.classList.contains(OPEN_CLASS);
    const toggle = document.querySelector(".bike-menu-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    }
  }

  function ensureBackdrop() {
    let backdrop = document.querySelector(`.${BACKDROP_CLASS}`);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.className = BACKDROP_CLASS;
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", closeMenu);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function enhanceMenu() {
    const sidebar = document.querySelector(".sidebar");
    const brand = sidebar?.querySelector(".brand-mark");
    if (!sidebar || !brand) return;

    let panel = sidebar.querySelector(".bike-mobile-menu-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "bike-mobile-menu-panel";
      panel.id = "bike-mobile-menu-panel";
      brand.insertAdjacentElement("afterend", panel);
    }

    if (!panel.querySelector(".bike-menu-head")) {
      const title = document.createElement("div");
      title.className = "bike-menu-head";
      title.innerHTML = '<div><strong>Menu</strong><span>BikeComanda</span></div><button class="bike-menu-close" type="button" aria-label="Fechar menu">×</button>';
      panel.prepend(title);
      title.querySelector("button")?.addEventListener("click", closeMenu);
    }

    const nav = sidebar.querySelector(":scope > .nav") || panel.querySelector(".nav");
    if (nav && nav.parentElement !== panel) panel.appendChild(nav);

    const logout = sidebar.querySelector(':scope > [data-action="logout"]') || panel.querySelector('[data-action="logout"]');
    if (logout && logout.parentElement !== panel) panel.appendChild(logout);

    let toggle = brand.querySelector(".bike-menu-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "bike-menu-toggle";
      toggle.setAttribute("aria-controls", "bike-mobile-menu-panel");
      toggle.setAttribute("aria-label", "Abrir menu");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = "<span aria-hidden='true'></span>";
      brand.appendChild(toggle);
      toggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleMenu();
      });
    }

    ensureBackdrop();
    syncToggle();
  }

  function navigateFromMenu(button) {
    const view = button?.dataset?.view;
    if (!view || typeof ui === "undefined") return false;
    ui.view = view;
    closeMenu();
    if (typeof render === "function") render();
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), 0);
    return true;
  }

  function patchRender() {
    if (window.__bikeComandaMenuPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedMenuRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(enhanceMenu, 0);
      return result;
    };
    window.__bikeComandaMenuPatched = true;
  }

  injectMobileMenuStyles();
  ensureBackdrop();
  patchRender();
  setTimeout(enhanceMenu, 0);

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const menuNavButton = target.closest('.bike-mobile-menu-panel [data-action="nav"]');
    if (menuNavButton) {
      event.preventDefault();
      event.stopPropagation();
      navigateFromMenu(menuNavButton);
      return;
    }

    if (target.closest(".bike-mobile-menu-panel [data-action]")) closeMenu();
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("DOMContentLoaded", function () {
    injectMobileMenuStyles();
    ensureBackdrop();
    patchRender();
    enhanceMenu();
  });
})();
