(function () {
  "use strict";

  const STORAGE_KEY = "bikecomanda:last-view:v1";
  const BLOCKED_VIEWS = new Set(["login"]);

  function safeParse(value) {
    try {
      return JSON.parse(value || "{}");
    } catch {
      return {};
    }
  }

  function isValidView(view) {
    if (!view || BLOCKED_VIEWS.has(view)) return false;
    if (typeof navItems === "function") {
      const allowed = navItems().map((item) => item.view);
      if (allowed.includes(view)) return true;
    }
    return view === "detalhe";
  }

  function persistCurrentView() {
    if (typeof ui === "undefined") return;
    if (!isValidView(ui.view)) return;

    const payload = {
      view: ui.view,
      selectedOrderId: ui.selectedOrderId || "",
      orderStatus: ui.orderStatus || "",
      orderSearch: ui.orderSearch || "",
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Não bloqueia o app caso o navegador impeça localStorage.
    }
  }

  function restoreLastView() {
    if (typeof ui === "undefined") return false;

    let payload = {};
    try {
      payload = safeParse(localStorage.getItem(STORAGE_KEY));
    } catch {
      payload = {};
    }

    if (!isValidView(payload.view)) return false;

    if (payload.view === "detalhe") {
      const orderExists = Array.isArray(db?.comandas) && db.comandas.some((order) => order.id === payload.selectedOrderId);
      if (!payload.selectedOrderId || !orderExists) return false;
      ui.selectedOrderId = payload.selectedOrderId;
    }

    ui.view = payload.view;
    ui.orderStatus = payload.orderStatus || ui.orderStatus || "";
    ui.orderSearch = payload.orderSearch || ui.orderSearch || "";
    return true;
  }

  function patchRender() {
    if (window.__bikeViewPersistPatched || typeof render !== "function") return;

    const originalRender = render;
    render = function persistedRender(...args) {
      const result = originalRender.apply(this, args);
      persistCurrentView();
      return result;
    };

    window.__bikeViewPersistPatched = true;
  }

  function restoreAndRender() {
    patchRender();
    const restored = restoreLastView();
    if (restored && typeof render === "function") render();
  }

  document.addEventListener("click", function () {
    setTimeout(persistCurrentView, 0);
  }, true);

  document.addEventListener("submit", function () {
    setTimeout(persistCurrentView, 0);
  }, true);

  document.addEventListener("change", function () {
    setTimeout(persistCurrentView, 0);
  }, true);

  window.addEventListener("beforeunload", persistCurrentView);

  restoreAndRender();
  document.addEventListener("DOMContentLoaded", restoreAndRender);
})();
