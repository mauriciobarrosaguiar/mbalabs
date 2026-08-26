import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { requireAppAccess } from "@/lib/core-data";
import "./mba-escola-theme.css";

export const dynamic = "force-dynamic";

export default async function MbaEscolaLayout({ children }: { children: ReactNode }) {
  const current = await requireAppAccess("mba-escola", "/mba-escola");

  if (current.usuario.status !== "ativo") {
    redirect("/acesso-bloqueado?motivo=usuario");
  }

  const identity = {
    userId: current.authUser.id,
    nome: current.usuario.nome,
    email: (current.authUser.email ?? current.usuario.email).trim().toLowerCase()
  };

  if (current.isAdminMaster) await ensureMbaEscolaOwner(identity);
  else await claimSchoolInvites(identity);

  return <div className="mba-escola-theme">{children}</div>;
}

function isSchoolSchemaUnavailable(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code ?? "").toUpperCase();
  const message = String(error?.message ?? "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("schema cache") || message.includes("could not find the table");
}

async function ensureMbaEscolaOwner({ userId, nome, email }: { userId: string; nome: string; email: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("escola_super_admins").upsert({ user_id: userId, nome, email, ativo: true }, { onConflict: "user_id" });
  if (error) {
    if (isSchoolSchemaUnavailable(error)) {
      console.warn("[mba-escola] Schema central ainda não aplicado; sincronização do ADMIN MBA adiada.");
      return;
    }
    throw new Error(`Falha ao sincronizar ADMIN MBA no módulo Escola: ${error.message}`);
  }
  await ensureDocumentsBucket(admin);
}

async function claimSchoolInvites({ userId, nome, email }: { userId: string; nome: string; email: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { data: invites, error: inviteError } = await admin
    .from("escola_convites")
    .select("id,escola_id,nome,email,papel,aluno_id,status,expira_em,criado_em")
    .eq("status", "pendente")
    .ilike("email", email)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (inviteError) {
    if (isSchoolSchemaUnavailable(inviteError)) {
      console.warn("[mba-escola] Schema central ainda não aplicado; reivindicação de convites adiada.");
      return;
    }
    throw new Error(`Falha ao localizar convites escolares: ${inviteError.message}`);
  }

  const allowedRoles = new Set(["admin_escola", "direcao", "coordenacao", "professor", "responsavel"]);
  const handledSchools = new Set<string>();

  for (const invite of invites ?? []) {
    const schoolId = String(invite.escola_id || "");
    if (!schoolId || invite.papel === "aluno" || !allowedRoles.has(String(invite.papel))) continue;

    if (invite.expira_em && new Date(invite.expira_em).getTime() < Date.now()) {
      await admin.from("escola_convites").update({ status: "expirado", atualizado_em: new Date().toISOString() }).eq("id", invite.id);
      continue;
    }

    if (handledSchools.has(schoolId)) {
      await admin.from("escola_convites").update({ status: "revogado", atualizado_em: new Date().toISOString() }).eq("id", invite.id);
      continue;
    }
    handledSchools.add(schoolId);

    const { error: profileError } = await admin.from("escola_perfis").upsert({
      id: userId,
      escola_id: schoolId,
      nome: invite.nome || nome,
      email,
      papel: invite.papel,
      ativo: true,
      is_teste: false,
      atualizado_em: new Date().toISOString()
    }, { onConflict: "id,escola_id" });
    if (profileError) throw new Error(`Falha ao criar vínculo escolar: ${profileError.message}`);

    if (invite.papel === "responsavel" && invite.aluno_id) {
      const { error: linkError } = await admin.from("escola_aluno_responsaveis").upsert({
        escola_id: schoolId,
        aluno_id: invite.aluno_id,
        responsavel_id: userId,
        principal: false,
        autorizado_buscar: true
      }, { onConflict: "aluno_id,responsavel_id" });
      if (linkError) throw new Error(`Falha ao vincular responsável ao aluno: ${linkError.message}`);
    }

    const { error: acceptError } = await admin.from("escola_convites").update({
      status: "aceito",
      aceito_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }).eq("id", invite.id);
    if (acceptError) throw new Error(`Falha ao concluir convite escolar: ${acceptError.message}`);
  }

  await ensureDocumentsBucket(admin);
}

async function ensureDocumentsBucket(admin: any) {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = (buckets ?? []).some((bucket: { name: string }) => bucket.name === "mba-escola-documentos");
  if (exists) return;
  const { error } = await admin.storage.createBucket("mba-escola-documentos", {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
  });
  if (error && !String(error.message).toLowerCase().includes("already")) console.error("[mba-escola] Falha ao garantir bucket privado:", error.message);
}
