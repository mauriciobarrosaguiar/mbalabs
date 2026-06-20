import { requireAppAccess } from "./core-data";
import { includesSearch } from "./form-utils";
import { getSupabaseServer } from "./supabase";

export const PORTAL_ASSOCIATIVO_SLUG = "portal-associativo";
export const PORTAL_ASSOCIATIVO_PATH = "/portal-associativo";

export type PortalPerfil =
  | "administrador"
  | "presidente"
  | "tesoureiro"
  | "secretario"
  | "conselho_fiscal"
  | "associado"
  | "portaria";

export const PORTAL_PERFIL_LABELS: Record<PortalPerfil, string> = {
  administrador: "Administrador",
  presidente: "Presidente",
  tesoureiro: "Tesoureiro",
  secretario: "Secretario",
  conselho_fiscal: "Conselho fiscal",
  associado: "Associado",
  portaria: "Portaria"
};

export const PORTAL_PERFIL_OPTIONS = Object.entries(PORTAL_PERFIL_LABELS).map(([value, label]) => ({ value, label }));

export const PORTAL_UNIDADE_OPTIONS = [
  { value: "chacara", label: "Chácara" },
  { value: "lote", label: "Lote" },
  { value: "casa", label: "Casa" },
  { value: "sala", label: "Sala" },
  { value: "box", label: "Box" },
  { value: "propriedade", label: "Propriedade" },
  { value: "outro", label: "Outro" }
];

export const PORTAL_CHARGE_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  aguardando_pagamento: "Aguardando pagamento",
  vencida: "Vencida",
  negociada: "Negociada",
  paga: "Paga",
  cancelada: "Cancelada"
};

const OPEN_CHARGE_STATUSES = new Set(["aberta", "aguardando_pagamento", "vencida", "negociada"]);

const roleSections: Record<PortalPerfil, Set<string>> = {
  administrador: new Set(["dashboard", "loteamentos", "pessoas", "unidades", "transferencias", "financeiro", "relatorios", "reunioes", "avisos", "projetos", "painel", "configuracoes"]),
  presidente: new Set(["dashboard", "loteamentos", "pessoas", "unidades", "transferencias", "reunioes", "avisos", "projetos", "relatorios", "painel"]),
  tesoureiro: new Set(["dashboard", "financeiro", "relatorios", "painel"]),
  secretario: new Set(["dashboard", "loteamentos", "pessoas", "unidades", "transferencias", "reunioes", "avisos", "painel"]),
  conselho_fiscal: new Set(["dashboard", "financeiro", "relatorios", "painel"]),
  associado: new Set(["painel"]),
  portaria: new Set(["dashboard", "loteamentos", "pessoas", "unidades"])
};

export async function getPortalContext(nextPath = PORTAL_ASSOCIATIVO_PATH) {
  const current = await requireAppAccess(PORTAL_ASSOCIATIVO_SLUG, nextPath);
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const empresaId = current.empresaId;

  const [perfilResult, empresaResult] = await Promise.all([
    empresaId
      ? client
          .from("assoc_perfis_usuarios")
          .select("perfil,status,pessoa_id")
          .eq("empresa_id", empresaId)
          .eq("core_usuario_id", current.usuario.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    empresaId
      ? client.from("core_empresas").select("nome,nome_fantasia").eq("id", empresaId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const permissionProfile = current.permissoes.find((permissao) => permissao.appSlug === PORTAL_ASSOCIATIVO_SLUG)?.perfil;
  const perfil = normalizePortalPerfil(
    perfilResult.data?.perfil ||
      (current.isAdminMaster ? "administrador" : "") ||
      (current.tipo === "admin_empresa" ? "administrador" : "") ||
      permissionProfile ||
      "associado"
  );
  const company = empresaResult.data as Record<string, unknown> | null;

  return {
    current,
    supabase,
    client,
    empresaId,
    perfil,
    perfilLabel: PORTAL_PERFIL_LABELS[perfil],
    pessoaId: String(perfilResult.data?.pessoa_id ?? ""),
    companyName:
      String(company?.nome_fantasia ?? company?.nome ?? "") ||
      (current.isAdminMaster ? "Todas as empresas" : "Empresa conectada"),
    error: perfilResult.error?.message ?? empresaResult.error?.message ?? null
  };
}

export async function getPortalShellContext(nextPath = PORTAL_ASSOCIATIVO_PATH) {
  const context = await getPortalContext(nextPath);
  return {
    current: context.current,
    perfil: context.perfil,
    perfilLabel: context.perfilLabel,
    companyName: context.companyName,
    can: (section: string) => canPortalAccess(context.perfil, section)
  };
}

export async function getPortalDashboard() {
  const context = await getPortalContext(PORTAL_ASSOCIATIVO_PATH);
  const client = context.client;
  const empresaId = context.empresaId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalLoteamentos,
    totalUnidades,
    unidadesAtivas,
    associadosAtivos,
    chargesResult,
    recentCharges,
    latestAudits
  ] = await Promise.all([
    countPortalRows(client, "assoc_loteamentos", empresaId),
    countPortalRows(client, "assoc_unidades", empresaId),
    countPortalRows(client, "assoc_unidades", empresaId, { status_unidade: "ativa" }),
    countPortalRows(client, "assoc_pessoas", empresaId, { status_pessoa: "ativa" }),
    scopedByEmpresa(
      client
        .from("assoc_cobrancas")
        .select("id,loteamento_id,unidade_id,pessoa_responsavel_id,descricao,status,valor_total,data_vencimento,data_pagamento,assoc_loteamentos(nome),assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo)"),
      empresaId
    ).limit(1000),
    scopedByEmpresa(
      client
        .from("assoc_cobrancas")
        .select("id,descricao,status,valor_total,data_vencimento,assoc_loteamentos(nome),assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo)")
        .order("criado_em", { ascending: false })
        .limit(8),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_auditoria_logs")
        .select("id,acao,entidade,criado_em")
        .order("criado_em", { ascending: false })
        .limit(8),
      empresaId
    )
  ]);

  const charges: Array<Record<string, unknown>> = ((chargesResult.data ?? []) as Array<Record<string, unknown>>).map(normalizeChargeRow);
  const openCharges = charges.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status)));
  const overdueCharges = charges.filter(isOverdueCharge);
  const paidThisMonth = charges.filter((row) => {
    if (String(row.status) !== "paga" || !row.data_pagamento) return false;
    const paidAt = new Date(String(row.data_pagamento));
    return Number.isFinite(paidAt.getTime()) && paidAt >= monthStart;
  });

  return {
    ...context,
    metrics: {
      totalLoteamentos,
      totalUnidades,
      unidadesAtivas,
      associadosAtivos,
      recebidoMes: sumMoney(paidThisMonth, "valor_total"),
      totalEmAberto: sumMoney(openCharges, "valor_total"),
      totalVencido: sumMoney(overdueCharges, "valor_total"),
      cobrancasAguardandoPagamento: charges.filter((row) => row.status === "aguardando_pagamento").length
    },
    inadimplenciaPorLoteamento: groupMoney(overdueCharges, (row) => loteamentoLabel(row.assoc_loteamentos)),
    inadimplenciaPorUnidade: groupMoney(overdueCharges, (row) => unitLabel(row.assoc_unidades)),
    inadimplenciaPorResponsavel: groupMoney(overdueCharges, (row) => relationName(row.assoc_pessoas) || "Sem responsável"),
    ultimasCobrancas: ((recentCharges.data ?? []) as Array<Record<string, unknown>>).map(normalizeChargeRow),
    ultimosLogs: (latestAudits.data ?? []) as Array<Record<string, unknown>>,
    error: context.error ?? chargesResult.error?.message ?? recentCharges.error?.message ?? latestAudits.error?.message ?? null
  };
}

export async function listPortalLoteamentos(search = "", status = "") {
  const context = await getPortalContext("/portal-associativo/loteamentos");
  let query = scopedByEmpresa(
    context.client
      .from("assoc_loteamentos")
      .select("id,nome,codigo,endereco,cidade,uf,status,valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao,observacoes,criado_em")
      .order("nome", { ascending: true })
      .limit(300),
    context.empresaId
  );

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "codigo", "cidade", "uf", "endereco"], search)
  );

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalPessoas(search = "", filters: { status?: string; perfil?: string } = {}) {
  const context = await getPortalContext("/portal-associativo/pessoas");
  const client = context.client;
  const empresaId = context.empresaId;
  let query = scopedByEmpresa(
    client
      .from("assoc_pessoas")
      .select("id,core_usuario_id,nome_completo,tipo_pessoa,cpf_cnpj,telefone,whatsapp,email,status_pessoa,cidade,uf,criado_em,assoc_perfis_usuarios(perfil,status)")
      .order("nome_completo", { ascending: true })
      .limit(300),
    empresaId
  );

  if (filters.status) {
    query = query.eq("status_pessoa", filters.status);
  }

  const { data, error } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      perfil: relationObject(row.assoc_perfis_usuarios)?.perfil ?? "",
      perfil_status: relationObject(row.assoc_perfis_usuarios)?.status ?? ""
    }))
    .filter((row) => !filters.perfil || row.perfil === filters.perfil)
    .filter((row) => includesSearch(row, ["nome_completo", "cpf_cnpj", "email", "telefone", "whatsapp"], search));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalUnidades(search = "", status = "", loteamento = "") {
  const context = await getPortalContext("/portal-associativo/unidades");
  const client = context.client;
  let query = scopedByEmpresa(
    client
      .from("assoc_unidades")
      .select("id,loteamento_id,codigo_unidade,numero_unidade,quadra_setor,tipo_unidade,status_unidade,endereco_localizacao,area_m2,possui_construcao,valor_mensalidade,vencimento_dia,isento_mensalidade,criado_em,assoc_loteamentos(nome,codigo),assoc_vinculos_unidade_pessoa(tipo_vinculo,status_vinculo,data_fim,assoc_pessoas(nome_completo))")
      .order("numero_unidade", { ascending: true })
      .limit(300),
    context.empresaId
  );

  if (status) {
    query = query.eq("status_unidade", status);
  }
  if (loteamento) {
    query = query.eq("loteamento_id", loteamento);
  }

  const { data, error } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      loteamento: loteamentoLabel(row.assoc_loteamentos),
      proprietario: vinculoName(row.assoc_vinculos_unidade_pessoa, "proprietario"),
      responsavel_financeiro: vinculoName(row.assoc_vinculos_unidade_pessoa, "responsavel_financeiro"),
      responsavel_contato: vinculoName(row.assoc_vinculos_unidade_pessoa, "responsavel_contato")
    }))
    .filter((row) => includesSearch(row, ["codigo_unidade", "numero_unidade", "quadra_setor", "loteamento", "proprietario", "responsavel_financeiro"], search));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalCobrancas(filters: { status?: string; q?: string; mes?: string; loteamento?: string; unidade?: string; responsavel?: string } = {}) {
  const context = await getPortalContext("/portal-associativo/financeiro");
  const client = context.client;
  let query = scopedByEmpresa(
    client
      .from("assoc_cobrancas")
      .select("id,loteamento_id,unidade_id,pessoa_responsavel_id,tipo_cobranca,descricao,mes_referencia,ano_referencia,data_vencimento,valor_total,status,forma_pagamento,data_pagamento,pix_copia_cola,comprovante_url,assoc_loteamentos(nome),assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp)")
      .order("data_vencimento", { ascending: false })
      .limit(500),
    context.empresaId
  );

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.loteamento) query = query.eq("loteamento_id", filters.loteamento);
  if (filters.unidade) query = query.eq("unidade_id", filters.unidade);
  if (filters.responsavel) query = query.eq("pessoa_responsavel_id", filters.responsavel);
  if (filters.mes && filters.mes.includes("-")) {
    const [ano, mes] = filters.mes.split("-");
    query = query.eq("ano_referencia", Number(ano)).eq("mes_referencia", Number(mes));
  }

  const { data, error } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      status_calculado: isOverdueCharge(row) ? "vencida" : row.status,
      loteamento: loteamentoLabel(row.assoc_loteamentos),
      unidade: unitLabel(row.assoc_unidades),
      responsavel: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas),
      mensagem_whatsapp: buildChargeWhatsappMessage(row)
    }))
    .filter((row) => includesSearch(row, ["descricao", "loteamento", "unidade", "responsavel"], filters.q ?? ""));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalTransferencias() {
  const context = await getPortalContext("/portal-associativo/transferencias");
  const { data, error } = await scopedByEmpresa(
    context.client
      .from("assoc_transferencias")
      .select("id,data_transferencia,motivo,responsabilidade_debitos,documento_url,assoc_unidades(codigo_unidade,numero_unidade),pessoa_anterior:assoc_pessoas!assoc_transferencias_pessoa_anterior_id_fkey(nome_completo),nova_pessoa:assoc_pessoas!assoc_transferencias_nova_pessoa_id_fkey(nome_completo)")
      .order("data_transferencia", { ascending: false })
      .limit(200),
    context.empresaId
  );

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({
    ...row,
    unidade: unitLabel(row.assoc_unidades),
    pessoa_anterior: relationName(row.pessoa_anterior),
    nova_pessoa: relationName(row.nova_pessoa)
  }));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalReunioes() {
  const context = await getPortalContext("/portal-associativo/reunioes");
  const { data, error } = await scopedByEmpresa(
    context.client.from("assoc_reunioes").select("*").order("data_reuniao", { ascending: false }).limit(200),
    context.empresaId
  );
  return { ...context, rows: data ?? [], error: context.error ?? error?.message ?? null };
}

export async function listPortalAvisos(activeOnly = false) {
  const context = await getPortalContext("/portal-associativo/avisos");
  let query = scopedByEmpresa(
    context.client.from("assoc_avisos").select("*").order("criado_em", { ascending: false }).limit(200),
    context.empresaId
  );
  if (activeOnly) {
    query = query.eq("status", "ativo").eq("mostrar_painel", true);
  }
  const { data, error } = await query;
  return { ...context, rows: (data ?? []).filter((row: Record<string, unknown>) => !activeOnly || isVisibleNotice(row)), error: context.error ?? error?.message ?? null };
}

export async function listPortalProjetos() {
  const context = await getPortalContext("/portal-associativo/projetos");
  const { data, error } = await scopedByEmpresa(
    context.client.from("assoc_projetos").select("*").order("criado_em", { ascending: false }).limit(200),
    context.empresaId
  );
  return { ...context, rows: data ?? [], error: context.error ?? error?.message ?? null };
}

export async function listPortalDocumentos(activeOnly = false) {
  const context = await getPortalContext("/portal-associativo/painel-associado");
  let query = scopedByEmpresa(
    context.client.from("assoc_documentos").select("id,titulo,categoria,descricao,storage_path,liberado_associado,criado_em,assoc_unidades(codigo_unidade,numero_unidade)").order("criado_em", { ascending: false }).limit(200),
    context.empresaId
  );
  if (activeOnly) {
    query = query.eq("liberado_associado", true);
  }
  const { data, error } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({ ...row, unidade: unitLabel(row.assoc_unidades) }));
  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function getPortalRelatorios() {
  const cobrancas = await listPortalCobrancas();
  const unidades = await listPortalUnidades();
  const loteamentos = await listPortalLoteamentos();
  const rows = cobrancas.rows;
  return {
    ...cobrancas,
    resumo: {
      totalCobrancas: rows.length,
      totalPago: sumMoney(rows.filter((row) => row.status === "paga"), "valor_total"),
      totalAberto: sumMoney(rows.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status))), "valor_total"),
      totalVencido: sumMoney(rows.filter(isOverdueCharge), "valor_total"),
      totalUnidades: unidades.rows.length,
      totalLoteamentos: loteamentos.rows.length
    },
    inadimplencia: groupMoney(rows.filter(isOverdueCharge), (row) => String(row.responsavel || "Sem responsável")),
    porLoteamento: groupMoney(rows, (row) => String(row.loteamento || "Sem loteamento")),
    porUnidade: groupMoney(rows, (row) => String(row.unidade || "Sem chácara/lote")),
    porResponsavel: groupMoney(rows, (row) => String(row.responsavel || "Sem responsável"))
  };
}

export async function getPortalAssociadoPanel() {
  const context = await getPortalContext("/portal-associativo/painel-associado");
  const client = context.client;
  const pessoaId = context.pessoaId || (await resolvePessoaIdByUsuario(client, context.empresaId, context.current.usuario.id));

  if (!pessoaId) {
    return {
      ...context,
      pessoa: null,
      unidades: [],
      cobrancasAbertas: [],
      cobrancasPagas: [],
      avisos: [],
      reunioes: [],
      documentos: [],
      error: "Seu usuario ainda nao esta vinculado a uma pessoa no Portal Associativo."
    };
  }

  const [pessoa, vinculos, cobrancas, avisos, reunioes, documentos] = await Promise.all([
    client.from("assoc_pessoas").select("*").eq("id", pessoaId).eq("empresa_id", context.empresaId).maybeSingle(),
    scopedByEmpresa(
      client
        .from("assoc_vinculos_unidade_pessoa")
        .select("tipo_vinculo,status_vinculo,assoc_unidades(id,codigo_unidade,numero_unidade,tipo_unidade,status_unidade,endereco_localizacao)")
        .eq("pessoa_id", pessoaId)
        .eq("status_vinculo", "ativo"),
      context.empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_cobrancas")
        .select("id,unidade_id,pessoa_responsavel_id,descricao,status,valor_total,data_vencimento,data_pagamento,pix_copia_cola,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp)")
        .order("data_vencimento", { ascending: false })
        .limit(300),
      context.empresaId
    ),
    listPortalAvisos(true),
    scopedByEmpresa(
      client.from("assoc_reunioes").select("*").order("data_reuniao", { ascending: false }).limit(50),
      context.empresaId
    ),
    listPortalDocumentos(true)
  ]);

  const unidades = ((vinculos.data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({
    ...relationObject(row.assoc_unidades),
    tipo_vinculo: row.tipo_vinculo
  }));
  const unidadeIds = new Set(unidades.map((row) => String(row.id ?? "")));
  const chargeRows = ((cobrancas.data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map<Record<string, unknown>>((row) => ({ ...row, unidade: unitLabel(row.assoc_unidades), mensagem_whatsapp: buildChargeWhatsappMessage(row) }))
    .filter((row) => String(row.pessoa_responsavel_id ?? "") === pessoaId || unidadeIds.has(String(row.unidade_id ?? "")));

  return {
    ...context,
    pessoa: pessoa.data,
    unidades,
    cobrancasAbertas: chargeRows.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status))),
    cobrancasPagas: chargeRows.filter((row) => row.status === "paga"),
    avisos: avisos.rows,
    reunioes: reunioes.data ?? [],
    documentos: documentos.rows,
    error: context.error ?? pessoa.error?.message ?? vinculos.error?.message ?? cobrancas.error?.message ?? reunioes.error?.message ?? null
  };
}

export async function getPortalConfiguracoes() {
  const context = await getPortalContext("/portal-associativo/configuracoes");
  const [config, pagamento] = await Promise.all([
    scopedByEmpresa(context.client.from("assoc_configuracoes").select("*"), context.empresaId).maybeSingle(),
    scopedByEmpresa(context.client.from("assoc_configuracoes_pagamento").select("*"), context.empresaId).maybeSingle()
  ]);

  return {
    ...context,
    configuracoes: config.data ?? defaultConfiguracoes(context.companyName),
    pagamento: pagamento.data ?? defaultPagamento(),
    error: context.error ?? config.error?.message ?? pagamento.error?.message ?? null
  };
}

export async function getPortalLookups(nextPath = PORTAL_ASSOCIATIVO_PATH) {
  const context = await getPortalContext(nextPath);
  const [pessoas, loteamentos, unidades, usuarios, config] = await Promise.all([
    scopedByEmpresa(context.client.from("assoc_pessoas").select("id,nome_completo,whatsapp,email,status_pessoa").order("nome_completo"), context.empresaId),
    scopedByEmpresa(context.client.from("assoc_loteamentos").select("id,nome,codigo,status,valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao").order("nome"), context.empresaId),
    scopedByEmpresa(context.client.from("assoc_unidades").select("id,loteamento_id,codigo_unidade,numero_unidade,tipo_unidade,status_unidade,valor_mensalidade,vencimento_dia,isento_mensalidade").order("numero_unidade"), context.empresaId),
    context.empresaId
      ? context.client.from("core_usuarios").select("id,nome,email,status").eq("empresa_id", context.empresaId).order("nome")
      : context.client.from("core_usuarios").select("id,nome,email,status").order("nome").limit(200),
    scopedByEmpresa(context.client.from("assoc_configuracoes").select("*"), context.empresaId).maybeSingle()
  ]);

  return {
    ...context,
    pessoas: pessoas.data ?? [],
    loteamentos: loteamentos.data ?? [],
    unidades: unidades.data ?? [],
    usuarios: usuarios.data ?? [],
    configuracoes: config.data ?? defaultConfiguracoes(context.companyName),
    error: context.error ?? pessoas.error?.message ?? loteamentos.error?.message ?? unidades.error?.message ?? usuarios.error?.message ?? config.error?.message ?? null
  };
}

export function canPortalAccess(perfil: PortalPerfil, section: string) {
  return roleSections[perfil]?.has(section) ?? false;
}

export function normalizePortalPerfil(value: unknown): PortalPerfil {
  const perfil = String(value ?? "").trim();
  if (perfil in PORTAL_PERFIL_LABELS) return perfil as PortalPerfil;
  if (perfil === "admin_empresa" || perfil === "admin_master" || perfil === "super_admin") return "administrador";
  return "associado";
}

export function unitOptionLabel(row: Record<string, unknown>) {
  return [row.codigo_unidade, row.numero_unidade].filter(Boolean).join(" - ") || String(row.id ?? "");
}

export function loteamentoOptionLabel(row: Record<string, unknown>) {
  return [row.codigo, row.nome].filter(Boolean).join(" - ") || String(row.id ?? "");
}

export function buildChargeWhatsappMessage(row: Record<string, unknown>) {
  const valor = Number(row.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vencimento = row.data_vencimento ? new Date(String(row.data_vencimento)).toLocaleDateString("pt-BR") : "-";
  const pix = row.pix_copia_cola ? `\nPIX copia e cola: ${row.pix_copia_cola}` : "";
  return `Ola! Existe uma mensalidade em aberto: ${row.descricao ?? "Mensalidade"} no valor de ${valor}, vencimento ${vencimento}.${pix}`;
}

function scopedByEmpresa(query: any, empresaId: string | null) {
  return empresaId ? query.eq("empresa_id", empresaId) : query;
}

async function countPortalRows(client: any, table: string, empresaId: string | null, filters: Record<string, unknown> = {}) {
  let query = scopedByEmpresa(client.from(table).select("id", { count: "exact", head: true }), empresaId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count } = await query;
  return count ?? 0;
}

async function resolvePessoaIdByUsuario(client: any, empresaId: string | null, usuarioId: string) {
  if (!empresaId) return "";
  const { data } = await client
    .from("assoc_pessoas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("core_usuario_id", usuarioId)
    .maybeSingle();
  return String(data?.id ?? "");
}

function normalizeChargeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    status: row.status ?? "aberta",
    valor_total: Number(row.valor_total ?? 0)
  };
}

function isOverdueCharge(row: Record<string, unknown>) {
  if (!OPEN_CHARGE_STATUSES.has(String(row.status))) return false;
  if (!row.data_vencimento) return false;
  const due = new Date(String(row.data_vencimento));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(due.getTime()) && due < today;
}

function sumMoney(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

function groupMoney(rows: Array<Record<string, unknown>>, labeler: (row: Record<string, unknown>) => string) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = labeler(row) || "Sem identificacao";
    grouped.set(label, (grouped.get(label) ?? 0) + Number(row.valor_total ?? 0));
  }
  return Array.from(grouped.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function unitLabel(value: unknown) {
  const unit = relationObject(value);
  if (!unit) return "-";
  return [unit.codigo_unidade, unit.numero_unidade].filter(Boolean).join(" - ") || "-";
}

function loteamentoLabel(value: unknown) {
  const loteamento = relationObject(value);
  if (!loteamento) return "-";
  return String(loteamento.nome ?? loteamento.codigo ?? "-");
}

function vinculoName(value: unknown, tipo: string) {
  const rows = Array.isArray(value) ? value : [];
  const row = rows.find((item) => {
    const record = item as Record<string, unknown>;
    return record.tipo_vinculo === tipo && record.status_vinculo === "ativo" && !record.data_fim;
  }) as Record<string, unknown> | undefined;
  return relationName(row?.assoc_pessoas);
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return String(relation?.nome_completo ?? relation?.nome ?? "");
}

function relationPhone(value: unknown) {
  const relation = relationObject(value);
  return String(relation?.whatsapp ?? relation?.telefone ?? "");
}

function isVisibleNotice(row: Record<string, unknown>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = row.visivel_de ? new Date(String(row.visivel_de)) : null;
  const until = row.visivel_ate ? new Date(String(row.visivel_ate)) : null;
  return (!from || from <= today) && (!until || until >= today);
}

function defaultConfiguracoes(companyName: string) {
  return {
    nome_publico_entidade: companyName === "Todas as empresas" ? "Portal Associativo" : companyName,
    subtitulo: "Gestao integrada de loteamentos, chacaras/lotes, mensalidades e comunicados.",
    logo_url: "",
    tema_visual: "padrao",
    tipo_unidade_padrao: "chacara",
    valor_mensalidade_padrao: 0,
    vencimento_padrao: 10,
    descricao_mensalidade_padrao: "Mensalidade",
    pix_chave: "",
    pix_tipo_chave: "",
    recebedor_nome: "",
    recebedor_cidade: "",
    webhook_url: ""
  };
}

function defaultPagamento() {
  return {
    provedor_pix_ativo: "manual",
    ambiente: "homologacao",
    chave_pix: "",
    nome_recebedor: "",
    cidade_recebedor: "",
    webhook_url: "",
    modo_cobranca_padrao: "manual",
    gerar_pix_automatico: false,
    status_configuracao: "nao_testado"
  };
}
