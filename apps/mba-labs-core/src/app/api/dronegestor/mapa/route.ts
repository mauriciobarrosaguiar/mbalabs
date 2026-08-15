import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  droneOsErrorResponse,
  requireDroneOsAccess,
  scopeDroneOsQuery,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const BUCKET = "dronegestor-map-evidence";
const ACTION = "mapa_voo_evidencia";
const PILOT_ACTION = "piloto_operacional_v1";
const MAX_BYTES = 8 * 1024 * 1024;

type Context = {
  userId: string;
  userName: string;
  empresaId: string | null;
  canManage: boolean;
};

function normalizeType(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
}
function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sem-os"
  );
}

async function getContext(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) {
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  }
  const type = normalizeType(session.profile.tipo || "");
  const admin = ["super_admin", "admin_master"].includes(type);
  const allowed = (session.appsLiberados ?? []).some(
    (app) => app.slug === "dronegestor" && app.canAccess,
  );
  if (!admin && !allowed) {
    return {
      current: null,
      response: NextResponse.json(
        { ok: false, error: "Acesso ao DroneGestor não liberado." },
        { status: 403 },
      ),
    };
  }
  return {
    current: {
      userId: session.profile.id,
      userName: session.profile.nome || "Piloto",
      empresaId: session.profile.empresa_id,
      canManage: canManageDroneGestor({ tipo: session.profile.tipo, isAdminMaster: admin, permissoes: session.permissoes }),
    },
    response: null,
  };
}

async function canUpload(admin: any, current: Context) {
  if (current.canManage || !current.empresaId) return true;
  let query = admin
    .from("core_logs")
    .select("detalhes")
    .eq("app_slug", "dronegestor")
    .eq("acao", PILOT_ACTION)
    .contains("detalhes", { usuarioId: current.userId, ativo: true })
    .limit(1);
  query = scopeDroneOsQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return data.detalhes?.permissoes?.anexarEvidencias !== false;
}

function detectImage(bytes: Buffer) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { extension: "jpg", contentType: "image/jpeg" };
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return { extension: "png", contentType: "image/png" };
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { extension: "webp", contentType: "image/webp" };
  return null;
}

async function signedEvidence(admin: any, row: any) {
  const details = row?.detalhes ?? {};
  const storagePath = text(details.storagePath, 500);
  if (!storagePath) return null;
  const signed = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 15 * 60);
  if (signed.error || !signed.data?.signedUrl) return null;
  return {
    id: text(details.evidenceId, 100) || String(row.id),
    storagePath,
    url: signed.data.signedUrl,
    uploadedAt: text(details.uploadedAt, 60) || row.created_at,
    source: text(details.source, 20),
    ordemServicoId: text(details.ordemServicoId, 100),
    ordemServicoNumero: text(details.ordemServicoNumero, 100),
    talhaoNome: text(details.talhaoNome, 180),
    fazendaNome: text(details.fazendaNome, 180),
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const osId = text(request.nextUrl.searchParams.get("osId"), 100);
    if (!osId) return NextResponse.json({ ok: true, evidence: null });

    const admin = createSupabaseAdminClient() as any;
    await requireDroneOsAccess(admin, current, osId);

    let query = admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .contains("detalhes", { ordemServicoId: osId })
      .order("created_at", { ascending: false })
      .limit(1);
    query = scopeDroneOsQuery(query, current);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: true, evidence: null });
    return NextResponse.json({ ok: true, evidence: await signedEvidence(admin, data) });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar a foto do mapa." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;

    const form = await request.formData();
    const file = form.get("foto");
    const ordemServicoId = text(form.get("ordemServicoId"), 100);
    if (!ordemServicoId) {
      return NextResponse.json(
        { ok: false, error: "Selecione uma OS antes de enviar o mapa usado no voo." },
        { status: 400 },
      );
    }

    // Confere a OS antes de ler e armazenar o arquivo. Isso evita mapa órfão ou anexado
    // pelo piloto errado em outra OS da mesma empresa.
    await requireDroneOsAccess(admin, current, ordemServicoId);
    if (!(await canUpload(admin, current))) {
      return NextResponse.json(
        { ok: false, error: "O gestor não liberou envio de evidências para este piloto." },
        { status: 403 },
      );
    }

    if (!(file instanceof File) || file.size <= 0)
      return NextResponse.json({ ok: false, error: "Tire uma foto ou escolha uma imagem do mapa." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ ok: false, error: "A imagem é muito grande. Use uma foto de até 8 MB." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = detectImage(bytes);
    if (!image)
      return NextResponse.json({ ok: false, error: "Arquivo inválido. Envie uma imagem JPG, PNG ou WebP." }, { status: 400 });

    const ordemServicoNumero = text(form.get("ordemServicoNumero"), 100);
    const talhaoNome = text(form.get("talhaoNome"), 180);
    const fazendaNome = text(form.get("fazendaNome"), 180);
    const source = text(form.get("source"), 20) === "camera" ? "camera" : "arquivo";
    const evidenceId = crypto.randomUUID();
    const owner = current.empresaId
      ? `empresa-${safePart(current.empresaId)}`
      : `usuario-${safePart(current.userId)}`;
    const storagePath = `${owner}/${safePart(current.userId)}/${safePart(ordemServicoId)}/${Date.now()}-${evidenceId}.${image.extension}`;

    const upload = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: image.contentType,
      upsert: false,
      cacheControl: "3600",
    });
    if (upload.error) throw upload.error;

    const uploadedAt = new Date().toISOString();
    const details = {
      evidenceId,
      storagePath,
      uploadedAt,
      source,
      ordemServicoId,
      ordemServicoNumero,
      talhaoNome,
      fazendaNome,
      originalBytes: bytes.length,
      contentType: image.contentType,
      piloto: current.userName,
    };
    const inserted = await admin
      .from("core_logs")
      .insert({
        empresa_id: current.empresaId,
        usuario_id: current.userId,
        app_slug: "dronegestor",
        acao: ACTION,
        detalhes: details,
      })
      .select("id,detalhes,created_at")
      .single();
    if (inserted.error) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      throw inserted.error;
    }
    return NextResponse.json({ ok: true, evidence: await signedEvidence(admin, inserted.data) });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar a foto do mapa." },
      { status: 500 },
    );
  }
}
