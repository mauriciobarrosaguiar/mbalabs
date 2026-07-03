import "server-only";

import { getLavaAiMode, getLavaGeminiDemoUsage } from "./lavagestor-ai";
import { getEvolutionManagerConfig } from "./lavagestor-evolution";
import { requireLavaGestorAccess, type LavaPerfil } from "./lavagestor-permissions";
import { getWhatsappIntegration } from "./lavagestor-whatsapp";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export async function getLavaSetupFacilPageData() {
  const { current, perfil } = await requireLavaGestorAccess("/lavagestor/setup-facil");
  const client = (await getSupabaseServer()) as any;
  const empresaId = current.empresaId;

  if (!empresaId) {
    return {
      companyName: "Empresa",
      canEdit: false,
      perfil,
      aiMode: await getLavaAiMode(current),
      whatsappIntegration: await getWhatsappIntegration(current),
      evolutionManager: getEvolutionManagerConfig(),
      geminiDemo: { available: false, used: 0, limit: 10, remaining: 0 },
      setup: emptySetup(),
      lastWhatsappTest: null,
      statusCards: emptyStatusCards()
    };
  }

  const [configResult, empresaResult, aiMode, whatsappIntegration, geminiDemo, lastWhatsappTestResult] = await Promise.all([
    client
      .from("lava_configuracoes")
      .select("nome_exibicao,whatsapp,setup_facil_started_at,setup_facil_finished_at,setup_facil_status,setup_facil_ultimo_teste_em,setup_facil_ultimo_erro")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    client.from("core_empresas").select("nome,nome_fantasia").eq("id", empresaId).maybeSingle(),
    getLavaAiMode(current),
    getWhatsappIntegration(current),
    getLavaGeminiDemoUsage(current).catch(() => ({ available: false, used: 0, limit: 10, remaining: 0 })),
    client
      .from("lava_whatsapp_envios")
      .select("id,status,telefone,mensagem,mensagem_gerada_por,provider,erro,enviado_em,created_at")
      .eq("empresa_id", empresaId)
      .eq("evento", "teste_setup_facil")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const config = (configResult.data ?? {}) as Row;
  const empresa = (empresaResult.data ?? {}) as Row;
  const companyName = String(config.nome_exibicao || empresa.nome_fantasia || empresa.nome || "Empresa");
  const setup = {
    startedAt: textOrNull(config.setup_facil_started_at),
    finishedAt: textOrNull(config.setup_facil_finished_at),
    status: String(config.setup_facil_status || "pendente"),
    lastTestAt: textOrNull(config.setup_facil_ultimo_teste_em),
    lastError: String(config.setup_facil_ultimo_erro || "")
  };

  return {
    companyName,
    canEdit: canEditEasySetup(perfil),
    perfil,
    aiMode,
    whatsappIntegration,
    evolutionManager: getEvolutionManagerConfig(),
    geminiDemo,
    setup,
    lastWhatsappTest: lastWhatsappTestResult.data ? normalizeLastWhatsappTest(lastWhatsappTestResult.data as Row) : null,
    statusCards: buildStatusCards(aiMode, whatsappIntegration, setup)
  };
}

function canEditEasySetup(perfil: LavaPerfil) {
  return perfil === "admin_master" || perfil === "admin_empresa";
}

function buildStatusCards(
  aiMode: Awaited<ReturnType<typeof getLavaAiMode>>,
  whatsappIntegration: Awaited<ReturnType<typeof getWhatsappIntegration>>,
  setup: ReturnType<typeof emptySetup>
) {
  const iaStatus = aiMode.active ? "Ativada" : aiMode.connection.status === "erro" ? "Erro" : "Nao ativada";
  const whatsappConnected = whatsappIntegration.provider !== "manual" && whatsappIntegration.status === "conectado";
  const whatsappWaitingQr = whatsappIntegration.provider === "evolution" && Boolean(whatsappIntegration.instanciaId) && !whatsappConnected && !whatsappIntegration.ultimoErro;
  const whatsappStatus = whatsappConnected
    ? "Conectado"
    : whatsappIntegration.ultimoErro || whatsappIntegration.status === "erro"
      ? "Erro"
      : whatsappWaitingQr
        ? "Aguardando QR Code"
        : "Nao conectado";
  const envioStatus = whatsappIntegration.modoEnvio === "automatico_total"
    ? "Automatico"
    : whatsappIntegration.modoEnvio === "automatico_com_aprovacao"
      ? "Com aprovacao"
      : "Manual";
  const finalReady = aiMode.active && whatsappConnected && whatsappIntegration.modoEnvio !== "manual";

  return {
    ia: iaStatus,
    whatsapp: whatsappStatus,
    envio: envioStatus,
    final: setup.status === "pronto" || finalReady ? "Pronto para usar" : "Pendente"
  };
}

function emptyStatusCards() {
  return { ia: "Nao ativada", whatsapp: "Nao conectado", envio: "Manual", final: "Pendente" };
}

function emptySetup() {
  return { startedAt: null as string | null, finishedAt: null as string | null, status: "pendente", lastTestAt: null as string | null, lastError: "" };
}

function normalizeLastWhatsappTest(row: Row) {
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? ""),
    phone: String(row.telefone ?? ""),
    message: String(row.mensagem ?? ""),
    generatedBy: String(row.mensagem_gerada_por ?? "modelo"),
    provider: String(row.provider ?? "manual"),
    error: String(row.erro ?? ""),
    sentAt: textOrNull(row.enviado_em),
    createdAt: textOrNull(row.created_at)
  };
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
