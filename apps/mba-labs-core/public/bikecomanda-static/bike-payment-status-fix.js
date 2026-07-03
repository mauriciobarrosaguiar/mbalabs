(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-payment-status-fix-style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .payment-done-card {
        display: grid;
        gap: 12px;
      }
      .payment-done-badge {
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
      .payment-done-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .payment-done-actions .btn {
        width: 100% !important;
        min-height: 44px !important;
        border-radius: 14px !important;
      }
      @media (max-width: 900px) {
        .payment-done-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function parseMoneyBR(value) {
    if (typeof value === "number") return value;
    const text = String(value || "").trim();
    if (!text) return 0;
    const normalized = text
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    return Number(normalized) || 0;
  }

  function moneyBR(value) {
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }

  function isPaid(order) {
    if (!order) return false;
    const finalValue = Number(order.valor_total_final || 0);
    const received = Number(order.valor_recebido || 0);
    const pending = Number(order.valor_pendente || 0);
    return order.status_pagamento === "Pago" || (finalValue > 0 && received >= finalValue) || (finalValue > 0 && pending <= 0);
  }

  function markOrderPaid(order, observation) {
    if (!order) return;
    order.status_pagamento = "Pago";
    order.valor_pendente = 0;
    if (!["Entregue", "Cancelado", "Cancelada", "Pago", "Paga"].includes(order.status)) {
      if (typeof setOrderStatus === "function") setOrderStatus(order, "Pago", observation || "Pagamento quitado.");
      else order.status = "Pago";
    }
  }

  function patchAddPayment() {
    if (window.__bikeAddPaymentStatusPatched || typeof addPayment !== "function") return;

    addPayment = function patchedAddPayment(orderId, data) {
      const order = findById("comandas", orderId);
      if (!order) return;

      const value = parseMoneyBR(data.valor);
      if (data.forma_pagamento !== "Fiado" && value <= 0) {
        alert("Informe um valor recebido maior que zero.");
        return;
      }

      db.pagamentos.push({
        id: uid("pay"),
        comanda_id: orderId,
        valor: value,
        forma_pagamento: data.forma_pagamento,
        data_pagamento: now(),
        observacoes: String(data.observacoes || "").trim(),
        created_at: now(),
      });

      order.forma_pagamento = data.forma_pagamento;
      if (typeof recalcOrder === "function") recalcOrder(orderId);

      const paidNow = isPaid(order) || data.forma_pagamento === "Fiado";
      if (paidNow) {
        markOrderPaid(order, `${data.forma_pagamento}: ${moneyBR(value)}. Pagamento quitado.`);
      }

      if (typeof addHistory === "function") {
        addHistory(
          orderId,
          paidNow ? "Pagamento registrado e comanda quitada" : "Pagamento registrado",
          order.status,
          paidNow ? "Pago" : order.status,
          `${data.forma_pagamento}: ${moneyBR(value)}.`,
        );
      }

      if (typeof saveAndRender === "function") saveAndRender();
      else if (typeof render === "function") render();
    };

    window.__bikeAddPaymentStatusPatched = true;
  }

  function patchPaymentForm() {
    if (window.__bikePaymentFormStatusPatched || typeof renderPaymentForm !== "function") return;

    renderPaymentForm = function patchedRenderPaymentForm(order) {
      const paid = isPaid(order);
      if (paid) {
        return `
          <div class="payment-done-card">
            <h2>Pagamento</h2>
            <span class="payment-done-badge">✓ Pago</span>
            <div class="totals">
              ${totalRow("Valor recebido", moneyBR(order.valor_recebido))}
              ${totalRow("Forma de pagamento", order.forma_pagamento || "-")}
              ${totalRow("Valor pendente", moneyBR(0))}
            </div>
            <div class="payment-done-actions">
              <button class="btn ghost" type="button" data-action="whatsapp-receipt" data-id="${order.id}">Enviar recibo</button>
              <button class="btn ghost" type="button" data-action="print-receipt" data-id="${order.id}">PDF/recibo</button>
            </div>
          </div>
        `;
      }

      const pending = Number(order.valor_pendente || order.valor_total_final || 0);
      return `
        <h2>Registrar pagamento</h2>
        <form data-form="add-payment" data-id="${order.id}">
          <div class="form-grid">
            ${selectField("Forma de pagamento", "forma_pagamento", PAYMENT_METHODS.map((item) => [item, item]), order.forma_pagamento || "Pix", true)}
            <div class="field">
              <label>Valor recebido</label>
              <input name="valor" data-money-input inputmode="decimal" autocomplete="off" value="${moneyBR(pending)}" />
            </div>
            ${textarea("Observações", "observacoes")}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">Registrar pagamento</button>
          </div>
        </form>
      `;
    };

    window.__bikePaymentFormStatusPatched = true;
  }

  function fixExistingOrders() {
    if (!Array.isArray(db?.comandas)) return;
    let changed = false;
    for (const order of db.comandas) {
      if (isPaid(order) && order.status_pagamento !== "Pago") {
        markOrderPaid(order, "Pagamento quitado.");
        changed = true;
      }
      if (isPaid(order) && !["Pago", "Paga", "Entregue", "Cancelado", "Cancelada"].includes(order.status)) {
        markOrderPaid(order, "Pagamento quitado.");
        changed = true;
      }
    }
    if (changed && typeof save === "function") save();
  }

  function fixDiscountSummary() {
    if (typeof ui === "undefined" || typeof db === "undefined") return;
    const order = db.comandas?.find((item) => item.id === ui.selectedOrderId);
    if (!order) return;
    const raw = Number(order.valor_desconto || 0);
    const applied = typeof discountAmount === "function" ? discountAmount(order) : raw;
    const text = !raw
      ? "Sem desconto aplicado"
      : order.tipo_desconto === "Percentual"
        ? `Desconto atual: ${raw}% = ${moneyBR(applied)}`
        : `Desconto atual: ${moneyBR(applied)}`;

    document.querySelectorAll(".bike-accordion").forEach((accordion) => {
      const title = accordion.querySelector(".bike-accordion-title strong");
      if (title?.textContent?.trim() !== "Aplicar desconto") return;
      const subtitle = accordion.querySelector(".bike-accordion-title span");
      if (subtitle) subtitle.textContent = text;
    });
  }

  function patchRender() {
    if (window.__bikePaymentStatusRenderPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedPaymentStatusRender(...args) {
      patchAddPayment();
      patchPaymentForm();
      fixExistingOrders();
      const result = originalRender.apply(this, args);
      setTimeout(fixDiscountSummary, 0);
      return result;
    };
    window.__bikePaymentStatusRenderPatched = true;
  }

  function boot() {
    injectStyle();
    patchAddPayment();
    patchPaymentForm();
    fixExistingOrders();
    patchRender();
    setTimeout(() => {
      fixDiscountSummary();
      if (typeof render === "function") render();
    }, 0);
  }

  boot();
  document.addEventListener("DOMContentLoaded", boot);
})();
