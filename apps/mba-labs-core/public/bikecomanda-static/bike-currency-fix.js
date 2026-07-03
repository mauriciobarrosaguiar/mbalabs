(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-currency-fix-style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      input[data-money-input] {
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .bike-payment-paid-card {
        display: grid;
        gap: 12px;
      }
      .bike-payment-paid-badge {
        display: inline-flex;
        width: max-content;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: #e9f8f1;
        color: var(--primary-strong);
        font-weight: 900;
      }
      .bike-payment-paid-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .bike-payment-paid-actions .btn {
        width: 100% !important;
        min-height: 44px !important;
        border-radius: 14px !important;
      }
      @media (max-width: 900px) {
        .bike-payment-paid-actions { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function parseMoney(value) {
    if (typeof value === "number") return value;
    let text = String(value || "").trim();
    if (!text) return 0;

    text = text.replace(/R\$/gi, "").replace(/\s/g, "");

    if (text.includes(",")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/[^0-9.-]/g, "");
      const parts = text.split(".");
      if (parts.length > 2) text = parts.slice(0, -1).join("") + "." + parts.at(-1);
    }

    return Number(text.replace(/[^0-9.-]/g, "")) || 0;
  }

  function formatMoney(value) {
    const amount = typeof value === "number" ? value : parseMoney(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  }

  function isOrderPaid(order) {
    if (!order) return false;
    const finalValue = Number(order.valor_total_final || 0);
    const received = Number(order.valor_recebido || 0);
    const pending = Number(order.valor_pendente || 0);
    return order.status_pagamento === "Pago" || (finalValue > 0 && received >= finalValue) || (finalValue > 0 && pending <= 0);
  }

  function renderPaidPaymentBlock(order) {
    return `
      <div class="bike-payment-paid-card">
        <h2>Pagamento</h2>
        <span class="bike-payment-paid-badge">✓ Pago</span>
        <div class="totals">
          ${totalRow("Valor recebido", formatMoney(order.valor_recebido))}
          ${totalRow("Forma de pagamento", order.forma_pagamento || "-")}
          ${totalRow("Valor pendente", formatMoney(0))}
        </div>
        <div class="bike-payment-paid-actions">
          <button class="btn ghost" type="button" data-action="whatsapp-receipt" data-id="${order.id}">Enviar recibo</button>
          <button class="btn ghost" type="button" data-action="print-receipt" data-id="${order.id}">PDF/recibo</button>
        </div>
      </div>
    `;
  }

  function renderPaymentFormFixed(order) {
    if (isOrderPaid(order)) return renderPaidPaymentBlock(order);

    const pending = Number(order.valor_pendente || order.valor_total_final || 0);
    return `
      <h2>Registrar pagamento</h2>
      <form data-form="add-payment" data-id="${order.id}">
        <div class="form-grid">
          ${selectField("Forma de pagamento", "forma_pagamento", PAYMENT_METHODS.map((item) => [item, item]), order.forma_pagamento || "Pix", true)}
          <div class="field">
            <label>Valor recebido</label>
            <input name="valor" data-money-input inputmode="decimal" autocomplete="off" value="${esc(formatMoney(pending))}" />
          </div>
          ${textarea("Observações", "observacoes")}
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Registrar pagamento</button>
        </div>
      </form>
    `;
  }

  function normalizeMoneyInput(input) {
    if (!input) return;
    input.value = formatMoney(input.value);
  }

  function prepareMoneyBeforeSubmit(form) {
    form.querySelectorAll("[data-money-input]").forEach((input) => {
      input.value = parseMoney(input.value).toFixed(2);
    });
  }

  function patchCurrency() {
    injectStyle();
    if (typeof renderPaymentForm === "function") renderPaymentForm = renderPaymentFormFixed;
  }

  document.addEventListener("focusin", function (event) {
    const input = event.target.closest("[data-money-input]");
    if (!input) return;
    const amount = parseMoney(input.value);
    input.value = amount ? String(amount.toFixed(2)).replace(".", ",") : "";
    setTimeout(() => input.select?.(), 0);
  });

  document.addEventListener("blur", function (event) {
    const input = event.target.closest("[data-money-input]");
    if (!input) return;
    normalizeMoneyInput(input);
  }, true);

  document.addEventListener("submit", function (event) {
    const form = event.target.closest('form[data-form="add-payment"]');
    if (!form) return;
    prepareMoneyBeforeSubmit(form);
  }, true);

  patchCurrency();
  document.addEventListener("DOMContentLoaded", patchCurrency);

  if (!window.__bikeCurrencyRenderPatched && typeof render === "function") {
    const originalRender = render;
    render = function patchedCurrencyRender(...args) {
      patchCurrency();
      const result = originalRender.apply(this, args);
      return result;
    };
    window.__bikeCurrencyRenderPatched = true;
    render();
  }
})();