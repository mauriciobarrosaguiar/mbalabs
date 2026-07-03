(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-final-lock-style";
  const LOCKED_STATUSES = new Set(["Pago", "Paga", "Entregue", "Finalizada", "Finalizado", "Cancelada", "Cancelado"]);
  const BLOCKED_FORMS = new Set([
    "add-servico-comanda",
    "add-produto-comanda",
    "technical-note",
    "apply-discount",
    "add-payment",
  ]);
  const BLOCKED_ACTIONS = new Set([
    "edit-service-value",
    "remove-service-item",
    "edit-product-value",
    "remove-product-item",
    "cancel-order",
    "client-approved",
    "client-rejected",
    "start-service",
    "finish-service",
    "deliver-order",
    "whatsapp-budget",
    "whatsapp-ready",
    "whatsapp-approval",
    "switch-status",
  ]);

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .order-locked-note {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border: 1px solid rgba(15, 138, 95, 0.16);
        border-radius: 16px;
        background: #f6fbf8;
        color: #174336;
        font-weight: 800;
        line-height: 1.35;
      }
      .order-locked-note span {
        color: #66756f;
        font-size: 12px;
        font-weight: 600;
      }
      .order-locked-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .order-locked-actions .btn {
        width: 100% !important;
        min-height: 44px !important;
        border-radius: 14px !important;
      }
      .order-locked-hidden { display: none !important; }
      .bike-accordion.is-readonly summary { cursor: default; }
      .bike-accordion.is-readonly .bike-accordion-icon { display: none !important; }
      @media (max-width: 900px) {
        .order-locked-actions { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function currentOrder() {
    if (typeof ui === "undefined" || typeof db === "undefined") return null;
    if (!ui.selectedOrderId) return null;
    return db.comandas?.find((order) => order.id === ui.selectedOrderId) || null;
  }

  function isLocked(order) {
    if (!order) return false;
    return order.status_pagamento === "Pago" || LOCKED_STATUSES.has(order.status);
  }

  function lockedHtml(message = "Comanda finalizada") {
    return `
      <div class="order-locked-note">
        ${message}
        <span>As informações ficam somente para consulta. Para alterar, seria necessário reabrir a comanda.</span>
      </div>
    `;
  }

  function paidHtml(order) {
    return `
      <div class="order-locked-note">
        Comanda finalizada e paga
        <span>Não é mais possível editar serviços, produtos, descontos, observações ou registrar novo pagamento.</span>
      </div>
      <div class="order-locked-actions" style="margin-top:10px">
        <button class="btn ghost" type="button" data-action="whatsapp-receipt" data-id="${order.id}">Enviar recibo</button>
        <button class="btn ghost" type="button" data-action="print-receipt" data-id="${order.id}">PDF/recibo</button>
      </div>
    `;
  }

  function replacePaymentForm(order) {
    document.querySelectorAll(".card").forEach((card) => {
      const title = card.querySelector("h2");
      if (!title) return;
      const text = title.textContent.trim();
      const hasPaymentForm = card.querySelector('form[data-form="add-payment"]');
      if (text === "Registrar pagamento" || hasPaymentForm) {
        card.innerHTML = `<h2>Pagamento</h2>${paidHtml(order)}`;
      }
    });
  }

  function lockForms() {
    document.querySelectorAll("form[data-form]").forEach((form) => {
      const type = form.getAttribute("data-form");
      if (!BLOCKED_FORMS.has(type)) return;
      const note = document.createElement("div");
      note.innerHTML = lockedHtml();
      form.replaceWith(note.firstElementChild);
    });
  }

  function lockActionButtons() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.getAttribute("data-action");
      if (!BLOCKED_ACTIONS.has(action)) return;
      button.classList.add("order-locked-hidden");
      button.setAttribute("disabled", "disabled");
      button.setAttribute("aria-disabled", "true");
    });
    document.querySelectorAll(".service-row-actions").forEach((item) => item.classList.add("order-locked-hidden"));
  }

  function lockAccordions(order) {
    document.querySelectorAll(".bike-accordion").forEach((accordion) => {
      const title = accordion.querySelector(".bike-accordion-title strong")?.textContent?.trim() || "";
      if (title === "Aplicar desconto") {
        accordion.classList.add("order-locked-hidden");
        return;
      }
      if (title === "Observação técnica") {
        accordion.classList.add("is-readonly");
        const body = accordion.querySelector(".bike-accordion-body");
        if (body) body.innerHTML = lockedHtml("Observação técnica bloqueada");
      }
      if (title === "Serviços" || title === "Produtos/peças") {
        accordion.classList.add("is-readonly");
        const body = accordion.querySelector(".bike-accordion-body");
        if (body) {
          body.querySelectorAll("form[data-form]").forEach((form) => form.remove());
          body.querySelectorAll("[data-action]").forEach((button) => {
            const action = button.getAttribute("data-action");
            if (BLOCKED_ACTIONS.has(action)) button.remove();
          });
        }
      }
    });
  }

  function lockFlow(order) {
    const flow = document.querySelector(".bike-simple-flow");
    if (!flow) return;
    const grid = flow.querySelector(".bike-flow-grid");
    if (grid) grid.innerHTML = paidHtml(order);
    const muted = flow.querySelector(".bike-flow-muted");
    if (muted) muted.textContent = "Comanda finalizada. Apenas recibo e consulta ficam disponíveis.";
    const status = flow.querySelector(".bike-flow-status");
    if (status) status.textContent = order.status_pagamento === "Pago" ? "Pago" : order.status || "Finalizada";
  }

  function applyLock() {
    injectStyle();
    const order = currentOrder();
    if (!isLocked(order)) return;

    document.body.classList.add("bike-order-locked");
    lockFlow(order);
    lockForms();
    lockActionButtons();
    lockAccordions(order);
    replacePaymentForm(order);
  }

  function blockIfLocked(event) {
    const order = currentOrder();
    if (!isLocked(order)) return;

    const form = event.target.closest?.("form[data-form]");
    if (form && BLOCKED_FORMS.has(form.getAttribute("data-form"))) {
      event.preventDefault();
      event.stopPropagation();
      alert("Esta comanda já foi finalizada. Para segurança, não é possível editar ou registrar novos dados.");
      return;
    }

    const actionEl = event.target.closest?.("[data-action]");
    if (actionEl && BLOCKED_ACTIONS.has(actionEl.getAttribute("data-action"))) {
      event.preventDefault();
      event.stopPropagation();
      alert("Esta comanda já foi finalizada. Para segurança, não é possível editar ou alterar o fluxo.");
    }
  }

  function patchRender() {
    if (window.__bikeFinalLockPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedFinalLockRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(applyLock, 0);
      return result;
    };
    window.__bikeFinalLockPatched = true;
  }

  document.addEventListener("click", blockIfLocked, true);
  document.addEventListener("submit", blockIfLocked, true);
  document.addEventListener("change", blockIfLocked, true);

  injectStyle();
  patchRender();
  setTimeout(applyLock, 0);
  document.addEventListener("DOMContentLoaded", function () {
    injectStyle();
    patchRender();
    applyLock();
  });
})();