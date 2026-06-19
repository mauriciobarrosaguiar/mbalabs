import { createClient } from "@supabase/supabase-js";
import { categoriasJuridicas, type CategoriaJuridica } from "@/data/lexgestor/areas";
import { requireAppAccess, type CurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import { obterPlanoLexGestor, type LexPlanoComercial, type LexUsoPlano } from "./plans";

export type LexCliente = {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  whatsapp: string;
  email: string;
  origem: string;
  status: string;
  endereco: string;
  observacoes: string;
  casosCount: number;
  documentosCount: number;
  ultimoAtendimento: string;
};

export type LexCaso = {
  id: string;
  titulo: string;
  clienteId: string;
  cliente: string;
  clienteDocumento: string;
  clienteContato: string;
  categoria: string;
  subcategoria: string;
  numeroProcesso: string;
  chaveProcesso: string;
  sistemaJudicial: string;
  tribunal: string;
  uf: string;
  comarca: string;
  vara: string;
  classeProcessual: string;
  assunto: string;
  faseProcessual: string;
  grau: string;
  poloAtivo: string;
  poloPassivo: string;
  advogadoResponsavelId: string;
  advogadoResponsavel: string;
  valorCausa: number;
  justicaGratuita: boolean;
  segredoJustica: boolean;
  dataDistribuicao: string;
  proximoPrazo: string;
  tipoPrazo: string;
  linkProcesso: string;
  observacoesProcesso: string;
  relatoInicial: string;
  status: string;
  prioridade: string;
  criadoEm: string;
  checklistTotal: number;
  checklistConcluido: number;
  documentosCount: number;
};

export type LexDocumento = {
  id: string;
  nome: string;
  clienteId: string;
  cliente: string;
  casoId: string;
  caso: string;
  processoId: string;
  movimentacaoId: string;
  categoria: string;
  subcategoria: string;
  tipo: string;
  mimeType: string;
  origem: string;
  observacoes: string;
  status: string;
  provider: string;
  storageFileId: string;
  storagePath: string;
  storageUrl: string;
  pdfFileId: string;
  pdfPath: string;
  pdfUrl: string;
  checklistItemId: string;
  nomeStorage: string;
  dropboxFolderPath: string;
  criadoEm: string;
};

export type LexAdvogado = {
  id: string;
  coreUsuarioId: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp: string;
  oab: string;
  ufOab: string;
  cargo: string;
  perfilAcesso: string;
  status: "Ativo" | "Inativo" | "Pendente";
  observacoes: string;
  casosResponsavelCount: number;
  criadoEm: string;
};

export type LexCoreUsuario = {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  status: string;
};

export type LexStorageConnection = {
  id: string;
  provider: "google_drive" | "dropbox";
  status: string;
  accountEmail: string;
  rootFolderPath: string;
  rootFolderId: string;
  connected: boolean;
};

export type LexDashboardMetric = {
  label: string;
  value: number | string;
  note: string;
};

export type LexWorkspaceData = {
  current: CurrentUserProfile;
  escritorio: Record<string, unknown> | null;
  categorias: CategoriaJuridica[];
  clientes: LexCliente[];
  casos: LexCaso[];
  documentos: LexDocumento[];
  advogados: LexAdvogado[];
  usuariosEmpresa: LexCoreUsuario[];
  storageConnections: LexStorageConnection[];
  plano: LexPlanoComercial;
  usoPlano: LexUsoPlano;
  metrics: LexDashboardMetric[];
  casosPorCategoria: Array<{ label: string; value: number }>;
  casosPorStatus: Array<{ label: string; value: number }>;
  documentosPorStatus: Array<{ label: string; value: number }>;
  produtividadePorAdvogado: Array<{ label: string; value: number }>;
  ultimosClientes: LexCliente[];
  ultimosCasos: LexCaso[];
  ultimosDocumentos: LexDocumento[];
  proximosPrazos: LexCaso[];
  setupSteps: Array<{ label: string; done: boolean; href: string; action: string }>;
  error: string | null;
  isReady: boolean;
  demoMode: boolean;
};

let serviceClient: ReturnType<typeof createClient> | null = null;

export async function getLexWorkspaceData(
  nextPath = "/lexgestor",
  options: { demo?: boolean } = {},
): Promise<LexWorkspaceData> {
  const current = await requireAppAccess("lexgestor", nextPath);
  const client = await getLexSupabaseClient();

  try {
    const escritorio = await ensureLexEscritorio(client, current);
    const escritorioId = text(escritorio?.id);
    const plano = await obterPlanoLexGestor(client, current);

    if (options.demo) {
      return demoWorkspace(current, escritorio, plano);
    }

    if (!escritorioId) {
      return emptyWorkspace(current, "Configure o escritório antes de usar dados reais do LexGestor.");
    }

    const [
      categorias,
      clientesRows,
      casosRows,
      documentosRows,
      checklistRows,
      storageRows,
      advogadosRows,
      usuariosEmpresaRows,
    ] = await Promise.all([
      listCategorias(client, escritorioId),
      listClientesRows(client, escritorioId),
      listCasosRows(client, escritorioId),
      listDocumentosRows(client, escritorioId),
      listChecklistRows(client, escritorioId),
      listStorageConnectionsRows(client, escritorioId),
      listAdvogadosRows(client, escritorioId),
      listUsuariosEmpresaRows(client, current),
    ]);

    const clientes = mapClientes(clientesRows, casosRows, documentosRows);
    const advogados = mapAdvogados(advogadosRows, casosRows);
    const casos = mapCasos(casosRows, documentosRows, checklistRows, categorias, advogadosRows);
    const documentos = mapDocumentos(documentosRows, casosRows, clientesRows);
    const storageConnections = mapStorageConnections(storageRows);

    return buildWorkspaceVendido({
      current,
      escritorio,
      categorias,
      clientes,
      casos,
      documentos,
      advogados,
      usuariosEmpresa: mapUsuariosEmpresa(usuariosEmpresaRows),
      storageConnections,
      plano,
      error: null,
      isReady: true,
      demoMode: false,
    });
  } catch (error) {
    return emptyWorkspace(current, errorMessage(error));
  }
}

export async function getLexSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    if (!serviceClient) {
      serviceClient = createClient(url, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    return serviceClient as any;
  }

  return (await getSupabaseServer()) as any;
}

export async function ensureLexEscritorio(client: any, current: CurrentUserProfile) {
  if (!current.empresaId) {
    return null;
  }

  const existing = await client
    .from("lex_escritorios")
    .select("*")
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data as Record<string, unknown>;
  }

  const empresa = await client
    .from("core_empresas")
    .select("nome,nome_fantasia,cnpj,telefone,whatsapp,email,cidade,estado")
    .eq("id", current.empresaId)
    .maybeSingle();

  const empresaData = (empresa.data ?? {}) as Record<string, unknown>;
  const payload = {
    empresa_id: current.empresaId,
    nome: text(empresaData.nome_fantasia) || text(empresaData.nome) || "Escritorio",
    cnpj: nullableText(empresaData.cnpj),
    telefone: nullableText(empresaData.telefone),
    whatsapp: nullableText(empresaData.whatsapp),
    email: nullableText(empresaData.email),
    endereco: [empresaData.cidade, empresaData.estado].filter(Boolean).join("/") || null,
    watermark_text: `${text(empresaData.nome_fantasia) || text(empresaData.nome) || "LexGestor"} - uso restrito`,
  };

  const created = await client.from("lex_escritorios").insert(payload).select("*").single();
  if (created.error) {
    throw created.error;
  }

  return created.data as Record<string, unknown>;
}

export function storageProviderLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "Armazenamento";
}

function buildWorkspace({
  current,
  escritorio,
  categorias,
  clientes,
  casos,
  documentos,
  storageConnections,
  error,
  isReady,
}: {
  current: CurrentUserProfile;
  escritorio: Record<string, unknown> | null;
  categorias: CategoriaJuridica[];
  clientes: LexCliente[];
  casos: LexCaso[];
  documentos: LexDocumento[];
  storageConnections: LexStorageConnection[];
  error: string | null;
  isReady: boolean;
}): any {
  const openCases = casos.filter((caso) => !["Finalizado", "Arquivado"].includes(caso.status));
  const pendingDocuments = documentos.filter((documento) =>
    ["Pendente", "Falha no envio", "Original indisponível", "Precisa reenviar arquivo"].includes(documento.status),
  );
  const pdfsGerados = documentos.filter((documento) => documento.status === "PDF gerado" || documento.pdfUrl || documento.pdfPath);
  const sentDocuments = documentos.filter((documento) =>
    ["Enviado ao Drive", "Enviado ao Dropbox", "PDF gerado"].includes(documento.status) ||
    Boolean(documento.storagePath || documento.storageUrl || documento.pdfPath || documento.pdfUrl),
  );
  const proximosPrazos = casos
    .filter((caso) => isPrazoProximo(caso.proximoPrazo))
    .sort((a, b) => a.proximoPrazo.localeCompare(b.proximoPrazo));

  return {
    current,
    escritorio,
    categorias,
    clientes,
    casos,
    documentos,
    storageConnections,
    metrics: [
      { label: "Clientes cadastrados", value: clientes.length, note: "Registros reais" },
      { label: "Casos abertos", value: openCases.length, note: "Não finalizados" },
      { label: "Documentos enviados", value: sentDocuments.length || pdfsGerados.length, note: "Arquivos no armazenamento" },
      { label: "Documentos pendentes", value: pendingDocuments.length, note: "Precisam de revisão" },
      { label: "Próximos prazos", value: proximosPrazos.length, note: "15 dias" },
    ],
    casosPorCategoria: countBy(casos, "categoria"),
    casosPorStatus: countBy(casos, "status"),
    documentosPorStatus: countBy(documentos, "status"),
    ultimosClientes: clientes.slice(0, 6),
    ultimosCasos: casos.slice(0, 6),
    ultimosDocumentos: documentos.slice(0, 6),
    proximosPrazos: proximosPrazos.slice(0, 6),
    setupSteps: [
      { label: "Configure seu escritório", done: Boolean(escritorio), href: "/lexgestor/configuracoes", action: "Configurar agora" },
      {
        label: "Conecte Google Drive ou Dropbox",
        done: storageConnections.some((connection) => connection.connected),
        href: "/lexgestor/configuracoes#armazenamento",
        action: "Conectar armazenamento",
      },
      { label: "Cadastre o primeiro cliente", done: clientes.length > 0, href: "/lexgestor/clientes/novo", action: "Novo cliente" },
      { label: "Abra um caso", done: casos.length > 0, href: "/lexgestor/casos/novo", action: "Abrir caso" },
      { label: "Anexe documentos", done: documentos.length > 0, href: "/lexgestor/documentos", action: "Anexar documentos" },
      {
        label: "Gere o primeiro dossiê",
        done: pdfsGerados.length > 0,
        href: "/lexgestor/relatorios",
        action: "Gerar dossiê",
      },
    ],
    error,
    isReady,
  };
}

function emptyWorkspace(current: CurrentUserProfile, error: string | null): LexWorkspaceData {
  return buildWorkspaceVendido({
    current,
    escritorio: null,
    categorias: categoriasJuridicas,
    clientes: [],
    casos: [],
    documentos: [],
    advogados: [],
    usuariosEmpresa: [],
    storageConnections: [],
    plano: {
      slug: "profissional",
      nome: "Plano Profissional",
      limiteAdvogados: 8,
      limiteClientes: 300,
      limiteCasosAtivos: 180,
      limiteDocumentos: 2500,
      permiteDossie: true,
      permiteRelatorios: true,
      suportePrioritario: false,
    },
    error,
    isReady: false,
  });
}

function buildWorkspaceVendido({
  current,
  escritorio,
  categorias,
  clientes,
  casos,
  documentos,
  advogados,
  usuariosEmpresa,
  storageConnections,
  plano,
  error,
  isReady,
  demoMode = false,
}: {
  current: CurrentUserProfile;
  escritorio: Record<string, unknown> | null;
  categorias: CategoriaJuridica[];
  clientes: LexCliente[];
  casos: LexCaso[];
  documentos: LexDocumento[];
  advogados: LexAdvogado[];
  usuariosEmpresa: LexCoreUsuario[];
  storageConnections: LexStorageConnection[];
  plano: LexPlanoComercial;
  error: string | null;
  isReady: boolean;
  demoMode?: boolean;
}): LexWorkspaceData {
  const openCases = casos.filter((caso) => !["Finalizado", "Arquivado"].includes(caso.status));
  const pendingDocuments = documentos.filter((documento) =>
    ["Pendente", "Falha no envio", "Original indisponível", "Precisa reenviar arquivo"].includes(documento.status),
  );
  const pdfsGerados = documentos.filter((documento) => documento.status === "PDF gerado" || documento.pdfUrl || documento.pdfPath);
  const sentDocuments = documentos.filter((documento) =>
    ["Enviado ao Drive", "Enviado ao Dropbox", "PDF gerado"].includes(documento.status) ||
    Boolean(documento.storagePath || documento.storageUrl || documento.pdfPath || documento.pdfUrl),
  );
  const proximosPrazos = casos
    .filter((caso) => isPrazoProximo(caso.proximoPrazo))
    .sort((a, b) => a.proximoPrazo.localeCompare(b.proximoPrazo));

  return {
    current,
    escritorio,
    categorias,
    clientes,
    casos,
    documentos,
    advogados,
    usuariosEmpresa,
    storageConnections,
    plano,
    usoPlano: {
      advogados: advogados.filter((advogado) => advogado.status !== "Inativo").length,
      clientes: clientes.length,
      casosAtivos: openCases.length,
      documentos: documentos.length,
    },
    metrics: [
      { label: "Clientes cadastrados", value: clientes.length, note: demoMode ? "Dados fictícios" : "Registros reais" },
      { label: "Casos ativos", value: openCases.length, note: "Não finalizados" },
      { label: "Documentos enviados", value: sentDocuments.length || pdfsGerados.length, note: "Arquivos no armazenamento" },
      { label: "Documentos pendentes", value: pendingDocuments.length, note: "Precisam de revisão" },
      { label: "Próximos prazos", value: proximosPrazos.length, note: "15 dias" },
      { label: "Profissionais ativos", value: advogados.filter((advogado) => advogado.status === "Ativo").length, note: "Equipe ativa" },
    ],
    casosPorCategoria: countBy(casos, "categoria"),
    casosPorStatus: countBy(casos, "status"),
    documentosPorStatus: countBy(documentos, "status"),
    produtividadePorAdvogado: countBy(casos, "advogadoResponsavel"),
    ultimosClientes: clientes.slice(0, 6),
    ultimosCasos: casos.slice(0, 6),
    ultimosDocumentos: documentos.slice(0, 6),
    proximosPrazos: proximosPrazos.slice(0, 6),
    setupSteps: [
      { label: "Dados do escritório", done: Boolean(escritorio), href: "/lexgestor/configuracoes", action: "Completar dados" },
      {
        label: "Dropbox do escritório",
        done: storageConnections.some((connection) => connection.connected),
        href: "/lexgestor/configuracoes#armazenamento",
        action: "Conectar",
      },
      {
        label: "Equipe jurídica",
        done: advogados.some((advogado) => advogado.status === "Ativo"),
        href: "/lexgestor/equipe",
        action: "Cadastrar equipe",
      },
    ],
    error,
    isReady,
    demoMode,
  };
}

async function listCategorias(client: any, escritorioId: string): Promise<CategoriaJuridica[]> {
  const categorias = await client
    .from("lex_categorias")
    .select("id,nome,ordem,lex_subcategorias(id,nome,ordem)")
    .or(`escritorio_id.is.null${escritorioId ? `,escritorio_id.eq.${escritorioId}` : ""}`)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (categorias.error || !Array.isArray(categorias.data) || categorias.data.length === 0) {
    return categoriasJuridicas;
  }

  return categorias.data.map((row: any, index: number) => {
    const subcategorias: Array<{ nome: string; ordem: number }> = (Array.isArray(row.lex_subcategorias) ? row.lex_subcategorias : [])
      .sort((a: any, b: any) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
      .map((sub: any, subIndex: number) => ({
        nome: text(sub.nome),
        ordem: Number(sub.ordem ?? subIndex + 1),
      }));

    return {
      nome: text(row.nome),
      resumo: categoriasJuridicas.find((categoria) => categoria.nome === row.nome)?.resumo ?? "Categoria juridica.",
      cor: "azul",
      ordem: Number(row.ordem ?? index + 1),
      subareas: subcategorias.map((sub: { nome: string }) => sub.nome),
      subcategorias,
    };
  });
}

async function listClientesRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];
  let query = client.from("lex_clientes").select("*").order("criado_em", { ascending: false }).limit(300);
  if (escritorioId) query = query.eq("escritorio_id", escritorioId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listCasosRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];
  let query = client
    .from("lex_casos")
    .select("*,lex_clientes(id,nome,cpf_cnpj,telefone,whatsapp,email)")
    .order("criado_em", { ascending: false })
    .limit(300);
  if (escritorioId) query = query.eq("escritorio_id", escritorioId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listDocumentosRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];
  let query = client
    .from("lex_documentos")
    .select("*,lex_clientes(id,nome),lex_casos(id,titulo)")
    .order("criado_em", { ascending: false })
    .limit(300);
  if (escritorioId) query = query.eq("escritorio_id", escritorioId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listChecklistRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];
  let query = client.from("lex_checklist_respostas").select("*").limit(1000);
  if (escritorioId) query = query.eq("escritorio_id", escritorioId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listStorageConnectionsRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];

  const storage = await client
    .from("lex_storage_connections")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .order("updated_at", { ascending: false });

  if (!storage.error) {
    return (storage.data ?? []) as Array<Record<string, unknown>>;
  }

  const legacy = await client
    .from("lex_dropbox_conexoes")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .order("atualizado_em", { ascending: false });

  return (legacy.data ?? []) as Array<Record<string, unknown>>;
}

async function listAdvogadosRows(client: any, escritorioId: string) {
  if (!escritorioId) return [];

  const { data, error } = await client
    .from("lex_advogados")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .order("nome", { ascending: true });

  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listUsuariosEmpresaRows(client: any, current: CurrentUserProfile) {
  if (!current.empresaId) return [];

  const { data, error } = await client
    .from("core_usuarios")
    .select("id,nome,email,tipo,status")
    .eq("empresa_id", current.empresaId)
    .eq("status", "ativo")
    .order("nome", { ascending: true })
    .limit(200);

  if (error) return [];
  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const tipo = text(row.tipo);
    return tipo !== "super_admin" && tipo !== "admin_master";
  });

  const appId = await resolveLexGestorAppId(client);
  if (!appId) return rows;

  const permissions = await client
    .from("core_usuario_app_permissoes")
    .select("usuario_id,status")
    .eq("empresa_id", current.empresaId)
    .eq("app_id", appId)
    .in("status", ["ativo", "teste"]);

  if (permissions.error) return rows;

  const allowedUsers = new Set(((permissions.data ?? []) as Array<Record<string, unknown>>).map((row) => text(row.usuario_id)));
  return rows.filter((row) => allowedUsers.has(text(row.id)));
}

async function resolveLexGestorAppId(client: any) {
  const { data, error } = await client
    .from("core_apps")
    .select("id")
    .in("slug", ["lexgestor", "lex-gestor"])
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return "";
  return text(data.id);
}

function mapClientes(
  clientes: Array<Record<string, unknown>>,
  casos: Array<Record<string, unknown>>,
  documentos: Array<Record<string, unknown>>,
): LexCliente[] {
  return clientes.map((cliente) => {
    const clienteId = text(cliente.id);
    const relatedCases = casos.filter((caso) => text(caso.cliente_id) === clienteId);
    const relatedDocuments = documentos.filter((documento) => text(documento.cliente_id) === clienteId);

    return {
      id: clienteId,
      nome: text(cliente.nome) || "Cliente sem nome",
      cpfCnpj: text(cliente.cpf_cnpj) || "-",
      telefone: text(cliente.telefone) || "-",
      whatsapp: text(cliente.whatsapp) || text(cliente.telefone) || "-",
      email: text(cliente.email) || "-",
      origem: text(cliente.origem) || "Atendimento",
      status: text(cliente.status) || "Ativo",
      endereco: text(cliente.endereco) || "-",
      observacoes: text(cliente.observacoes),
      casosCount: relatedCases.length,
      documentosCount: relatedDocuments.length,
      ultimoAtendimento: text(cliente.updated_at) || text(cliente.criado_em),
    };
  });
}

function mapAdvogados(
  advogados: Array<Record<string, unknown>>,
  casos: Array<Record<string, unknown>>,
): LexAdvogado[] {
  return advogados.map((advogado) => {
    const advogadoId = text(advogado.id);
    const ativo = advogado.ativo !== false;
    const statusRaw = text(advogado.status);
    const status: LexAdvogado["status"] =
      statusRaw === "pendente"
        ? "Pendente"
        : ativo && statusRaw !== "inativo"
          ? "Ativo"
          : "Inativo";

    return {
      id: advogadoId,
      coreUsuarioId: text(advogado.core_usuario_id),
      nome: text(advogado.nome) || "Profissional sem nome",
      email: text(advogado.email),
      telefone: text(advogado.telefone),
      whatsapp: text(advogado.whatsapp) || text(advogado.telefone),
      oab: text(advogado.oab),
      ufOab: text(advogado.uf_oab),
      cargo: text(advogado.cargo),
      perfilAcesso: text(advogado.perfil_acesso) || "advogado",
      status,
      observacoes: text(advogado.observacoes),
      casosResponsavelCount: casos.filter((caso) => text(caso.advogado_responsavel_id) === advogadoId).length,
      criadoEm: text(advogado.criado_em),
    };
  });
}

function mapUsuariosEmpresa(rows: Array<Record<string, unknown>>): LexCoreUsuario[] {
  return rows.map((row) => ({
    id: text(row.id),
    nome: text(row.nome) || text(row.email) || "Usuário",
    email: text(row.email),
    tipo: text(row.tipo) || "usuario",
    status: text(row.status) || "ativo",
  }));
}

function mapCasos(
  casos: Array<Record<string, unknown>>,
  documentos: Array<Record<string, unknown>>,
  checklistRows: Array<Record<string, unknown>>,
  categorias: CategoriaJuridica[],
  advogadosRows: Array<Record<string, unknown>>,
): LexCaso[] {
  return casos.map((caso) => {
    const cliente = relationObject(caso.lex_clientes);
    const casoId = text(caso.id);
    const checklist = checklistRows.filter((row) => text(row.caso_id) === casoId);
    const categoria = text(caso.categoria_nome) || text(caso.area) || categoryNameById(categorias, caso.categoria_id);
    const subcategoria = text(caso.subcategoria_nome) || text(caso.subarea) || "-";
    const advogadoResponsavelId = text(caso.advogado_responsavel_id);
    const advogado = advogadosRows.find((row) => text(row.id) === advogadoResponsavelId);

    return {
      id: casoId,
      titulo: text(caso.titulo) || "Caso sem titulo",
      clienteId: text(caso.cliente_id),
      cliente: text(cliente?.nome) || "Cliente",
      clienteDocumento: text(cliente?.cpf_cnpj) || "-",
      clienteContato: text(cliente?.whatsapp) || text(cliente?.telefone) || "-",
      categoria,
      subcategoria,
      numeroProcesso: text(caso.numero_processo),
      chaveProcesso: text(caso.chave_processo),
      sistemaJudicial: text(caso.sistema_judicial),
      tribunal: text(caso.tribunal),
      uf: text(caso.uf),
      comarca: text(caso.comarca),
      vara: text(caso.vara),
      classeProcessual: text(caso.classe_processual),
      assunto: text(caso.assunto),
      faseProcessual: text(caso.fase_processual),
      grau: text(caso.grau),
      poloAtivo: text(caso.polo_ativo),
      poloPassivo: text(caso.polo_passivo),
      advogadoResponsavelId,
      advogadoResponsavel: text(advogado?.nome) || text(caso.advogado_responsavel) || "Sem responsável",
      valorCausa: Number(caso.valor_causa ?? 0),
      justicaGratuita: Boolean(caso.justica_gratuita),
      segredoJustica: Boolean(caso.segredo_justica),
      dataDistribuicao: text(caso.data_distribuicao),
      proximoPrazo: text(caso.proximo_prazo),
      tipoPrazo: text(caso.tipo_prazo),
      linkProcesso: text(caso.link_processo),
      observacoesProcesso: text(caso.observacoes_processo),
      relatoInicial: text(caso.relato_inicial),
      status: text(caso.status) || "Atendimento inicial",
      prioridade: text(caso.prioridade) || "Normal",
      criadoEm: text(caso.criado_em),
      checklistTotal: checklist.length,
      checklistConcluido: checklist.filter((item) =>
        ["recebido", "conferido", "nao_se_aplica"].includes(text(item.status)),
      ).length,
      documentosCount: documentos.filter((documento) => text(documento.caso_id) === casoId).length,
    };
  });
}

function mapDocumentos(
  documentos: Array<Record<string, unknown>>,
  casos: Array<Record<string, unknown>>,
  clientes: Array<Record<string, unknown>>,
): LexDocumento[] {
  return documentos.map((documento) => {
    const caso = relationObject(documento.lex_casos) ?? casos.find((row) => text(row.id) === text(documento.caso_id));
    const cliente = relationObject(documento.lex_clientes) ?? clientes.find((row) => text(row.id) === text(documento.cliente_id));
    const provider = text(documento.storage_provider) || text(documento.provider) || (text(documento.dropbox_path_original) ? "dropbox" : "");
    const pdfPath = text(documento.pdf_storage_path) || text(documento.dropbox_path_pdf_marca_dagua);

    return {
      id: text(documento.id),
      nome: text(documento.nome_documento) || text(documento.nome_original) || text(documento.nome_arquivo_sistema) || "Documento",
      clienteId: text(documento.cliente_id),
      cliente: text(cliente?.nome) || "-",
      casoId: text(documento.caso_id),
      caso: text(caso?.titulo) || "-",
      processoId: text(documento.processo_id),
      movimentacaoId: text(documento.movimentacao_id),
      categoria: text(documento.categoria) || text(documento.categoria_nome) || text(documento.area) || "-",
      subcategoria: text(documento.subcategoria) || text(documento.subcategoria_nome) || text(documento.subarea) || "-",
      tipo: text(documento.tipo_documento) || "Documento",
      mimeType: text(documento.mime_type),
      origem: text(documento.origem) || "Upload",
      observacoes: text(documento.observacoes),
      status: statusDocumento(text(documento.status), provider),
      provider,
      storageFileId: text(documento.storage_file_id) || text(documento.dropbox_file_id),
      storagePath: text(documento.storage_path) || text(documento.caminho_original) || text(documento.dropbox_path_original),
      storageUrl: text(documento.storage_url),
      pdfFileId: text(documento.pdf_storage_file_id),
      pdfPath: text(documento.caminho_pdf) || pdfPath,
      pdfUrl: text(documento.pdf_storage_url),
      checklistItemId: text(documento.checklist_item_id),
      nomeStorage: text(documento.nome_storage) || text(documento.nome_arquivo_sistema),
      dropboxFolderPath: text(documento.dropbox_folder_path),
      criadoEm: text(documento.criado_em),
    };
  });
}

function mapStorageConnections(rows: Array<Record<string, unknown>>): LexStorageConnection[] {
  return rows.map((row) => {
    const provider = text(row.provider) || "dropbox";
    const status = text(row.status) || "nao_conectado";

    return {
      id: text(row.id),
      provider: provider === "google_drive" ? "google_drive" : "dropbox",
      status,
      accountEmail: text(row.account_email) || text(row.dropbox_email),
      rootFolderPath: text(row.root_folder_path) || "/LexGestor",
      rootFolderId: text(row.root_folder_id),
      connected: status === "conectado",
    };
  });
}

function statusDocumento(status: string, provider: string) {
  const normalized: Record<string, string> = {
    metadados_criados: "Pendente",
    pendente: "Pendente",
    original_salvo: provider === "google_drive" ? "Enviado ao Drive" : "Enviado ao Dropbox",
    pdf_gerado: "PDF gerado",
    erro_envio: "Falha no envio",
    falha_envio: "Falha no envio",
    precisa_reenviar: "Precisa reenviar arquivo",
    original_indisponivel: "Precisa reenviar arquivo",
    reenviado: provider === "google_drive" ? "Enviado ao Drive" : "Enviado ao Dropbox",
    substituido_reenviado: "Substituído",
    arquivado: "Arquivado",
    validado: "Validado pelo advogado",
    excluido: "Excluido",
  };

  if (status === "enviado" && provider === "google_drive") return "Enviado ao Drive";
  if (status === "enviado" && provider === "dropbox") return "Enviado ao Dropbox";
  return normalized[status] ?? (status || "Pendente");
}

function demoWorkspace(
  current: CurrentUserProfile,
  escritorio: Record<string, unknown> | null,
  plano: LexPlanoComercial,
): LexWorkspaceData {
  const demoEscritorio = escritorio ?? {
    nome: "Demo Advocacia",
    cnpj: "00.000.000/0001-00",
    email: "contato@demo.adv.br",
    whatsapp: "(11) 90000-0000",
    watermark_text: "Demo Advocacia - apresentação comercial",
  };
  const clientes: LexCliente[] = [
    {
      id: "demo-cliente-1",
      nome: "Cliente Demonstração",
      cpfCnpj: "000.000.000-00",
      telefone: "(11) 3000-0000",
      whatsapp: "(11) 90000-0000",
      email: "cliente.demo@email.com",
      origem: "Apresentação comercial",
      status: "Ativo",
      endereco: "São Paulo/SP",
      observacoes: "Cliente fictício para demonstração segura.",
      casosCount: 2,
      documentosCount: 4,
      ultimoAtendimento: new Date().toISOString(),
    },
  ];
  const advogados: LexAdvogado[] = [
    {
      id: "demo-adv-1",
      coreUsuarioId: "",
      nome: "Dra. Ana Demo",
      email: "ana.demo@demo.adv.br",
      telefone: "(11) 3000-0001",
      whatsapp: "(11) 90000-0001",
      oab: "123456",
      ufOab: "SP",
      cargo: "Sócia responsável",
      perfilAcesso: "dono",
      status: "Ativo",
      observacoes: "Usuária fictícia para apresentação.",
      casosResponsavelCount: 2,
      criadoEm: new Date().toISOString(),
    },
  ];
  const casos: LexCaso[] = [
    {
      id: "demo-caso-1",
      titulo: "Revisão de benefício previdenciário",
      clienteId: clientes[0].id,
      cliente: clientes[0].nome,
      clienteDocumento: clientes[0].cpfCnpj,
      clienteContato: clientes[0].whatsapp,
      categoria: "Previdenciário",
      subcategoria: "Revisão de benefício",
      numeroProcesso: "5000000-00.2026.4.03.0000",
      chaveProcesso: "DEMO-EPROC",
      sistemaJudicial: "eproc",
      tribunal: "TRF3",
      uf: "SP",
      comarca: "São Paulo",
      vara: "1ª Vara Federal",
      classeProcessual: "Procedimento comum",
      assunto: "Benefício previdenciário",
      faseProcessual: "Atendimento inicial",
      grau: "1º grau",
      poloAtivo: clientes[0].nome,
      poloPassivo: "INSS",
      advogadoResponsavelId: advogados[0].id,
      advogadoResponsavel: advogados[0].nome,
      valorCausa: 45000,
      justicaGratuita: true,
      segredoJustica: false,
      dataDistribuicao: "2026-06-01",
      proximoPrazo: soonDate(7),
      tipoPrazo: "Juntar documentos",
      linkProcesso: "",
      observacoesProcesso: "Caso fictício para apresentação.",
      relatoInicial: "Cliente relata benefício concedido com cálculo inferior ao esperado.",
      status: "Em andamento",
      prioridade: "Alta",
      criadoEm: new Date().toISOString(),
      checklistTotal: 6,
      checklistConcluido: 4,
      documentosCount: 4,
    },
  ];
  const documentos: LexDocumento[] = [
    {
      id: "demo-doc-1",
      nome: "CNIS demonstração.pdf",
      clienteId: clientes[0].id,
      cliente: clientes[0].nome,
      casoId: casos[0].id,
      caso: casos[0].titulo,
      processoId: "",
      movimentacaoId: "",
      categoria: "Documentos pessoais",
      subcategoria: "Previdenciário",
      tipo: "CNIS",
      mimeType: "application/pdf",
      origem: "Demo",
      observacoes: "Documento fictício.",
      status: "Enviado ao Dropbox",
      provider: "dropbox",
      storageFileId: "",
      storagePath: "/LexGestor/Demo/CNIS-demonstracao.pdf",
      storageUrl: "",
      pdfFileId: "",
      pdfPath: "",
      pdfUrl: "",
      checklistItemId: "",
      nomeStorage: "",
      dropboxFolderPath: "",
      criadoEm: new Date().toISOString(),
    },
    {
      id: "demo-doc-2",
      nome: "Comprovante de residência.png",
      clienteId: clientes[0].id,
      cliente: clientes[0].nome,
      casoId: casos[0].id,
      caso: casos[0].titulo,
      processoId: "",
      movimentacaoId: "",
      categoria: "Documentos pessoais",
      subcategoria: "Cadastro",
      tipo: "Comprovante",
      mimeType: "image/png",
      origem: "Demo",
      observacoes: "Documento fictício.",
      status: "Pendente de reenvio",
      provider: "",
      storageFileId: "",
      storagePath: "",
      storageUrl: "",
      pdfFileId: "",
      pdfPath: "",
      pdfUrl: "",
      checklistItemId: "",
      nomeStorage: "",
      dropboxFolderPath: "",
      criadoEm: new Date().toISOString(),
    },
  ];

  return buildWorkspaceVendido({
    current,
    escritorio: demoEscritorio,
    categorias: categoriasJuridicas,
    clientes,
    casos,
    documentos,
    advogados,
    usuariosEmpresa: [],
    storageConnections: [
      {
        id: "demo-dropbox",
        provider: "dropbox",
        status: "conectado",
        accountEmail: "dropbox@demo.adv.br",
        rootFolderPath: "/LexGestor/Demo",
        rootFolderId: "",
        connected: true,
      },
    ],
    plano,
    error: null,
    isReady: true,
    demoMode: true,
  });
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = text(row[key]) || "Sem informacao";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function soonDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isPrazoProximo(value: string) {
  if (!value) return false;
  const prazo = new Date(value);
  if (Number.isNaN(prazo.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 15);
  return prazo >= today && prazo <= limit;
}

function categoryNameById(categorias: CategoriaJuridica[], categoryId: unknown) {
  const id = text(categoryId);
  return categorias.find((categoria) => text((categoria as any).id) === id)?.nome ?? "-";
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function nullableText(value: unknown) {
  const result = text(value).trim();
  return result ? result : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao carregar dados do LexGestor.";
}
