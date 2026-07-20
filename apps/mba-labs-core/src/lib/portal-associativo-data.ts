import { requireAppAccess } from "./core-data";
import { includesSearch } from "./form-utils";
import { portalStorageProviderLabel } from "./portal-associativo-storage";
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
  secretario: "Secretário",
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
  aguardando_aprovacao: "Aguardando aprovação",
  vencida: "Vencida",
  negociada: "Negociada",
  paga: "Paga",
  recusada: "Recusada",
  cancelada: "Cancelada"
};

const OPEN_CHARGE_STATUSES = new Set(["aberta", "aguardando_pagamento", "vencida", "negociada"]);
const OUTSTANDING_CHARGE_STATUSES = new Set([...OPEN_CHARGE_STATUSES, "aguardando_aprovacao"]);

const roleSections: Record<PortalPerfil, Set<string>> = {
  administrador: new Set(["dashboard", "implantacao", "loteamentos", "pessoas", "unidades", "transferencias", "financeiro", "inadimplentes", "documentos", "importacao", "relatorios", "reunioes", "avisos", "projetos", "painel", "configuracoes"]),
  presidente: new Set(["dashboard", "implantacao", "loteamentos", "pessoas", "unidades", "transferencias", "reunioes", "avisos", "projetos", "documentos", "importacao", "relatorios", "painel"]),
  tesoureiro: new Set(["dashboard", "financeiro", "inadimplentes", "relatorios", "painel"]),
  secretario: new Set(["dashboard", "implantacao", "loteamentos", "pessoas", "unidades", "transferencias", "reunioes", "avisos", "documentos", "importacao", "painel"]),
  conselho_fiscal: new Set(["dashboard", "financeiro", "inadimplentes", "relatorios", "painel"]),
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
    current.isAdminMaster
      ? "administrador"
      : current.tipo === "admin_empresa"
        ? "administrador"
        : permissionProfile || perfilResult.data?.perfil || "associado"
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
  const noCompanyError = empresaId ? null : "Selecione uma empresa antes de consultar dados do Portal Associativo.";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalLoteamentos,
    totalUnidades,
    unidadesAtivas,
    associadosAtivos,
    pessoasResult,
    unidadesResult,
    vinculosResult,
    chargesResult,
    recentCharges,
    latestAudits,
    avisosAtivos,
    reunioesAgendadas,
    documentosInternos,
    storageResult,
    configResult
  ] = await Promise.all([
    countPortalRows(client, "assoc_loteamentos", empresaId),
    countPortalRows(client, "assoc_unidades", empresaId),
    countPortalRows(client, "assoc_unidades", empresaId, { status_unidade: "ativa" }),
    countPortalRows(client, "assoc_pessoas", empresaId, { status_pessoa: "ativa" }),
    scopedByEmpresa(
      client
        .from("assoc_pessoas")
        .select("id,nome_completo,whatsapp,core_usuario_id,status_pessoa,criado_em")
        .order("criado_em", { ascending: false })
        .limit(1000),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_unidades")
        .select("id,codigo_unidade,numero_unidade,status_unidade,criado_em")
        .order("criado_em", { ascending: false })
        .limit(1000),
      empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_vinculos_unidade_pessoa")
        .select("id,unidade_id,pessoa_id,tipo_vinculo,status_vinculo,data_fim")
        .eq("status_vinculo", "ativo")
        .is("data_fim", null)
        .limit(2000),
      empresaId
    ),
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
    ),
    countPortalRows(client, "assoc_avisos", empresaId, { status: "ativo" }),
    countPortalRows(client, "assoc_reunioes", empresaId, { status: "agendada" }),
    countPortalRows(client, "assoc_arquivos", empresaId, { liberado_associado: false }),
    scopedByEmpresa(
      client
        .from("assoc_storage_integracoes")
        .select("id,provedor,status")
        .eq("status", "conectado")
        .limit(5),
      empresaId
    ),
    scopedByEmpresa(client.from("assoc_configuracoes").select("*"), empresaId).maybeSingle()
  ]);

  const pessoas = uniqueById((pessoasResult.data ?? []) as Array<Record<string, unknown>>);
  const unidades = uniqueById((unidadesResult.data ?? []) as Array<Record<string, unknown>>);
  const vinculos = uniqueById((vinculosResult.data ?? []) as Array<Record<string, unknown>>);
  const pessoasComUnidade = new Set(vinculos.map((row) => String(row.pessoa_id ?? "")).filter(Boolean));
  const unidadesComFinanceiro = new Set(
    vinculos
      .filter((row) => row.tipo_vinculo === "responsavel_financeiro")
      .map((row) => String(row.unidade_id ?? ""))
      .filter(Boolean)
  );
  const unidadesComProprietario = new Set(
    vinculos
      .filter((row) => row.tipo_vinculo === "proprietario")
      .map((row) => String(row.unidade_id ?? ""))
      .filter(Boolean)
  );

  const charges = uniqueCharges(((chargesResult.data ?? []) as Array<Record<string, unknown>>).map(normalizeChargeRow));
  const openCharges = charges.filter((row) => OUTSTANDING_CHARGE_STATUSES.has(String(row.status)));
  const overdueCharges = charges.filter(isOverdueCharge);
  const paidThisMonth = charges.filter((row) => {
    if (String(row.status) !== "paga" || !row.data_pagamento) return false;
    const paidAt = new Date(String(row.data_pagamento));
    return Number.isFinite(paidAt.getTime()) && paidAt >= monthStart;
  });
  const activeUnits = unidades.filter((row) => row.status_unidade === "ativa");
  const pessoasAtivas = pessoas.filter((row) => row.status_pessoa === "ativa");
  const configData = (configResult.data ?? {}) as Record<string, unknown>;
  const configuracaoFinanceiraIncompleta = !(
    Number(configData.valor_mensalidade_padrao ?? 0) > 0 &&
    configData.vencimento_padrao &&
    (configData.pix_chave || configData.recebedor_nome)
  );
  const storageConfigured = ((storageResult.data ?? []) as Array<Record<string, unknown>>).length > 0;
  const unidadesSemResponsavelFinanceiro = activeUnits.filter((row) => !unidadesComFinanceiro.has(String(row.id)));
  const pessoasSemWhatsApp = pessoasAtivas.filter((row) => !String(row.whatsapp ?? "").trim());
  const associadosSemUsuario = pessoasAtivas.filter((row) => !String(row.core_usuario_id ?? "").trim());

  const alertas = [
    unidadesSemResponsavelFinanceiro.length
      ? { title: "Existem unidades sem responsável pelo pagamento", detail: `${unidadesSemResponsavelFinanceiro.length} unidade(s) ativa(s) precisam de responsável.`, href: "/portal-associativo/unidades", tone: "warning", action: "Corrigir unidades" }
      : null,
    pessoasSemWhatsApp.length
      ? { title: "Existem pessoas sem WhatsApp", detail: `${pessoasSemWhatsApp.length} cadastro(s) sem WhatsApp.`, href: "/portal-associativo/pessoas", tone: "warning", action: "Ver associados" }
      : null,
    overdueCharges.length
      ? { title: "Existem cobranças vencidas", detail: `${overdueCharges.length} cobrança(s) vencida(s).`, href: "/portal-associativo/inadimplentes", tone: "danger", action: "Ver atrasados" }
      : null,
    documentosInternos
      ? { title: "Existem documentos pendentes", detail: `${documentosInternos} documento(s) internos ou não liberados.`, href: "/portal-associativo/documentos", tone: "info", action: "Revisar documentos" }
      : null,
    associadosSemUsuario.length
      ? { title: "Existem associados sem usuário vinculado", detail: `${associadosSemUsuario.length} pessoa(s) ativa(s) ainda sem usuário MBA Labs.`, href: "/portal-associativo/pessoas", tone: "warning", action: "Vincular usuários" }
      : null,
    configuracaoFinanceiraIncompleta
      ? { title: "Configuração financeira incompleta", detail: "Revise mensalidade padrão, vencimento e dados PIX.", href: "/portal-associativo/configuracoes#pix-manual", tone: "danger", action: "Configurar PIX agora" }
      : null,
    !storageConfigured
      ? { title: "Arquivos ainda não conectados", detail: "Conecte o Dropbox ou Google Drive da associação antes de anexar documentos.", href: "/portal-associativo/configuracoes#arquivos", tone: "warning", action: "Conectar arquivos" }
      : null,
    charges.some((row) => row.status === "aguardando_aprovacao")
      ? { title: "Existem comprovantes para conferir", detail: `${charges.filter((row) => row.status === "aguardando_aprovacao").length} pagamento(s) aguardando sua conferência.`, href: "/portal-associativo/financeiro?status=aguardando_aprovacao", tone: "warning", action: "Aprovar agora" }
      : null
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string; tone: string; action?: string }>;

  const ultimosPagamentos = charges
    .filter((row) => row.status === "paga")
    .sort((a, b) => new Date(String(b.data_pagamento ?? "")).getTime() - new Date(String(a.data_pagamento ?? "")).getTime())
    .slice(0, 8);
  const ultimosCadastros = [
    ...pessoas.slice(0, 8).map((row) => ({ id: `pessoa-${row.id}`, tipo: "Pessoa", nome: row.nome_completo, criado_em: row.criado_em })),
    ...unidades.slice(0, 8).map((row) => ({ id: `unidade-${row.id}`, tipo: "Unidade", nome: unitLabel(row), criado_em: row.criado_em }))
  ]
    .sort((a, b) => new Date(String(b.criado_em ?? "")).getTime() - new Date(String(a.criado_em ?? "")).getTime())
    .slice(0, 8);

  return {
    ...context,
    metrics: {
      totalLoteamentos,
      totalUnidades,
      unidadesAtivas,
      associadosAtivos,
      pessoasSemUnidade: pessoasAtivas.filter((row) => !pessoasComUnidade.has(String(row.id))).length,
      unidadesSemResponsavelFinanceiro: unidadesSemResponsavelFinanceiro.length,
      cobrancasAbertas: openCharges.length,
      cobrancasVencidas: overdueCharges.length,
      recebidoMes: sumMoney(paidThisMonth, "valor_total"),
      totalEmAberto: sumMoney(openCharges, "valor_total"),
      totalVencido: sumMoney(overdueCharges, "valor_total"),
      cobrancasAguardandoPagamento: charges.filter((row) => row.status === "aguardando_pagamento").length,
      pagamentosAguardandoAprovacao: charges.filter((row) => row.status === "aguardando_aprovacao").length,
      comprovantesPendentes: charges.filter((row) => row.status === "aguardando_aprovacao").length,
      avisosAtivos,
      reunioesAgendadas
    },
    inadimplenciaPorLoteamento: groupMoney(overdueCharges, (row) => loteamentoLabel(row.assoc_loteamentos)),
    inadimplenciaPorUnidade: groupMoney(overdueCharges, (row) => unitLabel(row.assoc_unidades)),
    inadimplenciaPorResponsavel: groupMoney(overdueCharges, (row) => relationName(row.assoc_pessoas) || "Sem responsável"),
    ultimasCobrancas: uniqueCharges(((recentCharges.data ?? []) as Array<Record<string, unknown>>).map(normalizeChargeRow)),
    ultimosPagamentos,
    ultimosCadastros,
    ultimosLogs: (latestAudits.data ?? []) as Array<Record<string, unknown>>,
    alertas,
    readiness: {
      config: !configuracaoFinanceiraIncompleta,
      pessoas: pessoas.length > 0,
      unidades: unidades.length > 0,
      vinculos: activeUnits.length > 0 && unidadesSemResponsavelFinanceiro.length === 0 && activeUnits.every((row) => unidadesComProprietario.has(String(row.id))),
      financeiro: !configuracaoFinanceiraIncompleta && activeUnits.length > 0 && unidadesSemResponsavelFinanceiro.length === 0,
      painel: associadosSemUsuario.length < pessoasAtivas.length
    },
    error:
      noCompanyError ??
      context.error ??
      pessoasResult.error?.message ??
      unidadesResult.error?.message ??
      vinculosResult.error?.message ??
      chargesResult.error?.message ??
      recentCharges.error?.message ??
      latestAudits.error?.message ??
      storageResult.error?.message ??
      configResult.error?.message ??
      null
  };
}
export async function getPortalOnboarding() {
  const context = await getPortalContext(PORTAL_ASSOCIATIVO_PATH);
  const client = context.client;
  const empresaId = context.empresaId;
  const [config, pessoas, unidades, vinculos, cobrancas, perfis] = await Promise.all([
    scopedByEmpresa(client.from("assoc_configuracoes").select("*"), empresaId).maybeSingle(),
    countPortalRows(client, "assoc_pessoas", empresaId),
    countPortalRows(client, "assoc_unidades", empresaId),
    countPortalRows(client, "assoc_vinculos_unidade_pessoa", empresaId, { status_vinculo: "ativo" }),
    countPortalRows(client, "assoc_cobrancas", empresaId),
    countPortalRows(client, "assoc_perfis_usuarios", empresaId, { status: "ativo" })
  ]);

  const configData = (config.data ?? {}) as Record<string, unknown>;
  const hasConfig = Boolean(
    configData.nome_publico_entidade &&
      Number(configData.valor_mensalidade_padrao ?? 0) > 0 &&
      configData.vencimento_padrao &&
      (configData.pix_chave || configData.recebedor_nome)
  );
  const steps = [
    {
      id: "configuracoes",
      title: "Dados da entidade e PIX",
      description: "Preencha nome publico, logo, mensalidade padrao, vencimento, chave PIX e recebedor.",
      href: "/portal-associativo/configuracoes",
      done: hasConfig,
      action: hasConfig ? "Revisar" : "Configurar"
    },
    {
      id: "pessoas",
      title: "Cadastro ou importacao de pessoas",
      description: "Cadastre associados, proprietarios, responsaveis financeiros, contatos e diretores.",
      href: "/portal-associativo/pessoas",
      done: pessoas > 0,
      action: pessoas > 0 ? "Ver pessoas" : "Cadastrar"
    },
    {
      id: "unidades",
      title: "Cadastro ou importacao de unidades",
      description: "Cadastre lotes, chacaras, casas, salas, boxes, propriedades ou outros tipos.",
      href: "/portal-associativo/unidades",
      done: unidades > 0,
      action: unidades > 0 ? "Ver unidades" : "Cadastrar"
    },
    {
      id: "vinculos",
      title: "Vincular responsaveis",
      description: "Defina proprietario, responsavel financeiro e responsavel de contato em cada unidade.",
      href: "/portal-associativo/unidades",
      done: vinculos > 0,
      action: vinculos > 0 ? "Revisar vinculos" : "Vincular"
    },
    {
      id: "financeiro",
      title: "Mensalidade e PIX",
      description: "Confira valor padrao, vencimento, descricao e PIX manual. A estrutura ja fica pronta para PIX automatico futuro.",
      href: "/portal-associativo/financeiro",
      done: hasConfig,
      action: "Abrir financeiro"
    },
    {
      id: "cobrancas",
      title: "Gerar cobrancas",
      description: "Gere mensalidade individual ou em lote com previa antes de confirmar.",
      href: "/portal-associativo/financeiro",
      done: cobrancas > 0,
      action: cobrancas > 0 ? "Ver cobrancas" : "Gerar"
    },
    {
      id: "acesso",
      title: "Liberar acesso ao associado",
      description: "Vincule a pessoa ao usuario MBA Labs e defina o perfil interno. Nao ha login separado.",
      href: "/portal-associativo/pessoas",
      done: perfis > 0,
      action: perfis > 0 ? "Ver acessos" : "Vincular usuario"
    }
  ];

  return {
    ...context,
    steps,
    counts: { pessoas, unidades, vinculos, cobrancas, perfis },
    shouldShow: !configData.implantacao_concluida && steps.some((step) => !step.done),
    completed: steps.filter((step) => step.done).length,
    total: steps.length,
    error: context.error ?? config.error?.message ?? null
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

export async function listPortalPessoas(search = "", filters: { status?: string; perfil?: string; cidade?: string; uf?: string } = {}) {
  const context = await getPortalContext("/portal-associativo/pessoas");
  const client = context.client;
  const empresaId = context.empresaId;
  let query = scopedByEmpresa(
    client
      .from("assoc_pessoas")
      .select("id,core_usuario_id,nome_completo,tipo_pessoa,cpf_cnpj,rg_ie,data_nascimento,telefone,whatsapp,email,endereco,endereco_residencial,status_pessoa,cidade,uf,observacoes,criado_em,assoc_perfis_usuarios(perfil,status)")
      .order("nome_completo", { ascending: true })
      .limit(300),
    empresaId
  );

  if (filters.status) {
    query = query.eq("status_pessoa", filters.status);
  }
  if (filters.cidade) {
    query = query.ilike("cidade", `%${filters.cidade}%`);
  }
  if (filters.uf) {
    query = query.ilike("uf", `%${filters.uf}%`);
  }

  const [{ data, error }, vinculosResult, cobrancasResult] = await Promise.all([
    query,
    scopedByEmpresa(client.from("assoc_vinculos_unidade_pessoa").select("id,pessoa_id,unidade_id,status_vinculo,data_fim").eq("status_vinculo", "ativo").is("data_fim", null), empresaId),
    scopedByEmpresa(client.from("assoc_cobrancas").select("id,pessoa_responsavel_id,status").in("status", Array.from(OUTSTANDING_CHARGE_STATUSES)), empresaId)
  ]);
  const unidadesPorPessoa = new Map<string, Set<string>>();
  for (const vinculo of uniqueById((vinculosResult.data ?? []) as Array<Record<string, unknown>>)) {
    const pessoa = String(vinculo.pessoa_id ?? "");
    const unidade = String(vinculo.unidade_id ?? "");
    if (!pessoa || !unidade) continue;
    const ids = unidadesPorPessoa.get(pessoa) ?? new Set<string>();
    ids.add(unidade);
    unidadesPorPessoa.set(pessoa, ids);
  }
  const cobrancasPorPessoa = new Map<string, number>();
  for (const cobranca of uniqueCharges((cobrancasResult.data ?? []) as Array<Record<string, unknown>>)) {
    const pessoa = String(cobranca.pessoa_responsavel_id ?? "");
    if (pessoa) cobrancasPorPessoa.set(pessoa, (cobrancasPorPessoa.get(pessoa) ?? 0) + 1);
  }
  const rows = uniqueById(((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      perfil: relationObject(row.assoc_perfis_usuarios)?.perfil ?? "",
      perfil_status: relationObject(row.assoc_perfis_usuarios)?.status ?? "",
      unidades_vinculadas: unidadesPorPessoa.get(String(row.id))?.size ?? 0,
      unidade_ids: Array.from(unidadesPorPessoa.get(String(row.id)) ?? []),
      cobrancas_abertas: cobrancasPorPessoa.get(String(row.id)) ?? 0
    }))
    .filter((row) => !filters.perfil || row.perfil === filters.perfil)
    .filter((row) => includesSearch(row, ["nome_completo", "cpf_cnpj", "email", "telefone", "whatsapp"], search)));

  return { ...context, rows, error: context.error ?? error?.message ?? vinculosResult.error?.message ?? cobrancasResult.error?.message ?? null };
}

export async function listPortalUnidades(search = "", status = "", loteamento = "") {
  const context = await getPortalContext("/portal-associativo/unidades");
  const client = context.client;
  let query = scopedByEmpresa(
    client
      .from("assoc_unidades")
      .select("id,loteamento_id,codigo_unidade,numero_unidade,quadra_setor,tipo_unidade,status_unidade,endereco_localizacao,area_m2,possui_construcao,valor_mensalidade,vencimento_dia,isento_mensalidade,criado_em,assoc_loteamentos(nome,codigo),assoc_vinculos_unidade_pessoa(tipo_vinculo,status_vinculo,data_fim,assoc_pessoas(nome_completo)),assoc_cobrancas(id,status,data_vencimento)")
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
      responsavel_contato: vinculoName(row.assoc_vinculos_unidade_pessoa, "responsavel_contato"),
      cobrancas_abertas: uniqueCharges(Array.isArray(row.assoc_cobrancas) ? row.assoc_cobrancas as Array<Record<string, unknown>> : []).filter((charge) => OUTSTANDING_CHARGE_STATUSES.has(String(charge.status))).length,
      cobrancas_vencidas: uniqueCharges(Array.isArray(row.assoc_cobrancas) ? row.assoc_cobrancas as Array<Record<string, unknown>> : []).filter(isOverdueCharge).length
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
      .select("id,loteamento_id,unidade_id,pessoa_responsavel_id,tipo_cobranca,descricao,mes_referencia,ano_referencia,data_vencimento,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,status,forma_pagamento,data_pagamento,pix_copia_cola,comprovante_url,comprovante_pendente_url,comprovante_aprovado_url,motivo_recusa,observacoes,motivo_cancelamento,recibo_url,recibo_file_id,recibo_emitido_em,assoc_loteamentos(nome),assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp),assoc_comprovantes_pagamento(id,arquivo_id,status,comprovante_url,valor_informado,data_pagamento_informada,observacao_associado,motivo_recusa,enviado_em,provedor_storage)")
      .order("data_vencimento", { ascending: false })
      .limit(500),
    context.empresaId
  );

  if (filters.status && filters.status !== "vencida") query = query.eq("status", filters.status);
  if (filters.loteamento) query = query.eq("loteamento_id", filters.loteamento);
  if (filters.unidade) query = query.eq("unidade_id", filters.unidade);
  if (filters.responsavel) query = query.eq("pessoa_responsavel_id", filters.responsavel);
  if (filters.mes && filters.mes.includes("-")) {
    const [ano, mes] = filters.mes.split("-");
    query = query.eq("ano_referencia", Number(ano)).eq("mes_referencia", Number(mes));
  }

  const { data, error } = await query;
  const rows = uniqueCharges(((data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      status_calculado: isOverdueCharge(row) ? "vencida" : row.status,
      loteamento: loteamentoLabel(row.assoc_loteamentos),
      unidade: unitLabel(row.assoc_unidades),
      responsavel: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas),
      mensagem_whatsapp: buildChargeWhatsappMessage(row, context.companyName)
    }))
    .filter((row) => filters.status !== "vencida" || row.status_calculado === "vencida")
    .filter((row) => includesSearch(row, ["descricao", "loteamento", "unidade", "responsavel"], filters.q ?? "")));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalInadimplentes(filters: {
  q?: string;
  unidade?: string;
  responsavel?: string;
  mes?: string;
  status?: string;
  valorMin?: string;
  valorMax?: string;
  diasMin?: string;
  diasMax?: string;
  whatsapp?: string;
} = {}) {
  const context = await getPortalContext("/portal-associativo/inadimplentes");
  const client = context.client;
  let query = scopedByEmpresa(
    client
      .from("assoc_cobrancas")
      .select("id,unidade_id,pessoa_responsavel_id,descricao,status,mes_referencia,ano_referencia,data_vencimento,valor_total,pix_copia_cola,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp)")
      .in("status", ["aberta", "aguardando_pagamento", "vencida", "negociada"])
      .order("data_vencimento", { ascending: true })
      .limit(1000),
    context.empresaId
  );

  if (filters.unidade) query = query.eq("unidade_id", filters.unidade);
  if (filters.responsavel) query = query.eq("pessoa_responsavel_id", filters.responsavel);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.mes && filters.mes.includes("-")) {
    const [ano, mes] = filters.mes.split("-");
    query = query.eq("ano_referencia", Number(ano)).eq("mes_referencia", Number(mes));
  }

  const { data, error } = await query;
  const today = startOfToday();
  const min = moneyFilter(filters.valorMin);
  const max = moneyFilter(filters.valorMax);
  const minDays = moneyFilter(filters.diasMin);
  const maxDays = moneyFilter(filters.diasMax);
  const overdue = uniqueCharges(((data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .filter((row) => {
      if (!isOverdueCharge(row)) return false;
      const value = Number(row.valor_total ?? 0);
      return (min === null || value >= min) && (max === null || value <= max);
    }));

  const grouped = new Map<string, Record<string, unknown>>();
  for (const row of overdue) {
    const key = `${row.pessoa_responsavel_id ?? "sem-responsavel"}-${row.unidade_id ?? "sem-unidade"}`;
    const existing = grouped.get(key);
    const due = row.data_vencimento ? new Date(String(row.data_vencimento)) : today;
    const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
    const base: Record<string, unknown> = {
      id: key,
      pessoa_id: row.pessoa_responsavel_id,
      unidade_id: row.unidade_id,
      cobranca_id: row.id,
      responsavel: relationName(row.assoc_pessoas) || "Sem responsavel",
      whatsapp: relationPhone(row.assoc_pessoas),
      unidade: unitLabel(row.assoc_unidades),
      quantidade_cobrancas: 0,
      valor_total_vencido: 0,
      cobranca_mais_antiga: row.data_vencimento,
      dias_atraso: days,
      descricao_mais_antiga: row.descricao,
      pix_copia_cola: row.pix_copia_cola
    };
    const target: Record<string, unknown> = existing ?? base;
    target.quantidade_cobrancas = Number(target.quantidade_cobrancas ?? 0) + 1;
    target.valor_total_vencido = Number(target.valor_total_vencido ?? 0) + Number(row.valor_total ?? 0);
    if (days > Number(target.dias_atraso ?? 0)) {
      target.dias_atraso = days;
      target.cobranca_mais_antiga = row.data_vencimento;
      target.descricao_mais_antiga = row.descricao;
      target.pix_copia_cola = row.pix_copia_cola;
      target.cobranca_id = row.id;
    }
    target.mensagem_whatsapp = buildChargeWhatsappMessage(
      {
        ...row,
        responsavel: target.responsavel,
        unidade: target.unidade,
        valor_total: target.valor_total_vencido,
        descricao: `${target.quantidade_cobrancas} cobranca(s) vencida(s)`,
        data_vencimento: target.cobranca_mais_antiga
      },
      context.companyName
    );
    grouped.set(key, target);
  }

  const rows = Array.from(grouped.values())
    .filter((row) => {
      const days = Number(row.dias_atraso ?? 0);
      const phone = String(row.whatsapp ?? "").trim();
      return (minDays === null || days >= minDays) && (maxDays === null || days <= maxDays) && (filters.whatsapp !== "com" || Boolean(phone)) && (filters.whatsapp !== "sem" || !phone);
    })
    .filter((row) => includesSearch(row, ["responsavel", "whatsapp", "unidade", "descricao_mais_antiga"], filters.q ?? ""))
    .sort((a, b) => Number(b.valor_total_vencido ?? 0) - Number(a.valor_total_vencido ?? 0));

  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function getPortalMensalidadesPreview(params: {
  loteamentoId?: string;
  mesInicial?: string;
  valorOriginal?: string;
  vencimentoDia?: string;
  descricao?: string;
  ateDezembro?: boolean;
}) {
  const context = await getPortalContext("/portal-associativo/financeiro");
  const empresaId = context.empresaId;
  const empty = {
    ...context,
    preview: null as null | Record<string, unknown>,
    error: context.error
  };
  if (!empresaId || !params.mesInicial) return empty;

  const [year, month] = params.mesInicial.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return empty;

  const months = [];
  for (let monthIndex = month; monthIndex <= (params.ateDezembro ? 12 : month); monthIndex += 1) {
    months.push({ year, month: monthIndex });
  }

  let unitsQuery = context.client
    .from("assoc_unidades")
    .select("id,loteamento_id,codigo_unidade,numero_unidade,valor_mensalidade,vencimento_dia,isento_mensalidade,assoc_loteamentos(nome,valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao)")
    .eq("empresa_id", empresaId)
    .eq("status_unidade", "ativa");

  if (params.loteamentoId) unitsQuery = unitsQuery.eq("loteamento_id", params.loteamentoId);

  const [unitsResult, linksResult, existingResult, configResult] = await Promise.all([
    unitsQuery,
    context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("unidade_id,pessoa_id")
      .eq("empresa_id", empresaId)
      .eq("tipo_vinculo", "responsavel_financeiro")
      .eq("status_vinculo", "ativo")
      .is("data_fim", null),
    context.client
      .from("assoc_cobrancas")
      .select("unidade_id,mes_referencia,ano_referencia,status")
      .eq("empresa_id", empresaId)
      .eq("tipo_cobranca", "mensalidade")
      .in("ano_referencia", [year]),
    context.client.from("assoc_configuracoes").select("valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao").eq("empresa_id", empresaId).maybeSingle()
  ]);

  if (unitsResult.error || linksResult.error || existingResult.error || configResult.error) {
    return {
      ...context,
      preview: null,
      error: context.error ?? unitsResult.error?.message ?? linksResult.error?.message ?? existingResult.error?.message ?? configResult.error?.message ?? null
    };
  }

  const existingRows = (existingResult.data ?? []) as Array<Record<string, unknown>>;
  const existing = new Map(existingRows.map((row) => [`${row.unidade_id}-${row.ano_referencia}-${row.mes_referencia}`, String(row.status ?? "")]));
  const responsaveis = new Set((linksResult.data ?? []).map((row: Record<string, unknown>) => String(row.unidade_id ?? "")));
  const config = (configResult.data ?? {}) as Record<string, unknown>;
  const valorInformado = Number(String(params.valorOriginal ?? "").replace(",", ".") || 0);
  const vencimentoInformado = Number(params.vencimentoDia || 0);
  const rows: Array<Record<string, unknown>> = [];
  const ignored: Array<Record<string, unknown>> = [];
  const problemas: Array<Record<string, unknown>> = [];
  let semValor = 0;
  let isentas = 0;
  let semResponsavel = 0;

  for (const unit of unitsResult.data ?? []) {
    const unitRecord = unit as Record<string, unknown>;
    const unidadeLabel = unitLabel(unitRecord);
    if (unitRecord.isento_mensalidade === true) {
      isentas += 1;
      problemas.push({ unidade: unidadeLabel, motivo: "Unidade isenta de mensalidade" });
      continue;
    }
    if (!responsaveis.has(String(unitRecord.id))) {
      semResponsavel += 1;
      problemas.push({ unidade: unidadeLabel, motivo: "Sem responsável financeiro ativo" });
      continue;
    }
    const loteamento = relationObject(unitRecord.assoc_loteamentos);
    const valor = firstPositiveNumber(unitRecord.valor_mensalidade, valorInformado, loteamento?.valor_mensalidade_padrao, config.valor_mensalidade_padrao);
    if (valor <= 0) {
      semValor += 1;
      problemas.push({ unidade: unidadeLabel, motivo: "Sem valor de mensalidade configurado" });
      continue;
    }
    const vencimentoDia = clampDayLocal(firstPositiveNumber(unitRecord.vencimento_dia, vencimentoInformado, loteamento?.vencimento_padrao, config.vencimento_padrao, 10));
    const descricao = params.descricao || String(loteamento?.descricao_mensalidade_padrao ?? config.descricao_mensalidade_padrao ?? "Mensalidade");

    for (const item of months) {
      const key = `${unitRecord.id}-${item.year}-${item.month}`;
      const previewRow = {
        unidade_id: unitRecord.id,
        unidade: unidadeLabel,
        loteamento: loteamentoLabel(unitRecord.assoc_loteamentos),
        mes: item.month,
        ano: item.year,
        vencimento: buildDueDateLocal(item.year, item.month, vencimentoDia),
        descricao,
        valor
      };
      if (existing.has(key)) {
        ignored.push({ ...previewRow, motivo: existing.get(key) === "paga" ? "Já estava paga" : "Cobrança já existente", status: existing.get(key) });
      } else {
        rows.push(previewRow);
      }
    }
  }

  return {
    ...context,
    preview: {
      quantidade_unidades: (unitsResult.data ?? []).length,
      quantidade_com_responsavel: (unitsResult.data ?? []).length - semResponsavel - isentas,
      quantidade_sem_responsavel: semResponsavel,
      quantidade_cobrancas: rows.length,
      quantidade_ignoradas: ignored.length,
      quantidade_ignoradas_pagas: ignored.filter((row) => row.status === "paga").length,
      quantidade_ignoradas_existentes: ignored.filter((row) => row.status !== "paga").length,
      quantidade_meses: months.length,
      valor_total: rows.reduce((sum, row) => sum + Number(row.valor ?? 0), 0),
      mes_inicial: params.mesInicial,
      vencimento: params.vencimentoDia,
      descricao: params.descricao || String(config.descricao_mensalidade_padrao ?? "Mensalidade"),
      unidades_afetadas: rows.slice(0, 60),
      ignoradas: ignored.slice(0, 60),
      problemas: problemas.slice(0, 60),
      sem_valor: semValor,
      isentas
    },
    error: context.error ?? null
  };
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
  return { ...context, rows: uniqueById((data ?? []) as Array<Record<string, unknown>>), error: context.error ?? error?.message ?? null };
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
  const today = startOfToday();
  const rows = uniqueById(((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => !activeOnly || isVisibleNotice(row))
    .map((row) => ({ ...row, status_visual: row.visivel_ate && new Date(String(row.visivel_ate)) < today ? "expirado" : row.status })));
  return { ...context, rows, error: context.error ?? error?.message ?? null };
}

export async function listPortalProjetos() {
  const context = await getPortalContext("/portal-associativo/projetos");
  const { data, error } = await scopedByEmpresa(
    context.client.from("assoc_projetos").select("*").order("criado_em", { ascending: false }).limit(200),
    context.empresaId
  );
  return { ...context, rows: uniqueById((data ?? []) as Array<Record<string, unknown>>), error: context.error ?? error?.message ?? null };
}

export async function listPortalArquivos(filters: {
  q?: string;
  pessoa?: string;
  unidade?: string;
  cobranca?: string;
  reuniao?: string;
  projeto?: string;
  categoria?: string;
  liberado?: string;
} = {}) {
  const context = await getPortalContext("/portal-associativo/documentos");
  let query = scopedByEmpresa(
    context.client
      .from("assoc_arquivos")
      .select("id,pessoa_id,unidade_id,cobranca_id,reuniao_id,projeto_id,provedor,file_id,file_name,mime_type,size,path,shared_url,visibility,liberado_associado,categoria,descricao,criado_em,assoc_pessoas(nome_completo),assoc_unidades(codigo_unidade,numero_unidade),assoc_cobrancas(descricao),assoc_reunioes(titulo),assoc_projetos(nome)")
      .order("criado_em", { ascending: false })
      .limit(400),
    context.empresaId
  );

  if (filters.pessoa) query = query.eq("pessoa_id", filters.pessoa);
  if (filters.unidade) query = query.eq("unidade_id", filters.unidade);
  if (filters.cobranca) query = query.eq("cobranca_id", filters.cobranca);
  if (filters.reuniao) query = query.eq("reuniao_id", filters.reuniao);
  if (filters.projeto) query = query.eq("projeto_id", filters.projeto);
  if (filters.categoria) query = query.eq("categoria", filters.categoria);
  if (filters.liberado === "sim") query = query.eq("liberado_associado", true);
  if (filters.liberado === "nao") query = query.eq("liberado_associado", false);

  const { data, error } = await query;
  const rows = uniqueFiles(((data ?? []) as Array<Record<string, unknown>>)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      titulo: row.file_name,
      pessoa: relationName(row.assoc_pessoas),
      unidade: unitLabel(row.assoc_unidades),
      cobranca: relationObject(row.assoc_cobrancas)?.descricao ?? "",
      reuniao: relationObject(row.assoc_reunioes)?.titulo ?? "",
      projeto: relationObject(row.assoc_projetos)?.nome ?? "",
      local_armazenamento: [portalStorageProviderLabel(String(row.provedor ?? "")), row.path].filter(Boolean).join(" - ")
    }))
    .filter((row) => includesSearch(row, ["file_name", "descricao", "categoria", "pessoa", "unidade", "cobranca", "reuniao", "projeto"], filters.q ?? "")));

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
      cobrancasAguardandoAprovacao: [],
      cobrancasRecusadas: [],
      cobrancasPagas: [],
      pixManual: { ativo: false, chave: "", tipo: "", recebedor: "", cidade: "", instrucoes: "", qrCodeUrl: "" },
      avisos: [],
      reunioes: [],
      projetos: [],
      documentos: [],
      error: "Seu usu\u00e1rio ainda n\u00e3o est\u00e1 vinculado a um cadastro de associado. Procure a administra\u00e7\u00e3o."
    };
  }

  const [pessoa, vinculos, cobrancas, avisos, reunioes, projetos, documentos, config, pagamento] = await Promise.all([
    client.from("assoc_pessoas").select("*").eq("id", pessoaId).eq("empresa_id", context.empresaId).maybeSingle(),
    scopedByEmpresa(
      client
        .from("assoc_vinculos_unidade_pessoa")
        .select("tipo_vinculo,status_vinculo,assoc_unidades(id,codigo_unidade,numero_unidade,tipo_unidade,status_unidade,endereco_localizacao)")
        .eq("pessoa_id", pessoaId)
        .eq("status_vinculo", "ativo")
        .is("data_fim", null),
      context.empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_cobrancas")
        .select("id,unidade_id,pessoa_responsavel_id,descricao,status,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,data_vencimento,data_pagamento,forma_pagamento,pix_copia_cola,recibo_url,recibo_emitido_em,motivo_recusa,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp),assoc_comprovantes_pagamento(id,status,motivo_recusa,enviado_em)")
        .order("data_vencimento", { ascending: false })
        .limit(300),
      context.empresaId
    ),
    listPortalAvisos(true),
    scopedByEmpresa(
      client.from("assoc_reunioes").select("*").eq("liberado_associado", true).order("data_reuniao", { ascending: false }).limit(50),
      context.empresaId
    ),
    scopedByEmpresa(
      client.from("assoc_projetos").select("*").eq("liberado_associado", true).order("criado_em", { ascending: false }).limit(50),
      context.empresaId
    ),
    scopedByEmpresa(
      client
        .from("assoc_arquivos")
        .select("id,pessoa_id,unidade_id,cobranca_id,reuniao_id,projeto_id,provedor,file_name,mime_type,size,path,shared_url,categoria,descricao,liberado_associado,criado_em,assoc_unidades(codigo_unidade,numero_unidade)")
        .eq("liberado_associado", true)
        .order("criado_em", { ascending: false })
        .limit(300),
      context.empresaId
    ),
    scopedByEmpresa(client.from("assoc_configuracoes").select("pix_chave,pix_tipo_chave,recebedor_nome,recebedor_cidade,instrucoes_pagamento,instrucoes_pagamento_pix,qr_code_pix_url,usar_pix_manual"), context.empresaId).maybeSingle(),
    scopedByEmpresa(client.from("assoc_configuracoes_pagamento").select("provedor_pix_ativo,gerar_pix_automatico,status_configuracao"), context.empresaId).maybeSingle()
  ]);

  const unidades = uniqueUnidadesFromVinculos((vinculos.data ?? []) as Array<Record<string, unknown>>);
  const unidadeIds = new Set(unidades.map((row) => String(row.id ?? "")).filter(Boolean));
  const chargeRows = uniqueCharges(((cobrancas.data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map<Record<string, unknown>>((row) => ({
      ...row,
      unidade: unitLabel(row.assoc_unidades),
      mensagem_whatsapp: buildChargeWhatsappMessage({ ...row, pix_copia_cola: row.pix_copia_cola || config.data?.pix_chave }, context.companyName)
    }))
    .filter((row) => String(row.pessoa_responsavel_id ?? "") === pessoaId || unidadeIds.has(String(row.unidade_id ?? ""))));
  const avisosRows = uniqueById((avisos.rows as Array<Record<string, unknown>>).filter((row) => noticeMatchesAssociatedAudience(row, context.perfil, pessoaId, unidadeIds, chargeRows)));
  const documentosRows = uniqueFiles(((documentos.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => String(row.pessoa_id ?? "") === pessoaId || unidadeIds.has(String(row.unidade_id ?? "")) || chargeRows.some((charge) => String(charge.id) === String(row.cobranca_id ?? "")))
    .map<Record<string, unknown>>((row) => ({
      ...row,
      titulo: row.file_name,
      unidade: unitLabel(row.assoc_unidades),
      local_armazenamento: [portalStorageProviderLabel(String(row.provedor ?? "")), row.path].filter(Boolean).join(" - ")
    })));

  return {
    ...context,
    pessoa: pessoa.data,
    unidades,
    cobrancasAbertas: chargeRows.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status))),
    cobrancasAguardandoAprovacao: chargeRows.filter((row) => row.status === "aguardando_aprovacao"),
    cobrancasRecusadas: chargeRows.filter((row) => row.status === "recusada" || Boolean(row.motivo_recusa)),
    cobrancasPagas: chargeRows.filter((row) => row.status === "paga"),
    pixManual: {
      ativo: Boolean(config.data?.usar_pix_manual !== false && config.data?.pix_chave && (!pagamento.data?.gerar_pix_automatico || pagamento.data?.provedor_pix_ativo === "manual")),
      chave: config.data?.pix_chave ?? "",
      tipo: config.data?.pix_tipo_chave ?? "",
      recebedor: config.data?.recebedor_nome ?? "",
      cidade: config.data?.recebedor_cidade ?? "",
      instrucoes: config.data?.instrucoes_pagamento_pix ?? config.data?.instrucoes_pagamento ?? "",
      qrCodeUrl: config.data?.qr_code_pix_url ?? ""
    },
    avisos: avisosRows,
    reunioes: uniqueById((reunioes.data ?? []) as Array<Record<string, unknown>>),
    projetos: uniqueById((projetos.data ?? []) as Array<Record<string, unknown>>),
    documentos: documentosRows,
    error: context.error ?? pessoa.error?.message ?? vinculos.error?.message ?? cobrancas.error?.message ?? reunioes.error?.message ?? projetos.error?.message ?? documentos.error?.message ?? config.error?.message ?? pagamento.error?.message ?? null
  };
}

export async function getPortalConfiguracoes() {
  const context = await getPortalContext("/portal-associativo/configuracoes");
  const [config, pagamento, storage] = await Promise.all([
    scopedByEmpresa(context.client.from("assoc_configuracoes").select("*"), context.empresaId).maybeSingle(),
    scopedByEmpresa(context.client.from("assoc_configuracoes_pagamento").select("*"), context.empresaId).maybeSingle(),
    scopedByEmpresa(context.client.from("assoc_storage_integracoes").select("id,provedor,status,account_email,root_folder_path,atualizado_em").order("atualizado_em", { ascending: false }), context.empresaId)
  ]);

  return {
    ...context,
    configuracoes: config.data ?? defaultConfiguracoes(context.companyName),
    pagamento: pagamento.data ?? defaultPagamento(),
    storage: storage.data ?? [],
    error: context.error ?? config.error?.message ?? pagamento.error?.message ?? storage.error?.message ?? null
  };
}

export async function getPortalLookups(nextPath = PORTAL_ASSOCIATIVO_PATH) {
  const context = await getPortalContext(nextPath);
  const [pessoas, loteamentos, unidades, usuarios, config] = await Promise.all([
    scopedByEmpresa(context.client.from("assoc_pessoas").select("id,nome_completo,whatsapp,email,status_pessoa,core_usuario_id").order("nome_completo"), context.empresaId),
    scopedByEmpresa(context.client.from("assoc_loteamentos").select("id,nome,codigo,status,valor_mensalidade_padrao,vencimento_padrao,descricao_mensalidade_padrao").order("nome"), context.empresaId),
    scopedByEmpresa(context.client.from("assoc_unidades").select("id,loteamento_id,codigo_unidade,numero_unidade,tipo_unidade,status_unidade,valor_mensalidade,vencimento_dia,isento_mensalidade").order("numero_unidade"), context.empresaId),
    context.empresaId
      ? context.client.from("core_usuarios").select("id,nome,email,status").eq("empresa_id", context.empresaId).order("nome")
      : Promise.resolve({ data: [], error: null }),
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

export async function getPortalPessoaDetail(id: string) {
  const context = await getPortalContext(`/portal-associativo/pessoas/${id}`);
  const pessoaId = String(id ?? "");
  const empty = {
    ...context,
    pessoa: null,
    unidades: [] as Array<Record<string, unknown>>,
    cobrancasAbertas: [] as Array<Record<string, unknown>>,
    cobrancasPagas: [] as Array<Record<string, unknown>>,
    cobrancasVencidas: [] as Array<Record<string, unknown>>,
    documentos: [] as Array<Record<string, unknown>>,
    transferencias: [] as Array<Record<string, unknown>>,
    auditoria: [] as Array<Record<string, unknown>>,
    error: context.error ?? "Pessoa não encontrada."
  };
  if (!context.empresaId || !pessoaId) return empty;

  const [pessoa, vinculos, cobrancas, documentos, transferencias, auditoria] = await Promise.all([
    context.client.from("assoc_pessoas").select("*").eq("empresa_id", context.empresaId).eq("id", pessoaId).maybeSingle(),
    context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("id,tipo_vinculo,status_vinculo,data_inicio,data_fim,motivo_encerramento,assoc_unidades(id,codigo_unidade,numero_unidade,tipo_unidade,status_unidade,endereco_localizacao)")
      .eq("empresa_id", context.empresaId)
      .eq("pessoa_id", pessoaId)
      .order("data_inicio", { ascending: false }),
    context.client
      .from("assoc_cobrancas")
      .select("id,unidade_id,pessoa_responsavel_id,tipo_cobranca,descricao,mes_referencia,ano_referencia,data_vencimento,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,status,forma_pagamento,data_pagamento,pix_copia_cola,comprovante_url,motivo_cancelamento,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp)")
      .eq("empresa_id", context.empresaId)
      .eq("pessoa_responsavel_id", pessoaId)
      .order("data_vencimento", { ascending: false })
      .limit(300),
    context.client
      .from("assoc_arquivos")
      .select("id,file_name,categoria,descricao,provedor,path,shared_url,liberado_associado,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("pessoa_id", pessoaId)
      .order("criado_em", { ascending: false })
      .limit(200),
    context.client
      .from("assoc_transferencias")
      .select("id,unidade_id,pessoa_anterior_id,nova_pessoa_id,responsavel_financeiro_id,responsavel_contato_id,data_transferencia,motivo,responsabilidade_debitos,documento_url,assoc_unidades(codigo_unidade,numero_unidade)")
      .eq("empresa_id", context.empresaId)
      .order("data_transferencia", { ascending: false })
      .limit(300),
    context.client
      .from("assoc_auditoria_logs")
      .select("id,acao,entidade,entidade_id,dados_novos,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("entidade_id", pessoaId)
      .order("criado_em", { ascending: false })
      .limit(100)
  ]);

  if (pessoa.error || !pessoa.data?.id) {
    return { ...empty, error: pessoa.error?.message ?? "Pessoa não encontrada." };
  }

  const chargeRows = ((cobrancas.data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map((row): Record<string, unknown> => ({
      ...row,
      unidade: unitLabel(row.assoc_unidades),
      responsavel: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas),
      mensagem_whatsapp: buildChargeWhatsappMessage(row, context.companyName)
    }));
  const transferRows = ((transferencias.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) =>
      [row.pessoa_anterior_id, row.nova_pessoa_id, row.responsavel_financeiro_id, row.responsavel_contato_id].some((value) => String(value ?? "") === pessoaId)
    )
    .map((row): Record<string, unknown> => ({ ...row, unidade: unitLabel(row.assoc_unidades) }));

  return {
    ...context,
    pessoa: pessoa.data as Record<string, unknown>,
    unidades: ((vinculos.data ?? []) as Array<Record<string, unknown>>).map((row): Record<string, unknown> => ({
      ...row,
      unidade: unitLabel(row.assoc_unidades),
      unidade_dados: relationObject(row.assoc_unidades)
    })),
    cobrancasAbertas: chargeRows.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status))),
    cobrancasPagas: chargeRows.filter((row) => row.status === "paga"),
    cobrancasVencidas: chargeRows.filter(isOverdueCharge),
    documentos: documentos.data ?? [],
    transferencias: transferRows,
    auditoria: auditoria.data ?? [],
    error:
      context.error ??
      vinculos.error?.message ??
      cobrancas.error?.message ??
      documentos.error?.message ??
      transferencias.error?.message ??
      auditoria.error?.message ??
      null
  };
}

export async function getPortalUnidadeDetail(id: string) {
  const context = await getPortalContext(`/portal-associativo/unidades/${id}`);
  const unidadeId = String(id ?? "");
  const empty = {
    ...context,
    unidade: null,
    vinculos: [] as Array<Record<string, unknown>>,
    cobrancasAbertas: [] as Array<Record<string, unknown>>,
    cobrancasPagas: [] as Array<Record<string, unknown>>,
    cobrancasVencidas: [] as Array<Record<string, unknown>>,
    documentos: [] as Array<Record<string, unknown>>,
    transferencias: [] as Array<Record<string, unknown>>,
    auditoria: [] as Array<Record<string, unknown>>,
    error: context.error ?? "Unidade não encontrada."
  };
  if (!context.empresaId || !unidadeId) return empty;

  const [unidade, vinculos, cobrancas, documentos, transferencias, auditoria] = await Promise.all([
    context.client.from("assoc_unidades").select("*,assoc_loteamentos(nome,codigo)").eq("empresa_id", context.empresaId).eq("id", unidadeId).maybeSingle(),
    context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("id,pessoa_id,tipo_vinculo,status_vinculo,data_inicio,data_fim,motivo_encerramento,assoc_pessoas(id,nome_completo,whatsapp,email)")
      .eq("empresa_id", context.empresaId)
      .eq("unidade_id", unidadeId)
      .order("data_inicio", { ascending: false }),
    context.client
      .from("assoc_cobrancas")
      .select("id,unidade_id,pessoa_responsavel_id,tipo_cobranca,descricao,mes_referencia,ano_referencia,data_vencimento,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,status,forma_pagamento,data_pagamento,pix_copia_cola,comprovante_url,motivo_cancelamento,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp)")
      .eq("empresa_id", context.empresaId)
      .eq("unidade_id", unidadeId)
      .order("data_vencimento", { ascending: false })
      .limit(300),
    context.client
      .from("assoc_arquivos")
      .select("id,file_name,categoria,descricao,provedor,path,shared_url,liberado_associado,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("unidade_id", unidadeId)
      .order("criado_em", { ascending: false })
      .limit(200),
    context.client
      .from("assoc_transferencias")
      .select("id,data_transferencia,motivo,responsabilidade_debitos,documento_url,pessoa_anterior:assoc_pessoas!assoc_transferencias_pessoa_anterior_id_fkey(nome_completo),nova_pessoa:assoc_pessoas!assoc_transferencias_nova_pessoa_id_fkey(nome_completo)")
      .eq("empresa_id", context.empresaId)
      .eq("unidade_id", unidadeId)
      .order("data_transferencia", { ascending: false })
      .limit(200),
    context.client
      .from("assoc_auditoria_logs")
      .select("id,acao,entidade,entidade_id,dados_novos,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("entidade_id", unidadeId)
      .order("criado_em", { ascending: false })
      .limit(100)
  ]);

  if (unidade.error || !unidade.data?.id) {
    return { ...empty, error: unidade.error?.message ?? "Unidade não encontrada." };
  }

  const chargeRows = ((cobrancas.data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeChargeRow)
    .map((row): Record<string, unknown> => ({
      ...row,
      unidade: unitLabel(row.assoc_unidades),
      responsavel: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas),
      mensagem_whatsapp: buildChargeWhatsappMessage(row, context.companyName)
    }));

  return {
    ...context,
    unidade: {
      ...(unidade.data as Record<string, unknown>),
      loteamento: loteamentoLabel((unidade.data as Record<string, unknown>).assoc_loteamentos)
    },
    vinculos: ((vinculos.data ?? []) as Array<Record<string, unknown>>).map((row): Record<string, unknown> => ({
      ...row,
      pessoa: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas)
    })),
    cobrancasAbertas: chargeRows.filter((row) => OPEN_CHARGE_STATUSES.has(String(row.status))),
    cobrancasPagas: chargeRows.filter((row) => row.status === "paga"),
    cobrancasVencidas: chargeRows.filter(isOverdueCharge),
    documentos: documentos.data ?? [],
    transferencias: ((transferencias.data ?? []) as Array<Record<string, unknown>>).map((row): Record<string, unknown> => ({
      ...row,
      pessoa_anterior: relationName(row.pessoa_anterior),
      nova_pessoa: relationName(row.nova_pessoa)
    })),
    auditoria: auditoria.data ?? [],
    error:
      context.error ??
      vinculos.error?.message ??
      cobrancas.error?.message ??
      documentos.error?.message ??
      transferencias.error?.message ??
      auditoria.error?.message ??
      null
  };
}

export async function getPortalCobrancaDetail(id: string) {
  const context = await getPortalContext(`/portal-associativo/cobrancas/${id}`);
  const cobrancaId = String(id ?? "");
  const empty = {
    ...context,
    cobranca: null,
    documentos: [] as Array<Record<string, unknown>>,
    auditoria: [] as Array<Record<string, unknown>>,
    error: context.error ?? "Cobrança não encontrada."
  };
  if (!context.empresaId || !cobrancaId) return empty;

  const [cobranca, documentos, auditoria] = await Promise.all([
    context.client
      .from("assoc_cobrancas")
      .select("id,loteamento_id,unidade_id,pessoa_responsavel_id,tipo_cobranca,descricao,mes_referencia,ano_referencia,data_vencimento,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,status,forma_pagamento,data_pagamento,pix_copia_cola,comprovante_url,observacoes,motivo_cancelamento,recibo_url,recibo_file_id,recibo_emitido_em,criado_em,atualizado_em,assoc_loteamentos(nome),assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo,whatsapp,email),assoc_comprovantes_pagamento(id,arquivo_id,status,comprovante_url,valor_informado,data_pagamento_informada,observacao_associado,motivo_recusa,enviado_em)")
      .eq("empresa_id", context.empresaId)
      .eq("id", cobrancaId)
      .maybeSingle(),
    context.client
      .from("assoc_arquivos")
      .select("id,file_name,categoria,descricao,provedor,path,shared_url,liberado_associado,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("cobranca_id", cobrancaId)
      .order("criado_em", { ascending: false })
      .limit(100),
    context.client
      .from("assoc_auditoria_logs")
      .select("id,acao,entidade,entidade_id,dados_novos,criado_em")
      .eq("empresa_id", context.empresaId)
      .eq("entidade_id", cobrancaId)
      .order("criado_em", { ascending: false })
      .limit(100)
  ]);

  if (cobranca.error || !cobranca.data?.id) {
    return { ...empty, error: cobranca.error?.message ?? "Cobrança não encontrada." };
  }
  const row = normalizeChargeRow(cobranca.data as Record<string, unknown>);

  return {
    ...context,
    cobranca: {
      ...row,
      loteamento: loteamentoLabel(row.assoc_loteamentos),
      unidade: unitLabel(row.assoc_unidades),
      responsavel: relationName(row.assoc_pessoas),
      whatsapp: relationPhone(row.assoc_pessoas),
      email: relationObject(row.assoc_pessoas)?.email ?? "",
      status_calculado: isOverdueCharge(row) ? "vencida" : row.status,
      mensagem_whatsapp: buildChargeWhatsappMessage(row, context.companyName)
    } as Record<string, unknown>,
    documentos: documentos.data ?? [],
    auditoria: auditoria.data ?? [],
    error: context.error ?? documentos.error?.message ?? auditoria.error?.message ?? null
  };
}

export async function listPortalImportacoes() {
  const context = await getPortalContext("/portal-associativo/importacao");
  const { data, error } = await scopedByEmpresa(
    context.client.from("assoc_importacoes").select("*").order("criado_em", { ascending: false }).limit(50),
    context.empresaId
  );
  return { ...context, rows: data ?? [], error: context.error ?? error?.message ?? null };
}

export function canPortalAccess(perfil: PortalPerfil, section: string) {
  return roleSections[perfil]?.has(section) ?? false;
}

export function normalizePortalPerfil(value: unknown): PortalPerfil {
  const perfil = String(value ?? "").trim().toLowerCase();
  if (perfil in PORTAL_PERFIL_LABELS) return perfil as PortalPerfil;
  if (perfil === "admin_empresa" || perfil === "admin_master" || perfil === "super_admin") return "administrador";
  return "associado";
}

export function unitOptionLabel(row: Record<string, unknown>) {
  const codigo = String(row.codigo_unidade ?? "").trim();
  const numero = String(row.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || String(row.id ?? "");
}

export async function getPortalVinculoDiagnostics() {
  const context = await getPortalContext("/portal-associativo/implantacao");
  const { data, error } = await scopedByEmpresa(
    context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("id,unidade_id,pessoa_id,tipo_vinculo,status_vinculo,data_inicio,data_fim,assoc_unidades(id,codigo_unidade,numero_unidade),assoc_pessoas(id,nome_completo)")
      .order("criado_em", { ascending: true })
      .limit(5000),
    context.empresaId
  );
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const issues: Array<Record<string, unknown>> = [];
  const activeRows = rows.filter((row) => row.status_vinculo === "ativo" && !row.data_fim);
  const duplicateGroups = groupBy(activeRows, (row) => `${row.unidade_id}|${row.pessoa_id}|${row.tipo_vinculo}`);
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    issues.push(buildVinculoIssue("duplicado", "Esta pessoa aparece repetida no mesmo papel.", group));
  }
  for (const tipo of ["proprietario", "responsavel_financeiro", "responsavel_contato"]) {
    const principalGroups = groupBy(activeRows.filter((row) => row.tipo_vinculo === tipo), (row) => String(row.unidade_id));
    for (const group of principalGroups.values()) {
      if (group.length < 2) continue;
      issues.push(buildVinculoIssue("multiplos_principais", `Esta unidade possui mais de um ${portalVinculoLabel(tipo).toLowerCase()}.`, group));
    }
  }
  for (const row of rows) {
    if (row.status_vinculo === "ativo" && row.data_fim) {
      issues.push(buildVinculoIssue("ativo_com_fim", "Vínculo ativo com data de encerramento preenchida.", [row]));
    }
    if (row.status_vinculo === "encerrado" && !row.data_fim) {
      issues.push(buildVinculoIssue("encerrado_sem_fim", "Vínculo encerrado sem data de encerramento.", [row]));
    }
    if (!relationObject(row.assoc_unidades) || !relationObject(row.assoc_pessoas)) {
      issues.push(buildVinculoIssue("referencia_invalida", "Vínculo aponta para pessoa ou unidade inexistente.", [row]));
    }
  }
  return { ...context, issues: uniqueByKey(issues, "key"), error: context.error ?? error?.message ?? null };
}

export function loteamentoOptionLabel(row: Record<string, unknown>) {
  return [row.codigo, row.nome].filter(Boolean).join(" - ") || String(row.id ?? "");
}

export function buildChargeWhatsappMessage(row: Record<string, unknown>, entidade = "associacao") {
  const valor = Number(row.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vencimento = row.data_vencimento ? new Date(String(row.data_vencimento)).toLocaleDateString("pt-BR") : "-";
  const responsavel = String(row.responsavel ?? relationName(row.assoc_pessoas) ?? "").trim();
  const unidade = String(row.unidade ?? unitLabel(row.assoc_unidades) ?? "").trim();
  const pix = row.pix_copia_cola ? `\nPIX copia e cola: ${row.pix_copia_cola}` : "";
  return [
    `Ola${responsavel ? `, ${responsavel}` : ""}!`,
    `Aqui e ${entidade}.`,
    `Identificamos a cobranca "${row.descricao ?? "Mensalidade"}"${unidade ? ` da unidade ${unidade}` : ""}.`,
    `Valor: ${valor}.`,
    `Vencimento: ${vencimento}.`,
    pix ? pix.trim() : "",
    "Se o pagamento ja foi feito, por favor desconsidere esta mensagem ou envie o comprovante para a administracao."
  ].filter(Boolean).join("\n");
}

function scopedByEmpresa(query: any, empresaId: string | null) {
  return empresaId ? query.eq("empresa_id", empresaId) : query.eq("empresa_id", "00000000-0000-0000-0000-000000000000");
}

async function countPortalRows(client: any, table: string, empresaId: string | null, filters: Record<string, unknown> = {}) {
  if (!empresaId) return 0;
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

export function uniqueByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T | string): T[] {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const value = String(row[String(key)] ?? "").trim();
    if (!value || unique.has(value)) continue;
    unique.set(value, row);
  }
  return Array.from(unique.values());
}

export function uniqueById<T extends Record<string, unknown>>(rows: T[]): T[] {
  return uniqueByKey(rows, "id");
}

export function uniqueCharges<T extends Record<string, unknown>>(rows: T[]): T[] {
  return uniqueById(rows);
}

export function uniqueFiles<T extends Record<string, unknown>>(rows: T[]): T[] {
  return uniqueById(rows);
}

export function uniqueUnidadesFromVinculos(vinculos: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const unidadesMap = new Map<string, Record<string, unknown>>();
  for (const vinculo of vinculos) {
    const unidade = relationObject(vinculo.assoc_unidades);
    const unidadeId = String(unidade?.id ?? "").trim();
    if (!unidade || !unidadeId) continue;
    const papel = String(vinculo.tipo_vinculo ?? "").trim();
    const existing = unidadesMap.get(unidadeId) ?? { ...unidade, tipo_vinculos: [], papeis: [] };
    const tipos = new Set(Array.isArray(existing.tipo_vinculos) ? existing.tipo_vinculos.map(String) : []);
    if (papel) tipos.add(papel);
    existing.tipo_vinculos = Array.from(tipos);
    existing.papeis = Array.from(tipos).map(portalVinculoLabel);
    unidadesMap.set(unidadeId, existing);
  }
  return Array.from(unidadesMap.values());
}

function portalVinculoLabel(tipo: string) {
  const labels: Record<string, string> = {
    proprietario: "Proprietário",
    responsavel_financeiro: "Responsável pelo pagamento",
    responsavel_contato: "Responsável de contato",
    morador: "Morador",
    ocupante: "Ocupante",
    antigo_proprietario: "Antigo proprietário"
  };
  return labels[tipo] ?? tipo.replaceAll("_", " ");
}

function groupBy(rows: Array<Record<string, unknown>>, keyFor: (row: Record<string, unknown>) => string) {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function buildVinculoIssue(tipo: string, mensagem: string, rows: Array<Record<string, unknown>>) {
  const first = rows[0] ?? {};
  return {
    key: `${tipo}:${rows.map((row) => String(row.id)).sort().join(",")}`,
    tipo,
    mensagem,
    unidade: unitLabel(first.assoc_unidades),
    papel: portalVinculoLabel(String(first.tipo_vinculo ?? "")),
    candidatos: rows.map((row) => ({
      id: String(row.id ?? ""),
      pessoa: relationName(row.assoc_pessoas) || "Pessoa não encontrada",
      data_inicio: row.data_inicio,
      status_vinculo: row.status_vinculo,
      data_fim: row.data_fim
    }))
  };
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
  const today = startOfToday();
  return Number.isFinite(due.getTime()) && due < today;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function moneyFilter(value: unknown) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value ?? 0);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function clampDayLocal(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(31, Math.trunc(value)));
}

function buildDueDateLocal(year: number, month: number, day: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const dueDay = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
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
  const codigo = String(unit.codigo_unidade ?? "").trim();
  const numero = String(unit.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || "-";
}

function loteamentoLabel(value: unknown) {
  const loteamento = relationObject(value);
  if (!loteamento) return "Sem grupo/condomínio";
  return String(loteamento.nome ?? loteamento.codigo ?? "Sem grupo/condomínio");
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

function noticeMatchesAssociatedAudience(
  row: Record<string, unknown>,
  perfil: PortalPerfil,
  pessoaId: string,
  unidadeIds: Set<string>,
  charges: Array<Record<string, unknown>>
) {
  const publico = String(row.publico ?? "todos");
  if (publico === "todos") return true;
  if (publico === "associados") return true;
  if (publico === "diretoria") return ["administrador", "presidente", "tesoureiro", "secretario", "conselho_fiscal"].includes(perfil);
  if (publico === "inadimplentes") return charges.some(isOverdueCharge);
  if (publico === "adimplentes") return !charges.some(isOverdueCharge);
  if (publico === "pessoa") return String(row.pessoa_id ?? "") === pessoaId;
  if (publico === "perfil" || publico === "por_perfil") {
    const perfis = Array.isArray(row.perfis) ? row.perfis.map(String) : [];
    return perfis.length === 0 || perfis.includes(perfil);
  }
  if (publico === "unidade" || publico === "por_unidade") {
    return unidadeIds.has(String(row.unidade_id ?? ""));
  }
  if (publico === "status_cobranca") {
    const status = String(row.status_cobranca ?? "");
    if (!status) return true;
    if (status === "vencida") return charges.some(isOverdueCharge);
    return charges.some((charge) => String(charge.status ?? "") === status);
  }
  return true;
}

function defaultConfiguracoes(companyName: string) {
  return {
    nome_publico_entidade: companyName === "Todas as empresas" ? "Portal Associativo" : companyName,
    subtitulo: "Gestao integrada de loteamentos, chacaras/lotes, mensalidades e comunicados.",
    logo_url: "",
    tema_visual: "padrao",
    tipo_unidade_padrao: "chacara",
    valor_mensalidade_padrao: 20,
    vencimento_padrao: 10,
    descricao_mensalidade_padrao: "Mensalidade",
    pix_chave: "",
    pix_tipo_chave: "",
    recebedor_nome: "",
    recebedor_cidade: "",
    webhook_url: "",
    storage_provider_ativo: "nenhum",
    assinatura_entidade: "",
    implantacao_concluida: false
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
