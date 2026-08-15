import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor, droneGestorRole } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const VERIFY_ACTION = "produto_bula_verificado_v1";
const AGROFIT_RESOURCE_ID = "d30b30d7-e256-484e-9ab8-cd40974e1238";
const AGROFIT_CSV_URL = "https://dados.agricultura.gov.br/dataset/6c913699-e82e-4da3-a0a1-fb6c431e367f/resource/d30b30d7-e256-484e-9ab8-cd40974e1238/download/agrofitprodutosformulados.csv";
const QUERY_CACHE_MS = 30 * 60 * 1000;

type ProductStatus = "verified" | "no_explicit_order" | "review_required";
type CsvRecord = Record<string, string>;
type OfficialProduct = ReturnType<typeof normalizeOfficialRecord>;

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

const queryCache = new Map<string, { expiresAt: number; items: OfficialProduct[] }>();

function normalize(value: unknown) { return String(value ?? "").trim(); }
function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function normalizeSearch(value: string) {
  return normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function field(record: Record<string, unknown>, aliases: string[], hints: string[][] = []) {
  const entries = Object.entries(record).map(([key, value]) => [normalizeKey(key), value] as const);
  const normalized = new Map(entries);
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && value !== null && String(value).trim()) return normalize(value);
  }
  for (const group of hints) {
    const match = entries.find(([key, value]) => group.every((hint) => key.includes(normalizeKey(hint))) && value !== undefined && value !== null && String(value).trim());
    if (match) return normalize(match[1]);
  }
  return "";
}
function productKey(name: string, registration: string) { return `${normalizeSearch(name)}::${normalizeSearch(registration)}`; }

function normalizeOfficialRecord(record: Record<string, unknown>) {
  const name = field(record,
    ["marca comercial", "marca_comercial", "produto", "nome comercial", "nome_comercial", "nome do produto", "produto formulado", "nm_marca_comercial", "marca"],
    [["marca", "comercial"], ["nome", "produto"]]
  );
  const registration = field(record,
    ["numero registro", "número registro", "registro", "numero_registro", "n do registro", "nº registro", "nr_registro", "numero do registro"],
    [["registro"]]
  );
  const activeIngredient = field(record,
    ["ingrediente ativo", "ingrediente_ativo", "principio ativo", "princípio ativo", "ingredientes ativos", "ingredientes_ativos"],
    [["ingrediente", "ativo"], ["principio", "ativo"]]
  );
  const formulation = field(record,
    ["formulacao", "formulação", "tipo formulacao", "tipo formulação", "tipo_de_formulacao"],
    [["formula"]]
  );
  const holder = field(record,
    ["titular", "empresa", "registrante", "titular do registro", "empresa registrante", "razao social", "razão social"],
    [["titular"], ["registrante"], ["razao", "social"]]
  );
  const bulletinUrl = field(record,
    ["bula", "url bula", "url_bula", "link bula", "rotulo bula", "rótulo bula", "rotulo_bula"],
    [["bula"]]
  );
  return { key: productKey(name, registration), name, registration, activeIngredient, formulation, holder, bulletinUrl, officialSource: "AGROFIT / Dados Abertos MAPA" };
}

function detectDelimiter(headerLine: string) {
  return [";", ",", "\t"].sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
}
function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = false;
      } else value += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { cells.push(value.trim()); value = ""; }
    else value += char;
  }
  cells.push(value.replace(/\r$/, "").trim());
  return cells;
}

async function fetchAgrofit(query: string, limit: number) {
  const cacheKey = `${normalizeSearch(query)}:${limit}`;
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const response = await fetch(AGROFIT_CSV_URL, {
    headers: { Accept: "text/csv,*/*", "User-Agent": "MBA-Labs-DroneGestor/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok || !response.body) throw new Error(`CSV oficial do AGROFIT indisponível (${response.status}).`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const needle = normalizeSearch(query);
  const maxResults = Math.max(1, Math.min(50, limit));
  const unique = new Map<string, OfficialProduct>();

  let headers: string[] | null = null;
  let delimiter = ";";
  let prefix = "";
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let quotePending = false;
  let stopped = false;

  function processRow(cells: string[]) {
    if (!headers || !cells.some((cell) => cell)) return;
    if (!normalizeSearch(cells.join(" ")).includes(needle)) return;
    const record: CsvRecord = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const item = normalizeOfficialRecord(record);
    if (!item.name || unique.has(item.key)) return;
    unique.set(item.key, item);
    if (unique.size >= maxResults) stopped = true;
  }

  function ingest(text: string) {
    let index = 0;
    if (quotePending) {
      if (text[0] === '"') { value += '"'; index = 1; quoted = true; }
      else quoted = false;
      quotePending = false;
    }
    for (; index < text.length && !stopped; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (index + 1 < text.length) {
            if (text[index + 1] === '"') { value += '"'; index += 1; }
            else quoted = false;
          } else quotePending = true;
        } else value += char;
        continue;
      }
      if (char === '"') { quoted = true; continue; }
      if (char === delimiter) { row.push(value.trim()); value = ""; continue; }
      if (char === "\n") {
        row.push(value.replace(/\r$/, "").trim());
        processRow(row);
        row = [];
        value = "";
        continue;
      }
      value += char;
    }
  }

  try {
    while (!stopped) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(chunk, { stream: true });
      if (!headers) {
        prefix += text;
        const newline = prefix.indexOf("\n");
        if (newline < 0) {
          if (prefix.length > 200_000) throw new Error("Cabeçalho do CSV oficial não identificado.");
          continue;
        }
        const headerLine = prefix.slice(0, newline).replace(/^\uFEFF/, "").replace(/\r$/, "");
        delimiter = detectDelimiter(headerLine);
        headers = parseCsvLine(headerLine, delimiter).map((header, index) => header || `coluna_${index + 1}`);
        const remainder = prefix.slice(newline + 1);
        prefix = "";
        ingest(remainder);
      } else ingest(text);
    }
    if (!stopped) {
      const tail = decoder.decode();
      if (tail) ingest(tail);
      if (value || row.length) {
        row.push(value.replace(/\r$/, "").trim());
        processRow(row);
      }
    }
  } finally {
    if (stopped) await reader.cancel().catch(() => undefined);
    else reader.releaseLock();
  }

  const items = Array.from(unique.values());
  queryCache.set(cacheKey, { expiresAt: Date.now() + QUERY_CACHE_MS, items });
  while (queryCache.size > 80) queryCache.delete(queryCache.keys().next().value as string);
  return items;
}

function normalizedType(value: string) { return normalizeSearch(value).replaceAll(" ", "_"); }
async function sessionContext() {
  const context = await getSessionProfile();
  if (!context.user || !context.profile) return null;
  const tipo = normalizedType(context.profile.tipo);
  const isMaster = ["super_admin", "admin_master"].includes(tipo);
  const appAllowed = (context.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!isMaster && !appAllowed) return null;
  const roleInput = { tipo: context.profile.tipo, isAdminMaster: isMaster, permissoes: context.permissoes };
  return { userId: context.profile.id, empresaId: context.profile.empresa_id, tipo: droneGestorRole(roleInput), canManage: canManageDroneGestor(roleInput) };
}
async function loadVerifiedProducts(empresaId: string | null) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.from("core_logs").select("id,empresa_id,detalhes,created_at").eq("app_slug", "dronegestor").eq("acao", VERIFY_ACTION).order("created_at", { ascending: false }).limit(1500);
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
    const items = official.map((item) => {
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
        items.push({ key: local.productKey, name: local.productName, registration: local.registration, activeIngredient: local.activeIngredient, formulation: local.formulation, holder: local.holder, bulletinUrl: local.bulletinUrl, officialSource: "Biblioteca DroneGestor — revisão local", verification: { status: local.status, bulletinUrl: local.bulletinUrl, bulletinVerifiedAt: local.bulletinVerifiedAt, preparationSummary: local.preparationSummary, sequenceGroup: local.sequenceGroup, tankMixNotes: local.tankMixNotes, sourceTitle: local.sourceTitle } });
        if (items.length >= limit) break;
      }
    }
    return NextResponse.json({ ok: true, items: items.slice(0, limit), officialAvailable: officialResult.status === "fulfilled", officialError: officialResult.status === "rejected" ? String((officialResult.reason as Error)?.message || "AGROFIT temporariamente indisponível") : null, canManage: ctx?.canManage === true, resourceId: AGROFIT_RESOURCE_ID, sourceUrl: AGROFIT_CSV_URL });
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
    const product: VerifiedProduct = { productKey: productKey(name, registration), productName: name, registration, activeIngredient: normalize(body?.activeIngredient), formulation: normalize(body?.formulation), holder: normalize(body?.holder), status, bulletinUrl: normalize(body?.bulletinUrl), bulletinVerifiedAt: status === "review_required" ? "" : normalize(body?.bulletinVerifiedAt) || new Date().toISOString(), preparationSummary: normalize(body?.preparationSummary), sequenceGroup: normalize(body?.sequenceGroup), tankMixNotes: normalize(body?.tankMixNotes), sourceTitle: normalize(body?.sourceTitle) || (status === "verified" ? "Bula verificada" : "Revisão técnica") };
    if (status !== "review_required" && !product.bulletinUrl) return NextResponse.json({ ok: false, error: "Informe a fonte/link da bula revisada." }, { status: 400 });
    if (status === "verified" && !product.preparationSummary) return NextResponse.json({ ok: false, error: "Para marcar como verificado, registre o resumo do preparo indicado na bula." }, { status: 400 });
    if (status === "verified" && !product.sequenceGroup) return NextResponse.json({ ok: false, error: "Para marcar a sequência como verificada, informe o grupo/posição validado na bula." }, { status: 400 });
    const admin = createSupabaseAdminClient() as any;
    const { error } = await admin.from("core_logs").insert({ empresa_id: ctx.empresaId, usuario_id: ctx.userId, app_slug: "dronegestor", acao: VERIFY_ACTION, detalhes: { product, verifiedBy: ctx.userId, verifiedAt: new Date().toISOString(), sourceResourceId: AGROFIT_RESOURCE_ID, sourceUrl: AGROFIT_CSV_URL } });
    if (error) throw error;
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao salvar a verificação da bula." }, { status: 500 });
  }
}
