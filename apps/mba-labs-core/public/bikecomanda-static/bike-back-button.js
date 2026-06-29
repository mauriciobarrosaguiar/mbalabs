(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-back-button-style";
  const HISTORY_KEY = "bikecomanda:view-history:v1";
  const NO_BACK_VIEWS = new Set(["dashboard", "login"]);
  const FALLBACK_BY_VIEW = {
    detalhe: "comandas",
    nova_comanda: "dashboard",
    "nova-comanda": "dashboard",
  };

  let lastTrackedView = "";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .bike-back-button {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 42px;
        padding: 10px 14px;
        border: 1px solid rgba(15, 138, 95, 0.16);
        border-radius: 14px;
        background: #ffffff;
        color: var(--primary-strong);
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(14, 35, 28, 0.06);
        cursor: pointer;
        white-space: nowrap;
      }
      .bike-back-button span {
        font-size: 20px;
        line-height: 1;
      }
      .topbar.bike-topbar-with-back {
        align-items: center !important;
      }
      .topbar.bike-topbar-with-back > div:first-of-type {
        min-width: 0;
      }

      @media (max-width: 900px) {
        .topbar.bike-topbar-with-back {
          display: grid !important;
          grid-template-columns: auto 1fr !important;
          gap: 10px !important;
          align-items: start !important;
        }
        .topbar.bike-topbar-with-back .btn.primary {
          grid-column: 1 / -1;
        }
        .bike-back-button {
          min-height: 40px;
          padding: 9px 11px;
          border-radius: 13px;
          font-size: 14px;
        }
        .bike-back-button span {
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function currentState() {
    if (typeof ui === "undefined") return null;
    return {
      view: ui.view || "dashboard",
      selectedOrderId: ui.selectedOrderId || "",
      orderStatus: ui.orderStatus || "",
      orderSearch: ui.orderSearch || "",
    };
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-12)));
    } catch {
      // Sem ação.
    }
  }

  function samePage(a, b) {
    return a && b && a.view === b.view && (a.selectedOrderId || "") === (b.selectedOrderId || "");
  }

  function trackView() {
    const state = currentState();
    if (!state || NO_BACK_VIEWS.has(state.view)) {
      lastTrackedView = state?.view || "";
      return;
    }

    const key = `${state.view}:${state.selectedOrderId || ""}`;
    if (key === lastTrackedView) return;

    const history = readHistory();
    const last = history[history.length - 1];
    if (!samePage(last, state)) {
      history.push(state);
      writeHistory(history);
    }
    lastTrackedView = key;
  }

  function fallbackTarget() {
    const state = currentState();
    if (!state) return { view: "dashboard" };
    if (state.view === "detalhe") return { view: "comandas" };
    return { view: FALLBACK_BY_VIEW[state.view] || "dashboard" };
  }

  function goBack() {
    if (typeof ui === "undefined") return;

    const current = currentState();
    const history = readHistory();

    while (history.length && samePage(history[history.length - 1], current)) history.pop();
    const previous = history.pop();
    writeHistory(history);

    const target = previous || fallbackTarget();
    ui.view = target.view || "dashboard";
    ui.selectedOrderId = target.selectedOrderId || (ui.view === "detalhe" ? ui.selectedOrderId : "");
    ui.orderStatus = target.orderStatus || ui.orderStatus || "";
    ui.orderSearch = target.orderSearch || ui.orderSearch || "";

    if (typeof render === "function") render();
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }), 0);
  }

  function addBackButton() {
    injectStyle();
    if (typeof ui === "undefined") return;

    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const shouldShow = !NO_BACK_VIEWS.has(ui.view || "dashboard");
    const existing = topbar.querySelector(".bike-back-button");

    if (!shouldShow) {
      existing?.remove();
      topbar.classList.remove("bike-topbar-with-back");
      return;
    }

    topbar.classList.add("bike-topbar-with-back");
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "bike-back-button";
    button.setAttribute("aria-label", "Voltar");
    button.innerHTML = '<span aria-hidden="true">←</span> Voltar';
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      goBack();
    });

    topbar.prepend(button);
  }

  function patchRender() {
    if (window.__bikeBackButtonPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedBackButtonRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(() => {
        addBackButton();
        trackView();
      }, 0);
      return result;
    };
    window.__bikeBackButtonPatched = true;
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-action="nav"], [data-action="open-order"]')) {
      setTimeout(trackView, 0);
    }
  }, true);

  injectStyle();
  patchRender();
  setTimeout(() => {
    addBackButton();
    trackView();
  }, 0);
  document.addEventListener("DOMContentLoaded", function () {
    injectStyle();
    patchRender();
    addBackButton();
    trackView();
  });
})();
