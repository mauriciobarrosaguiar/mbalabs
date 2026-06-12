"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/modules/cotacoes/lib/supabase/server";

export async function savePaymentSettingsAction(formData: FormData) {
  await requireSuperAdmin("/admin/configuracoes/pagamentos");

  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role nao configurado.");
  }

  const supabase = createSupabaseAdminClient();
  const provider = text(formData.get("provider")) || "efi";
  const clientSecret = text(formData.get("clientSecret"));

  const { data: current } = await supabase
    .from("payment_settings")
    .select("client_secret")
    .eq("provider", provider)
    .maybeSingle();

  const { error } = await supabase
    .from("payment_settings")
    .upsert(
      {
        provider,
        environment: text(formData.get("environment")) || "sandbox",
        pix_key: text(formData.get("pixKey")),
        client_id: text(formData.get("clientId")),
        client_secret: clientSecret || current?.client_secret || null,
        certificate_reference: text(formData.get("certificateReference")),
        webhook_url: text(formData.get("webhookUrl")),
        receiver_account: text(formData.get("receiverAccount")),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/configuracoes/pagamentos");
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
