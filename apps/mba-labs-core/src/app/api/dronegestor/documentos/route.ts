import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  droneOsErrorResponse,
  requireDroneOsAccess, requireDroneOsWriteAccess,
  scopeDroneOsQuery,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const BUCKET = "dronegestor-documentos";
const ACTION = "documento_operacao_v1";
const PILOT_ACTION = "piloto_operacional_v1";
const MAX_BYTES = 10 * 1024 * 1024;

const TYPES = new Set([
  "sarpas_autorizacao",
  "sisant_certidao",
  "avaliacao_risco",
  "receituario",
  "mapa_aplicacao",
  "seguro",
  "exame_piloto_anac",
  "registro_mapa",
  "relatorio_mapa",
  "outro",
]);

type Context = { userId: string; userName: string; empresaId: string | null; canManage: boolean };
function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safe(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sem-os"
  );
}

async function context(): Promise<{ current: Context | null; response: NextResponse | null }> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile)
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  if (session.profile.status !== "ativo") return { current: null, response: NextResponse.json({ ok: false, error: "Conta inativa: acesso bloqueado." }, { status: 403 }) };
  const type = normalize(session.profile.tipo || "");
  const master = ["super_admin", "admin_master"].includes(type);
  const allowed = (session.appsLiberados ?? []).some(
    (app) => app.slug === "dronegestor" && app.canAccess,
  );
  if (!master && !allowed)
    return {
      current: null,
      response: NextResponse.json(
        { ok: false, error: "Acesso ao DroneGestor não liberado." },
        { status: 403 },
      ),
    };
  return {
    current: {
      userId: session.profile.id,
      userName: session.profile.nome || "Piloto",
      empresaId: session.profile.empresa_id,
      canManage: canManageDroneGestor({ tipo: session.profile.tipo, isAdminMaster: master, permissoes: session.permissoes }),
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

function detect(bytes: Buffer) {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-")
    return { ext: "pdf", mime: "application/pdf" };
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { ext: "png", mime: "image/png" };
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)
    return { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  return null;
}

async function signed(admin: any, row: any) {
  const d = row?.detalhes ?? {};
  const path = text(d.storagePath, 600);
  if (!path) return null;
  const url = await admin.storage.from(BUCKET).createSignedUrl(path, 15 * 60);
  return {
    id: String(row.id),
    tipo: text(d.tipo, 60),
    nome: text(d.nome, 240),
    numero: text(d.numero, 120),
    validade: text(d.validade, 40),
    observacao: text(d.observacao, 600),
    ordemServicoId: text(d.ordemServicoId, 120),
    ordemServicoNumero: text(d.ordemServicoNumero, 120),
    uploadedAt: text(d.uploadedAt, 60) || row.created_at,
    uploadedBy: text(d.uploadedBy, 180),
    url: url.data?.signedUrl || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    const admin = createSupabaseAdminClient() as any;
    const osId = text(request.nextUrl.searchParams.get("osId"), 120);
    if (!osId)
      return NextResponse.json(
        { ok: false, error: "Selecione uma OS para consultar os documentos desta operação." },
        { status: 400 },
      );

    await requireDroneOsAccess(admin, current, osId);

    let query = admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("app_slug", "dronegestor")
      .eq("acao", ACTION)
      .contains("detalhes", { ordemServicoId: osId })
      .order("created_at", { ascending: false })
      .limit(200);
    query = scopeDroneOsQuery(query, current);
    const { data, error } = await query;
    if (error) throw error;
    const items = (await Promise.all((data ?? []).map((row: any) => signed(admin, row)))).filter(Boolean);
    let cloudQuery = admin.from("agrodoc_cloud_files")
      .select("id,category,original_name,created_at,os_id,status")
      .eq("os_id",osId).eq("status","synced").order("created_at",{ascending:false}).limit(200);
    cloudQuery = current.empresaId
      ? cloudQuery.eq("owner_type","empresa").eq("owner_id",current.empresaId)
      : cloudQuery.eq("owner_type","usuario").eq("owner_id",current.userId);
    const cloud=await cloudQuery;
    if(cloud.error && !["42P01","PGRST205"].includes(String(cloud.error.code)))throw cloud.error;
    const cloudItems=(cloud.data||[]).map((row:any)=>({
      id:row.id,tipo:row.category,nome:row.original_name,numero:"",validade:"",observacao:"",
      ordemServicoId:row.os_id,ordemServicoNumero:"",
      uploadedAt:row.created_at,uploadedBy:"Usuário autorizado",
      url:"/api/dronegestor/cloud/file?id="+encodeURIComponent(row.id)
    }));
    return NextResponse.json({ok:true,items:[...cloudItems,...items]});
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar documentos." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await context();
    if (access.response) return access.response;
    const current = access.current!;
    const form = await request.formData();
    const file = form.get("arquivo");
    const tipo = text(form.get("tipo"), 60);
    const osId = text(form.get("ordemServicoId"), 120);

    if (!osId)
      return NextResponse.json(
        { ok: false, error: "Selecione uma OS antes de anexar documentos da operação." },
        { status: 400 },
      );
    if (!TYPES.has(tipo))
      return NextResponse.json({ ok: false, error: "Tipo de documento inválido." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const authorizedOs = await requireDroneOsWriteAccess(admin, current, osId);
    // Never trust a submitted OS number: bind the attachment to the persisted order.
    const osNumero = text(authorizedOs.data.numero, 120);
    if (!(await canUpload(admin, current)))
      return NextResponse.json(
        { ok: false, error: "O gestor não liberou envio de documentos/evidências para este piloto." },
        { status: 403 },
      );

    if (!(file instanceof File) || file.size <= 0)
      return NextResponse.json({ ok: false, error: "Escolha um arquivo." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ ok: false, error: "Arquivo maior que 10 MB." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = detect(bytes);
    if (!detected)
      return NextResponse.json({ ok: false, error: "Envie PDF, JPG, PNG, WebP ou XLSX." }, { status: 400 });

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    let duplicates = admin.from("core_logs").select("id,detalhes,created_at")
      .eq("app_slug","dronegestor").eq("acao",ACTION)
      .contains("detalhes",{ordemServicoId:osId,tipo,sha256})
      .order("created_at",{ascending:false}).limit(1);
    duplicates = scopeDroneOsQuery(duplicates,current);
    const existing=await duplicates.maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data)return NextResponse.json({
      ok:true,duplicate:true,item:await signed(admin,existing.data)
    });
    const id = crypto.randomUUID();
    const owner = current.empresaId ? `empresa-${safe(current.empresaId)}` : `usuario-${safe(current.userId)}`;
    const storagePath = `${owner}/${safe(osId)}/${tipo}/${Date.now()}-${id}.${detected.ext}`;
    const upload = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: detected.mime,
      upsert: false,
      cacheControl: "3600",
    });
    if (upload.error) throw upload.error;

    const details = {
      documentId: id,
      tipo,
      nome: text(file.name, 240),
      numero: text(form.get("numero"), 120),
      validade: text(form.get("validade"), 40),
      observacao: text(form.get("observacao"), 600),
      ordemServicoId: osId,
      ordemServicoNumero: osNumero,
      storagePath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: current.userName,
      contentType: detected.mime,
      bytes: bytes.length,
      sha256,
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
    return NextResponse.json({ ok: true, item: await signed(admin, inserted.data) });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar documento." },
      { status: 500 },
    );
  }
}
