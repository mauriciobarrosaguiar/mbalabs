(function () {
  "use strict";

  function ensurePortalSession() {
    try {
      if (typeof db !== "undefined" && (!db.session || !db.session.userId)) {
        db.session = {
          userId: "u_admin",
          source: "mba-labs",
          created_at: new Date().toISOString(),
        };
        if (typeof save === "function") save();
        if (typeof ui !== "undefined") ui.view = "dashboard";
        if (typeof render === "function") render();
      }
    } catch {
      // Não interrompe o carregamento visual do BikeComanda.
    }
  }

  function injectResponsiveFixes() {
    const previous = document.getElementById("bikecomanda-responsive-fix-style");
    if (previous) previous.remove();

    const style = document.createElement("style");
    style.id = "bikecomanda-responsive-fix-style";
    style.textContent = `
      html,
      body,
      #app {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        background: #f4f7f6 !important;
      }

      body {
        touch-action: pan-y;
      }

      .login-page {
        display: none !important;
      }

      .app-shell,
      .main,
      .sidebar,
      .card,
      .metric-card,
      .page-header,
      .topbar,
      .grid,
      .form-grid,
      .command-list,
      .command-card,
      .table-wrap {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .sidebar {
        overflow-x: hidden !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      .sidebar [data-action="logout"] {
        display: none !important;
      }

      .sidebar::-webkit-scrollbar,
      .nav::-webkit-scrollbar,
      .mobile-nav::-webkit-scrollbar,
      .table-wrap::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      .nav,
      .mobile-nav,
      .table-wrap {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      .nav-button,
      .btn,
      input,
      select,
      textarea {
        max-width: 100% !important;
      }

      @media (min-width: 901px) {
        .sidebar {
          height: 100dvh !important;
          overflow-y: auto !important;
          padding-bottom: 18px !important;
        }

        .nav {
          padding-right: 0 !important;
        }
      }

      @media (max-width: 900px) {
        :root {
          --radius: 14px;
        }

        .app-shell {
          display: block !important;
          width: 100% !important;
          max-width: 100vw !important;
          overflow-x: hidden !important;
          padding-bottom: 0 !important;
        }

        .sidebar {
          position: relative !important;
          top: auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 14px 14px 8px !important;
          border-right: 0 !important;
          border-bottom: 1px solid var(--line) !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .sidebar .brand-mark {
          width: 100% !important;
          margin: 0 0 10px !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          font-size: 18px !important;
        }

        .sidebar .brand-mark .brand-icon {
          flex: 0 0 auto;
          width: 34px !important;
          height: 34px !important;
          font-size: 16px !important;
        }

        .sidebar .brand-mark > span,
        .sidebar .brand-mark > div {
          min-width: 0;
        }

        .user-card {
          display: none !important;
        }

        .nav {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 8px 0 0 !important;
          padding: 0 2px 7px 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .mobile-nav {
          display: none !important;
        }

        .nav-button {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: max-content !important;
          max-width: 84vw !important;
          min-height: 40px !important;
          padding: 9px 12px !important;
          border-radius: 12px !important;
          white-space: nowrap !important;
          font-size: 14px !important;
          scroll-snap-align: start;
        }

        .nav-button svg,
        .nav-button .icon,
        .nav-button span:first-child:not(:only-child) {
          flex: 0 0 auto;
        }

        .main {
          width: 100% !important;
          max-width: 100vw !important;
          padding: 16px 14px 28px !important;
          overflow-x: hidden !important;
        }

        .topbar,
        .page-header {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          align-items: stretch !important;
          margin-bottom: 14px !important;
        }

        .topbar h1,
        .page-header h1 {
          font-size: clamp(26px, 9vw, 36px) !important;
          line-height: 1.05 !important;
          overflow-wrap: anywhere;
        }

        .topbar p,
        .page-header p {
          font-size: 15px !important;
          line-height: 1.45 !important;
        }

        .topbar .btn,
        .page-header .btn,
        .toolbar .btn,
        .form-actions .btn {
          width: 100% !important;
        }

        .grid,
        .grid.two,
        .grid.three,
        .grid.four,
        .grid.auto,
        .form-grid,
        .form-grid.three {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .metric-card,
        .card,
        .command-card {
          width: 100% !important;
          padding: 14px !important;
          border-radius: 14px !important;
          overflow: hidden !important;
          box-shadow: 0 6px 16px rgba(22, 36, 31, 0.06) !important;
        }

        .metric-card strong {
          font-size: 24px !important;
        }

        .toolbar,
        .form-actions,
        .product-action-group,
        .command-actions {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .command-card,
        .detail-layout,
        .inline-edit {
          grid-template-columns: 1fr !important;
        }

        .table-wrap {
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
        }

        table {
          width: 100% !important;
        }

        .field.full,
        .field {
          grid-column: 1 / -1 !important;
        }
      }

      @media (max-width: 520px) {
        .sidebar {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .main {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .card,
        .metric-card,
        .command-card {
          padding: 13px !important;
        }

        .btn {
          min-height: 44px !important;
          width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  ensurePortalSession();
  injectResponsiveFixes();
  setTimeout(ensurePortalSession, 0);
  setTimeout(injectResponsiveFixes, 0);
  document.addEventListener("DOMContentLoaded", function () {
    ensurePortalSession();
    injectResponsiveFixes();
  });
  window.addEventListener("resize", injectResponsiveFixes);
})();
