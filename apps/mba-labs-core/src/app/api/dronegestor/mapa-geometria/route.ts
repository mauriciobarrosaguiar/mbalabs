import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { droneOsErrorResponse, requireDroneOsAccess } from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const ACTION = "mapa_voo_geometria_v1";
const PILOT_ACTION = "piloto_operacional_v1";
const MAX_POINTS = 5000;
const EARTH_RADIUS_M = 6378137;

type Context = { userId: string; userName: string; empresaId: string | null; canManage: boolean };
type Coordinate = [number, number];

function normalizeType(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function scopeQuery(query: any, current: Context) {
  return current.empresaId ? query.eq("empresa_id", current.empresaId) : query.eq("usuario_id", current.userId);
}
async function getContext(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return { current: null, response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  const type = normalizeType(session.profile.tipo || "");
  const admin = ["super_admin", "admin_master"].includes(type);
  const allowed = (session.appsLiberados ?? []).some((app) => app.slug === "dronegestor" && app.canAccess);
  if (!admin && !allowed) return { current: null, response: NextResponse.json({ ok: false, error: "Acesso ao DroneGestor não liberado." }, { status: 403 }) };
  return { current: { userId: session.profile.id, userName: session.profile.nome || "Piloto", empresaId: session.profile.empresa_id, canManage: canManageDroneGestor({ tipo: session.profile.tipo, isAdminMaster: admin, permissoes: session.permissoes }) }, response: null };
}

function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) && Number(value[0]) >= -180 && Number(value[0]) <= 180 && Number(value[1]) >= -90 && Number(value[1]) <= 90;
}
function samePoint(a: Coordinate, b: Coordinate) {
  return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}
function normalizeRing(value: unknown): Coordinate[] {
  if (!Array.isArray(value)) throw new Error("Polígono inválido.");
  if (value.length < 3) throw new Error("O polígono precisa de pelo menos 3 pontos.");
  if (value.length > MAX_POINTS) throw new Error(`O polígono excede o limite de ${MAX_POINTS} pontos.`);
  const ring = value.map((entry) => {
    if (!validCoordinate(entry)) throw new Error("O arquivo contém coordenada inválida.");
    return [Number(entry[0]), Number(entry[1])] as Coordinate;
  });
  if (!samePoint(ring[0], ring[ring.length - 1])) ring.push([...ring[0]] as Coordinate);
  if (ring.length < 4) throw new Error("O polígono precisa de pelo menos 3 pontos distintos.");
  return ring;
}
function geometryStats(ring: Coordinate[]) {
  const vertices = ring.slice(0, -1);
  const meanLatRad = vertices.reduce((sum, point) => sum + point[1], 0) / vertices.length * Math.PI / 180;
  const cosLat = Math.cos(meanLatRad);
  const projected = ring.map(([lon, lat]) => [EARTH_RADIUS_M * lon * Math.PI / 180 * cosLat, EARTH_RADIUS_M * lat * Math.PI / 180] as const);
  let twiceArea = 0;
  for (let index = 0; index < projected.length - 1; index += 1) {
    const [x1, y1] = projected[index];
    const [x2, y2] = projected[index + 1];
    twiceArea += x1 * y2 - x2 * y1;
  }
  const areaHa = Math.abs(twiceArea) / 2 / 10000;
  const lons = vertices.map((point) => point[0]);
  const lats = vertices.map((point) => point[1]);
  const bbox = { west: Math.min(...lons), south: Math.min(...lats), east: Math.max(...lons), north: Math.max(...lats) };
  const center = { longitude: (bbox.west + bbox.east) / 2, latitude: (bbox.south + bbox.north) / 2 };
  return { areaHa: Math.round(areaHa * 10000) / 10000, bbox, center, pointCount: vertices.length };
}
async function canUpload(admin: any, current: Context) {
  if (current.canManage || !current.empresaId) return true;
  let query = admin.from("core_logs").select("detalhes").eq("app_slug", "dronegestor").eq("acao", PILOT_ACTION).contains("detalhes", { usuarioId: current.userId, ativo: true }).limit(1);
  query = scopeQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return data.detalhes?.permissoes?.anexarEvidencias !== false;
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const osId = text(request.nextUrl.searchParams.get("osId"), 100);
    if (!osId) return NextResponse.json({ ok: false, error: "Selecione uma OS para consultar o mapa desta operação." }, { status: 400 });
    const admin = createSupabaseAdminClient() as any;
    await requireDroneOsAccess(admin, current, osId);
    let query = admin.from("core_logs").select("id,detalhes,created_at").eq("app_slug", "dronegestor").eq("acao", ACTION).order("created_at", { ascending: false }).limit(100);
    query = scopeQuery(query, current);
    const { data, error } = await query;
    if (error) throw error;
    const row = (data ?? []).find((item: any) => text(item?.detalhes?.ordemServicoId, 100) === osId);
    if (!row) return NextResponse.json({ ok: true, geometry: null });
    return NextResponse.json({ ok: true, geometry: { id: row.detalhes?.geometryId || String(row.id), ...row.detalhes } });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError) return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar o polígono do talhão." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const body = await request.json();
    const ring = normalizeRing(body?.coordinates);
    const sourceFormat = text(body?.sourceFormat, 20).toLowerCase();
    if (!["geojson", "kml"].includes(sourceFormat)) return NextResponse.json({ ok: false, error: "Formato geográfico não suportado. Use GeoJSON ou KML." }, { status: 400 });
    const sourceName = text(body?.sourceName, 180) || `talhao.${sourceFormat}`;
    const ordemServicoId = text(body?.ordemServicoId, 100);
    const ordemServicoNumero = text(body?.ordemServicoNumero, 100);
    const talhaoNome = text(body?.talhaoNome, 180);
    const fazendaNome = text(body?.fazendaNome, 180);
    const stats = geometryStats(ring);
    if (!Number.isFinite(stats.areaHa) || stats.areaHa <= 0) return NextResponse.json({ ok: false, error: "Não foi possível calcular uma área válida para este polígono." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    await requireDroneOsAccess(admin, current, ordemServicoId);
    if (!(await canUpload(admin, current))) return NextResponse.json({ ok: false, error: "O gestor não liberou envio de mapa/evidências para este piloto." }, { status: 403 });
    const geometryId = crypto.randomUUID();
    const importedAt = new Date().toISOString();
    const details = {
      geometryId,
      geometryType: "Polygon",
      coordinates: ring,
      sourceName,
      sourceFormat,
      importedAt,
      ordemServicoId,
      ordemServicoNumero,
      talhaoNome,
      fazendaNome,
      piloto: current.userName,
      ...stats
    };
    const { data, error } = await admin.from("core_logs").insert({
      empresa_id: current.empresaId,
      usuario_id: current.userId,
      app_slug: "dronegestor",
      acao: ACTION,
      detalhes: details
    }).select("id,created_at").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, geometry: { id: geometryId || String(data?.id || ""), ...details } });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError) return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    const message = error instanceof Error ? error.message : "Falha ao salvar o polígono do talhão.";
    const badRequest = /inválid|precisa|limite|coordenada|formato|polígono/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: badRequest ? 400 : 500 });
  }
}
