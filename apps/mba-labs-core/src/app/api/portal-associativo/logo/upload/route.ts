import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { buildPortalStorageFolder, getPortalStorageConnection, isPortalStorageProvider, uploadToPortalStorage } from "@/lib/portal-associativo-storage";
import { ensurePortalStorageEnvAliases } from "../../_storage-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowed = new Map([["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]);

export async function POST(request: Request) {
  ensurePortalStorageEnvAliases();
  try {
    const context = await getPortalContext("/portal-associativo/configuracoes");
    if (!context.empresaId || !canPortalAccess(context.perfil, "configuracoes")) throw new Error("Seu perfil não permite alterar a logo.");
    const formData = await request.formData();
    const file = formData.get("arquivo");
    if (!(file instanceof File) || !file.size) throw new Error("Selecione uma imagem.");
    if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    if (allowed.get(extension) !== file.type.toLowerCase()) throw new Error("Envie uma imagem JPG, PNG ou WEBP válida.");
    const connection = await getPortalStorageConnection(context.current);
    if (!connection || !isPortalStorageProvider(String(connection.provedor ?? ""))) throw new Error("Configure o Dropbox ou Google Drive antes de enviar a logo.");
    const provider = connection.provedor as "dropbox" | "google_drive";
    const uploaded = await uploadToPortalStorage({
      current: context.current,
      provider,
      fileName: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      folderPath: buildPortalStorageFolder({ root: String(connection.root_folder_path ?? "/Portal Associativo"), area: "relatorio", categoria: "Identidade visual" })
    });
    if (!uploaded) throw new Error("Não foi possível guardar a imagem.");
    const saved = await context.client.from("assoc_arquivos").insert({
      empresa_id: context.empresaId, provedor: provider, file_id: uploaded.fileId || null, file_name: file.name,
      mime_type: file.type, size: file.size, path: uploaded.path, shared_url: uploaded.url || null,
      visibility: "interno", liberado_associado: false, categoria: "logo", descricao: "Logo da entidade",
      criado_por: context.current.usuario.id, atualizado_por: context.current.usuario.id
    }).select("id").single();
    if (saved.error) throw saved.error;
    const updated = await context.client.from("assoc_configuracoes").upsert({ empresa_id: context.empresaId, logo_url: uploaded.url || uploaded.path, logo_arquivo_id: saved.data.id, atualizado_em: new Date().toISOString() }, { onConflict: "empresa_id" });
    if (updated.error) throw updated.error;
    await context.client.from("assoc_auditoria_logs").insert({ empresa_id: context.empresaId, usuario_id: context.current.usuario.id, acao: "alterar_logo", entidade: "assoc_configuracoes", dados_novos: { arquivo_id: saved.data.id, provedor: provider } });
    return go(request, "ok", "Logo atualizada.");
  } catch (error) { return go(request, "error", error instanceof Error ? error.message : "Erro ao enviar a logo."); }
}

function go(request: Request, kind: "ok" | "error", message: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?${kind}=${encodeURIComponent(message)}`, request.url), 303);
}
