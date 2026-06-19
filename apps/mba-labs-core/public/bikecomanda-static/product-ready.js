(function () {
  "use strict";

  const PRODUCT_STATUSES = [
    "Aberta",
    "Aguardando orçamento",
    "Aguardando aprovação",
    "Aprovada",
    "Em manutenção",
    "Aguardando peça",
    "Finalizada",
    "Aguardando pagamento",
    "Paga",
    "Entregue",
    "Cancelada",
  ];

  const STATUS_ALIASES = {
    "Entrada realizada": "Aberta",
    "Orçamento enviado": "Aguardando aprovação",
    "Aprovado pelo cliente": "Aprovada",
    "Serviço concluído": "Finalizada",
    "Cliente avisado": "Finalizada",
    Pago: "Paga",
    Cancelado: "Cancelada",
  };

  const FINAL_STATUSES = ["Entregue", "Cancelada"];
  const PRODUCT_VERSION = "2026-06-19";

  function normalizeStatus(status) {
    return STATUS_ALIASES[status] || status || "Aberta";
  }

  function patchStatusList() {
    if (Array.isArray(STATUS_LIST)) {
      STATUS_LIST.splice(0, STATUS_LIST.length, ...PRODUCT_STATUSES);
    }
  }

  function tenantId() {
    const host = window.location.hostname || "local";
    const store = settings?.()?.nome_loja || "BikeComanda";
    return String(store || host)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "bikecomanda-local";
  }

  function tagTenant(collection) {
    if (!Array.isArray(db?.[collection])) return;
    const empresaId = tenantId();
    db[collection].forEach((item) => {
      if (!item.empresa_id) item.empresa_id = empresaId;
      if (item.status) item.status = normalizeStatus(item.status);
    });
  }

  function patchDb() {
    patchStatusList();
    [
      "usuarios",
      "configuracoes_loja",
      "clientes",
      "bicicletas",
      "mecanicos",
      "servicos",
      "produtos",
      "comandas",
      "comanda_servicos",
      "comanda_produtos",
      "pagamentos",
      "comissoes",
      "historico_comandas",
    ].forEach(tagTenant);

    db.comandas.forEach((order) => {
      order.status = normalizeStatus(order.status);
      if (!order.status_pagamento || order.status_pagamento === "aberto") order.status_pagamento = "Aberto";
      if (order.status_pagamento === "pago") order.status_pagamento = "Pago";
      if (order.status_pagamento === "parcial") order.status_pagamento = "Parcial";
      if (order.status === "Cancelada") cancelPaymentState(order, false);
      if (order.status === "Finalizada" && Number(order.valor_pendente || 0) > 0) order.status = "Aguardando pagamento";
    });

    db.product_ready = {
      ...(db.product_ready || {}),
      version: PRODUCT_VERSION,
      empresa_id: tenantId(),
      supabase_tables: [
        "bike_configuracoes",
        "bike_clientes",
        "bike_bicicletas",
        "bike_servicos",
        "bike_mecanicos",
        "bike_comandas",
        "bike_comanda_servicos",
        "bike_comanda_produtos",
        "bike_pagamentos",
        "bike_comissoes",
        "bike_historico",
      ],
    };
  }

  function cancelPaymentState(order, writeHistory = true) {
    if (!order) return;
    const previous = order.status;
    order.status = "Cancelada";
    order.status_pagamento = "Cancelado";
    order.valor_recebido = 0;
    order.valor_pendente = 0;
    order.forma_pagamento = "";
    order.data_cancelamento = order.data_cancelamento || now();
    db.pagamentos
      .filter((payment) => payment.comanda_id === order.id)
      .forEach((payment) => {
        payment.cancelado = true;
        payment.estornado = true;
        payment.cancelado_em = payment.cancelado_em || now();
        payment.observacoes = [payment.observacoes, "Pagamento cancelado junto com a comanda."].filter(Boolean).join(" | ");
      });
    db.comanda_servicos
      .filter((item) => item.comanda_id === order.id)
      .forEach((item) => {
        item.status = "Cancelado";
      });
    db.comissoes
      .filter((commission) => commission.comanda_id === order.id && commission.status_pagamento_comissao !== "Paga")
      .forEach((commission) => {
        commission.status_pagamento_comissao = "Cancelada";
      });
    if (writeHistory) addHistory(order.id, "Comanda cancelada", previous, "Cancelada", "Pagamento e pendências zerados automaticamente.");
  }

  const originalSetOrderStatus = setOrderStatus;
  setOrderStatus = function patchedSetOrderStatus(order, status, observation) {
    const normalized = normalizeStatus(status);
    if (!order) return;
    if (normalized === "Paga" && order.status_pagamento !== "Pago") {
      alert("Registre o pagamento antes de marcar a comanda como paga.");
      return;
    }
    if (normalized === "Cancelada") {
      cancelPaymentState(order, true);
      return;
    }
    const previous = order.status;
    originalSetOrderStatus(order, normalized, observation);
    if (normalized === "Em manutenção") order.data_inicio = order.data_inicio || now();
    if (normalized === "Finalizada") order.data_finalizacao = order.data_finalizacao || now();
    if (normalized === "Entregue") order.data_saida = order.data_saida || now();
    if (previous !== normalized && normalized === "Aprovada") addHistory(order.id, "Aprovação registrada", previous, normalized, "Cliente autorizou o serviço.");
  };

  const originalRecalcOrder = recalcOrder;
  recalcOrder = function patchedRecalcOrder(orderId) {
    const order = findById("comandas", orderId);
    const wasCancelled = order?.status === "Cancelada";
    originalRecalcOrder(orderId);
    const updated = findById("comandas", orderId);
    if (!updated) return;
    updated.status = normalizeStatus(updated.status);
    if (wasCancelled || updated.status === "Cancelada") {
      cancelPaymentState(updated, false);
      return;
    }
    if (updated.status_pagamento === "Pago" && updated.status === "Pago") updated.status = "Paga";
    if (updated.status === "Finalizada" && Number(updated.valor_pendente || 0) > 0) updated.status = "Aguardando pagamento";
  };

  const originalStatusBadge = statusBadge;
  statusBadge = function patchedStatusBadge(status, forcedColor = "") {
    const normalized = normalizeStatus(status);
    if (forcedColor) return originalStatusBadge(normalized, forcedColor);
    const green = ["Aprovada", "Finalizada", "Paga", "Entregue", "Ativo", "Pago"];
    const blue = ["Em manutenção"];
    const yellow = ["Aberta", "Aguardando orçamento", "Aguardando aprovação", "Aguardando peça", "Aguardando pagamento", "Parcial", "Pendente"];
    const red = ["Cancelada", "Cancelado", "Inativo"];
    const color = green.includes(normalized) ? "green" : blue.includes(normalized) ? "blue" : yellow.includes(normalized) ? "yellow" : red.includes(normalized) ? "red" : "";
    return `<span class="status ${color}">${esc(normalized || "-")}</span>`;
  };

  const originalRender = render;
  render = function patchedRender() {
    patchStatusList();
    originalRender();
    setTimeout(enhanceScreen, 0);
  };

  document.addEventListener(
    "click",
    function (event) {
      const button = event.target.closest("[data-product-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.productAction;
      const id = button.dataset.id || ui.selectedOrderId;
      const order = id ? findById("comandas", id) : null;
      if (["send-approval-request", "send-maintenance", "send-collection", "send-pickup", "print-os", "print-budget", "print-receipt-pro"].includes(action) && !order) return;

      if (action === "send-approval-request") sendApprovalRequest(order);
      if (action === "send-maintenance") sendMaintenance(order);
      if (action === "send-collection") sendCollection(order);
      if (action === "send-pickup") sendPickup(order);
      if (action === "print-os") printProfessionalDocument(order, "Ordem de serviço");
      if (action === "print-budget") printProfessionalDocument(order, "Orçamento");
      if (action === "print-receipt-pro") printProfessionalDocument(order, "Recibo");
      if (action === "print-monthly-report") printMonthlyReport();
      if (action === "delete-entity") deleteEntity(button.dataset.entity, button.dataset.entityId);
    },
    true,
  );

  function enhanceScreen() {
    injectStyles();
    replacePrototypeCopy();
    injectDeleteButtons();
    if (ui.view === "dashboard") injectDashboardPrompt();
    if (ui.view === "detalhe") injectDetailButtons();
    if (ui.view === "relatorios") injectReportButton();
  }

  function injectStyles() {
    if (document.getElementById("bikecomanda-product-ready-style")) return;
    const style = document.createElement("style");
    style.id = "bikecomanda-product-ready-style";
    style.textContent = `
      .product-ready-banner{border:1px solid #c8e6d7;background:#f3fff8;border-radius:18px;padding:16px;display:grid;gap:8px;margin-top:16px}
      .product-ready-banner strong{font-size:16px;color:#0f5132}.product-ready-banner p{margin:0;color:#406157}
      .product-action-group{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed #dbe7e1}
      .doc-card{border:1px solid #e0e7e4;border-radius:18px;padding:16px;background:#fff;margin-top:14px}
      .print-doc-body{font-family:Arial,sans-serif;color:#17211d;margin:28px}.print-doc-body h1,.print-doc-body h2{margin:0 0 10px}.print-doc-body table{width:100%;border-collapse:collapse;margin:14px 0}.print-doc-body th,.print-doc-body td{border-bottom:1px solid #dbe5e1;padding:8px;text-align:left}.print-doc-total{max-width:380px;margin-left:auto}.print-row{display:flex;justify-content:space-between;border-bottom:1px solid #dbe5e1;padding:7px 0}.print-row.final{font-size:18px;font-weight:800;border-bottom:0}
    `;
    document.head.appendChild(style);
  }

  function replacePrototypeCopy() {
    document.querySelectorAll(".login-hero .subtle").forEach((node) => {
      if (node.textContent.includes("Protótipo")) node.textContent = "Versão operacional com fluxo de oficina, WhatsApp, PDF e estrutura SaaS preparada.";
    });
  }

  function injectDashboardPrompt() {
    const recent = document.querySelector(".command-list");
    if (!recent || document.querySelector(".product-ready-banner")) return;
    if (db.comandas.length) return;
    recent.insertAdjacentHTML(
      "afterend",
      `<div class="product-ready-banner"><strong>Comece pela primeira comanda</strong><p>Cadastre o cliente, vincule a bicicleta, monte o orçamento, envie pelo WhatsApp e acompanhe até pagamento e entrega.</p><button class="btn primary" type="button" data-action="nav" data-view="nova-comanda">Criar primeira comanda</button></div>`,
    );
  }

  function injectDetailButtons() {
    const card = [...document.querySelectorAll(".card")].find((item) => item.textContent.includes("Fluxo da comanda"));
    if (!card || card.querySelector(".product-action-group")) return;
    const order = findById("comandas", ui.selectedOrderId);
    if (!order || !canManageOrder()) return;
    card.insertAdjacentHTML(
      "beforeend",
      `<div class="product-action-group">
        <button class="btn blue" type="button" data-product-action="send-approval-request" data-id="${order.id}">Pedir aprovação</button>
        <button class="btn ghost" type="button" data-product-action="send-maintenance" data-id="${order.id}">Avisar manutenção</button>
        <button class="btn warning" type="button" data-product-action="send-collection" data-id="${order.id}">Enviar cobrança</button>
        <button class="btn ghost" type="button" data-product-action="send-pickup" data-id="${order.id}">Avisar retirada</button>
        <button class="btn ghost" type="button" data-product-action="print-os" data-id="${order.id}">OS/PDF</button>
        <button class="btn ghost" type="button" data-product-action="print-budget" data-id="${order.id}">Orçamento/PDF</button>
        <button class="btn ghost" type="button" data-product-action="print-receipt-pro" data-id="${order.id}">Recibo/PDF</button>
      </div>`,
    );
  }

  function injectReportButton() {
    const card = document.querySelector("section.card, .card");
    if (!card || document.querySelector('[data-product-action="print-monthly-report"]')) return;
    card.insertAdjacentHTML("afterbegin", `<div class="form-actions"><button class="btn primary" type="button" data-product-action="print-monthly-report">Imprimir relatório mensal/PDF</button></div>`);
  }

  function injectDeleteButtons() {
    if (!canManageOrder()) return;
    document.querySelectorAll('[data-action="edit-entity"]').forEach((button) => {
      const entity = button.dataset.entity;
      const id = button.dataset.id;
      if (!entity || !id || button.parentElement.querySelector(`[data-product-action="delete-entity"][data-entity-id="${id}"]`)) return;
      button.insertAdjacentHTML("afterend", ` <button class="btn small danger" type="button" data-product-action="delete-entity" data-entity="${entity}" data-entity-id="${id}">Excluir</button>`);
    });
  }

  function orderLines(order) {
    const services = orderServices(order.id).map((item) => `- ${item.descricao}: ${money(item.valor)}`);
    const products = orderProducts(order.id).map((item) => `- ${item.descricao} (${item.quantidade}x): ${money(item.valor_total)}`);
    return [...services, ...products].join("\n") || "- Nenhum item informado";
  }

  function clientAndBike(order) {
    return {
      client: findById("clientes", order.cliente_id),
      bike: findById("bicicletas", order.bicicleta_id),
    };
  }

  function sendApprovalRequest(order) {
    const { client, bike } = clientAndBike(order);
    const msg = `Olá, ${client?.nome || "cliente"}. Segue orçamento da ${settings().nome_loja}.

Comanda #${String(order.numero).padStart(5, "0")}
Bike: ${bikeLabel(bike)}

Itens:
${orderLines(order)}

Total: ${money(order.valor_total_final)}

Podemos iniciar o serviço? Responda APROVADO para autorizarmos a manutenção.`;
    openWhatsApp(client?.whatsapp, msg);
    setOrderStatus(order, "Aguardando aprovação", "Pedido de aprovação enviado ao cliente.");
    saveAndRender();
  }

  function sendMaintenance(order) {
    const { client, bike } = clientAndBike(order);
    const msg = `Olá, ${client?.nome || "cliente"}. Sua bicicleta entrou em manutenção.

Bike: ${bikeLabel(bike)}
Status: ${order.status}
Previsão: ${dateTime(order.data_previsao)}

Avisaremos assim que estiver pronta.`;
    openWhatsApp(client?.whatsapp, msg);
    setOrderStatus(order, "Em manutenção", "Cliente avisado sobre manutenção.");
    saveAndRender();
  }

  function sendCollection(order) {
    const { client, bike } = clientAndBike(order);
    const pending = Number(order.valor_pendente || 0) || Number(order.valor_total_final || 0);
    const msg = `Olá, ${client?.nome || "cliente"}. Sua bicicleta está com pagamento pendente.

Bike: ${bikeLabel(bike)}
Comanda #${String(order.numero).padStart(5, "0")}
Valor pendente: ${money(pending)}

Forma de pagamento disponível: Pix, dinheiro ou cartão.`;
    openWhatsApp(client?.whatsapp, msg);
    addHistory(order.id, "Cobrança enviada", order.status, order.status, `Pendente: ${money(pending)}.`);
    saveAndRender();
  }

  function sendPickup(order) {
    const { client, bike } = clientAndBike(order);
    const msg = `Olá, ${client?.nome || "cliente"}. Sua bicicleta está pronta para retirada.

Bike: ${bikeLabel(bike)}
Comanda #${String(order.numero).padStart(5, "0")}
Status do pagamento: ${order.status_pagamento}
Valor total: ${money(order.valor_total_final)}

Aguardamos você na ${settings().nome_loja}.`;
    openWhatsApp(client?.whatsapp, msg);
    if (order.status !== "Entregue" && order.status !== "Cancelada") setOrderStatus(order, "Finalizada", "Cliente avisado para retirada.");
    saveAndRender();
  }

  function printProfessionalDocument(order, kind) {
    const { client, bike } = clientAndBike(order);
    const title = `${kind} #${String(order.numero).padStart(5, "0")}`;
    const services = orderServices(order.id);
    const products = orderProducts(order.id);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body class="print-doc-body">
      <h1>${esc(settings().nome_loja)} · ${esc(kind)}</h1>
      <p>${esc(settings().endereco_loja || "")} ${settings().whatsapp_loja ? `· WhatsApp: ${esc(settings().whatsapp_loja)}` : ""}</p>
      <p><strong>Comanda:</strong> #${String(order.numero).padStart(5, "0")} · <strong>Data:</strong> ${dateTime(now())}</p>
      <p><strong>Cliente:</strong> ${esc(client?.nome || "-")} · <strong>WhatsApp:</strong> ${esc(client?.whatsapp || "-")}</p>
      <p><strong>Bike:</strong> ${esc(bikeLabel(bike))}</p>
      <p><strong>Status:</strong> ${esc(order.status)} · <strong>Pagamento:</strong> ${esc(order.status_pagamento)}</p>
      <h2>Serviços</h2><table><thead><tr><th>Serviço</th><th>Mecânico</th><th>Valor</th></tr></thead><tbody>${services.map((item) => `<tr><td>${esc(item.descricao)}</td><td>${esc(mechanicName(item.mecanico_id) || "-")}</td><td>${money(item.valor)}</td></tr>`).join("") || `<tr><td colspan="3">Nenhum serviço informado</td></tr>`}</tbody></table>
      <h2>Peças/produtos</h2><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Total</th></tr></thead><tbody>${products.map((item) => `<tr><td>${esc(item.descricao)}</td><td>${esc(item.quantidade)}</td><td>${money(item.valor_total)}</td></tr>`).join("") || `<tr><td colspan="3">Nenhuma peça informada</td></tr>`}</tbody></table>
      <div class="print-doc-total"><div class="print-row"><span>Total bruto</span><strong>${money(order.valor_total_bruto)}</strong></div><div class="print-row"><span>Desconto</span><strong>-${money(discountAmount(order))}</strong></div><div class="print-row final"><span>Total final</span><strong>${money(order.valor_total_final)}</strong></div><div class="print-row"><span>Recebido</span><strong>${money(order.valor_recebido)}</strong></div><div class="print-row"><span>Pendente</span><strong>${money(order.valor_pendente)}</strong></div></div>
      <p><strong>Observações:</strong> ${esc(order.observacoes || "-")}</p>
      <p style="margin-top:36px;border-top:1px solid #dbe5e1;padding-top:18px">Assinatura do cliente: _________________________________________</p>
      <script>window.print();<\/script>
    </body></html>`;
    const popup = window.open("", "_blank");
    if (!popup) return alert("Não foi possível abrir a impressão.");
    popup.document.write(html);
    popup.document.close();
    addHistory(order.id, `${kind} gerado`, order.status, order.status, "Documento aberto para impressão/PDF.");
    saveAndRender();
  }

  function printMonthlyReport() {
    const month = new Date().toISOString().slice(0, 7);
    const orders = db.comandas.filter((order) => String(order.created_at || order.data_entrada).slice(0, 7) === month);
    const received = orders.reduce((sum, order) => sum + Number(order.valor_recebido || 0), 0);
    const pending = orders.filter((order) => order.status !== "Cancelada").reduce((sum, order) => sum + Number(order.valor_pendente || 0), 0);
    const cancelled = orders.filter((order) => order.status === "Cancelada").length;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório mensal BikeComanda</title></head><body class="print-doc-body">
      <h1>${esc(settings().nome_loja)} · Relatório mensal</h1><p>Mês: ${esc(month)}</p>
      <div class="print-doc-total"><div class="print-row"><span>Comandas</span><strong>${orders.length}</strong></div><div class="print-row"><span>Recebido</span><strong>${money(received)}</strong></div><div class="print-row"><span>A receber</span><strong>${money(pending)}</strong></div><div class="print-row"><span>Canceladas</span><strong>${cancelled}</strong></div></div>
      <table><thead><tr><th>Comanda</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Recebido</th><th>Pendente</th></tr></thead><tbody>${orders.map((order) => `<tr><td>#${String(order.numero).padStart(5, "0")}</td><td>${esc(clientName(order.cliente_id))}</td><td>${esc(order.status)}</td><td>${esc(order.status_pagamento)}</td><td>${money(order.valor_total_final)}</td><td>${money(order.valor_recebido)}</td><td>${money(order.valor_pendente)}</td></tr>`).join("")}</tbody></table>
      <script>window.print();<\/script>
    </body></html>`;
    const popup = window.open("", "_blank");
    if (!popup) return alert("Não foi possível abrir a impressão.");
    popup.document.write(html);
    popup.document.close();
  }

  function deleteEntity(entity, id) {
    const collections = { cliente: "clientes", bicicleta: "bicicletas", mecanico: "mecanicos", servico: "servicos", produto: "produtos" };
    const collection = collections[entity];
    if (!collection || !id) return;
    if (!confirm("Excluir este cadastro?")) return;
    const blocked =
      (entity === "cliente" && (db.bicicletas.some((bike) => bike.cliente_id === id) || db.comandas.some((order) => order.cliente_id === id))) ||
      (entity === "bicicleta" && db.comandas.some((order) => order.bicicleta_id === id)) ||
      (entity === "mecanico" && (db.comandas.some((order) => order.mecanico_id === id) || db.comanda_servicos.some((item) => item.mecanico_id === id))) ||
      (entity === "servico" && db.comanda_servicos.some((item) => item.servico_id === id)) ||
      (entity === "produto" && db.comanda_produtos.some((item) => item.produto_id === id));
    if (blocked) {
      alert("Este cadastro possui vínculo com comanda ou histórico. Para preservar relatórios, marque como inativo ou remova os vínculos antes.");
      return;
    }
    db[collection] = db[collection].filter((item) => item.id !== id);
    delete ui.editing[entity];
    saveAndRender();
  }

  patchDb();
  save();
  render();
})();
