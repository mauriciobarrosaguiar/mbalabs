(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-shell-fix-style";
  const OPEN_CLASS = "bike-menu-open";

  function injectStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .login-page { display: none !important; }

      .bike-loading-page {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(135deg, #0f8a5f 0%, #086b51 100%);
        color: #fff;
      }
      .bike-loading-card {
        width: min(460px, 100%);
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 24px;
        padding: 24px;
        background: rgba(255,255,255,.12);
        box-shadow: 0 24px 70px rgba(0,0,0,.18);
      }
      .bike-loading-card strong { font-size: 24px; display: block; margin-bottom: 14px; }
      .bike-loading-card p { margin: 0; color: rgba(255,255,255,.78); line-height: 1.45; }

      .bike-menu-toggle,
      .bike-drawer,
      .bike-drawer-backdrop { display: none; }

      @media (max-width: 900px) {
        body.${OPEN_CLASS} { overflow: hidden !important; }
        .app-shell.bike-fixed-shell { display: block !important; width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; padding-bottom: 0 !important; }
        .app-shell.bike-fixed-shell .sidebar {
          position: sticky !important;
          top: 0 !important;
          z-index: 150 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 68px !important;
          padding: 12px 18px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          border-right: 0 !important;
          border-bottom: 1px solid rgba(15,138,95,.12) !important;
          background: rgba(255,255,255,.98) !important;
          box-shadow: 0 8px 24px rgba(14,35,28,.1) !important;
          overflow: visible !important;
        }
        .app-shell.bike-fixed-shell .sidebar .brand-mark {
          width: auto !important;
          margin: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 12px !important;
          color: var(--primary-strong) !important;
          font-size: 24px !important;
          font-weight: 900 !important;
        }
        .app-shell.bike-fixed-shell .sidebar .brand-icon {
          width: 34px !important;
          height: 34px !important;
          border: 0 !important;
          border-radius: 12px !important;
          background: var(--primary-soft) !important;
          color: var(--primary-strong) !important;
          font-size: 18px !important;
          font-weight: 900 !important;
        }
        .app-shell.bike-fixed-shell .desktop-menu { display: none !important; }
        .app-shell.bike-fixed-shell .mobile-nav { display: none !important; }

        .bike-menu-toggle {
          display: inline-grid !important;
          place-items: center;
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          border: 1px solid rgba(15,138,95,.22);
          border-radius: 16px;
          background: #fff;
          color: var(--primary-strong);
          box-shadow: 0 10px 24px rgba(15,32,25,.10);
          cursor: pointer;
        }
        .bike-menu-toggle span,
        .bike-menu-toggle span::before,
        .bike-menu-toggle span::after {
          display: block;
          width: 21px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }
        .bike-menu-toggle span { position: relative; }
        .bike-menu-toggle span::before,
        .bike-menu-toggle span::after { content: ""; position: absolute; left: 0; }
        .bike-menu-toggle span::before { top: -7px; }
        .bike-menu-toggle span::after { top: 7px; }

        .bike-drawer-backdrop {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          z-index: 220 !important;
          opacity: 0;
          pointer-events: none;
          background: rgba(8,20,16,.35) !important;
          transition: opacity .18s ease;
        }
        body.${OPEN_CLASS} .bike-drawer-backdrop { opacity: 1; pointer-events: auto; }

        .bike-drawer {
          display: flex !important;
          flex-direction: column !important;
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 230 !important;
          width: min(86vw, 360px) !important;
          max-width: 360px !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          padding: 16px 16px calc(20px + env(safe-area-inset-bottom, 0px)) !important;
          background: #fff !important;
          border-left: 1px solid rgba(15,138,95,.14) !important;
          box-shadow: -18px 0 50px rgba(12,30,24,.22) !important;
          transform: translateX(105%);
          transition: transform .22s ease;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-y !important;
        }
        body.${OPEN_CLASS} .bike-drawer { transform: translateX(0); }

        .bike-drawer-head {
          position: sticky;
          top: -16px;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 0 14px;
          margin: -16px 0 14px;
          border-bottom: 1px solid var(--line);
          background: #fff;
        }
        .bike-drawer-head strong { display: block; font-size: 24px; color: var(--text); }
        .bike-drawer-head span { display: block; margin-top: 2px; font-size: 13px; color: var(--muted); }
        .bike-drawer-close {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--primary-soft);
          color: var(--primary-strong);
          font-size: 30px;
          line-height: 1;
          cursor: pointer;
        }
        .bike-drawer .user-card {
          display: block !important;
          flex: 0 0 auto;
          margin: 0 0 12px;
          border-radius: 16px;
        }
        .bike-drawer .nav {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        .bike-drawer .nav-button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 48px !important;
          justify-content: flex-start !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(15,138,95,.10) !important;
          border-radius: 14px !important;
          background: #f7fbf9 !important;
          color: #213d34 !important;
          text-align: left !important;
          white-space: normal !important;
          font-size: 15px !important;
        }
        .bike-drawer .nav-button.is-active {
          background: var(--primary-soft) !important;
          border-color: rgba(15,138,95,.28) !important;
          color: var(--primary-strong) !important;
        }
        .bike-drawer .btn.full {
          width: 100% !important;
          min-height: 46px !important;
          margin-top: 12px !important;
          border-radius: 14px !important;
          flex: 0 0 auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function loadingScreen() {
    const root = document.querySelector("#app");
    if (!root) return;
    root.innerHTML = `
      <main class="bike-loading-page">
        <section class="bike-loading-card">
          <strong>BikeComanda</strong>
          <p>Carregando o acesso do MBA Labs e sincronizando os dados da empresa.</p>
        </section>
      </main>
    `;
  }

  function openMenu() {
    document.body.classList.add(OPEN_CLASS);
    syncToggle();
  }

  function closeMenu() {
    document.body.classList.remove(OPEN_CLASS);
    syncToggle();
  }

  function toggleMenu() {
    document.body.classList.contains(OPEN_CLASS) ? closeMenu() : openMenu();
  }

  function syncToggle() {
    const opened = document.body.classList.contains(OPEN_CLASS);
    document.querySelectorAll("[data-bike-menu-toggle]").forEach((button) => {
      button.setAttribute("aria-expanded", String(opened));
      button.setAttribute("aria-label", opened ? "Fechar menu" : "Abrir menu");
    });
  }

  function navHtml() {
    return navItems()
      .map((item) => `<button class="nav-button ${ui.view === item.view ? "is-active" : ""}" type="button" data-action="nav" data-view="${item.view}">${esc(item.label)}</button>`)
      .join("");
  }

  function fixedShell(content) {
    const user = currentUser();
    const nav = navHtml();
    return `
      <div class="app-shell bike-fixed-shell">
        <aside class="sidebar">
          <div class="brand-mark"><span class="brand-icon">BC</span> BikeComanda</div>
          <button class="bike-menu-toggle" type="button" data-bike-menu-toggle aria-label="Abrir menu" aria-expanded="false"><span aria-hidden="true"></span></button>
          <div class="desktop-menu">
            <div class="user-card"><strong>${esc(user.nome)}</strong><span>${esc(user.perfil)} · ${esc(settings().nome_loja)}</span></div>
            <nav class="nav">${nav}</nav>
            <button class="btn ghost full" type="button" data-action="logout">Sair</button>
          </div>
        </aside>
        <div class="bike-drawer-backdrop" data-bike-menu-close></div>
        <aside class="bike-drawer" aria-label="Menu do BikeComanda">
          <div class="bike-drawer-head"><div><strong>Menu</strong><span>BikeComanda</span></div><button class="bike-drawer-close" type="button" data-bike-menu-close aria-label="Fechar menu">×</button></div>
          <div class="user-card"><strong>${esc(user.nome)}</strong><span>${esc(user.perfil)} · ${esc(settings().nome_loja)}</span></div>
          <nav class="nav">${nav}</nav>
          <button class="btn ghost full" type="button" data-action="logout">Sair</button>
        </aside>
        <main class="main">
          <div class="topbar"><div><h1>${esc(pageTitle())}</h1><p>${esc(pageSubtitle())}</p></div>${canCreateOrders() ? `<button class="btn primary" type="button" data-action="nav" data-view="nova-comanda">Nova comanda</button>` : ""}</div>
          ${content}
        </main>
      </div>
    `;
  }

  function patch() {
    injectStyle();
    if (typeof renderLogin === "function") renderLogin = loadingScreen;
    if (typeof renderShell === "function") renderShell = fixedShell;
    if (typeof render === "function") render();
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-bike-menu-toggle]")) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
      return;
    }

    if (target.closest("[data-bike-menu-close]")) {
      event.preventDefault();
      closeMenu();
      return;
    }

    const navButton = target.closest('.bike-drawer [data-action="nav"]');
    if (navButton) {
      closeMenu();
      return;
    }

    if (target.closest('.bike-drawer [data-action="logout"]')) {
      closeMenu();
    }
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  patch();
  document.addEventListener("DOMContentLoaded", patch);
})();
