(function () {
  "use strict";

  const STYLE_ID = "bikecomanda-workflow-fix-style";

  function injectStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .client-search-wrap { position: relative; }
      .client-suggestions {
        display: none;
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 6px);
        z-index: 80;
        max-height: 240px;
        overflow-y: auto;
        border: 1px solid rgba(15, 138, 95, 0.16);
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 18px 42px rgba(12, 30, 24, 0.14);
        padding: 6px;
      }
      .client-suggestions.is-open { display: grid; gap: 6px; }
      .client-suggestion {
        width: 100%;
        border: 0;
        border-radius: 12px;
        background: #f7fbf9;
        padding: 12px;
        text-align: left;
        color: #18342b;
        cursor: pointer;
      }
      .client-suggestion strong { display: block; font-size: 15px; }
      .client-suggestion span { display: block; margin-top: 2px; color: #64746e; font-size: 12px; }
      .bike-inline-title {
        grid-column: 1 / -1;
        margin: 4px 0 -2px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
        color: var(--primary-strong);
        font-size: 16px;
        font-weight: 900;
      }

      @media (max-width: 900px) {
        .main { padding-left: 14px !important; padding-right: 14px !important; }
        .card { border-radius: 18px !important; padding: 16px !important; overflow: hidden !important; }
        .form-grid, .form-grid.three, .grid.two { grid-template-columns: 1fr !important; gap: 12px !important; }
        .field, .field.full { grid-column: 1 / -1 !important; min-width: 0 !important; }
        input, select, textarea { width: 100% !important; max-width: 100% !important; font-size: 16px !important; }
        textarea { min-height: 118px !important; }
        .form-actions { display: grid !important; grid-template-columns: 1fr !important; gap: 10px !important; width: 100% !important; }
        .form-actions .btn, .btn.primary, .btn.ghost, .btn.danger { width: 100% !important; min-height: 48px !important; }
        .table-wrap { overflow: visible !important; width: 100% !important; }
        .table-wrap table, .table-wrap thead, .table-wrap tbody, .table-wrap tr, .table-wrap th, .table-wrap td { display: block !important; width: 100% !important; min-width: 0 !important; }
        .table-wrap thead { display: none !important; }
        .table-wrap tr {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 14px;
          margin: 0 0 12px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(14, 35, 28, 0.05);
        }
        .table-wrap td {
          border: 0 !important;
          padding: 8px 0 !important;
          color: var(--text);
        }
        .table-wrap td::before {
          content: attr(data-label);
          display: block;
          margin-bottom: 3px;
          color: var(--muted);
          font-weight: 900;
          font-size: 12px;
        }
        .table-wrap td .btn { width: 100% !important; margin: 4px 0 !important; }
        .client-suggestions { position: static; margin-top: 8px; max-height: 220px; }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function findClientBySearch(value) {
    const q = normalizeText(value);
    if (!q) return null;
    return (
      db.clientes.find((client) => normalizeText(client.nome) === q) ||
      db.clientes.find((client) => normalizeText(client.nome).startsWith(q)) ||
      db.clientes.find((client) => normalizeText(client.nome).includes(q)) ||
      null
    );
  }

  function clientOptionsHtml() {
    return db.clientes
      .map((client) => `<option value="${esc(client.nome)}">${esc(client.whatsapp || "")}</option>`)
      .join("");
  }

  function renderClientSuggestions(input) {
    const wrap = input.closest(".client-search-wrap");
    const box = wrap?.querySelector(".client-suggestions");
    const hidden = wrap?.querySelector('input[name="cliente_id"]');
    if (!box || !hidden) return;

    const q = normalizeText(input.value);
    hidden.value = "";
    if (!q) {
      box.classList.remove("is-open");
      box.innerHTML = "";
      return;
    }

    const matches = db.clientes
      .filter((client) => normalizeText(client.nome).includes(q) || normalizeText(client.whatsapp).includes(q))
      .slice(0, 8);

    if (!matches.length) {
      box.classList.add("is-open");
      box.innerHTML = `<div class="empty" style="padding:10px">Cliente não encontrado. Cadastre o cliente antes de abrir a comanda.</div>`;
      return;
    }

    const exact = matches.find((client) => normalizeText(client.nome) === q);
    if (exact) hidden.value = exact.id;

    box.classList.add("is-open");
    box.innerHTML = matches
      .map(
        (client) => `
          <button class="client-suggestion" type="button" data-client-pick="${esc(client.id)}">
            <strong>${esc(client.nome)}</strong>
            <span>${esc(client.whatsapp || "Sem WhatsApp")}</span>
          </button>
        `,
      )
      .join("");
  }

  function renderNovaComandaFixed() {
    if (!db.clientes.length) {
      return `
        <div class="empty">
          Cadastre o cliente antes de abrir a comanda.
          <div class="form-actions" style="justify-content:center">
            <button class="btn primary" type="button" data-action="nav" data-view="clientes">Cadastrar cliente</button>
          </div>
        </div>
      `;
    }

    return `
      <section class="card">
        <h2>Entrada da bike</h2>
        <p class="subtle">Selecione o cliente cadastrado e informe os dados da bike que ele trouxe hoje. Não precisa cadastrar a bicicleta antes.</p>
        <form data-form="nova-comanda" class="quick-order-form">
          <div class="form-grid three">
            <div class="field full client-search-wrap">
              <label>Cliente cadastrado</label>
              <input name="cliente_busca" type="search" list="clientes-cadastrados" data-client-search autocomplete="off" placeholder="Digite o nome do cliente" required />
              <input type="hidden" name="cliente_id" />
              <datalist id="clientes-cadastrados">${clientOptionsHtml()}</datalist>
              <div class="client-suggestions"></div>
            </div>

            <div class="bike-inline-title">Dados da bike recebida</div>
            ${field("Marca", "bike_marca", "", "text", false)}
            ${field("Modelo/descrição", "bike_modelo", "", "text", false)}
            ${field("Cor", "bike_cor", "", "text", false)}
            ${field("Aro", "bike_aro", "", "text", false)}
            ${field("Número de série", "bike_numero_serie", "", "text", false)}
            ${selectField("Mecânico responsável", "mecanico_id", activeMechanics().map((mechanic) => [mechanic.id, mechanic.nome]), "", false)}
            ${field("Data prevista", "data_previsao", "", "datetime-local")}
            <div class="field full">
              <label>Fotos opcionais da bike</label>
              <input type="file" name="fotos" accept="image/*" multiple />
            </div>
            ${textarea("Observações da entrada", "observacoes", "")}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">Abrir comanda</button>
          </div>
        </form>
      </section>
    `;
  }

  async function createComandaFixed(form, data) {
    let client = data.cliente_id ? findById("clientes", data.cliente_id) : null;
    if (!client) client = findClientBySearch(data.cliente_busca);
    if (!client) {
      alert("Selecione um cliente cadastrado. Digite o nome e toque no cliente que aparecer na lista.");
      return;
    }

    const bike = {
      id: uid("bike"),
      cliente_id: client.id,
      tipo: "Bicicleta",
      marca: String(data.bike_marca || "").trim() || "Bike",
      modelo: String(data.bike_modelo || "").trim() || "Entrada avulsa",
      cor: String(data.bike_cor || "").trim(),
      aro: String(data.bike_aro || "").trim(),
      numero_serie: String(data.bike_numero_serie || "").trim(),
      observacoes: String(data.observacoes || "").trim(),
      created_at: now(),
    };
    db.bicicletas.push(bike);

    const files = [...(form.querySelector('input[name="fotos"]')?.files || [])].slice(0, 4);
    const fotos = await Promise.all(files.map(fileToDataUrl));
    const order = {
      id: uid("cmd"),
      numero: nextOrderNumber(),
      cliente_id: client.id,
      bicicleta_id: bike.id,
      mecanico_id: data.mecanico_id || "",
      status: "Entrada realizada",
      data_entrada: now(),
      data_previsao: data.data_previsao ? new Date(data.data_previsao).toISOString() : "",
      data_saida: "",
      observacoes: String(data.observacoes || "").trim(),
      fotos,
      valor_total_servicos: 0,
      valor_total_produtos: 0,
      valor_total_bruto: 0,
      tipo_desconto: "Valor fixo",
      valor_desconto: 0,
      motivo_desconto: "",
      valor_total_final: 0,
      desconto_aplicado_por: "",
      desconto_aplicado_em: "",
      status_pagamento: "Aberto",
      forma_pagamento: "",
      valor_recebido: 0,
      valor_pendente: 0,
      created_at: now(),
    };
    db.comandas.push(order);
    addHistory(order.id, "Comanda aberta", "", "Entrada realizada", "Entrada da bike registrada com dados informados no balcão.");
    ui.selectedOrderId = order.id;
    ui.view = "detalhe";
    saveAndRender();
  }

  function patchWorkflow() {
    injectStyle();
    if (typeof renderNovaComanda === "function") renderNovaComanda = renderNovaComandaFixed;
    if (typeof createComanda === "function") createComanda = createComandaFixed;
  }

  document.addEventListener("input", function (event) {
    const input = event.target.closest("[data-client-search]");
    if (!input) return;
    renderClientSuggestions(input);
  });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-client-pick]");
    if (!button) return;
    event.preventDefault();
    const client = findById("clientes", button.dataset.clientPick);
    if (!client) return;
    const wrap = button.closest(".client-search-wrap");
    const input = wrap?.querySelector('input[name="cliente_busca"]');
    const hidden = wrap?.querySelector('input[name="cliente_id"]');
    const box = wrap?.querySelector(".client-suggestions");
    if (input) input.value = client.nome;
    if (hidden) hidden.value = client.id;
    if (box) {
      box.classList.remove("is-open");
      box.innerHTML = "";
    }
  }, true);

  patchWorkflow();
  document.addEventListener("DOMContentLoaded", patchWorkflow);
})();
