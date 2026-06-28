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
        margin-top: 6px;
        color: #66756f;
        font-size: 12px;
        line-height: 1.35;
      }
      @media (max-width: 900px) {
        form[data-form="add-servico-comanda"] .form-grid,
        form[data-form="add-servico-comanda"] .form-grid.three {
          grid-template-columns: 1fr !important;
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
      <form data-form="add-servico-comanda" data-id="${order.id}" style="margin-top:16px">
        <h3>Adicionar serviço</h3>
        <div class="form-grid three">
          <div class="field">
            <label>Serviço</label>
            <select name="servico_id" data-service-select>
              ${serviceOptions().map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("")}
            </select>
            <span class="service-inline-hint">Ao escolher um serviço cadastrado, o valor entra automaticamente.</span>
          </div>
          ${field("Descrição avulsa/observação", "descricao")}
          ${field("Valor", "valor", "", "number")}
          ${selectField("Mecânico", "mecanico_id", activeMechanics().map((mechanic) => [mechanic.id, mechanic.nome]), order.mecanico_id)}
          ${selectField("Tipo de comissão", "tipo_comissao", [["", "Usar padrão do serviço"], ...COMMISSION_TYPES.map((item) => [item, item])])}
          ${field("Percentual comissão", "percentual_comissao", "", "number")}
          ${field("Comissão fixa", "valor_comissao_fixa", "", "number")}
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Adicionar serviço</button>
        </div>
      </form>
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
    if (!form || !service) return;

    const valueInput = form.querySelector('input[name="valor"]');
    const descriptionInput = form.querySelector('input[name="descricao"]');
    const commissionType = form.querySelector('select[name="tipo_comissao"]');
    const percentInput = form.querySelector('input[name="percentual_comissao"]');
    const fixedInput = form.querySelector('input[name="valor_comissao_fixa"]');

    if (valueInput) valueInput.value = Number(service.valor_padrao || 0).toFixed(2);
    if (descriptionInput && !descriptionInput.value) descriptionInput.value = service.descricao || "";
    if (commissionType && !commissionType.value) commissionType.value = service.tipo_comissao || "";
    if (percentInput && !percentInput.value && Number(service.percentual_comissao || 0) > 0) percentInput.value = service.percentual_comissao;
    if (fixedInput && !fixedInput.value && Number(service.valor_comissao_fixa || 0) > 0) fixedInput.value = service.valor_comissao_fixa;
  }

  function patchServiceForm() {
    injectStyle();
    if (typeof renderAddServiceForm === "function") renderAddServiceForm = renderAddServiceFormFixed;
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
