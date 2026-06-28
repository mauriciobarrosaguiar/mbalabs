(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-flow-fix-style";

  function injectStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .bike-simple-flow {
        display: grid;
        gap: 14px;
      }
      .bike-flow-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .bike-flow-head h2 {
        margin: 0;
      }
      .bike-flow-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 7px 12px;
        border: 1px solid rgba(15, 138, 95, 0.14);
        border-radius: 999px;
        background: #f6fbf8;
        color: #174336;
        font-size: 13px;
        font-weight: 900;
        white-space: nowrap;
      }
      .bike-flow-next {
        border: 1px solid rgba(15, 138, 95, 0.12);
        border-radius: 18px;
        background: linear-gradient(180deg, #fbfefd 0%, #f5fbf8 100%);
        padding: 14px;
      }
      .bike-flow-next strong {
        display: block;
        color: #10201a;
        font-size: 17px;
      }
      .bike-flow-next span {
        display: block;
        margin-top: 4px;
        color: #66756f;
        line-height: 1.4;
      }
      .bike-flow-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .bike-flow-actions .btn {
        width: 100% !important;
        min-height: 48px !important;
        border-radius: 15px !important;
        box-shadow: none !important;
      }
      .bike-flow-actions .btn.primary,
      .bike-flow-actions .btn.blue,
      .bike-flow-actions .btn.warning,
      .bike-flow-actions .btn.danger {
        background: var(--primary) !important;
        color: #fff !important;
        border-color: var(--primary) !important;
      }
      .bike-flow-actions .btn.ghost,
      .bike-flow-actions .btn.secondary {
        background: #fff !important;
        color: #15231e !important;
        border: 1px solid var(--line) !important;
      }
      .bike-flow-secondary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding-top: 2px;
      }
      .bike-flow-secondary .btn {
        width: 100% !important;
        min-height: 42px !important;
        border-radius: 14px !important;
        background: #fff !important;
        color: #1d2d27 !important;
        border: 1px solid var(--line) !important;
        box-shadow: none !important;
      }
      .bike-flow-secondary .btn.danger {
        color: #9f1d35 !important;
        background: #fff7f8 !important;
        border-color: #f5c9d0 !important;
      }
      .bike-flow-muted {
        color: #66756f;
        font-size: 13px;
        line-height: 1.35;
      }

      @media (max-width: 900px) {
        .bike-flow-head {
          display: grid;
          grid-template-columns: 1fr;
        }
        .bike-flow-status {
          width: max-content;
          max-width: 100%;
        }
        .bike-flow-actions,
        .bike-flow-secondary {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function flowStep(order) {
    const status = order.status || "Aberta";
    if (["Aberta", "Entrada realizada", "Aguardando orçamento"].includes(status)) {
      return {
        title: "Enviar orçamento",
        text: "Monte serviços e peças. Depois envie o orçamento para aprovação do cliente.",
        actions: [
          { label: "Enviar orçamento", action: "whatsapp-budget", style: "primary" },
          { label: "Cliente aprovou", action: "client-approved", style: "ghost" },
        ],
      };
    }
    if (["Aguardando aprovação", "Aguardando resposta"].includes(status)) {
      return {
        title: "Aguardando decisão do cliente",
        text: "Quando o cliente responder, marque se aprovou ou recusou.",
        actions: [
          { label: "Cliente aprovou", action: "client-approved", style: "primary" },
          { label: "Cliente recusou", action: "client-rejected", style: "ghost" },
        ],
      };
    }
    if (["Aprovada", "Aprovado", "Cliente aprovou"].includes(status)) {
      return {
        title: "Pronto para iniciar",
        text: "A aprovação foi registrada. Agora inicie o serviço na oficina.",
        actions: [{ label: "Iniciar serviço", action: "start-service", style: "primary" }],
      };
    }
    if (["Em manutenção", "Em execução"].includes(status)) {
      return {
        title: "Serviço em andamento",
        text: "Quando a bike estiver pronta, marque como concluída.",
        actions: [{ label: "Concluir serviço", action: "finish-service", style: "primary" }],
      };
    }
    if (["Serviço concluído", "Finalizada", "Cliente avisado"].includes(status)) {
      return {
        title: "Avisar e receber",
        text: "Avise o cliente pelo WhatsApp e registre o pagamento quando receber.",
        actions: [
          { label: "Avisar cliente", action: "whatsapp-ready", style: "primary" },
          { label: "Gerar recibo", action: "print-receipt", style: "ghost" },
        ],
      };
    }
    if (["Pago", "Paga", "Aguardando retirada"].includes(status) || order.status_pagamento === "Pago") {
      return {
        title: "Liberar entrega",
        text: "Pagamento registrado. Entregue a bike e finalize a comanda.",
        actions: [{ label: "Entregar bike", action: "deliver-order", style: "primary" }],
      };
    }
    if (["Entregue"].includes(status)) {
      return {
        title: "Comanda finalizada",
        text: "Bike entregue ao cliente.",
        actions: [{ label: "Enviar recibo", action: "whatsapp-receipt", style: "ghost" }],
      };
    }
    if (["Cancelada", "Cancelado"].includes(status)) {
      return {
        title: "Comanda cancelada",
        text: "Esta comanda não entra no faturamento.",
        actions: [],
      };
    }
    return {
      title: "Próximo passo",
      text: "Escolha a ação principal para continuar o atendimento.",
      actions: [{ label: "Iniciar serviço", action: "start-service", style: "primary" }],
    };
  }

  function renderSimpleFlow(order, canManage, canExecute) {
    const step = flowStep(order);
    const actions = step.actions
      .filter((item) => {
        if (["start-service", "finish-service"].includes(item.action)) return canExecute;
        return canManage;
      })
      .map((item) => `<button class="btn ${item.style}" type="button" data-action="${item.action}" data-id="${order.id}">${item.label}</button>`)
      .join("");

    const secondary = canManage
      ? `
        <div class="bike-flow-secondary">
          <button class="btn ghost" type="button" data-action="whatsapp-receipt" data-id="${order.id}">Recibo WhatsApp</button>
          <button class="btn ghost" type="button" data-action="print-receipt" data-id="${order.id}">PDF/recibo</button>
          ${order.status !== "Cancelada" ? `<button class="btn danger" type="button" data-action="cancel-order" data-id="${order.id}">Cancelar</button>` : ""}
        </div>
      `
      : "";

    return `
      <div class="bike-simple-flow">
        <div class="bike-flow-head">
          <div>
            <h2>Fluxo da comanda</h2>
            <div class="bike-flow-muted">Controle simples, sem excesso de botões.</div>
          </div>
          <span class="bike-flow-status">${esc(order.status || "Aberta")}</span>
        </div>
        <div class="bike-flow-next">
          <strong>${esc(step.title)}</strong>
          <span>${esc(step.text)}</span>
        </div>
        ${actions ? `<div class="bike-flow-actions">${actions}</div>` : ""}
        ${secondary}
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
