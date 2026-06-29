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
    `;
    document.head.appendChild(style);
  }

  function parseMoney(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    const clean = text
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    return Number(clean) || 0;
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

  function renderPaymentFormFixed(order) {
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
