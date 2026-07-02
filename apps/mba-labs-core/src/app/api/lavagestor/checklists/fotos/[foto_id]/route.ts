import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { LAVA_CHECKLIST_BUCKET } from "@/lib/lavagestor-checklists-data";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ foto_id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const current = await requireAppAccess("lavagestor");
  const { foto_id: fotoId } = await params;
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const { data: foto, error } = await client
    .from("lava_checklist_fotos")
    .select("id,empresa_id,storage_path")
    .eq("id", fotoId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error || !foto?.storage_path) {
    return NextResponse.json({ error: error?.message ?? "Foto nao encontrada." }, { status: 404 });
  }

  const { data, error: downloadError } = await client.storage
    .from(LAVA_CHECKLIST_BUCKET)
    .download(String(foto.storage_path));

  if (downloadError || !data) {
    return NextResponse.json({ error: downloadError?.message ?? "Foto indisponivel." }, { status: 404 });
  }

  return new Response(data, {
    headers: {
      "content-type": data.type || mimeTypeFromPath(String(foto.storage_path)),
      "cache-control": "private, max-age=300"
    }
  });
}

function mimeTypeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}
