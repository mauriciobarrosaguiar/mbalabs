import { createClient } from "@supabase/supabase-js";
import { categoriasJuridicas, type CategoriaJuridica } from "@/data/lexgestor/areas";
import { requireAppAccess, type CurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

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
  categoria: string;
  subcategoria: string;
  tipo: string;
  origem: string;
  status: string;
  provider: string;
  storagePath: string;
  storageUrl: string;
  pdfPath: string;
  pdfUrl: string;
  criadoEm: string;
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
  storageConnections: LexStorageConnection[];
  metrics: LexDashboardMetric[];
  casosPorCategoria: Array<{ label: string; value: number }>;
  casosPorStatus: Array<{ label: string; value: number }>;
  documentosPorStatus: Array<{ label: string; value: number }>;
  ultimosClientes: LexCliente[];
  ultimosCasos: LexCaso[];
  ultimosDocumentos: LexDocumento[];
  proximosPrazos: LexCaso[];
  setupSteps: Array<{ label: string; done: boolean; href: string; action: string }>;
  error: string | null;
  isReady: boolean;
};

let serviceClient: ReturnType<typeof createClient> | null = null;

export async function getLexWorkspaceData(nextPath = "/lexgestor"): Promise<LexWorkspaceData> {
  const current = await requireAppAccess("lexgestor", nextPath);
  const client = await getLexSupabaseClient();

  try {
    const escritorio = await ensureLexEscritorio(client, current);
    const escritorioId = text(escritorio?.id);

    if (!escritorioId && !current.isAdminMaster) {
      return emptyWorkspace(current, "Configure o escritorio antes de gravar dados do LexGestor.");
    }

    const [categorias, clientesRows, casosRows, documentosRows, checklistRows, storageRows] =
      await Promise.all([
        listCategorias(client, escritorioId),
        listClientesRows(client, escritorioId, current.isAdminMaster),
        listCasosRows(client, escritorioId, current.isAdminMaster),
        listDocumentosRows(client, escritorioId, current.isAdminMaster),
        listChecklistRows(client, escritorioId, current.isAdminMaster),
        listStorageConnectionsRows(client, escritorioId),
      ]);

    const clientes = mapClientes(clientesRows, casosRows, documentosRows);
    const casos = mapCasos(casosRows, documentosRows, checklistRows, categorias);
    const documentos = mapDocumentos(documentosRows, casosRows, clientesRows);
    const storageConnections = mapStorageConnections(storageRows);

    return buildWorkspace({
      current,
      escritorio,
      categorias,
      clientes,
      casos,
      documentos,
      storageConnections,
      error: null,
      isReady: true,
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
}): LexWorkspaceData {
  const openCases = casos.filter((caso) => !["Finalizado", "Arquivado"].includes(caso.status));
  const aguardandoDocs = casos.filter((caso) => caso.status === "Aguardando documentos");
  const pendingDocuments = documentos.filter((documento) =>
    ["Pendente", "Erro no envio", "Precisa reenviar"].includes(documento.status),
  );
  const pdfsGerados = documentos.filter((documento) => documento.status === "PDF gerado" || documento.pdfUrl || documento.pdfPath);
  const protocolados = casos.filter((caso) => caso.status === "Protocolado");
  const finalizados = casos.filter((caso) => caso.status === "Finalizado");
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
      { label: "Casos abertos", value: openCases.length, note: "Nao finalizados" },
      { label: "Aguardando documentos", value: aguardandoDocs.length, note: "Proxima acao" },
      { label: "Documentos pendentes", value: pendingDocuments.length, note: "Faltam arquivos" },
      { label: "PDFs gerados", value: pdfsGerados.length, note: "Com marca d'agua" },
      { label: "Prazos proximos", value: proximosPrazos.length, note: "15 dias" },
      { label: "Protocolados", value: protocolados.length, note: "Processo iniciado" },
      { label: "Finalizados", value: finalizados.length, note: "Casos encerrados" },
    ],
    casosPorCategoria: countBy(casos, "categoria"),
    casosPorStatus: countBy(casos, "status"),
    documentosPorStatus: countBy(documentos, "status"),
    ultimosClientes: clientes.slice(0, 6),
    ultimosCasos: casos.slice(0, 6),
    ultimosDocumentos: documentos.slice(0, 6),
    proximosPrazos: proximosPrazos.slice(0, 6),
    setupSteps: [
      { label: "Configure seu escritorio", done: Boolean(escritorio), href: "/lexgestor/configuracoes", action: "Configurar agora" },
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
        label: "Gere o primeiro dossie",
        done: pdfsGerados.length > 0,
        href: "/lexgestor/relatorios",
        action: "Gerar dossie",
      },
    ],
    error,
    isReady,
  };
}

function emptyWorkspace(current: CurrentUserProfile, error: string | null): LexWorkspaceData {
  return buildWorkspace({
    current,
    escritorio: null,
    categorias: categoriasJuridicas,
    clientes: [],
    casos: [],
    documentos: [],
    storageConnections: [],
    error,
    isReady: false,
  });
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

async function listClientesRows(client: any, escritorioId: string, global: boolean) {
  if (!escritorioId && !global) return [];
  let query = client.from("lex_clientes").select("*").order("criado_em", { ascending: false }).limit(300);
  if (escritorioId) query = query.eq("escritorio_id", escritorioId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function listCasosRows(client: any, escritorioId: string, global: boolean) {
  if (!escritorioId && !global) return [];
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

async function listDocumentosRows(client: any, escritorioId: string, global: boolean) {
  if (!escritorioId && !global) return [];
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

async function listChecklistRows(client: any, escritorioId: string, global: boolean) {
  if (!escritorioId && !global) return [];
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

function mapCasos(
  casos: Array<Record<string, unknown>>,
  documentos: Array<Record<string, unknown>>,
  checklistRows: Array<Record<string, unknown>>,
  categorias: CategoriaJuridica[],
): LexCaso[] {
  return casos.map((caso) => {
    const cliente = relationObject(caso.lex_clientes);
    const casoId = text(caso.id);
    const checklist = checklistRows.filter((row) => text(row.caso_id) === casoId);
    const categoria = text(caso.categoria_nome) || text(caso.area) || categoryNameById(categorias, caso.categoria_id);
    const subcategoria = text(caso.subcategoria_nome) || text(caso.subarea) || "-";

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
      advogadoResponsavel: text(caso.advogado_responsavel),
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
    const provider = text(documento.storage_provider) || (text(documento.dropbox_path_original) ? "dropbox" : "");
    const pdfPath = text(documento.pdf_storage_path) || text(documento.dropbox_path_pdf_marca_dagua);

    return {
      id: text(documento.id),
      nome: text(documento.nome_original) || text(documento.nome_arquivo_sistema) || "Documento",
      clienteId: text(documento.cliente_id),
      cliente: text(cliente?.nome) || "-",
      casoId: text(documento.caso_id),
      caso: text(caso?.titulo) || "-",
      categoria: text(documento.categoria_nome) || text(documento.area) || "-",
      subcategoria: text(documento.subcategoria_nome) || text(documento.subarea) || "-",
      tipo: text(documento.tipo_documento) || "Documento",
      origem: text(documento.origem) || "Upload",
      status: statusDocumento(text(documento.status), provider),
      provider,
      storagePath: text(documento.storage_path) || text(documento.dropbox_path_original),
      storageUrl: text(documento.storage_url),
      pdfPath,
      pdfUrl: text(documento.pdf_storage_url),
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
    original_salvo: "Original salvo",
    pdf_gerado: "PDF gerado",
    erro_envio: "Erro no envio",
    precisa_reenviar: "Precisa reenviar",
    validado: "Validado pelo advogado",
  };

  if (status === "enviado" && provider === "google_drive") return "Enviado ao Drive";
  if (status === "enviado" && provider === "dropbox") return "Enviado ao Dropbox";
  return normalized[status] ?? (status || "Pendente");
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = text(row[key]) || "Sem informacao";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
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
