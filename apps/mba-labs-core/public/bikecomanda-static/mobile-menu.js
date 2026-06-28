(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-mobile-menu-style";
  const BACKDROP_CLASS = "bike-menu-backdrop";
  const OPEN_CLASS = "bike-mobile-menu-open";

  function injectMobileMenuStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .bike-menu-toggle {
        display: none;
      }

      .bike-mobile-menu-panel {
        display: contents;
      }

      .bike-menu-backdrop {
        display: none;
      }

      @media (max-width: 900px) {
        .sidebar {
          position: sticky !important;
          top: 0 !important;
          z-index: 90 !important;
          overflow: visible !important;
          box-shadow: 0 8px 22px rgba(15, 32, 25, 0.08);
        }

        .sidebar .brand-mark {
          display: flex !important;
          width: 100% !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 0 !important;
        }

        .bike-menu-toggle {
          display: inline-grid !important;
          place-items: center;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 1px solid rgba(15, 138, 95, 0.22);
          border-radius: 14px;
          background: #ffffff;
          color: var(--primary-strong);
          box-shadow: 0 8px 18px rgba(15, 32, 25, 0.08);
          cursor: pointer;
        }

        .bike-menu-toggle-lines,
        .bike-menu-toggle-lines::before,
        .bike-menu-toggle-lines::after {
          display: block;
          width: 18px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transition: transform 0.18s ease, opacity 0.18s ease;
        }

        .bike-menu-toggle-lines {
          position: relative;
        }

        .bike-menu-toggle-lines::before,
        .bike-menu-toggle-lines::after {
          content: "";
          position: absolute;
          left: 0;
        }

        .bike-menu-toggle-lines::before {
          top: -6px;
        }

        .bike-menu-toggle-lines::after {
          top: 6px;
        }

        body.${OPEN_CLASS} .bike-menu-toggle-lines {
          background: transparent;
        }

        body.${OPEN_CLASS} .bike-menu-toggle-lines::before {
          transform: translateY(6px) rotate(45deg);
        }

        body.${OPEN_CLASS} .bike-menu-toggle-lines::after {
          transform: translateY(-6px) rotate(-45deg);
        }

        .bike-mobile-menu-panel {
          display: none !important;
          position: absolute;
          top: calc(100% - 2px);
          right: 12px;
          left: 12px;
          z-index: 120;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(15, 138, 95, 0.14);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 20px 50px rgba(12, 31, 24, 0.2);
          backdrop-filter: blur(14px);
          max-height: min(72vh, 560px);
          overflow-y: auto;
        }

        body.${OPEN_CLASS} .bike-mobile-menu-panel {
          display: grid !important;
        }

        .bike-mobile-menu-panel .nav {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 8px !important;
          overflow: visible !important;
          scroll-snap-type: none !important;
        }

        .bike-mobile-menu-panel .nav-button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 44px !important;
          justify-content: center !important;
          padding: 10px 8px !important;
          border-radius: 14px !important;
          background: #f6fbf8;
          border: 1px solid rgba(15, 138, 95, 0.1);
          color: #214337;
          white-space: normal !important;
          text-align: center !important;
          font-size: 13px !important;
          line-height: 1.15 !important;
        }

        .bike-mobile-menu-panel .nav-button.is-active {
          background: var(--primary-soft) !important;
          border-color: rgba(15, 138, 95, 0.26) !important;
          color: var(--primary-strong) !important;
        }

        .bike-mobile-menu-panel > .btn.full {
          width: 100% !important;
          min-height: 44px !important;
          margin-top: 2px !important;
          border-radius: 14px !important;
        }

        body:not(.${OPEN_CLASS}) .bike-mobile-menu-panel {
          pointer-events: none;
        }

        body.${OPEN_CLASS} .bike-menu-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 70;
          background: rgba(9, 22, 17, 0.18);
        }
      }

      @media (max-width: 430px) {
        .bike-mobile-menu-panel {
          left: 10px;
          right: 10px;
          padding: 10px;
          border-radius: 16px;
        }

        .bike-mobile-menu-panel .nav {
          gap: 7px !important;
        }

        .bike-mobile-menu-panel .nav-button {
          min-height: 42px !important;
          font-size: 12.5px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureBackdrop() {
    let backdrop = document.querySelector(`.${BACKDROP_CLASS}`);
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.className = BACKDROP_CLASS;
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", closeMobileMenu);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function enhanceMobileMenu() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    const brand = sidebar.querySelector(".brand-mark");
    if (!brand) return;

    let panel = sidebar.querySelector(".bike-mobile-menu-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "bike-mobile-menu-panel";
      panel.id = "bike-mobile-menu-panel";
      brand.insertAdjacentElement("afterend", panel);
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
      toggle.setAttribute("aria-label", "Abrir menu");
      toggle.setAttribute("aria-controls", "bike-mobile-menu-panel");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = '<span class="bike-menu-toggle-lines" aria-hidden="true"></span>';
      brand.appendChild(toggle);
      toggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleMobileMenu();
      });
    }

    ensureBackdrop();
    syncToggleState();
  }

  function syncToggleState() {
    const isOpen = document.body.classList.contains(OPEN_CLASS);
    const toggle = document.querySelector(".bike-menu-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    }
  }

  function toggleMobileMenu() {
    document.body.classList.toggle(OPEN_CLASS);
    syncToggleState();
  }

  function closeMobileMenu() {
    document.body.classList.remove(OPEN_CLASS);
    syncToggleState();
  }

  function patchRenderForMenu() {
    if (window.__bikeComandaMobileMenuPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedMobileMenuRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(enhanceMobileMenu, 0);
      return result;
    };
    window.__bikeComandaMobileMenuPatched = true;
  }

  injectMobileMenuStyles();
  ensureBackdrop();
  patchRenderForMenu();
  setTimeout(enhanceMobileMenu, 0);

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest(".bike-mobile-menu-panel [data-action]")) {
      closeMobileMenu();
      return;
    }

    if (
      document.body.classList.contains(OPEN_CLASS) &&
      !target.closest(".bike-mobile-menu-panel") &&
      !target.closest(".bike-menu-toggle")
    ) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMobileMenu();
  });

  document.addEventListener("DOMContentLoaded", function () {
    injectMobileMenuStyles();
    ensureBackdrop();
    patchRenderForMenu();
    enhanceMobileMenu();
  });
})();
