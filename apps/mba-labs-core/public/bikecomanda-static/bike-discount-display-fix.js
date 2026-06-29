(function () {
  "use strict";

  function getCurrentOrder() {
    if (typeof ui === "undefined" || typeof db === "undefined") return null;
    if (!ui.selectedOrderId) return null;
    return db.comandas?.find((order) => order.id === ui.selectedOrderId) || null;
  }

  function discountSubtitle(order) {
    const raw = Number(order?.valor_desconto || 0);
    if (!raw) return "Sem desconto aplicado";

    const applied = typeof discountAmount === "function" ? discountAmount(order) : raw;
    if (order.tipo_desconto === "Percentual") {
      return `Desconto atual: ${raw}% = ${money(applied)}`;
    }

    return `Desconto atual: ${money(applied)}`;
  }

  function fixDiscountSummary() {
    const order = getCurrentOrder();
    if (!order) return;

    const accordions = document.querySelectorAll(".bike-accordion");
    for (const item of accordions) {
      const title = item.querySelector(".bike-accordion-title strong");
      if (!title || title.textContent.trim() !== "Aplicar desconto") continue;

      const subtitle = item.querySelector(".bike-accordion-title span");
      if (subtitle) subtitle.textContent = discountSubtitle(order);
    }
  }

  function patchRender() {
    if (window.__bikeDiscountDisplayPatched || typeof render !== "function") return;
    const originalRender = render;
    render = function patchedDiscountDisplayRender(...args) {
      const result = originalRender.apply(this, args);
      setTimeout(fixDiscountSummary, 0);
      return result;
    };
    window.__bikeDiscountDisplayPatched = true;
  }

  patchRender();
  setTimeout(fixDiscountSummary, 0);
  document.addEventListener("DOMContentLoaded", function () {
    patchRender();
    fixDiscountSummary();
  });
})();
