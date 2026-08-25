import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function MbaEscolaLayout({ children }: { children: ReactNode }) {
  const current = await requireAppAccess("mba-escola", "/mba-escola");

  if (current.usuario.status !== "ativo") {
    redirect("/acesso-bloqueado?motivo=usuario");
  }

  // No modelo unificado, o ADMIN MBA usa o mesmo auth.uid() da MBA Labs.
  // O vínculo global é sincronizado de forma idempotente ao entrar no módulo.
  if (current.isAdminMaster) {
    await ensureMbaEscolaOwner({
      userId: current.authUser.id,
      nome: current.usuario.nome,
      email: current.authUser.email ?? current.usuario.email
    });
  }

  return children;
}

async function ensureMbaEscolaOwner({
  userId,
  nome,
  email
}: {
  userId: string;
  nome: string;
  email: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("escola_super_admins").upsert(
    {
      user_id: userId,
      nome,
      email,
      ativo: true
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Falha ao sincronizar ADMIN MBA no módulo Escola: ${error.message}`);
  }

  // O bucket é privado e serve apenas aos anexos de justificativas/documentos.
  // Criamos somente se ainda não existir no Supabase central.
  const { data: buckets } = await admin.storage.listBuckets();
  const hasDocumentsBucket = (buckets ?? []).some((bucket: { name: string }) => bucket.name === "mba-escola-documentos");

  if (!hasDocumentsBucket) {
    const { error: bucketError } = await admin.storage.createBucket("mba-escola-documentos", {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    });

    if (bucketError && !String(bucketError.message).toLowerCase().includes("already")) {
      console.error("[mba-escola] Não foi possível garantir o bucket privado:", bucketError.message);
    }
  }
}
