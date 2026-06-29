(function () {
  "use strict";

  const NEW_SERVICE_VALUE = "__new_service__";
  const STYLE_ID = "bikecomanda-service-fix-style";

  function injectStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .service-inline-hint {
        display: block;
        margin-top: 5px;
        color: #66756f;
        font-size: 12px;
        line-height: 1.35;
      }
      .service-compact-form {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed var(--line);
      }
      .service-compact-form h3 {
        margin: 0 0 10px;
        font-size: 20px;
      }
      .service-compact-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(120px, .7fr);
        gap: 10px;
        align-items: end;
      }
      .service-compact-grid .field.full {
        grid-column: 1 / -1;
      }
      .service-compact-form .form-actions {
        margin-top: 10px;
      }
      .service-compact-form .btn.primary {
        min-height: 46px !important;
      }
      .service-list-compact {
        display: grid;
        gap: 10px;
      }
      .service-row-compact {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #fff;
      }
      .service-row-compact strong {
        display: block;
        color: #10201a;
        line-height: 1.2;
      }
      .service-row-compact span {
        display: block;
        margin-top: 3px;
        color: #66756f;
        font-size: 12px;
        line-height: 1.25;
      }
      .service-row-price {
        text-align: right;
        white-space: nowrap;
      }
      .service-row-actions {
        display: inline-flex;
        gap: 6px;
        margin-top: 7px;
      }
      .service-row-actions .btn.small {
        min-height: 34px !important;
        padding: 7px 10px !important;
        border-radius: 11px !important;
      }

      @media (max-width: 900px) {
        .service-compact-form {
          margin-top: 12px;
          padding-top: 10px;
        }
        .service-compact-grid {
          grid-template-columns: 1fr !important;
          gap: 8px !important;
        }
        .service-compact-form .field {
          min-width: 0 !important;
        }
        .service-compact-form select,
        .service-compact-form input {
          min-height: 46px !important;
        }
        .service-row-compact {
          grid-template-columns: 1fr;
          padding: 12px;
        }
        .service-row-price {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          text-align: left;
        }
        .service-row-actions {
          margin-top: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function serviceOptions() {
    return [
      ["", "Serviço avulso"],
      ...activeServices().map((service) => [service.id, `${service.nome} · ${money(service.valor_padrao)}`]),
      [NEW_SERVICE_VALUE, "+ Cadastrar novo serviço"],
    ];
  }

  function renderAddServiceFormFixed(order) {
    return `
      <form data-form="add-servico-comanda" class="service-compact-form" data-id="${order.id}">
        <h3>Adicionar serviço</h3>
        <div class="service-compact-grid">
          <div class="field">
            <label>Serviço</label>
            <select name="servico_id" data-service-select>
              ${serviceOptions().map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("")}
            </select>
            <span class="service-inline-hint">Valor automático ao escolher serviço cadastrado.</span>
          </div>
          ${field("Valor", "valor", "", "number")}
          <div class="field full">
            <label>Observação/serviço avulso</label>
            <input name="descricao" placeholder="Opcional. Use para serviço avulso ou detalhe do serviço." />
          </div>
          <input type="hidden" name="mecanico_id" value="${esc(order.mecanico_id || "")}" />
          <input type="hidden" name="tipo_comissao" value="" />
          <input type="hidden" name="percentual_comissao" value="" />
          <input type="hidden" name="valor_comissao_fixa" value="" />
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Adicionar serviço</button>
        </div>
      </form>
    `;
  }

  function renderServiceItemsFixed(order, services) {
    if (!services.length) return `<div class="empty">Nenhum serviço adicionado.</div>`;
    return `
      <div class="service-list-compact">
        ${services
          .map(
            (item) => `
              <div class="service-row-compact">
                <div>
                  <strong>${esc(item.descricao)}</strong>
                  <span>${esc(mechanicName(item.mecanico_id) || mechanicName(order.mecanico_id) || "Sem mecânico")} · ${esc(item.status || "Pendente")}</span>
                  ${item.observacoes ? `<span>${esc(item.observacoes)}</span>` : ""}
                </div>
                <div class="service-row-price">
                  <strong>${money(item.valor)}</strong>
                  ${canManageOrder()
                    ? `<div class="service-row-actions">
                        <button class="btn small ghost" type="button" data-action="edit-service-value" data-id="${item.id}">Editar</button>
                        <button class="btn small danger" type="button" data-action="remove-service-item" data-id="${item.id}">Remover</button>
                      </div>`
                    : ""}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function orderStage(order) {
    const status = order.status || "Aberta";
    if (["Aberta", "Entrada realizada", "Aguardando orçamento"].includes(status)) return "orcamento";
    if (["Aguardando aprovação", "Aguardando resposta"].includes(status)) return "aprovacao";
    if (["Aprovada", "Aprovado", "Aprovado pelo cliente", "Cliente aprovou", "Em manutenção", "Em execução", "Aguardando peça"].includes(status)) return "manutencao";
    if (["Serviço concluído", "Finalizada", "Cliente avisado", "Aguardando pagamento", "Pago", "Paga", "Aguardando retirada", "Entregue"].includes(status) || order.status_pagamento === "Pago") return "entrega";
    if (["Cancelada", "Cancelado"].includes(status)) return "cancelada";
    return "orcamento";
  }

  function compactStatusOptions() {
    return [
      ["", "Todas as etapas"],
      ["stage:orcamento", "Orçamento"],
      ["stage:aprovacao", "Aprovação"],
      ["stage:manutencao", "Manutenção/Revisão"],
      ["stage:entrega", "Entrega/Pagamento"],
      ["stage:cancelada", "Cancelada"],
    ];
  }

  function filteredOrdersFixed() {
    const search = ui.orderSearch.trim().toLowerCase();
    const selected = ui.orderStatus || "";
    return visibleOrders().filter((order) => {
      const client = clientName(order.cliente_id).toLowerCase();
      const bike = bikeLabel(findById("bicicletas", order.bicicleta_id)).toLowerCase();
      const numberText = String(order.numero).padStart(5, "0");
      const matchesSearch = !search || client.includes(search) || bike.includes(search) || numberText.includes(search);
      const matchesStatus = !selected || (selected.startsWith("stage:") ? orderStage(order) === selected.replace("stage:", "") : order.status === selected);
      return matchesStatus && matchesSearch;
    });
  }

  function renderComandasFixed() {
    const orders = filteredOrders();
    return `
      <section class="card compact">
        <form class="toolbar" data-form="order-filter">
          ${selectField("Etapa", "status", compactStatusOptions(), ui.orderStatus)}
          <div class="field">
            <label>Buscar</label>
            <input name="busca" value="${esc(ui.orderSearch)}" placeholder="Cliente, bike ou número" />
          </div>
          <button class="btn primary" type="submit">Filtrar</button>
        </form>
      </section>
      <section class="command-list" style="margin-top:16px">
        ${orders.map(renderOrderCard).join("") || `<div class="empty">Nenhuma comanda encontrada.</div>`}
      </section>
    `;
  }

  function applySelectedService(select) {
    if (!select) return;
    if (select.value === NEW_SERVICE_VALUE) {
      ui.view = "servicos";
      render();
      setTimeout(() => {
        const nameInput = document.querySelector('form[data-form="servico"] input[name="nome"]');
        if (nameInput) nameInput.focus();
      }, 0);
      return;
    }

    const form = select.closest('form[data-form="add-servico-comanda"]');
    const service = findById("servicos", select.value);
    if (!form) return;

    const valueInput = form.querySelector('input[name="valor"]');
    const descriptionInput = form.querySelector('input[name="descricao"]');
    const commissionType = form.querySelector('input[name="tipo_comissao"]');
    const percentInput = form.querySelector('input[name="percentual_comissao"]');
    const fixedInput = form.querySelector('input[name="valor_comissao_fixa"]');

    if (!service) {
      if (valueInput) valueInput.value = "";
      return;
    }

    if (valueInput) valueInput.value = Number(service.valor_padrao || 0).toFixed(2);
    if (descriptionInput && !descriptionInput.value) descriptionInput.value = service.descricao || "";
    if (commissionType) commissionType.value = service.tipo_comissao || "";
    if (percentInput) percentInput.value = service.percentual_comissao || "";
    if (fixedInput) fixedInput.value = service.valor_comissao_fixa || "";
  }

  function patchServiceForm() {
    injectStyle();
    if (typeof renderAddServiceForm === "function") renderAddServiceForm = renderAddServiceFormFixed;
    if (typeof renderServiceItems === "function") renderServiceItems = renderServiceItemsFixed;
    if (typeof filteredOrders === "function") filteredOrders = filteredOrdersFixed;
    if (typeof renderComandas === "function") renderComandas = renderComandasFixed;
  }

  document.addEventListener("change", function (event) {
    const select = event.target.closest("[data-service-select]");
    if (!select) return;
    applySelectedService(select);
  }, true);

  document.addEventListener("submit", function (event) {
    const form = event.target.closest('form[data-form="add-servico-comanda"]');
    if (!form) return;
    const select = form.querySelector("[data-service-select]");
    if (select?.value === NEW_SERVICE_VALUE) {
      event.preventDefault();
      event.stopPropagation();
      ui.view = "servicos";
      render();
    }
  }, true);

  patchServiceForm();
  document.addEventListener("DOMContentLoaded", patchServiceForm);
})();
