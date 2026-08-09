import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const VERIFY_ACTION = "produto_bula_verificado_v1";
const AGROFIT_RESOURCE_ID = "d30b30d7-e256-484e-9ab8-cd40974e1238";
const AGROFIT_DATASTORE = "https://dados.agricultura.gov.br/api/3/action/datastore_search";

type ProductStatus = "verified" | "no_explicit_order" | "review_required";

type VerifiedProduct = {
  productKey: string;
  productName: string;
  registration: string;
  activeIngredient: string;
  formulation: string;
  holder: string;
  status: ProductStatus;
  bulletinUrl: string;
  bulletinVerifiedAt: string;
  preparationSummary: string;
  sequenceGroup: string;
  tankMixNotes: string;
  sourceTitle: string;
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeSearch(value: string) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function field(record: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(Object.entries(record).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && value !== null && String(value).trim()) return normalize(value);
  }
  return "";
}

function productKey(name: string, registration: string) {
  return `${normalizeSearch(name)}::${normalizeSearch(registration)}`;
}

function normalizeOfficialRecord(record: Record<string, unknown>) {
  const name = field(record, ["marca comercial", "marca_comercial", "produto", "nome comercial", "nome_comercial", "nome do produto", "produto formulado"]);
  const registration = field(record, ["numero registro", "número registro", "registro", "numero_registro", "n do registro", "nº registro"]);
  const activeIngredient = field(record, ["ingrediente ativo", "ingrediente_ativo", "principio ativo", "princípio ativo", "ingredientes ativos"]);
  const formulation = field(record, ["formulacao", "formulação", "tipo formulacao", "tipo formulação"]);
  const holder = field(record, ["titular", "empresa", "registrante", "titular do registro", "empresa registrante"]);
  const bulletinUrl = field(record, ["bula", "url bula", "url_bula", "link bula", "rotulo bula", "rótulo bula", "rotulo_bula"]);
  return {
    key: productKey(name, registration),
    name,
    registration,
    activeIngredient,
    formulation,
    holder,
    bulletinUrl,
    officialSource: "AGROFIT / Dados Abertos MAPA"
  };
}

async function fetchAgrofit(query: string, limit: number) {
  const url = new URL(AGROFIT_DATASTORE);
  url.searchParams.set("resource_id", AGROFIT_RESOURCE_ID);
  url.searchParams.set("limit", String(Math.max(1, Math.min(50, limit))));
  if (query) url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MBA-Labs-DroneGestor/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`AGROFIT indisponível (${response.status}).`);
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload?.result?.records)) throw new Error("Resposta do AGROFIT fora do formato esperado.");
  return payload.result.records.map((item: unknown) => normalizeOfficialRecord((item && typeof item === "object" ? item : {}) as Record<string, unknown>)).filter((item: { name: string }) => item.name);
}

function normalizedType(value: string) {
  return normalizeSearch(value).replaceAll(" ", "_");
}

async function sessionContext() {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) return null;
  const tipo = normalizedType(context.profile.tipo);
  const isMaster = ["super_admin", "admin_master"].includes(tipo);
  const appAllowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!isMaster && !appAllowed) return null;
  return {
    userId: context.profile.id,
    empresaId: context.profile.empresa_id,
    tipo,
    canManage: isMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(tipo)
  };
}

async function loadVerifiedProducts(empresaId: string | null) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("core_logs")
    .select("id,empresa_id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", VERIFY_ACTION)
    .order("created_at", { ascending: false })
    .limit(1500);
  if (error) throw error;
  const latest = new Map<string, VerifiedProduct>();
  for (const row of data ?? []) {
    if (row.empresa_id && row.empresa_id !== empresaId) continue;
    const item = row.detalhes?.product as VerifiedProduct | undefined;
    if (!item?.productKey || latest.has(item.productKey)) continue;
    latest.set(item.productKey, item);
  }
  return latest;
}

export async function GET(request: NextRequest) {
  const q = normalize(request.nextUrl.searchParams.get("q"));
  const limit = Math.max(1, Math.min(30, Number(request.nextUrl.searchParams.get("limit") || 15) || 15));
  if (q.length < 2) return NextResponse.json({ ok: true, items: [], source: "AGROFIT", note: "Digite ao menos 2 caracteres." });

  try {
    const [officialResult, context] = await Promise.allSettled([fetchAgrofit(q, limit), sessionContext()]);
    const official = officialResult.status === "fulfilled" ? officialResult.value : [];
    const ctx = context.status === "fulfilled" ? context.value : null;
    const verified = ctx ? await loadVerifiedProducts(ctx.empresaId) : new Map<string, VerifiedProduct>();

    const items = official.map((item: any) => {
      const local = verified.get(item.key);
      return {
        ...item,
        verification: local ? {
          status: local.status,
          bulletinUrl: local.bulletinUrl || item.bulletinUrl,
          bulletinVerifiedAt: local.bulletinVerifiedAt,
          preparationSummary: local.preparationSummary,
          sequenceGroup: local.sequenceGroup,
          tankMixNotes: local.tankMixNotes,
          sourceTitle: local.sourceTitle || "Bula verificada"
        } : {
          status: "review_required" as ProductStatus,
          bulletinUrl: item.bulletinUrl,
          bulletinVerifiedAt: "",
          preparationSummary: "",
          sequenceGroup: "",
          tankMixNotes: "",
          sourceTitle: "Ainda não revisado na biblioteca do DroneGestor"
        }
      };
    });

    if (!items.length && ctx) {
      const needle = normalizeSearch(q);
      for (const local of verified.values()) {
        if (!normalizeSearch(`${local.productName} ${local.registration} ${local.activeIngredient}`).includes(needle)) continue;
        items.push({
          key: local.productKey,
          name: local.productName,
          registration: local.registration,
          activeIngredient: local.activeIngredient,
          formulation: local.formulation,
          holder: local.holder,
          bulletinUrl: local.bulletinUrl,
          officialSource: "Biblioteca DroneGestor — revisão local",
          verification: {
            status: local.status,
            bulletinUrl: local.bulletinUrl,
            bulletinVerifiedAt: local.bulletinVerifiedAt,
            preparationSummary: local.preparationSummary,
            sequenceGroup: local.sequenceGroup,
            tankMixNotes: local.tankMixNotes,
            sourceTitle: local.sourceTitle
          }
        });
        if (items.length >= limit) break;
      }
    }

    return NextResponse.json({
      ok: true,
      items: items.slice(0, limit),
      officialAvailable: officialResult.status === "fulfilled",
      officialError: officialResult.status === "rejected" ? String((officialResult.reason as Error)?.message || "AGROFIT temporariamente indisponível") : null,
      canManage: ctx?.canManage === true,
      resourceId: AGROFIT_RESOURCE_ID
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao consultar a biblioteca de produtos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await sessionContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 });
    if (!ctx.canManage) return NextResponse.json({ ok: false, error: "Somente ADMIN/RT pode validar informações de bula." }, { status: 403 });

    const body = await request.json();
    const name = normalize(body?.productName);
    const registration = normalize(body?.registration);
    if (!name) return NextResponse.json({ ok: false, error: "Informe o produto." }, { status: 400 });
    const status = normalize(body?.status) as ProductStatus;
    if (!["verified", "no_explicit_order", "review_required"].includes(status)) return NextResponse.json({ ok: false, error: "Status de verificação inválido." }, { status: 400 });

    const product: VerifiedProduct = {
      productKey: productKey(name, registration),
      productName: name,
      registration,
      activeIngredient: normalize(body?.activeIngredient),
      formulation: normalize(body?.formulation),
      holder: normalize(body?.holder),
      status,
      bulletinUrl: normalize(body?.bulletinUrl),
      bulletinVerifiedAt: status === "review_required" ? "" : normalize(body?.bulletinVerifiedAt) || new Date().toISOString(),
      preparationSummary: normalize(body?.preparationSummary),
      sequenceGroup: normalize(body?.sequenceGroup),
      tankMixNotes: normalize(body?.tankMixNotes),
      sourceTitle: normalize(body?.sourceTitle) || (status === "verified" ? "Bula verificada" : "Revisão técnica")
    };

    if (status === "verified" && !product.preparationSummary) return NextResponse.json({ ok: false, error: "Para marcar como verificado, registre o resumo do preparo indicado na bula." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const { error } = await admin.from("core_logs").insert({
      empresa_id: ctx.empresaId,
      usuario_id: ctx.userId,
      app_slug: "dronegestor",
      acao: VERIFY_ACTION,
      detalhes: { product, verifiedBy: ctx.userId, verifiedAt: new Date().toISOString(), sourceResourceId: AGROFIT_RESOURCE_ID }
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar a verificação da bula." }, { status: 500 });
  }
}
