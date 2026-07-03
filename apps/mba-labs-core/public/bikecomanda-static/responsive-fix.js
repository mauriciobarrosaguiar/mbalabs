(function () {
  "use strict";

  function usePortalAccess() {
    try {
      if (typeof db === "undefined" || typeof ui === "undefined") return;
      const portalUser = window.BikeComandaPortalUser;
      if (!portalUser?.id) return;

      if (!Array.isArray(db.usuarios)) db.usuarios = [];
      const existing = db.usuarios.find((user) => user.id === portalUser.id);
      const userPayload = {
        id: portalUser.id,
        nome: portalUser.nome || "Usuário MBA Labs",
        email: portalUser.email || "",
        senha_hash: "",
        perfil: portalUser.perfil || "Admin",
        ativo: true,
        source: "mba-labs",
        empresa_id: portalUser.empresa_id || null,
        created_at: portalUser.created_at || new Date().toISOString(),
      };

      if (existing) Object.assign(existing, userPayload);
      else db.usuarios = [userPayload];

      if (!db.session || db.session.userId !== portalUser.id) {
        db.session = { userId: portalUser.id, source: "mba-labs" };
        ui.view = ui.view === "login" ? "dashboard" : ui.view;
        if (typeof save === "function") save();
        if (typeof render === "function") render();
      }
    } catch {
      // Mantém o BikeComanda funcionando mesmo se o contexto do portal ainda não carregou.
    }
  }

  function injectResponsiveFixes() {
    const oldStyle = document.getElementById("bikecomanda-responsive-fix-style");
    if (oldStyle) oldStyle.remove();

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
      .table-wrap,
      .detail-layout {
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
        }

        .sidebar .brand-mark {
          width: 100%;
          margin: 0 0 10px !important;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 18px;
        }

        .sidebar .brand-mark .brand-icon {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          font-size: 16px;
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
          padding: 0 2px 8px 0 !important;
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
          max-width: 86vw !important;
          min-height: 40px !important;
          padding: 9px 12px !important;
          border-radius: 12px !important;
          white-space: nowrap !important;
          font-size: 14px !important;
          scroll-snap-align: start;
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
        .form-grid.three,
        .detail-layout,
        .inline-edit {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .dashboard-metrics.grid.auto {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          align-items: stretch !important;
        }

        .dashboard-metrics .metric-card {
          min-height: 118px;
          padding: 12px !important;
          border-radius: 18px !important;
          border-color: rgba(15, 138, 95, 0.14) !important;
          background: linear-gradient(180deg, #ffffff 0%, #f8fcfa 100%) !important;
          box-shadow: 0 10px 22px rgba(14, 45, 34, 0.09) !important;
        }

        .dashboard-metrics .metric-card small {
          color: #52665e !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          line-height: 1.16 !important;
          letter-spacing: -0.01em;
        }

        .dashboard-metrics .metric-card strong {
          margin-top: 8px !important;
          font-size: clamp(19px, 5.6vw, 24px) !important;
          line-height: 1.05 !important;
          letter-spacing: -0.04em;
          overflow-wrap: anywhere;
        }

        .dashboard-metrics .metric-card .hint {
          margin-top: 7px !important;
          color: #6f7f79 !important;
          font-size: 11px !important;
          line-height: 1.25 !important;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .metric-card,
        .card,
        .command-card {
          width: 100% !important;
          padding: 14px !important;
          overflow: hidden !important;
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
          width: 100% !important;
          gap: 8px !important;
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

      @media (max-width: 430px) {
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

        .dashboard-metrics.grid.auto {
          gap: 8px !important;
        }

        .dashboard-metrics .metric-card {
          min-height: 112px;
          padding: 10px !important;
          border-radius: 16px !important;
        }

        .dashboard-metrics .metric-card strong {
          font-size: clamp(17px, 5.3vw, 21px) !important;
        }

        .dashboard-metrics .metric-card small,
        .dashboard-metrics .metric-card .hint {
          font-size: 10.5px !important;
        }

        .btn {
          min-height: 44px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function enhanceDashboardCards() {
    try {
      if (typeof ui === "undefined" || ui.view !== "dashboard") return;
      const dashboardGrid = [...document.querySelectorAll(".main > section.grid.auto")].find((section) => section.querySelector(".metric-card"));
      if (!dashboardGrid) return;
      dashboardGrid.classList.add("dashboard-metrics");
    } catch {
      // Ajuste visual não deve bloquear o uso do sistema.
    }
  }

  function patchRenderForDashboardCards() {
    if (window.__bikeComandaDashboardCardsPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedResponsiveRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(enhanceDashboardCards, 0);
      return result;
    };
    window.__bikeComandaDashboardCardsPatched = true;
  }

  patchRenderForDashboardCards();
  usePortalAccess();
  injectResponsiveFixes();
  setTimeout(usePortalAccess, 0);
  setTimeout(enhanceDashboardCards, 0);
  document.addEventListener("DOMContentLoaded", function () {
    patchRenderForDashboardCards();
    usePortalAccess();
    injectResponsiveFixes();
    enhanceDashboardCards();
  });
  window.addEventListener("resize", function () {
    injectResponsiveFixes();
    enhanceDashboardCards();
  });
})();
