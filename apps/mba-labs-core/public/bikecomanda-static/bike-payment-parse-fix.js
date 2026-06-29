(function () {
  "use strict";

  function parseCurrency(value) {
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

  function fmt(value) {
    return typeof money === "function"
      ? money(value)
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }

  function orderPayments(orderId) {
    return (db.pagamentos || []).filter((payment) => payment.comanda_id === orderId);
  }

  function normalizePayments(order) {
    if (!order) return false;
    const finalValue = Number(order.valor_total_final || 0);
    if (finalValue <= 0) return false;

    let changed = false;
    const payments = orderPayments(order.id);

    for (const payment of payments) {
      const value = Number(payment.valor || 0);
      const candidate = value / 100;
      if (value > finalValue * 10 && candidate <= finalValue * 2) {
        payment.valor = candidate;
        changed = true;
      }
    }

    let sum = payments.reduce((total, payment) => total + Number(payment.valor || 0), 0);
    if (sum > finalValue * 1.05) {
      let remaining = finalValue;
      for (const payment of payments) {
        const value = Number(payment.valor || 0);
        if (remaining <= 0) {
          if (value !== 0) changed = true;
          payment.valor = 0;
          continue;
        }
        if (value > remaining) {
          payment.valor = remaining;
          remaining = 0;
          changed = true;
        } else {
          remaining -= value;
        }
      }
    }

    if (changed && typeof recalcOrder === "function") recalcOrder(order.id);
    if (order.valor_recebido >= order.valor_total_final && order.valor_total_final > 0) {
      order.status_pagamento = "Pago";
      order.valor_pendente = 0;
      if (!["Pago", "Paga", "Entregue", "Cancelada", "Cancelado"].includes(order.status)) order.status = "Pago";
    }
    return changed;
  }

  function normalizeAll() {
    if (!Array.isArray(db?.comandas)) return;
    let changed = false;
    for (const order of db.comandas) {
      if (typeof recalcOrder === "function") recalcOrder(order.id);
      if (normalizePayments(order)) changed = true;
    }
    if (changed && typeof save === "function") save();
  }

  function patchAddPayment() {
    if (window.__bikePaymentParseFixPatched || typeof addPayment !== "function") return;
    addPayment = function fixedAddPayment(orderId, data) {
      const order = findById("comandas", orderId);
      if (!order) return;
      const value = parseCurrency(data.valor);
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
      normalizePayments(order);
      const paid = order.valor_recebido >= order.valor_total_final && order.valor_total_final > 0;
      if (paid) {
        order.status_pagamento = "Pago";
        order.valor_pendente = 0;
        if (!["Pago", "Paga", "Entregue", "Cancelada", "Cancelado"].includes(order.status)) order.status = "Pago";
      }
      if (typeof addHistory === "function") {
        addHistory(orderId, paid ? "Pagamento registrado e comanda quitada" : "Pagamento registrado", order.status, paid ? "Pago" : order.status, `${data.forma_pagamento}: ${fmt(value)}.`);
      }
      if (typeof saveAndRender === "function") saveAndRender();
      else if (typeof render === "function") render();
    };
    window.__bikePaymentParseFixPatched = true;
  }

  function patchRender() {
    if (window.__bikePaymentParseRenderPatched || typeof render !== "function") return;
    const original = render;
    render = function patchedPaymentParseRender(...args) {
      patchAddPayment();
      normalizeAll();
      return original.apply(this, args);
    };
    window.__bikePaymentParseRenderPatched = true;
  }

  function boot() {
    patchAddPayment();
    normalizeAll();
    patchRender();
    if (typeof render === "function") setTimeout(render, 0);
  }

  boot();
  document.addEventListener("DOMContentLoaded", boot);
})();
