(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-flow-fix-style";

  function injectStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .product-action-group { display: none !important; }

      .bike-simple-flow {
        display: grid;
        gap: 12px;
      }
      .bike-flow-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .bike-flow-head h2 {
        margin: 0;
        font-size: 24px;
      }
      .bike-flow-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        padding: 6px 11px;
        border: 1px solid rgba(15, 138, 95, 0.14);
        border-radius: 999px;
        background: #f6fbf8;
        color: #174336;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }
      .bike-flow-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .bike-flow-button {
        display: grid !important;
        align-content: center;
        gap: 2px;
        width: 100% !important;
        min-height: 70px !important;
        padding: 12px !important;
        border-radius: 16px !important;
        border: 1px solid var(--line) !important;
        background: #fff !important;
        color: #15231e !important;
        box-shadow: none !important;
        text-align: left !important;
      }
      .bike-flow-button strong {
        display: block;
        font-size: 15px;
        line-height: 1.15;
      }
      .bike-flow-button span {
        display: block;
        color: #6a7973;
        font-size: 11.5px;
        line-height: 1.25;
      }
      .bike-flow-button.is-current {
        background: var(--primary) !important;
        border-color: var(--primary) !important;
        color: #fff !important;
      }
      .bike-flow-button.is-current span {
        color: rgba(255,255,255,.82) !important;
      }
      .bike-flow-muted {
        color: #66756f;
        font-size: 13px;
        line-height: 1.35;
      }

      .bike-accordion-list {
        display: grid;
        gap: 10px;
      }
      .bike-accordion {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
        overflow: hidden;
        box-shadow: 0 8px 20px rgba(14, 35, 28, 0.04);
      }
      .bike-accordion summary {
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px;
        cursor: pointer;
        user-select: none;
      }
      .bike-accordion summary::-webkit-details-marker {
        display: none;
      }
      .bike-accordion-title {
        min-width: 0;
      }
      .bike-accordion-title strong {
        display: block;
        color: #10201a;
        font-size: 18px;
        line-height: 1.15;
      }
      .bike-accordion-title span {
        display: block;
        margin-top: 4px;
        color: #66756f;
        font-size: 12.5px;
        line-height: 1.3;
      }
      .bike-accordion-icon {
        display: inline-grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 12px;
        background: #f2f7f5;
        color: var(--primary-strong);
        font-size: 20px;
        font-weight: 900;
        transition: transform .18s ease;
      }
      .bike-accordion[open] .bike-accordion-icon {
        transform: rotate(45deg);
      }
      .bike-accordion-body {
        padding: 0 16px 16px;
        border-top: 1px dashed var(--line);
      }
      .bike-accordion-body > :first-child {
        margin-top: 14px;
      }
      .bike-accordion-body .card {
        border: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        background: transparent !important;
      }
      .bike-accordion-body h2,
      .bike-accordion-body h3 {
        margin-top: 0;
      }
      .bike-collapsed-section.card {
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      @media (max-width: 900px) {
        .bike-flow-head {
          align-items: flex-start;
        }
        .bike-flow-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px;
        }
        .bike-flow-button {
          min-height: 66px !important;
          padding: 10px !important;
          border-radius: 15px !important;
        }
        .bike-flow-button strong {
          font-size: 14px;
        }
        .bike-flow-button span {
          font-size: 10.8px;
        }
        .bike-accordion summary {
          padding: 14px;
        }
        .bike-accordion-title strong {
          font-size: 17px;
        }
        .bike-accordion-body {
          padding: 0 14px 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function currentStage(order) {
    const status = order.status || "Aberta";
    if (["Aberta", "Entrada realizada", "Aguardando orçamento"].includes(status)) return "orcamento";
    if (["Aguardando aprovação", "Aguardando resposta"].includes(status)) return "aprovacao";
    if (["Aprovada", "Aprovado", "Cliente aprovou", "Em manutenção", "Em execução", "Aguardando peça"].includes(status)) return "manutencao";
    if (["Serviço concluído", "Finalizada", "Cliente avisado", "Aguardando pagamento", "Pago", "Paga", "Aguardando retirada", "Entregue"].includes(status) || order.status_pagamento === "Pago") return "entrega";
    if (["Cancelada", "Cancelado"].includes(status)) return "cancelada";
    return "orcamento";
  }

  function stageButtons(order, canManage, canExecute) {
    const stage = currentStage(order);
    const maintenanceAction = stage === "manutencao" && ["Em manutenção", "Em execução"].includes(order.status) ? "finish-service" : "start-service";
    const deliveryAction = order.status_pagamento === "Pago" || ["Pago", "Paga", "Aguardando retirada"].includes(order.status) ? "deliver-order" : "whatsapp-ready";

    const items = [
      { key: "orcamento", title: "Orçamento", hint: "Enviar ao cliente", action: "whatsapp-budget", allowed: canManage },
      { key: "aprovacao", title: "Aprovação", hint: "Cliente autorizou", action: "client-approved", allowed: canManage },
      { key: "manutencao", title: "Manutenção", hint: stage === "manutencao" && ["Em manutenção", "Em execução"].includes(order.status) ? "Concluir serviço" : "Iniciar revisão", action: maintenanceAction, allowed: canExecute },
      { key: "entrega", title: "Entrega", hint: deliveryAction === "deliver-order" ? "Finalizar saída" : "Avisar retirada", action: deliveryAction, allowed: canManage },
    ];

    return items
      .filter((item) => item.allowed)
      .map(
        (item) => `
          <button class="btn bike-flow-button ${stage === item.key ? "is-current" : ""}" type="button" data-action="${item.action}" data-id="${order.id}">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.hint)}</span>
          </button>
        `,
      )
      .join("");
  }

  function renderSimpleFlow(order, canManage, canExecute) {
    const buttons = stageButtons(order, canManage, canExecute);
    return `
      <div class="bike-simple-flow">
        <div class="bike-flow-head">
          <div>
            <h2>Fluxo</h2>
            <div class="bike-flow-muted">Use só a etapa atual da comanda.</div>
          </div>
          <span class="bike-flow-status">${esc(order.status || "Aberta")}</span>
        </div>
        <div class="bike-flow-grid">${buttons}</div>
      </div>
    `;
  }

  function accordion(title, subtitle, body, startOpen = false) {
    return `
      <details class="bike-accordion" ${startOpen ? "open" : ""}>
        <summary>
          <span class="bike-accordion-title">
            <strong>${esc(title)}</strong>
            <span>${esc(subtitle || "Clique para ver detalhes")}</span>
          </span>
          <span class="bike-accordion-icon">+</span>
        </summary>
        <div class="bike-accordion-body">
          ${body}
        </div>
      </details>
    `;
  }

  function renderTechnicalNote(order) {
    return `
      <form data-form="technical-note" data-id="${order.id}">
        <div class="field">
          <label>Adicionar observação</label>
          <textarea name="observacao" required placeholder="Ex.: pastilha traseira com desgaste irregular"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Salvar observação</button>
        </div>
      </form>
    `;
  }

  function renderDetalheSimplificado() {
    const order = db.comandas.find((item) => item.id === ui.selectedOrderId);
    if (!order || !canSeeOrder(order)) {
      return `<div class="empty">Comanda não encontrada ou sem permissão de acesso.</div>`;
    }

    const client = findById("clientes", order.cliente_id);
    const bike = findById("bicicletas", order.bicicleta_id);
    const services = orderServices(order.id);
    const products = orderProducts(order.id);
    const canManage = canManageOrder();
    const canExecute = canExecuteOrder(order);
    const servicesTotal = services.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const productsTotal = products.reduce((sum, item) => sum + Number(item.valor_total || item.valor_unitario * item.quantidade || 0), 0);
    const discountValue = Number(order.valor_desconto || 0);

    return `
      <section class="page-header">
        <div>
          <h1>Comanda #${String(order.numero).padStart(5, "0")}</h1>
          <p>${esc(client?.nome || "-")} · ${esc(client?.whatsapp || "-")} · ${esc(bikeLabel(bike))}</p>
        </div>
        <div class="toolbar">
          ${statusBadge(order.status)}
          ${statusBadge(order.status_pagamento, order.status_pagamento === "Pago" ? "green" : order.status_pagamento === "Parcial" ? "yellow" : "gray")}
        </div>
      </section>
      <section class="detail-layout">
        <div class="grid">
          <div class="card">
            ${renderSimpleFlow(order, canManage, canExecute)}
          </div>

          <div class="card">
            <h2>Dados da entrada</h2>
            <div class="grid two">
              ${info("Cliente", client?.nome)}
              ${info("WhatsApp", client?.whatsapp)}
              ${info("Bicicleta", bikeLabel(bike))}
              ${info("Mecânico responsável", mechanicName(order.mecanico_id) || "-")}
              ${info("Data de entrada", dateTime(order.data_entrada))}
              ${info("Data prevista", dateTime(order.data_previsao))}
              ${info("Data de saída", dateTime(order.data_saida))}
              ${info("Observações", order.observacoes || "-")}
            </div>
            ${order.fotos?.length ? `<div class="photos" style="margin-top:14px">${order.fotos.map((src) => `<img src="${esc(src)}" alt="Foto da bicicleta" />`).join("")}</div>` : ""}
          </div>

          <div class="bike-accordion-list">
            ${accordion("Serviços", `${services.length} item(ns) · ${money(servicesTotal)}`, `${renderServiceItems(order, services)}${canManage ? renderAddServiceForm(order) : ""}`)}
            ${accordion("Produtos/peças", `${products.length} item(ns) · ${money(productsTotal)}`, `${renderProductItems(order, products)}${canManage ? renderAddProductForm(order) : ""}`)}
            ${accordion("Observação técnica", "Adicionar anotação da oficina", renderTechnicalNote(order))}
          </div>
        </div>

        <aside class="grid">
          <div class="card">
            <h2>Financeiro</h2>
            ${renderTotals(order)}
          </div>
          ${canDiscount() ? `<div class="bike-accordion-list">${accordion("Aplicar desconto", discountValue > 0 ? `Desconto atual: ${money(discountValue)}` : "Sem desconto aplicado", renderDiscountForm(order))}</div>` : ""}
          ${canManage ? `<div class="card">${renderPaymentForm(order)}</div>` : ""}
          <div class="card">
            <h2>Histórico da comanda</h2>
            ${renderHistory(order.id)}
          </div>
        </aside>
      </section>
    `;
  }

  function patchFlow() {
    injectStyle();
    if (typeof renderDetalhe === "function") renderDetalhe = renderDetalheSimplificado;
  }

  patchFlow();
  document.addEventListener("DOMContentLoaded", patchFlow);
})();