(function () {
  "use strict";

  function injectResponsiveFixes() {
    if (document.getElementById("bikecomanda-responsive-fix-style")) return;

    const style = document.createElement("style");
    style.id = "bikecomanda-responsive-fix-style";
    style.textContent = `
      html,
      body,
      #app {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: hidden;
      }

      body {
        touch-action: pan-y;
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
        min-width: 0;
        max-width: 100%;
      }

      .sidebar {
        overflow-x: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .sidebar::-webkit-scrollbar,
      .nav::-webkit-scrollbar,
      .mobile-nav::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }

      .nav,
      .mobile-nav {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .nav-button,
      .btn,
      input,
      select,
      textarea {
        max-width: 100%;
      }

      @media (min-width: 901px) {
        .sidebar {
          height: 100dvh;
          overflow-y: auto;
          padding-bottom: 18px;
        }

        .nav {
          padding-right: 0;
        }
      }

      @media (max-width: 900px) {
        :root {
          --radius: 16px;
        }

        .app-shell {
          display: block !important;
          width: 100% !important;
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        .sidebar {
          position: relative !important;
          top: auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 16px 16px 10px !important;
          border-right: 0 !important;
          border-bottom: 1px solid var(--line) !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .sidebar .brand-mark {
          width: 100%;
          margin: 0 0 10px !important;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .sidebar .brand-mark .brand-icon {
          flex: 0 0 auto;
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
          gap: 10px !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 8px 0 0 !important;
          padding: 0 2px 8px 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .nav-button {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: max-content !important;
          max-width: 86vw !important;
          min-height: 42px !important;
          padding: 10px 14px !important;
          border-radius: 14px !important;
          white-space: nowrap !important;
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
          padding: 22px 16px 28px !important;
          overflow-x: hidden !important;
        }

        .topbar,
        .page-header {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 14px !important;
          align-items: stretch !important;
        }

        .topbar h1,
        .page-header h1 {
          font-size: clamp(30px, 12vw, 44px) !important;
          line-height: 0.98 !important;
          overflow-wrap: anywhere;
        }

        .topbar p,
        .page-header p {
          font-size: 17px !important;
          line-height: 1.55 !important;
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
        }

        .metric-card,
        .card {
          width: 100% !important;
          overflow: hidden !important;
        }

        .toolbar,
        .form-actions,
        .product-action-group {
          display: grid !important;
          grid-template-columns: 1fr !important;
          width: 100% !important;
        }

        .command-card {
          grid-template-columns: 1fr !important;
        }

        .table-wrap {
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
        }

        table {
          min-width: 560px;
        }

        .field.full,
        .field {
          grid-column: 1 / -1 !important;
        }
      }

      @media (max-width: 520px) {
        .sidebar {
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .main {
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .card {
          padding: 16px !important;
        }

        .nav-button {
          font-size: 15px !important;
        }

        .btn {
          min-height: 48px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectResponsiveFixes();
  document.addEventListener("DOMContentLoaded", injectResponsiveFixes);
  window.addEventListener("resize", injectResponsiveFixes);
})();
