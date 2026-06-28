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

          <div class="card">
            <div class="split-title"><h2>Serviços</h2></div>
            ${renderServiceItems(order, services)}
            ${canManage ? renderAddServiceForm(order) : ""}
          </div>

          <div class="card">
            <div class="split-title"><h2>Produtos/peças</h2></div>
            ${renderProductItems(order, products)}
            ${canManage ? renderAddProductForm(order) : ""}
          </div>

          <div class="card">
            <h2>Observações técnicas</h2>
            <form data-form="technical-note" data-id="${order.id}">
              <div class="field">
                <label>Adicionar observação</label>
                <textarea name="observacao" required placeholder="Ex.: pastilha traseira com desgaste irregular"></textarea>
              </div>
              <div class="form-actions">
                <button class="btn primary" type="submit">Salvar observação</button>
              </div>
            </form>
          </div>
        </div>

        <aside class="grid">
          <div class="card">
            <h2>Financeiro</h2>
            ${renderTotals(order)}
          </div>
          ${canDiscount() ? `<div class="card">${renderDiscountForm(order)}</div>` : ""}
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