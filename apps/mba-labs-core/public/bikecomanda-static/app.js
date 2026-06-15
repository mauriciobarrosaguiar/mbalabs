const STORAGE_KEY = "bikecomanda:v1";
const STATUS_LIST = [
  "Entrada realizada",
  "Aguardando orçamento",
  "Orçamento enviado",
  "Aguardando aprovação",
  "Aprovado pelo cliente",
  "Em manutenção",
  "Serviço concluído",
  "Cliente avisado",
  "Pago",
  "Entregue",
  "Cancelado",
];
const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão", "Fiado"];
const COMMISSION_TYPES = ["Sem comissão", "Percentual", "Valor fixo"];

const app = document.querySelector("#app");
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

let db = loadDb();
let ui = {
  view: db.session?.userId ? "dashboard" : "login",
  selectedOrderId: db.comandas[0]?.id || null,
  editing: {},
  orderStatus: "",
  orderSearch: "",
  reportFrom: "",
  reportTo: "",
};

recalcAll();
save();
render();

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return brl.format(Number(value || 0));
}

function number(value) {
  if (value === "" || value === null || value === undefined) return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

function dateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateOnly(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function toInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toInputDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedDb();
  try {
    return migrateDb(JSON.parse(raw));
  } catch {
    return seedDb();
  }
}

function migrateDb(data) {
  const fresh = seedDb();
  const merged = { ...fresh, ...data };
  for (const key of Object.keys(fresh)) {
    if (Array.isArray(fresh[key]) && !Array.isArray(merged[key])) merged[key] = [];
  }
  merged.session = merged.session || null;
  merged.configuracoes_loja = merged.configuracoes_loja?.length
    ? merged.configuracoes_loja
    : fresh.configuracoes_loja;
  merged.comandas = merged.comandas.map((order) => ({
    fotos: [],
    tipo_desconto: "Valor fixo",
    valor_desconto: 0,
    valor_recebido: 0,
    valor_pendente: 0,
    status_pagamento: "Aberto",
    ...order,
  }));
  merged.comanda_servicos = merged.comanda_servicos.map((item) => ({
    status: "Pendente",
    observacoes: "",
    ...item,
  }));
  return merged;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function saveAndRender() {
  recalcAll();
  save();
  render();
}

function seedDb() {
  const created = now();
  return {
    session: null,
    usuarios: [
      {
        id: "u_admin",
        nome: "Ana Dona",
        email: "admin@bikecomanda.com",
        senha_hash: "123456",
        perfil: "Admin",
        ativo: true,
        created_at: created,
      },
      {
        id: "u_atendente",
        nome: "Bruno Atendente",
        email: "atendente@bikecomanda.com",
        senha_hash: "123456",
        perfil: "Atendente",
        ativo: true,
        created_at: created,
      },
      {
        id: "u_mecanico",
        nome: "Carlos Mecânico",
        email: "mecanico@bikecomanda.com",
        senha_hash: "123456",
        perfil: "Mecânico",
        mecanico_id: "mec_carlos",
        ativo: true,
        created_at: created,
      },
    ],
    configuracoes_loja: [
      {
        id: "cfg_1",
        nome_loja: "BikeComanda Oficina",
        whatsapp_loja: "11999990000",
        endereco_loja: "Rua das Bicicletas, 120",
        limite_desconto_atendente: 10,
        comissao_sobre_valor_com_desconto: false,
        created_at: created,
      },
    ],
    clientes: [
      {
        id: "cli_joao",
        nome: "João Pereira",
        whatsapp: "11988887777",
        cpf: "",
        endereco: "Av. Central, 45",
        observacoes: "Prefere contato por WhatsApp.",
        created_at: created,
      },
      {
        id: "cli_marina",
        nome: "Marina Souza",
        whatsapp: "11977776666",
        cpf: "",
        endereco: "",
        observacoes: "",
        created_at: created,
      },
    ],
    bicicletas: [
      {
        id: "bike_joao",
        cliente_id: "cli_joao",
        tipo: "Bicicleta",
        marca: "Caloi",
        modelo: "Explorer",
        cor: "Preta",
        aro: "29",
        numero_serie: "",
        observacoes: "Barulho no freio dianteiro.",
        created_at: created,
      },
      {
        id: "bike_marina",
        cliente_id: "cli_marina",
        tipo: "Bicicleta",
        marca: "Sense",
        modelo: "Fun Comp",
        cor: "Azul",
        aro: "29",
        numero_serie: "",
        observacoes: "",
        created_at: created,
      },
    ],
    mecanicos: [
      {
        id: "mec_carlos",
        nome: "Carlos Mecânico",
        whatsapp: "11955554444",
        tipo_comissao: "Percentual",
        percentual_padrao: 25,
        valor_fixo_padrao: 0,
        ativo: true,
        created_at: created,
      },
      {
        id: "mec_luiza",
        nome: "Luiza Técnica",
        whatsapp: "11944443333",
        tipo_comissao: "Valor fixo",
        percentual_padrao: 0,
        valor_fixo_padrao: 12,
        ativo: true,
        created_at: created,
      },
    ],
    servicos: [
      serviceSeed("srv_freio", "Regulagem de freio", "Ajuste de sapatas, pinças e cabos.", 35, "30 min", "Percentual", 25, 0, created),
      serviceSeed("srv_marcha", "Regulagem de marcha", "Ajuste fino de câmbio dianteiro e traseiro.", 45, "40 min", "Percentual", 25, 0, created),
      serviceSeed("srv_revisao_simples", "Revisão simples", "Ajuste geral, lubrificação e conferência de segurança.", 120, "2 h", "Percentual", 30, 0, created),
      serviceSeed("srv_revisao_completa", "Revisão completa", "Desmontagem parcial, limpeza, regulagens e reaperto geral.", 220, "1 dia", "Percentual", 30, 0, created),
      serviceSeed("srv_troca_pneu", "Troca de pneu", "Substituição e calibragem.", 25, "20 min", "Valor fixo", 0, 8, created),
      serviceSeed("srv_troca_camara", "Troca de câmara", "Substituição de câmara e teste de vazamento.", 20, "20 min", "Valor fixo", 0, 7, created),
      serviceSeed("srv_sangria", "Sangria de freio hidráulico", "Sangria e troca de fluido.", 95, "1 h", "Percentual", 25, 0, created),
      serviceSeed("srv_lavagem", "Lavagem da bike", "Lavagem completa com desengraxante e acabamento.", 60, "1 h", "Percentual", 20, 0, created),
    ],
    produtos: [
      productSeed("prod_camara29", "Câmara de ar aro 29", "Válvula presta.", 38, 12, created),
      productSeed("prod_pastilha", "Pastilha de freio", "Par para freio a disco.", 55, 8, created),
      productSeed("prod_cabo", "Cabo de aço", "Cabo inox para freio ou câmbio.", 18, 30, created),
      productSeed("prod_pneu29", "Pneu aro 29", "Pneu MTB uso misto.", 145, 5, created),
    ],
    comandas: [
      {
        id: "cmd_1",
        numero: 1,
        cliente_id: "cli_joao",
        bicicleta_id: "bike_joao",
        mecanico_id: "mec_carlos",
        status: "Aguardando aprovação",
        data_entrada: created,
        data_previsao: "",
        data_saida: "",
        observacoes: "Cliente pediu orçamento antes de executar.",
        fotos: [],
        valor_total_servicos: 0,
        valor_total_produtos: 0,
        valor_total_bruto: 0,
        tipo_desconto: "Valor fixo",
        valor_desconto: 10,
        motivo_desconto: "Cortesia primeira visita",
        valor_total_final: 0,
        desconto_aplicado_por: "u_admin",
        desconto_aplicado_em: created,
        status_pagamento: "Aberto",
        forma_pagamento: "",
        valor_recebido: 0,
        valor_pendente: 0,
        created_at: created,
      },
    ],
    comanda_servicos: [
      {
        id: "cs_1",
        comanda_id: "cmd_1",
        servico_id: "srv_freio",
        mecanico_id: "mec_carlos",
        descricao: "Regulagem de freio",
        valor: 35,
        tipo_comissao: "Percentual",
        percentual_comissao: 25,
        valor_comissao: 0,
        status: "Pendente",
        observacoes: "",
        created_at: created,
      },
      {
        id: "cs_2",
        comanda_id: "cmd_1",
        servico_id: "srv_lavagem",
        mecanico_id: "mec_carlos",
        descricao: "Lavagem da bike",
        valor: 60,
        tipo_comissao: "Percentual",
        percentual_comissao: 20,
        valor_comissao: 0,
        status: "Pendente",
        observacoes: "",
        created_at: created,
      },
    ],
    comanda_produtos: [
      {
        id: "cp_1",
        comanda_id: "cmd_1",
        produto_id: "prod_cabo",
        descricao: "Cabo de aço",
        quantidade: 1,
        valor_unitario: 18,
        valor_total: 18,
        created_at: created,
      },
    ],
    pagamentos: [],
    comissoes: [],
    historico_comandas: [
      {
        id: "hist_1",
        comanda_id: "cmd_1",
        usuario_id: "u_admin",
        acao: "Comanda aberta",
        status_anterior: "",
        status_novo: "Entrada realizada",
        observacao: "Entrada registrada no sistema.",
        created_at: created,
      },
      {
        id: "hist_2",
        comanda_id: "cmd_1",
        usuario_id: "u_admin",
        acao: "Orçamento enviado",
        status_anterior: "Entrada realizada",
        status_novo: "Aguardando aprovação",
        observacao: "Orçamento enviado ao cliente pelo WhatsApp.",
        created_at: created,
      },
    ],
  };
}

function serviceSeed(id, nome, descricao, valor, tempo, tipo, percentual, fixo, created) {
  return {
    id,
    nome,
    descricao,
    valor_padrao: valor,
    tempo_estimado: tempo,
    tipo_comissao: tipo,
    percentual_comissao: percentual,
    valor_comissao_fixa: fixo,
    ativo: true,
    created_at: created,
  };
}

function productSeed(id, nome, descricao, valor, estoque, created) {
  return {
    id,
    nome,
    descricao,
    valor_venda: valor,
    estoque,
    ativo: true,
    created_at: created,
  };
}

function currentUser() {
  if (!db.session?.userId) return null;
  return db.usuarios.find((user) => user.id === db.session.userId && user.ativo) || null;
}

function settings() {
  return db.configuracoes_loja[0];
}

function isAdmin() {
  return currentUser()?.perfil === "Admin";
}

function isAttendant() {
  return currentUser()?.perfil === "Atendente";
}

function isMechanic() {
  return currentUser()?.perfil === "Mecânico";
}

function currentMechanicId() {
  return currentUser()?.mecanico_id || "";
}

function navItems() {
  const role = currentUser()?.perfil;
  const items = [
    ["dashboard", "Dashboard", ["Admin", "Atendente", "Mecânico"]],
    ["clientes", "Clientes", ["Admin", "Atendente"]],
    ["bicicletas", "Bicicletas", ["Admin", "Atendente"]],
    ["nova-comanda", "Nova comanda", ["Admin", "Atendente"]],
    ["comandas", isMechanic() ? "Minhas comandas" : "Comandas", ["Admin", "Atendente", "Mecânico"]],
    ["pagamentos", "Pagamentos", ["Admin", "Atendente"]],
    ["comissoes", "Comissões", ["Admin", "Mecânico"]],
    ["mecanicos", "Mecânicos", ["Admin"]],
    ["servicos", "Serviços", ["Admin", "Atendente"]],
    ["produtos", "Produtos/Peças", ["Admin", "Atendente"]],
    ["relatorios", "Relatórios", ["Admin", "Atendente"]],
    ["configuracoes", "Configurações", ["Admin"]],
  ];
  return items
    .filter(([, , roles]) => roles.includes(role))
    .map(([view, label]) => ({ view, label }));
}

function render() {
  recalcAll();
  const user = currentUser();
  if (!user) {
    renderLogin();
    return;
  }

  const allowed = navItems().some((item) => item.view === ui.view) || ui.view === "detalhe";
  if (!allowed) ui.view = "dashboard";

  const content = renderView();
  app.innerHTML = renderShell(content);
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-hero">
        <div class="brand-mark"><span class="brand-icon">BC</span> BikeComanda</div>
        <div class="login-copy">
          <h1>Comandas de oficina sem complicar a loja.</h1>
          <p>Registre a entrada da bike, envie orçamento pelo WhatsApp, acompanhe a manutenção, controle pagamentos e calcule comissão dos mecânicos.</p>
          <div class="login-pills">
            <span>Celular primeiro</span>
            <span>WhatsApp pronto</span>
            <span>Comissão automática</span>
          </div>
        </div>
        <p class="subtle" style="color: rgba(255,255,255,.72)">Protótipo local com dados de demonstração.</p>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <h2>Entrar</h2>
          <p>Use um perfil de demonstração ou informe e-mail e senha.</p>
          <form data-form="login">
            <div class="form-grid">
              <div class="field full">
                <label>E-mail</label>
                <input name="email" type="email" autocomplete="email" value="admin@bikecomanda.com" required />
              </div>
              <div class="field full">
                <label>Senha</label>
                <input name="senha" type="password" autocomplete="current-password" value="123456" required />
              </div>
            </div>
            <div class="form-actions">
              <button class="btn primary" type="submit">Entrar no sistema</button>
            </div>
          </form>
          <div class="quick-logins">
            <button class="btn ghost" type="button" data-action="quick-login" data-user="u_admin">Entrar como Admin</button>
            <button class="btn ghost" type="button" data-action="quick-login" data-user="u_atendente">Entrar como Atendente</button>
            <button class="btn ghost" type="button" data-action="quick-login" data-user="u_mecanico">Entrar como Mecânico</button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderShell(content) {
  const user = currentUser();
  const nav = navItems()
    .map(
      (item) => `
        <button class="nav-button ${ui.view === item.view ? "is-active" : ""}" type="button" data-action="nav" data-view="${item.view}">
          ${esc(item.label)}
        </button>
      `,
    )
    .join("");
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-mark"><span class="brand-icon">BC</span> BikeComanda</div>
        <div class="user-card">
          <strong>${esc(user.nome)}</strong>
          <span>${esc(user.perfil)} · ${esc(settings().nome_loja)}</span>
        </div>
        <nav class="nav">${nav}</nav>
        <button class="btn ghost full" type="button" data-action="logout">Sair</button>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h1>${esc(pageTitle())}</h1>
            <p>${esc(pageSubtitle())}</p>
          </div>
          ${canCreateOrders() ? `<button class="btn primary" type="button" data-action="nav" data-view="nova-comanda">Nova comanda</button>` : ""}
        </div>
        ${content}
      </main>
      <nav class="mobile-nav">${nav}</nav>
    </div>
  `;
}

function pageTitle() {
  const titles = {
    dashboard: "Dashboard",
    clientes: "Clientes",
    bicicletas: "Bicicletas",
    mecanicos: "Mecânicos",
    servicos: "Serviços",
    produtos: "Produtos/Peças",
    "nova-comanda": "Nova comanda",
    comandas: isMechanic() ? "Minhas comandas" : "Comandas",
    detalhe: "Detalhe da comanda",
    pagamentos: "Pagamentos",
    comissoes: "Comissões",
    relatorios: "Relatórios",
    configuracoes: "Configurações da loja",
  };
  return titles[ui.view] || "BikeComanda";
}

function pageSubtitle() {
  if (isMechanic()) return "Acesso focado nas comandas atribuídas e nas suas comissões.";
  const subtitles = {
    dashboard: "Visão rápida da operação da bicicletaria.",
    clientes: "Cadastre clientes com WhatsApp obrigatório.",
    bicicletas: "Vincule as bicicletas aos clientes.",
    mecanicos: "Configure comissão e disponibilidade dos mecânicos.",
    servicos: "Cadastre serviços, valores e regras de comissão.",
    produtos: "Controle peças, valores e estoque opcional.",
    "nova-comanda": "Registre a entrada da bicicleta em poucos passos.",
    comandas: "Acompanhe orçamento, manutenção, pagamento e entrega.",
    detalhe: "Edite itens, envie WhatsApp, aplique desconto e registre histórico.",
    pagamentos: "Veja recebimentos, pendências e formas de pagamento.",
    comissoes: "Acompanhe comissão por serviço, mecânico e status.",
    relatorios: "Indicadores simples por período.",
    configuracoes: "Defina limite de desconto e regra de comissão.",
  };
  return subtitles[ui.view] || "";
}

function renderView() {
  switch (ui.view) {
    case "dashboard":
      return renderDashboard();
    case "clientes":
      return renderClientes();
    case "bicicletas":
      return renderBicicletas();
    case "mecanicos":
      return renderMecanicos();
    case "servicos":
      return renderServicos();
    case "produtos":
      return renderProdutos();
    case "nova-comanda":
      return renderNovaComanda();
    case "comandas":
      return renderComandas();
    case "detalhe":
      return renderDetalhe();
    case "pagamentos":
      return renderPagamentos();
    case "comissoes":
      return renderComissoes();
    case "relatorios":
      return renderRelatorios();
    case "configuracoes":
      return renderConfiguracoes();
    default:
      return renderDashboard();
  }
}

function renderDashboard() {
  const orders = visibleOrders();
  const allOrders = isMechanic() ? orders : db.comandas;
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const soldToday = allOrders
    .filter((order) => ["Pago", "Entregue"].includes(order.status) && order.created_at.slice(0, 10) === today)
    .reduce((sum, order) => sum + order.valor_total_final, 0);
  const soldMonth = allOrders
    .filter((order) => ["Pago", "Entregue"].includes(order.status) && order.created_at.slice(0, 7) === month)
    .reduce((sum, order) => sum + order.valor_total_final, 0);
  const totalDiscounts = allOrders.reduce((sum, order) => sum + discountAmount(order), 0);
  const pendingCommission = commissionsForCurrentUser()
    .filter((commission) => commission.status_pagamento_comissao !== "Paga")
    .reduce((sum, commission) => sum + commission.valor_comissao, 0);

  const cards = [
    ["Comandas abertas", allOrders.filter((order) => !["Entregue", "Cancelado"].includes(order.status)).length, "Em andamento na loja"],
    ["Bikes em manutenção", allOrders.filter((order) => order.status === "Em manutenção").length, "Serviço já iniciado"],
    ["Aguardando aprovação", allOrders.filter((order) => order.status === "Aguardando aprovação").length, "Orçamentos sem resposta"],
    ["Serviços concluídos", allOrders.filter((order) => order.status === "Serviço concluído").length, "Prontos para avisar"],
    ["Vendido hoje", money(soldToday), "Pagas ou entregues"],
    ["Vendido no mês", money(soldMonth), "Pagas ou entregues"],
    ["Descontos concedidos", money(totalDiscounts), "Total acumulado"],
    ["Comissão pendente", money(pendingCommission), isMechanic() ? "Sua comissão" : "Todos os mecânicos"],
    ["Comandas entregues", allOrders.filter((order) => order.status === "Entregue").length, "Saída concluída"],
    ["Comandas canceladas", allOrders.filter((order) => order.status === "Cancelado").length, "Recusadas ou canceladas"],
  ];

  return `
    <section class="grid auto">
      ${cards
        .map(
          ([label, value, hint]) => `
            <article class="metric-card">
              <small>${esc(label)}</small>
              <strong>${esc(value)}</strong>
              <div class="hint">${esc(hint)}</div>
            </article>
          `,
        )
        .join("")}
    </section>
    <section class="grid two" style="margin-top:16px">
      <div class="card">
        <div class="split-title">
          <h2>${isMechanic() ? "Suas próximas comandas" : "Comandas recentes"}</h2>
          <button class="btn small ghost" type="button" data-action="nav" data-view="comandas">Ver todas</button>
        </div>
        <div class="command-list">
          ${orders.slice(0, 4).map(renderOrderCard).join("") || `<div class="empty">Nenhuma comanda encontrada.</div>`}
        </div>
      </div>
      <div class="card">
        <h2>Ações rápidas</h2>
        <div class="grid">
          ${canCreateOrders() ? `<button class="btn primary" type="button" data-action="nav" data-view="nova-comanda">Abrir nova comanda</button>` : ""}
          ${canCreateOrders() ? `<button class="btn ghost" type="button" data-action="nav" data-view="clientes">Cadastrar cliente</button>` : ""}
          ${!isMechanic() ? `<button class="btn ghost" type="button" data-action="nav" data-view="relatorios">Ver relatórios</button>` : ""}
          ${isMechanic() ? `<button class="btn ghost" type="button" data-action="nav" data-view="comissoes">Ver minha comissão</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderClientes() {
  const edit = db.clientes.find((item) => item.id === ui.editing.cliente);
  return `
    <section class="grid two">
      <div class="card">
        <h2>${edit ? "Editar cliente" : "Novo cliente"}</h2>
        <form data-form="cliente">
          <input type="hidden" name="id" value="${esc(edit?.id || "")}" />
          <div class="form-grid">
            ${field("Nome completo", "nome", edit?.nome, "text", true)}
            ${field("WhatsApp", "whatsapp", edit?.whatsapp, "tel", true)}
            ${field("CPF", "cpf", edit?.cpf)}
            ${field("Endereço", "endereco", edit?.endereco)}
            ${textarea("Observações", "observacoes", edit?.observacoes)}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${edit ? "Salvar alterações" : "Cadastrar cliente"}</button>
            ${edit ? `<button class="btn ghost" type="button" data-action="cancel-edit" data-entity="cliente">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Clientes cadastrados</h2>
        ${table(
          ["Nome", "WhatsApp", "Bikes", "Ações"],
          db.clientes.map((client) => [
            esc(client.nome),
            esc(client.whatsapp),
            db.bicicletas.filter((bike) => bike.cliente_id === client.id).length,
            `<button class="btn small ghost" type="button" data-action="edit-entity" data-entity="cliente" data-id="${client.id}">Editar</button>`,
          ]),
        )}
      </div>
    </section>
  `;
}

function renderBicicletas() {
  const edit = db.bicicletas.find((item) => item.id === ui.editing.bicicleta);
  return `
    <section class="grid two">
      <div class="card">
        <h2>${edit ? "Editar bicicleta" : "Nova bicicleta"}</h2>
        <form data-form="bicicleta">
          <input type="hidden" name="id" value="${esc(edit?.id || "")}" />
          <div class="form-grid">
            ${selectField("Cliente vinculado", "cliente_id", db.clientes.map((client) => [client.id, client.nome]), edit?.cliente_id, true)}
            ${selectField("Tipo de veículo", "tipo", [["Bicicleta", "Bicicleta"]], edit?.tipo || "Bicicleta", true)}
            ${field("Marca", "marca", edit?.marca, "text", true)}
            ${field("Modelo", "modelo", edit?.modelo, "text", true)}
            ${field("Cor", "cor", edit?.cor)}
            ${field("Aro", "aro", edit?.aro)}
            ${field("Número de série", "numero_serie", edit?.numero_serie)}
            ${textarea("Observações", "observacoes", edit?.observacoes)}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${edit ? "Salvar alterações" : "Cadastrar bicicleta"}</button>
            ${edit ? `<button class="btn ghost" type="button" data-action="cancel-edit" data-entity="bicicleta">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Bicicletas</h2>
        ${table(
          ["Cliente", "Bike", "Cor/Aro", "Ações"],
          db.bicicletas.map((bike) => [
            esc(clientName(bike.cliente_id)),
            `${esc(bike.marca)} ${esc(bike.modelo)}`,
            `${esc(bike.cor || "-")} · Aro ${esc(bike.aro || "-")}`,
            `<button class="btn small ghost" type="button" data-action="edit-entity" data-entity="bicicleta" data-id="${bike.id}">Editar</button>`,
          ]),
        )}
      </div>
    </section>
  `;
}

function renderMecanicos() {
  const edit = db.mecanicos.find((item) => item.id === ui.editing.mecanico);
  return `
    <section class="grid two">
      <div class="card">
        <h2>${edit ? "Editar mecânico" : "Novo mecânico"}</h2>
        <form data-form="mecanico">
          <input type="hidden" name="id" value="${esc(edit?.id || "")}" />
          <div class="form-grid">
            ${field("Nome", "nome", edit?.nome, "text", true)}
            ${field("WhatsApp", "whatsapp", edit?.whatsapp, "tel")}
            ${selectField("Tipo de comissão", "tipo_comissao", COMMISSION_TYPES.map((item) => [item, item]), edit?.tipo_comissao || "Sem comissão")}
            ${field("Percentual padrão de comissão", "percentual_padrao", edit?.percentual_padrao, "number")}
            ${field("Valor fixo padrão", "valor_fixo_padrao", edit?.valor_fixo_padrao, "number")}
            ${selectField("Status", "ativo", [["true", "Ativo"], ["false", "Inativo"]], String(edit?.ativo ?? true))}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${edit ? "Salvar alterações" : "Cadastrar mecânico"}</button>
            ${edit ? `<button class="btn ghost" type="button" data-action="cancel-edit" data-entity="mecanico">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Mecânicos</h2>
        ${table(
          ["Nome", "Comissão", "Status", "Ações"],
          db.mecanicos.map((mechanic) => [
            `${esc(mechanic.nome)}<div class="subtle">${esc(mechanic.whatsapp || "")}</div>`,
            commissionLabel(mechanic.tipo_comissao, mechanic.percentual_padrao, mechanic.valor_fixo_padrao),
            statusBadge(mechanic.ativo ? "Ativo" : "Inativo"),
            `<button class="btn small ghost" type="button" data-action="edit-entity" data-entity="mecanico" data-id="${mechanic.id}">Editar</button>
             <button class="btn small warning" type="button" data-action="toggle-active" data-entity="mecanicos" data-id="${mechanic.id}">${mechanic.ativo ? "Inativar" : "Ativar"}</button>`,
          ]),
        )}
      </div>
    </section>
  `;
}

function renderServicos() {
  const edit = db.servicos.find((item) => item.id === ui.editing.servico);
  return `
    <section class="grid two">
      <div class="card">
        <h2>${edit ? "Editar serviço" : "Novo serviço"}</h2>
        <form data-form="servico">
          <input type="hidden" name="id" value="${esc(edit?.id || "")}" />
          <div class="form-grid">
            ${field("Nome do serviço", "nome", edit?.nome, "text", true)}
            ${field("Valor padrão", "valor_padrao", edit?.valor_padrao, "number", true)}
            ${field("Tempo estimado", "tempo_estimado", edit?.tempo_estimado)}
            ${selectField("Tipo de comissão", "tipo_comissao", COMMISSION_TYPES.map((item) => [item, item]), edit?.tipo_comissao || "Sem comissão")}
            ${field("Percentual de comissão", "percentual_comissao", edit?.percentual_comissao, "number")}
            ${field("Valor fixo de comissão", "valor_comissao_fixa", edit?.valor_comissao_fixa, "number")}
            ${selectField("Status", "ativo", [["true", "Ativo"], ["false", "Inativo"]], String(edit?.ativo ?? true))}
            ${textarea("Descrição", "descricao", edit?.descricao)}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${edit ? "Salvar alterações" : "Cadastrar serviço"}</button>
            ${edit ? `<button class="btn ghost" type="button" data-action="cancel-edit" data-entity="servico">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Serviços</h2>
        ${table(
          ["Serviço", "Valor", "Comissão", "Status", "Ações"],
          db.servicos.map((service) => [
            `${esc(service.nome)}<div class="subtle">${esc(service.descricao || "")}</div>`,
            money(service.valor_padrao),
            commissionLabel(service.tipo_comissao, service.percentual_comissao, service.valor_comissao_fixa),
            statusBadge(service.ativo ? "Ativo" : "Inativo"),
            `<button class="btn small ghost" type="button" data-action="edit-entity" data-entity="servico" data-id="${service.id}">Editar</button>
             <button class="btn small warning" type="button" data-action="toggle-active" data-entity="servicos" data-id="${service.id}">${service.ativo ? "Inativar" : "Ativar"}</button>`,
          ]),
        )}
      </div>
    </section>
  `;
}

function renderProdutos() {
  const edit = db.produtos.find((item) => item.id === ui.editing.produto);
  return `
    <section class="grid two">
      <div class="card">
        <h2>${edit ? "Editar produto/peça" : "Novo produto/peça"}</h2>
        <form data-form="produto">
          <input type="hidden" name="id" value="${esc(edit?.id || "")}" />
          <div class="form-grid">
            ${field("Nome do produto", "nome", edit?.nome, "text", true)}
            ${field("Valor de venda", "valor_venda", edit?.valor_venda, "number", true)}
            ${field("Estoque opcional", "estoque", edit?.estoque, "number")}
            ${selectField("Status", "ativo", [["true", "Ativo"], ["false", "Inativo"]], String(edit?.ativo ?? true))}
            ${textarea("Descrição", "descricao", edit?.descricao)}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">${edit ? "Salvar alterações" : "Cadastrar produto"}</button>
            ${edit ? `<button class="btn ghost" type="button" data-action="cancel-edit" data-entity="produto">Cancelar</button>` : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Produtos e peças</h2>
        ${table(
          ["Produto", "Valor", "Estoque", "Status", "Ações"],
          db.produtos.map((product) => [
            `${esc(product.nome)}<div class="subtle">${esc(product.descricao || "")}</div>`,
            money(product.valor_venda),
            product.estoque === "" || product.estoque === null || product.estoque === undefined ? "-" : esc(product.estoque),
            statusBadge(product.ativo ? "Ativo" : "Inativo"),
            `<button class="btn small ghost" type="button" data-action="edit-entity" data-entity="produto" data-id="${product.id}">Editar</button>
             <button class="btn small warning" type="button" data-action="toggle-active" data-entity="produtos" data-id="${product.id}">${product.ativo ? "Inativar" : "Ativar"}</button>`,
          ]),
        )}
      </div>
    </section>
  `;
}

function renderNovaComanda() {
  if (!db.clientes.length || !db.bicicletas.length) {
    return `
      <div class="empty">
        Cadastre ao menos um cliente e uma bicicleta antes de abrir comandas.
        <div class="form-actions" style="justify-content:center">
          <button class="btn primary" type="button" data-action="nav" data-view="clientes">Cadastrar cliente</button>
          <button class="btn ghost" type="button" data-action="nav" data-view="bicicletas">Cadastrar bicicleta</button>
        </div>
      </div>
    `;
  }

  return `
    <section class="card">
      <h2>Entrada da bicicleta</h2>
      <form data-form="nova-comanda">
        <div class="form-grid three">
          ${selectField("Cliente", "cliente_id", db.clientes.map((client) => [client.id, client.nome]), "", true)}
          ${selectField(
            "Bicicleta",
            "bicicleta_id",
            db.bicicletas.map((bike) => [bike.id, `${clientName(bike.cliente_id)} · ${bike.marca} ${bike.modelo} aro ${bike.aro || "-"}`]),
            "",
            true,
          )}
          ${selectField("Mecânico responsável", "mecanico_id", activeMechanics().map((mechanic) => [mechanic.id, mechanic.nome]), "", false)}
          ${field("Data prevista", "data_previsao", "", "datetime-local")}
          <div class="field full">
            <label>Fotos opcionais da bicicleta</label>
            <input type="file" name="fotos" accept="image/*" multiple />
          </div>
          ${textarea("Observações gerais", "observacoes")}
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Abrir comanda</button>
        </div>
      </form>
    </section>
  `;
}

function renderComandas() {
  const orders = filteredOrders();
  const statusOptions = [["", "Todos os status"], ...STATUS_LIST.map((status) => [status, status])];
  return `
    <section class="card compact">
      <form class="toolbar" data-form="order-filter">
        ${selectField("Status", "status", statusOptions, ui.orderStatus)}
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

function renderOrderCard(order) {
  const client = findById("clientes", order.cliente_id);
  const bike = findById("bicicletas", order.bicicleta_id);
  return `
    <article class="command-card">
      <div>
        <h3>Comanda #${String(order.numero).padStart(5, "0")} · ${esc(client?.nome || "Cliente")}</h3>
        <div class="meta">
          <span>${esc(bikeLabel(bike))}</span>
          <span>Entrada: ${dateTime(order.data_entrada)}</span>
          <span>Mecânico: ${esc(mechanicName(order.mecanico_id) || "-")}</span>
        </div>
        <div class="toolbar" style="margin-top:10px">
          ${statusBadge(order.status)}
          ${statusBadge(order.status_pagamento, order.status_pagamento === "Pago" ? "green" : order.status_pagamento === "Parcial" ? "yellow" : "gray")}
          <span class="money">${money(order.valor_total_final)}</span>
        </div>
      </div>
      <div class="command-actions">
        <button class="btn small primary" type="button" data-action="open-order" data-id="${order.id}">Abrir</button>
      </div>
    </article>
  `;
}

function renderDetalhe() {
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
          <div class="split-title">
            <h2>Fluxo da comanda</h2>
            ${canManage ? statusSelect(order) : ""}
          </div>
          <div class="toolbar">
            ${canManage ? `<button class="btn blue" type="button" data-action="whatsapp-budget" data-id="${order.id}">Enviar orçamento no WhatsApp</button>` : ""}
            ${canManage ? `<button class="btn primary" type="button" data-action="client-approved" data-id="${order.id}">Cliente aprovou</button>` : ""}
            ${canManage ? `<button class="btn warning" type="button" data-action="client-waiting" data-id="${order.id}">Aguardando resposta</button>` : ""}
            ${canManage ? `<button class="btn danger" type="button" data-action="client-rejected" data-id="${order.id}">Cliente recusou</button>` : ""}
            ${canManage ? `<button class="btn ghost" type="button" data-action="whatsapp-approved" data-id="${order.id}">WhatsApp aprovação</button>` : ""}
            ${canExecute ? `<button class="btn primary" type="button" data-action="start-service" data-id="${order.id}">Iniciar serviço</button>` : ""}
            ${canExecute ? `<button class="btn primary" type="button" data-action="finish-service" data-id="${order.id}">Concluir serviço</button>` : ""}
            ${canManage ? `<button class="btn blue" type="button" data-action="whatsapp-ready" data-id="${order.id}">Avisar cliente no WhatsApp</button>` : ""}
            ${canManage ? `<button class="btn ghost" type="button" data-action="print-receipt" data-id="${order.id}">Gerar PDF/recibo</button>` : ""}
            ${canManage ? `<button class="btn ghost" type="button" data-action="whatsapp-receipt" data-id="${order.id}">Enviar recibo WhatsApp</button>` : ""}
            ${canManage ? `<button class="btn primary" type="button" data-action="deliver-order" data-id="${order.id}">Entregar bicicleta</button>` : ""}
            ${canManage ? `<button class="btn danger" type="button" data-action="cancel-order" data-id="${order.id}">Cancelar comanda</button>` : ""}
          </div>
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

function renderServiceItems(order, services) {
  if (!services.length) return `<div class="empty">Nenhum serviço adicionado.</div>`;
  return table(
    ["Serviço", "Mecânico", "Valor", "Comissão", "Status", "Ações"],
    services.map((item) => [
      `${esc(item.descricao)}${item.observacoes ? `<div class="subtle">${esc(item.observacoes)}</div>` : ""}`,
      esc(mechanicName(item.mecanico_id) || mechanicName(order.mecanico_id) || "-"),
      money(item.valor),
      money(item.valor_comissao),
      statusBadge(item.status, item.status === "Concluído" ? "green" : item.status === "Em manutenção" ? "blue" : "gray"),
      canManageOrder()
        ? `<button class="btn small ghost" type="button" data-action="edit-service-value" data-id="${item.id}">Editar valor</button>
           <button class="btn small danger" type="button" data-action="remove-service-item" data-id="${item.id}">Remover</button>`
        : "-",
    ]),
  );
}

function renderProductItems(order, products) {
  if (!products.length) return `<div class="empty">Nenhum produto/peça adicionado.</div>`;
  return table(
    ["Produto", "Qtd.", "Unitário", "Total", "Ações"],
    products.map((item) => [
      esc(item.descricao),
      esc(item.quantidade),
      money(item.valor_unitario),
      money(item.valor_total),
      canManageOrder()
        ? `<button class="btn small ghost" type="button" data-action="edit-product-value" data-id="${item.id}">Editar</button>
           <button class="btn small danger" type="button" data-action="remove-product-item" data-id="${item.id}">Remover</button>`
        : "-",
    ]),
  );
}

function renderAddServiceForm(order) {
  return `
    <form data-form="add-servico-comanda" data-id="${order.id}" style="margin-top:16px">
      <h3>Adicionar serviço</h3>
      <div class="form-grid three">
        ${selectField("Serviço", "servico_id", [["", "Serviço avulso"], ...activeServices().map((service) => [service.id, `${service.nome} · ${money(service.valor_padrao)}`])])}
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

function renderAddProductForm(order) {
  return `
    <form data-form="add-produto-comanda" data-id="${order.id}" style="margin-top:16px">
      <h3>Adicionar produto/peça</h3>
      <div class="form-grid three">
        ${selectField("Produto", "produto_id", [["", "Produto avulso"], ...activeProducts().map((product) => [product.id, `${product.nome} · ${money(product.valor_venda)}`])])}
        ${field("Descrição avulsa", "descricao")}
        ${field("Quantidade", "quantidade", 1, "number")}
        ${field("Valor unitário", "valor_unitario", "", "number")}
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit">Adicionar produto</button>
      </div>
    </form>
  `;
}

function renderTotals(order) {
  const discount = discountAmount(order);
  return `
    <div class="totals">
      ${totalRow("Total de serviços", money(order.valor_total_servicos))}
      ${totalRow("Total de produtos", money(order.valor_total_produtos))}
      ${totalRow("Total bruto", money(order.valor_total_bruto))}
      ${totalRow(`Desconto ${order.valor_desconto ? discountDescription(order) : ""}`, `-${money(discount)}`)}
      ${totalRow("Total final", money(order.valor_total_final), "final")}
      ${totalRow("Valor recebido", money(order.valor_recebido))}
      ${totalRow("Valor pendente", money(order.valor_pendente))}
      ${totalRow("Pagamento", order.status_pagamento)}
      ${order.forma_pagamento ? totalRow("Forma de pagamento", order.forma_pagamento) : ""}
    </div>
  `;
}

function renderDiscountForm(order) {
  return `
    <h2>Aplicar desconto</h2>
    <p class="subtle">Atendente pode aplicar até ${settings().limite_desconto_atendente}% do total bruto. Mecânico não aplica desconto.</p>
    <form data-form="apply-discount" data-id="${order.id}">
      <div class="form-grid">
        ${selectField("Tipo de desconto", "tipo_desconto", [["Valor fixo", "Valor fixo"], ["Percentual", "Percentual"]], order.tipo_desconto)}
        ${field("Valor do desconto", "valor_desconto", order.valor_desconto, "number")}
        ${textarea("Motivo do desconto", "motivo_desconto", order.motivo_desconto)}
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit">Aplicar desconto</button>
      </div>
    </form>
  `;
}

function renderPaymentForm(order) {
  return `
    <h2>Registrar pagamento</h2>
    <form data-form="add-payment" data-id="${order.id}">
      <div class="form-grid">
        ${selectField("Forma de pagamento", "forma_pagamento", PAYMENT_METHODS.map((item) => [item, item]), order.forma_pagamento || "Pix", true)}
        ${field("Valor recebido", "valor", order.valor_pendente || order.valor_total_final, "number")}
        ${textarea("Observações", "observacoes")}
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit">Registrar pagamento</button>
      </div>
    </form>
  `;
}

function renderHistory(orderId) {
  const items = db.historico_comandas
    .filter((item) => item.comanda_id === orderId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!items.length) return `<div class="empty">Sem histórico.</div>`;
  return `
    <div class="timeline">
      ${items
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${esc(item.acao)}</strong>
              <div class="subtle">${dateTime(item.created_at)} · ${esc(userName(item.usuario_id) || "Sistema")}</div>
              ${item.status_anterior || item.status_novo ? `<div class="subtle">${esc(item.status_anterior || "-")} → ${esc(item.status_novo || "-")}</div>` : ""}
              ${item.observacao ? `<div>${esc(item.observacao)}</div>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderPagamentos() {
  const payments = db.pagamentos
    .slice()
    .sort((a, b) => new Date(b.data_pagamento) - new Date(a.data_pagamento));
  const pending = db.comandas.filter((order) => order.valor_pendente > 0 && order.status !== "Cancelado");
  return `
    <section class="grid two">
      <div class="card">
        <h2>Pagamentos registrados</h2>
        ${table(
          ["Data", "Comanda", "Cliente", "Forma", "Valor"],
          payments.map((payment) => {
            const order = findById("comandas", payment.comanda_id);
            return [
              dateTime(payment.data_pagamento),
              order ? `#${String(order.numero).padStart(5, "0")}` : "-",
              order ? esc(clientName(order.cliente_id)) : "-",
              esc(payment.forma_pagamento),
              money(payment.valor),
            ];
          }),
        )}
      </div>
      <div class="card">
        <h2>Valores pendentes</h2>
        ${table(
          ["Comanda", "Cliente", "Pendente", "Status"],
          pending.map((order) => [
            `#${String(order.numero).padStart(5, "0")}`,
            esc(clientName(order.cliente_id)),
            money(order.valor_pendente),
            statusBadge(order.status_pagamento, order.status_pagamento === "Parcial" ? "yellow" : "gray"),
          ]),
        )}
      </div>
    </section>
  `;
}

function renderComissoes() {
  const commissions = commissionsForCurrentUser();
  const pending = commissions.filter((item) => item.status_pagamento_comissao !== "Paga").reduce((sum, item) => sum + item.valor_comissao, 0);
  const paid = commissions.filter((item) => item.status_pagamento_comissao === "Paga").reduce((sum, item) => sum + item.valor_comissao, 0);
  const byMechanic = groupSum(commissions, "mecanico_id", "valor_comissao");

  return `
    <section class="grid auto">
      <article class="metric-card"><small>Comissão pendente</small><strong>${money(pending)}</strong><div class="hint">A pagar</div></article>
      <article class="metric-card"><small>Comissão paga</small><strong>${money(paid)}</strong><div class="hint">Já baixada</div></article>
      <article class="metric-card"><small>Serviços com comissão</small><strong>${commissions.length}</strong><div class="hint">Somente serviços, sem produtos</div></article>
    </section>
    <section class="grid two" style="margin-top:16px">
      <div class="card">
        <h2>Comissão por mecânico</h2>
        ${table(
          ["Mecânico", "Valor"],
          Object.entries(byMechanic).map(([mechanicId, value]) => [esc(mechanicName(mechanicId)), money(value)]),
        )}
      </div>
      <div class="card">
        <h2>Comissões por serviço</h2>
        ${table(
          ["Comanda", "Mecânico", "Serviço", "Valor serviço", "Comissão", "Status", "Ações"],
          commissions.map((commission) => {
            const order = findById("comandas", commission.comanda_id);
            const item = db.comanda_servicos.find((service) => service.id === commission.servico_item_id);
            return [
              order ? `#${String(order.numero).padStart(5, "0")}` : "-",
              esc(mechanicName(commission.mecanico_id)),
              esc(item?.descricao || serviceName(commission.servico_id) || "Serviço"),
              money(commission.valor_servico),
              money(commission.valor_comissao),
              statusBadge(commission.status_pagamento_comissao, commission.status_pagamento_comissao === "Paga" ? "green" : "yellow"),
              isAdmin() && commission.status_pagamento_comissao !== "Paga"
                ? `<button class="btn small primary" type="button" data-action="mark-commission-paid" data-id="${commission.id}">Marcar paga</button>`
                : "-",
            ];
          }),
        )}
      </div>
    </section>
  `;
}

function renderRelatorios() {
  const orders = ordersByPeriod();
  const discountsByUser = groupSum(
    orders.filter((order) => discountAmount(order) > 0),
    "desconto_aplicado_por",
    (order) => discountAmount(order),
  );
  const soldByPayment = groupSum(db.pagamentos.filter((payment) => orderInPeriod(payment.comanda_id)), "forma_pagamento", "valor");
  const serviceRanking = {};
  for (const item of db.comanda_servicos.filter((service) => orderInPeriod(service.comanda_id))) {
    serviceRanking[item.descricao] = (serviceRanking[item.descricao] || 0) + 1;
  }
  const gross = orders.reduce((sum, order) => sum + order.valor_total_bruto, 0);
  const final = orders.reduce((sum, order) => sum + order.valor_total_final, 0);
  const discounts = orders.reduce((sum, order) => sum + discountAmount(order), 0);

  return `
    <section class="card compact">
      <form class="toolbar" data-form="report-filter">
        ${field("De", "from", ui.reportFrom, "date")}
        ${field("Até", "to", ui.reportTo, "date")}
        <button class="btn primary" type="submit">Atualizar período</button>
      </form>
    </section>
    <section class="grid auto" style="margin-top:16px">
      <article class="metric-card"><small>Comandas no período</small><strong>${orders.length}</strong><div class="hint">Todas as situações</div></article>
      <article class="metric-card"><small>Total bruto vendido</small><strong>${money(gross)}</strong><div class="hint">Antes de descontos</div></article>
      <article class="metric-card"><small>Total final vendido</small><strong>${money(final)}</strong><div class="hint">Após descontos</div></article>
      <article class="metric-card"><small>Descontos concedidos</small><strong>${money(discounts)}</strong><div class="hint">No período</div></article>
    </section>
    <section class="grid two" style="margin-top:16px">
      <div class="card">
        <h2>Comandas por período</h2>
        ${table(
          ["Comanda", "Cliente", "Status", "Bruto", "Desconto", "Final"],
          orders.map((order) => [
            `#${String(order.numero).padStart(5, "0")}`,
            esc(clientName(order.cliente_id)),
            statusBadge(order.status),
            money(order.valor_total_bruto),
            money(discountAmount(order)),
            money(order.valor_total_final),
          ]),
        )}
      </div>
      <div class="card">
        <h2>Serviços mais vendidos</h2>
        ${table(
          ["Serviço", "Quantidade"],
          Object.entries(serviceRanking)
            .sort((a, b) => b[1] - a[1])
            .map(([service, count]) => [esc(service), count]),
        )}
      </div>
      <div class="card">
        <h2>Vendas por forma de pagamento</h2>
        ${table(
          ["Forma", "Valor"],
          Object.entries(soldByPayment).map(([method, value]) => [esc(method), money(value)]),
        )}
      </div>
      <div class="card">
        <h2>Comissão por mecânico</h2>
        ${table(
          ["Mecânico", "Comissão"],
          Object.entries(groupSum(db.comissoes.filter((commission) => orderInPeriod(commission.comanda_id)), "mecanico_id", "valor_comissao")).map(([mechanicId, value]) => [
            esc(mechanicName(mechanicId)),
            money(value),
          ]),
        )}
      </div>
      <div class="card">
        <h2>Clientes atendidos</h2>
        ${table(
          ["Cliente", "Comandas"],
          Object.entries(countBy(orders, "cliente_id")).map(([clientId, count]) => [esc(clientName(clientId)), count]),
        )}
      </div>
      <div class="card">
        <h2>Bicicletas entregues</h2>
        ${table(
          ["Comanda", "Bike", "Saída"],
          orders
            .filter((order) => order.status === "Entregue")
            .map((order) => [`#${String(order.numero).padStart(5, "0")}`, esc(bikeLabel(findById("bicicletas", order.bicicleta_id))), dateTime(order.data_saida)]),
        )}
      </div>
      <div class="card">
        <h2>Comandas em aberto</h2>
        ${table(
          ["Comanda", "Cliente", "Status", "Pendente"],
          orders
            .filter((order) => !["Entregue", "Cancelado"].includes(order.status))
            .map((order) => [`#${String(order.numero).padStart(5, "0")}`, esc(clientName(order.cliente_id)), statusBadge(order.status), money(order.valor_pendente)]),
        )}
      </div>
      <div class="card">
        <h2>Descontos por usuário</h2>
        ${table(
          ["Usuário", "Valor"],
          Object.entries(discountsByUser).map(([userId, value]) => [esc(userName(userId) || "Sem usuário"), money(value)]),
        )}
      </div>
    </section>
  `;
}

function renderConfiguracoes() {
  const cfg = settings();
  return `
    <section class="grid two">
      <div class="card">
        <h2>Configurações da loja</h2>
        <form data-form="settings">
          <div class="form-grid">
            ${field("Nome da loja", "nome_loja", cfg.nome_loja, "text", true)}
            ${field("WhatsApp da loja", "whatsapp_loja", cfg.whatsapp_loja)}
            ${field("Endereço da loja", "endereco_loja", cfg.endereco_loja)}
            ${field("Limite máximo de desconto para atendente (%)", "limite_desconto_atendente", cfg.limite_desconto_atendente, "number")}
            ${selectField(
              "Comissão sobre valor com desconto",
              "comissao_sobre_valor_com_desconto",
              [["false", "Não, usar valor original do serviço"], ["true", "Sim, usar valor proporcional com desconto"]],
              String(cfg.comissao_sobre_valor_com_desconto),
            )}
          </div>
          <div class="form-actions">
            <button class="btn primary" type="submit">Salvar configurações</button>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Dados locais</h2>
        <p class="muted">Os dados desta versão ficam no navegador. Você pode exportar um backup JSON ou restaurar os dados de demonstração.</p>
        <div class="form-actions">
          <button class="btn ghost" type="button" data-action="export-json">Exportar JSON</button>
          <button class="btn danger" type="button" data-action="reset-demo">Restaurar demonstração</button>
        </div>
      </div>
    </section>
  `;
}

function field(label, name, value = "", type = "text", required = false) {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <input name="${esc(name)}" type="${esc(type)}" value="${esc(value ?? "")}" ${required ? "required" : ""} ${type === "number" ? 'step="0.01" min="0"' : ""} />
    </div>
  `;
}

function textarea(label, name, value = "") {
  return `
    <div class="field full">
      <label>${esc(label)}</label>
      <textarea name="${esc(name)}">${esc(value ?? "")}</textarea>
    </div>
  `;
}

function selectField(label, name, options, selected = "", required = false) {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <select name="${esc(name)}" ${required ? "required" : ""}>
        ${options.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(text)}</option>`).join("")}
      </select>
    </div>
  `;
}

function info(label, value) {
  return `
    <div>
      <div class="subtle">${esc(label)}</div>
      <strong>${esc(value || "-")}</strong>
    </div>
  `;
}

function totalRow(label, value, kind = "") {
  return `<div class="totals-row ${kind}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function table(headers, rows) {
  if (!rows.length) return `<div class="empty">Nenhum registro.</div>`;
  return `
    <div class="table-wrap mobile-cards">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell, index) => `<td data-label="${esc(headers[index])}">${cell}</td>`).join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function statusBadge(status, forcedColor = "") {
  const color =
    forcedColor ||
    (["Aprovado pelo cliente", "Serviço concluído", "Cliente avisado", "Pago", "Entregue", "Ativo"].includes(status)
      ? "green"
      : ["Orçamento enviado", "Em manutenção"].includes(status)
        ? "blue"
        : ["Aguardando orçamento", "Aguardando aprovação", "Parcial", "Pendente"].includes(status)
          ? "yellow"
          : ["Cancelado", "Inativo"].includes(status)
            ? "red"
            : "");
  return `<span class="status ${color}">${esc(status || "-")}</span>`;
}

function statusSelect(order) {
  return `
    <div class="field" style="min-width:220px">
      <label>Status</label>
      <select data-action="set-status" data-id="${order.id}">
        ${STATUS_LIST.map((status) => `<option value="${esc(status)}" ${status === order.status ? "selected" : ""}>${esc(status)}</option>`).join("")}
      </select>
    </div>
  `;
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, view, user, entity } = button.dataset;

  if (action === "quick-login") {
    db.session = { userId: user };
    ui.view = "dashboard";
    saveAndRender();
    return;
  }

  if (action === "logout") {
    db.session = null;
    ui.view = "login";
    saveAndRender();
    return;
  }

  if (action === "nav") {
    ui.view = view;
    render();
    return;
  }

  if (action === "edit-entity") {
    ui.editing[entity] = id;
    render();
    return;
  }

  if (action === "cancel-edit") {
    delete ui.editing[entity];
    render();
    return;
  }

  if (action === "toggle-active") {
    const item = findById(entity, id);
    if (item) item.ativo = !item.ativo;
    saveAndRender();
    return;
  }

  if (action === "open-order") {
    ui.selectedOrderId = id;
    ui.view = "detalhe";
    render();
    return;
  }

  const order = id ? findById("comandas", id) : null;
  if (order) {
    handleOrderAction(action, order);
    return;
  }

  if (action === "edit-service-value") editServiceValue(id);
  if (action === "remove-service-item") removeServiceItem(id);
  if (action === "edit-product-value") editProductValue(id);
  if (action === "remove-product-item") removeProductItem(id);
  if (action === "mark-commission-paid") markCommissionPaid(id);
  if (action === "reset-demo") resetDemo();
  if (action === "export-json") exportJson();
}

function handleOrderAction(action, order) {
  if (action === "whatsapp-budget") sendBudget(order);
  if (action === "client-approved") {
    setOrderStatus(order, "Aprovado pelo cliente", "Cliente aprovou o orçamento.");
    saveAndRender();
  }
  if (action === "client-rejected") {
    setOrderStatus(order, "Cancelado", "Cliente recusou o orçamento.");
    saveAndRender();
  }
  if (action === "client-waiting") {
    setOrderStatus(order, "Aguardando aprovação", "Aguardando resposta do cliente.");
    saveAndRender();
  }
  if (action === "whatsapp-approved") sendApproved(order);
  if (action === "start-service") startService(order);
  if (action === "finish-service") finishService(order);
  if (action === "whatsapp-ready") sendReady(order);
  if (action === "print-receipt") printReceipt(order);
  if (action === "whatsapp-receipt") sendReceipt(order);
  if (action === "deliver-order") deliverOrder(order);
  if (action === "cancel-order" && confirm("Cancelar esta comanda?")) {
    setOrderStatus(order, "Cancelado", "Comanda cancelada manualmente.");
    saveAndRender();
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  switch (form.dataset.form) {
    case "login":
      submitLogin(data);
      break;
    case "cliente":
      upsertCliente(data);
      break;
    case "bicicleta":
      upsertBicicleta(data);
      break;
    case "mecanico":
      upsertMecanico(data);
      break;
    case "servico":
      upsertServico(data);
      break;
    case "produto":
      upsertProduto(data);
      break;
    case "nova-comanda":
      await createComanda(form, data);
      break;
    case "order-filter":
      ui.orderStatus = data.status || "";
      ui.orderSearch = data.busca || "";
      render();
      break;
    case "add-servico-comanda":
      addOrderService(form.dataset.id, data);
      break;
    case "add-produto-comanda":
      addOrderProduct(form.dataset.id, data);
      break;
    case "apply-discount":
      applyDiscount(form.dataset.id, data);
      break;
    case "add-payment":
      addPayment(form.dataset.id, data);
      break;
    case "technical-note":
      addTechnicalNote(form.dataset.id, data);
      break;
    case "report-filter":
      ui.reportFrom = data.from || "";
      ui.reportTo = data.to || "";
      render();
      break;
    case "settings":
      updateSettings(data);
      break;
  }
}

function handleChange(event) {
  const select = event.target.closest('[data-action="set-status"]');
  if (!select) return;
  const order = findById("comandas", select.dataset.id);
  if (!order) return;
  if (select.value === "Entregue") {
    deliverOrder(order);
    return;
  }
  if (select.value === "Pago" && order.status_pagamento !== "Pago") {
    alert("Registre o pagamento antes de alterar a comanda para Pago.");
    render();
    return;
  }
  setOrderStatus(order, select.value, "Status alterado manualmente.");
  saveAndRender();
}

function submitLogin(data) {
  const user = db.usuarios.find(
    (item) => item.email.toLowerCase() === data.email.toLowerCase() && item.senha_hash === data.senha && item.ativo,
  );
  if (!user) {
    alert("E-mail ou senha inválidos.");
    return;
  }
  db.session = { userId: user.id };
  ui.view = "dashboard";
  saveAndRender();
}

function upsertCliente(data) {
  const item = {
    id: data.id || uid("cli"),
    nome: data.nome.trim(),
    whatsapp: data.whatsapp.trim(),
    cpf: data.cpf.trim(),
    endereco: data.endereco.trim(),
    observacoes: data.observacoes.trim(),
    created_at: data.id ? findById("clientes", data.id)?.created_at || now() : now(),
  };
  upsert("clientes", item);
  delete ui.editing.cliente;
  saveAndRender();
}

function upsertBicicleta(data) {
  const item = {
    id: data.id || uid("bike"),
    cliente_id: data.cliente_id,
    tipo: data.tipo || "Bicicleta",
    marca: data.marca.trim(),
    modelo: data.modelo.trim(),
    cor: data.cor.trim(),
    aro: data.aro.trim(),
    numero_serie: data.numero_serie.trim(),
    observacoes: data.observacoes.trim(),
    created_at: data.id ? findById("bicicletas", data.id)?.created_at || now() : now(),
  };
  upsert("bicicletas", item);
  delete ui.editing.bicicleta;
  saveAndRender();
}

function upsertMecanico(data) {
  const item = {
    id: data.id || uid("mec"),
    nome: data.nome.trim(),
    whatsapp: data.whatsapp.trim(),
    tipo_comissao: data.tipo_comissao,
    percentual_padrao: number(data.percentual_padrao),
    valor_fixo_padrao: number(data.valor_fixo_padrao),
    ativo: data.ativo === "true",
    created_at: data.id ? findById("mecanicos", data.id)?.created_at || now() : now(),
  };
  upsert("mecanicos", item);
  delete ui.editing.mecanico;
  saveAndRender();
}

function upsertServico(data) {
  const item = {
    id: data.id || uid("srv"),
    nome: data.nome.trim(),
    descricao: data.descricao.trim(),
    valor_padrao: number(data.valor_padrao),
    tempo_estimado: data.tempo_estimado.trim(),
    tipo_comissao: data.tipo_comissao,
    percentual_comissao: number(data.percentual_comissao),
    valor_comissao_fixa: number(data.valor_comissao_fixa),
    ativo: data.ativo === "true",
    created_at: data.id ? findById("servicos", data.id)?.created_at || now() : now(),
  };
  upsert("servicos", item);
  delete ui.editing.servico;
  saveAndRender();
}

function upsertProduto(data) {
  const item = {
    id: data.id || uid("prod"),
    nome: data.nome.trim(),
    descricao: data.descricao.trim(),
    valor_venda: number(data.valor_venda),
    estoque: data.estoque === "" ? "" : number(data.estoque),
    ativo: data.ativo === "true",
    created_at: data.id ? findById("produtos", data.id)?.created_at || now() : now(),
  };
  upsert("produtos", item);
  delete ui.editing.produto;
  saveAndRender();
}

async function createComanda(form, data) {
  const bike = findById("bicicletas", data.bicicleta_id);
  if (!bike || bike.cliente_id !== data.cliente_id) {
    alert("Selecione uma bicicleta vinculada ao cliente escolhido.");
    return;
  }
  const files = [...form.querySelector('input[name="fotos"]').files].slice(0, 4);
  const fotos = await Promise.all(files.map(fileToDataUrl));
  const order = {
    id: uid("cmd"),
    numero: nextOrderNumber(),
    cliente_id: data.cliente_id,
    bicicleta_id: data.bicicleta_id,
    mecanico_id: data.mecanico_id,
    status: "Entrada realizada",
    data_entrada: now(),
    data_previsao: data.data_previsao ? new Date(data.data_previsao).toISOString() : "",
    data_saida: "",
    observacoes: data.observacoes.trim(),
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
  addHistory(order.id, "Comanda aberta", "", "Entrada realizada", "Entrada da bicicleta registrada.");
  ui.selectedOrderId = order.id;
  ui.view = "detalhe";
  saveAndRender();
}

function addOrderService(orderId, data) {
  const order = findById("comandas", orderId);
  const service = findById("servicos", data.servico_id);
  const descricao = (data.descricao || service?.nome || "Serviço avulso").trim();
  const tipo = data.tipo_comissao || service?.tipo_comissao || "Sem comissão";
  const item = {
    id: uid("cs"),
    comanda_id: orderId,
    servico_id: service?.id || "",
    mecanico_id: data.mecanico_id || order.mecanico_id,
    descricao,
    valor: data.valor === "" ? number(service?.valor_padrao) : number(data.valor),
    tipo_comissao: tipo,
    percentual_comissao: data.percentual_comissao === "" ? number(service?.percentual_comissao) : number(data.percentual_comissao),
    valor_comissao: data.valor_comissao_fixa === "" ? number(service?.valor_comissao_fixa) : number(data.valor_comissao_fixa),
    status: "Pendente",
    observacoes: "",
    created_at: now(),
  };
  db.comanda_servicos.push(item);
  addHistory(orderId, "Serviço adicionado", order.status, order.status, `${descricao} por ${money(item.valor)}.`);
  saveAndRender();
}

function addOrderProduct(orderId, data) {
  const product = findById("produtos", data.produto_id);
  const quantity = Math.max(1, number(data.quantidade));
  const unit = data.valor_unitario === "" ? number(product?.valor_venda) : number(data.valor_unitario);
  const descricao = (data.descricao || product?.nome || "Produto avulso").trim();
  const item = {
    id: uid("cp"),
    comanda_id: orderId,
    produto_id: product?.id || "",
    descricao,
    quantidade: quantity,
    valor_unitario: unit,
    valor_total: quantity * unit,
    created_at: now(),
  };
  db.comanda_produtos.push(item);
  const order = findById("comandas", orderId);
  addHistory(orderId, "Produto adicionado", order.status, order.status, `${descricao} por ${money(item.valor_total)}.`);
  saveAndRender();
}

function applyDiscount(orderId, data) {
  const order = findById("comandas", orderId);
  const previous = discountAmount(order);
  const type = data.tipo_desconto;
  const value = number(data.valor_desconto);
  const gross = order.valor_total_bruto;
  const discount = type === "Percentual" ? gross * (value / 100) : value;
  if (discount > gross) {
    alert("O desconto não pode ser maior que o valor total da comanda.");
    return;
  }
  if (isAttendant()) {
    const pct = gross > 0 ? (discount / gross) * 100 : 0;
    if (pct > number(settings().limite_desconto_atendente)) {
      alert("Desconto acima do limite do atendente. Peça liberação do Admin.");
      return;
    }
  }
  order.tipo_desconto = type;
  order.valor_desconto = value;
  order.motivo_desconto = data.motivo_desconto.trim();
  order.desconto_aplicado_por = currentUser().id;
  order.desconto_aplicado_em = now();
  addHistory(orderId, "Desconto aplicado", order.status, order.status, `De ${money(previous)} para ${money(discount)}. Motivo: ${order.motivo_desconto || "-"}`);
  saveAndRender();
}

function addPayment(orderId, data) {
  const order = findById("comandas", orderId);
  const value = number(data.valor);
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
    observacoes: data.observacoes.trim(),
    created_at: now(),
  });
  order.forma_pagamento = data.forma_pagamento;
  addHistory(orderId, "Pagamento registrado", order.status, order.status, `${data.forma_pagamento}: ${money(value)}.`);
  recalcOrder(orderId);
  if (order.status_pagamento === "Pago" && !["Entregue", "Cancelado"].includes(order.status)) {
    setOrderStatus(order, "Pago", "Pagamento quitado.");
  }
  saveAndRender();
}

function addTechnicalNote(orderId, data) {
  const order = findById("comandas", orderId);
  const note = data.observacao.trim();
  if (!note) return;
  order.observacoes = [order.observacoes, `Técnico: ${note}`].filter(Boolean).join("\n");
  addHistory(orderId, "Observação técnica", order.status, order.status, note);
  saveAndRender();
}

function updateSettings(data) {
  const cfg = settings();
  cfg.nome_loja = data.nome_loja.trim();
  cfg.whatsapp_loja = data.whatsapp_loja.trim();
  cfg.endereco_loja = data.endereco_loja.trim();
  cfg.limite_desconto_atendente = number(data.limite_desconto_atendente);
  cfg.comissao_sobre_valor_com_desconto = data.comissao_sobre_valor_com_desconto === "true";
  addGlobalHistory("Configurações atualizadas", "Limite de desconto e regra de comissão revisados.");
  saveAndRender();
}

function upsert(collection, item) {
  const index = db[collection].findIndex((existing) => existing.id === item.id);
  if (index >= 0) db[collection][index] = item;
  else db[collection].push(item);
}

function setOrderStatus(order, status, observation) {
  const previous = order.status;
  order.status = status;
  if (status === "Entregue") order.data_saida = now();
  addHistory(order.id, "Status alterado", previous, status, observation);
}

function startService(order) {
  setOrderStatus(order, "Em manutenção", "Serviço iniciado pelo responsável.");
  for (const item of orderServices(order.id)) {
    if (!isMechanic() || item.mecanico_id === currentMechanicId() || order.mecanico_id === currentMechanicId()) {
      item.status = "Em manutenção";
    }
  }
  saveAndRender();
}

function finishService(order) {
  setOrderStatus(order, "Serviço concluído", "Serviço concluído pelo responsável.");
  for (const item of orderServices(order.id)) {
    if (!isMechanic() || item.mecanico_id === currentMechanicId() || order.mecanico_id === currentMechanicId()) {
      item.status = "Concluído";
    }
  }
  saveAndRender();
}

function deliverOrder(order) {
  const canDeliver = order.status_pagamento === "Pago" || order.forma_pagamento === "Fiado";
  if (!canDeliver && !isAdmin()) {
    alert("Entrega bloqueada. Registre pagamento ou marque como Fiado.");
    return;
  }
  if (!canDeliver && isAdmin() && !confirm("Pagamento não está quitado. Liberar entrega manualmente como Admin?")) {
    return;
  }
  setOrderStatus(order, "Entregue", canDeliver ? "Bicicleta entregue ao cliente." : "Entrega liberada manualmente pelo Admin.");
  saveAndRender();
}

function sendBudget(order) {
  const client = findById("clientes", order.cliente_id);
  const bike = findById("bicicletas", order.bicicleta_id);
  const services = orderServices(order.id);
  const products = orderProducts(order.id);
  const message = `Olá, ${client?.nome || "cliente"}! Tudo bem?

Segue o orçamento da sua bicicleta:

Bike: ${bike?.marca || ""} ${bike?.modelo || ""} - Aro ${bike?.aro || ""}

Serviços:
${services.length ? services.map((item) => `- ${item.descricao}: ${money(item.valor)}`).join("\n") : "- Nenhum serviço informado"}

Peças:
${products.length ? products.map((item) => `- ${item.descricao}: ${money(item.valor_total)}`).join("\n") : "- Nenhuma peça informada"}

Total bruto: ${money(order.valor_total_bruto)}
Desconto: ${money(discountAmount(order))}
Total final: ${money(order.valor_total_final)}

Podemos iniciar o serviço?`;
  openWhatsApp(client?.whatsapp, message);
  setOrderStatus(order, "Aguardando aprovação", "Orçamento enviado pelo WhatsApp.");
  saveAndRender();
}

function sendApproved(order) {
  const client = findById("clientes", order.cliente_id);
  const bike = findById("bicicletas", order.bicicleta_id);
  const message = `Olá, ${client?.nome || "cliente"}! Obrigado pela aprovação.

Sua bicicleta já entrou na fila de manutenção.

Bike: ${bike?.marca || ""} ${bike?.modelo || ""}

Avisaremos assim que estiver pronta.`;
  openWhatsApp(client?.whatsapp, message);
  addHistory(order.id, "WhatsApp enviado", order.status, order.status, "Confirmação de aprovação enviada ao cliente.");
  saveAndRender();
}

function sendReady(order) {
  const client = findById("clientes", order.cliente_id);
  const bike = findById("bicicletas", order.bicicleta_id);
  const message = `Olá, ${client?.nome || "cliente"}! Sua bicicleta está pronta.

Bike: ${bike?.marca || ""} ${bike?.modelo || ""}
Valor total: ${money(order.valor_total_final)}

Já pode retirar na loja.`;
  openWhatsApp(client?.whatsapp, message);
  setOrderStatus(order, "Cliente avisado", "Cliente avisado pelo WhatsApp.");
  saveAndRender();
}

function sendReceipt(order) {
  const client = findById("clientes", order.cliente_id);
  const message = `Olá, ${client?.nome || "cliente"}!

Sua bicicleta foi entregue.

Comanda: #${String(order.numero).padStart(5, "0")}
Valor pago: ${money(order.valor_recebido)}
Forma de pagamento: ${order.forma_pagamento || "-"}

Obrigado pela preferência!`;
  openWhatsApp(client?.whatsapp, message);
  addHistory(order.id, "Recibo enviado", order.status, order.status, "Mensagem de retirada enviada pelo WhatsApp.");
  saveAndRender();
}

function openWhatsApp(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    alert("Cliente sem WhatsApp válido.");
    return;
  }
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function printReceipt(order) {
  const client = findById("clientes", order.cliente_id);
  const bike = findById("bicicletas", order.bicicleta_id);
  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Recibo #${String(order.numero).padStart(5, "0")}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17211d; margin: 28px; }
          h1, h2 { margin: 0 0 10px; }
          table { width: 100%; border-collapse: collapse; margin: 14px 0; }
          th, td { border-bottom: 1px solid #dbe5e1; padding: 8px; text-align: left; }
          .totals { max-width: 360px; margin-left: auto; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #dbe5e1; }
          .final { font-weight: 800; font-size: 18px; border-bottom: 0; }
        </style>
      </head>
      <body>
        <h1>${esc(settings().nome_loja)} · Recibo</h1>
        <p>Comanda #${String(order.numero).padStart(5, "0")} · ${dateTime(now())}</p>
        <p><strong>Cliente:</strong> ${esc(client?.nome || "-")} · <strong>WhatsApp:</strong> ${esc(client?.whatsapp || "-")}</p>
        <p><strong>Bike:</strong> ${esc(bikeLabel(bike))}</p>
        <h2>Serviços</h2>
        <table>
          <thead><tr><th>Serviço</th><th>Valor</th></tr></thead>
          <tbody>${orderServices(order.id).map((item) => `<tr><td>${esc(item.descricao)}</td><td>${money(item.valor)}</td></tr>`).join("")}</tbody>
        </table>
        <h2>Produtos/peças</h2>
        <table>
          <thead><tr><th>Produto</th><th>Qtd.</th><th>Total</th></tr></thead>
          <tbody>${orderProducts(order.id).map((item) => `<tr><td>${esc(item.descricao)}</td><td>${esc(item.quantidade)}</td><td>${money(item.valor_total)}</td></tr>`).join("")}</tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Total bruto</span><strong>${money(order.valor_total_bruto)}</strong></div>
          <div class="row"><span>Desconto</span><strong>-${money(discountAmount(order))}</strong></div>
          <div class="row final"><span>Total final</span><strong>${money(order.valor_total_final)}</strong></div>
          <div class="row"><span>Valor recebido</span><strong>${money(order.valor_recebido)}</strong></div>
          <div class="row"><span>Valor pendente</span><strong>${money(order.valor_pendente)}</strong></div>
          <div class="row"><span>Pagamento</span><strong>${esc(order.status_pagamento)}</strong></div>
        </div>
        <p><strong>Observações:</strong> ${esc(order.observacoes || "-")}</p>
        <script>window.print();<\/script>
      </body>
    </html>
  `;
  const popup = window.open("", "_blank");
  if (!popup) {
    alert("Não foi possível abrir a janela de impressão.");
    return;
  }
  popup.document.write(html);
  popup.document.close();
  addHistory(order.id, "Recibo gerado", order.status, order.status, "Recibo/PDF aberto para impressão.");
  saveAndRender();
}

function editServiceValue(id) {
  const item = findById("comanda_servicos", id);
  if (!item) return;
  const value = prompt("Novo valor do serviço:", String(item.valor));
  if (value === null) return;
  const previous = item.valor;
  item.valor = number(value);
  const order = findById("comandas", item.comanda_id);
  addHistory(item.comanda_id, "Valor de serviço alterado", order.status, order.status, `${item.descricao}: ${money(previous)} para ${money(item.valor)}.`);
  saveAndRender();
}

function removeServiceItem(id) {
  const item = findById("comanda_servicos", id);
  if (!item || !confirm("Remover este serviço da comanda?")) return;
  const order = findById("comandas", item.comanda_id);
  db.comanda_servicos = db.comanda_servicos.filter((service) => service.id !== id);
  db.comissoes = db.comissoes.filter((commission) => commission.servico_item_id !== id);
  addHistory(item.comanda_id, "Serviço removido", order.status, order.status, item.descricao);
  saveAndRender();
}

function editProductValue(id) {
  const item = findById("comanda_produtos", id);
  if (!item) return;
  const quantity = prompt("Quantidade:", String(item.quantidade));
  if (quantity === null) return;
  const unit = prompt("Valor unitário:", String(item.valor_unitario));
  if (unit === null) return;
  const previous = item.valor_total;
  item.quantidade = Math.max(1, number(quantity));
  item.valor_unitario = number(unit);
  item.valor_total = item.quantidade * item.valor_unitario;
  const order = findById("comandas", item.comanda_id);
  addHistory(item.comanda_id, "Produto alterado", order.status, order.status, `${item.descricao}: ${money(previous)} para ${money(item.valor_total)}.`);
  saveAndRender();
}

function removeProductItem(id) {
  const item = findById("comanda_produtos", id);
  if (!item || !confirm("Remover este produto da comanda?")) return;
  const order = findById("comandas", item.comanda_id);
  db.comanda_produtos = db.comanda_produtos.filter((product) => product.id !== id);
  addHistory(item.comanda_id, "Produto removido", order.status, order.status, item.descricao);
  saveAndRender();
}

function markCommissionPaid(id) {
  const commission = findById("comissoes", id);
  if (!commission) return;
  commission.status_pagamento_comissao = "Paga";
  addHistory(commission.comanda_id, "Comissão paga", "", "", `${mechanicName(commission.mecanico_id)}: ${money(commission.valor_comissao)}.`);
  saveAndRender();
}

function resetDemo() {
  if (!confirm("Restaurar dados de demonstração e apagar dados locais?")) return;
  db = seedDb();
  ui = {
    view: "login",
    selectedOrderId: db.comandas[0]?.id || null,
    editing: {},
    orderStatus: "",
    orderSearch: "",
    reportFrom: "",
    reportTo: "",
  };
  saveAndRender();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bikecomanda-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function recalcAll() {
  for (const order of db.comandas) recalcOrder(order.id);
}

function recalcOrder(orderId) {
  const order = findById("comandas", orderId);
  if (!order) return;
  const services = orderServices(orderId);
  const products = orderProducts(orderId);
  for (const product of products) {
    product.valor_total = number(product.quantidade) * number(product.valor_unitario);
  }
  order.valor_total_servicos = services.reduce((sum, item) => sum + number(item.valor), 0);
  order.valor_total_produtos = products.reduce((sum, item) => sum + number(item.valor_total), 0);
  order.valor_total_bruto = order.valor_total_servicos + order.valor_total_produtos;
  const discount = Math.min(discountAmount(order), order.valor_total_bruto);
  order.valor_total_final = Math.max(0, order.valor_total_bruto - discount);
  order.valor_recebido = db.pagamentos.filter((payment) => payment.comanda_id === orderId).reduce((sum, payment) => sum + number(payment.valor), 0);
  order.valor_pendente = Math.max(0, order.valor_total_final - order.valor_recebido);
  if (order.valor_recebido >= order.valor_total_final && order.valor_total_final > 0) order.status_pagamento = "Pago";
  else if (order.valor_recebido > 0) order.status_pagamento = "Parcial";
  else order.status_pagamento = "Aberto";
  syncCommissions(order);
}

function syncCommissions(order) {
  const existingIds = new Set();
  for (const item of orderServices(order.id)) {
    const mechanicId = item.mecanico_id || order.mecanico_id;
    const value = calcCommission(order, item);
    item.valor_comissao = value;
    if (!mechanicId || value <= 0) continue;
    existingIds.add(item.id);
    const current = db.comissoes.find((commission) => commission.servico_item_id === item.id);
    const payload = {
      id: current?.id || uid("com"),
      comanda_id: order.id,
      mecanico_id: mechanicId,
      servico_id: item.servico_id,
      servico_item_id: item.id,
      valor_servico: commissionBase(order, item),
      percentual: item.tipo_comissao === "Percentual" ? number(item.percentual_comissao) : 0,
      valor_comissao: value,
      status_pagamento_comissao: current?.status_pagamento_comissao || "Pendente",
      created_at: current?.created_at || now(),
    };
    if (current) Object.assign(current, payload);
    else db.comissoes.push(payload);
  }
  db.comissoes = db.comissoes.filter((commission) => commission.comanda_id !== order.id || existingIds.has(commission.servico_item_id));
}

function calcCommission(order, item) {
  const base = commissionBase(order, item);
  if (item.tipo_comissao === "Percentual") return base * (number(item.percentual_comissao) / 100);
  if (item.tipo_comissao === "Valor fixo") return number(item.valor_comissao);
  return 0;
}

function commissionBase(order, item) {
  if (!settings().comissao_sobre_valor_com_desconto) return number(item.valor);
  if (!order.valor_total_bruto) return number(item.valor);
  const proportionalDiscount = discountAmount(order) * (number(item.valor) / order.valor_total_bruto);
  return Math.max(0, number(item.valor) - proportionalDiscount);
}

function discountAmount(order) {
  const value = number(order.valor_desconto);
  if (!value) return 0;
  if (order.tipo_desconto === "Percentual") return Math.min(order.valor_total_bruto, order.valor_total_bruto * (value / 100));
  return Math.min(order.valor_total_bruto, value);
}

function discountDescription(order) {
  if (order.tipo_desconto === "Percentual") return `(${number(order.valor_desconto)}%)`;
  return "";
}

function addHistory(orderId, action, previousStatus, newStatus, observation) {
  db.historico_comandas.push({
    id: uid("hist"),
    comanda_id: orderId,
    usuario_id: currentUser()?.id || "",
    acao: action,
    status_anterior: previousStatus || "",
    status_novo: newStatus || "",
    observacao: observation || "",
    created_at: now(),
  });
}

function addGlobalHistory(action, observation) {
  const order = db.comandas[0];
  if (!order) return;
  addHistory(order.id, action, order.status, order.status, observation);
}

function visibleOrders() {
  const orders = db.comandas.slice().sort((a, b) => b.numero - a.numero);
  if (!isMechanic()) return orders;
  const mechanicId = currentMechanicId();
  return orders.filter((order) => order.mecanico_id === mechanicId || orderServices(order.id).some((service) => service.mecanico_id === mechanicId));
}

function filteredOrders() {
  const search = ui.orderSearch.trim().toLowerCase();
  return visibleOrders().filter((order) => {
    const client = clientName(order.cliente_id).toLowerCase();
    const bike = bikeLabel(findById("bicicletas", order.bicicleta_id)).toLowerCase();
    const numberText = String(order.numero).padStart(5, "0");
    const matchesStatus = !ui.orderStatus || order.status === ui.orderStatus;
    const matchesSearch = !search || client.includes(search) || bike.includes(search) || numberText.includes(search);
    return matchesStatus && matchesSearch;
  });
}

function canSeeOrder(order) {
  return visibleOrders().some((visible) => visible.id === order.id);
}

function canCreateOrders() {
  return isAdmin() || isAttendant();
}

function canManageOrder() {
  return isAdmin() || isAttendant();
}

function canDiscount() {
  return isAdmin() || isAttendant();
}

function canExecuteOrder(order) {
  if (isAdmin()) return true;
  if (!isMechanic()) return false;
  const mechanicId = currentMechanicId();
  return order.mecanico_id === mechanicId || orderServices(order.id).some((service) => service.mecanico_id === mechanicId);
}

function ordersByPeriod() {
  return db.comandas.filter((order) => {
    const date = toInputDate(order.created_at || order.data_entrada);
    if (ui.reportFrom && date < ui.reportFrom) return false;
    if (ui.reportTo && date > ui.reportTo) return false;
    return true;
  });
}

function orderInPeriod(orderId) {
  return ordersByPeriod().some((order) => order.id === orderId);
}

function commissionsForCurrentUser() {
  if (!isMechanic()) return db.comissoes.slice();
  return db.comissoes.filter((commission) => commission.mecanico_id === currentMechanicId());
}

function groupSum(items, key, valueKey) {
  return items.reduce((acc, item) => {
    const group = typeof key === "function" ? key(item) : item[key] || "Sem informação";
    const value = typeof valueKey === "function" ? valueKey(item) : number(item[valueKey]);
    acc[group] = (acc[group] || 0) + value;
    return acc;
  }, {});
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const group = item[key] || "Sem informação";
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});
}

function orderServices(orderId) {
  return db.comanda_servicos.filter((item) => item.comanda_id === orderId);
}

function orderProducts(orderId) {
  return db.comanda_produtos.filter((item) => item.comanda_id === orderId);
}

function activeMechanics() {
  return db.mecanicos.filter((item) => item.ativo);
}

function activeServices() {
  return db.servicos.filter((item) => item.ativo);
}

function activeProducts() {
  return db.produtos.filter((item) => item.ativo);
}

function findById(collection, id) {
  return db[collection]?.find((item) => item.id === id) || null;
}

function clientName(id) {
  return findById("clientes", id)?.nome || "-";
}

function mechanicName(id) {
  return findById("mecanicos", id)?.nome || "";
}

function serviceName(id) {
  return findById("servicos", id)?.nome || "";
}

function userName(id) {
  return findById("usuarios", id)?.nome || "";
}

function bikeLabel(bike) {
  if (!bike) return "-";
  return `${bike.marca || ""} ${bike.modelo || ""} · ${bike.cor || "-"} · Aro ${bike.aro || "-"}`.trim();
}

function commissionLabel(type, percent, fixed) {
  if (type === "Percentual") return `${number(percent)}%`;
  if (type === "Valor fixo") return money(fixed);
  return "Sem comissão";
}

function nextOrderNumber() {
  const last = db.comandas.reduce((max, order) => Math.max(max, number(order.numero)), 0);
  return last + 1;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
