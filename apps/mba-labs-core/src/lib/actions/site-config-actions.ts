"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, logAction } from "@/lib/core-data";
import { booleanValue, messageParam, textValue } from "@/lib/form-utils";
import { defaultSiteConfig, mergeSiteConfig } from "@/lib/site-config";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveSiteConfig(formData: FormData) {
  const current = await getCurrentUserProfile("/admin/site");

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const benefits = Array.from({ length: 6 }, (_, index) => textValue(formData, `benefit_${index}`)).filter(Boolean);
  const systems = defaultSiteConfig.systems.map((system) => ({
    ...system,
    name: textValue(formData, `system_${system.key}_name`) || system.name,
    description: textValue(formData, `system_${system.key}_description`) || system.description,
    cta: textValue(formData, `system_${system.key}_cta`) || system.cta,
    visible: booleanValue(formData, `system_${system.key}_visible`)
  }));

  const config = mergeSiteConfig({
    brandName: textValue(formData, "brandName") || defaultSiteConfig.brandName,
    logoUrl: textValue(formData, "logoUrl"),
    heroEyebrow: textValue(formData, "heroEyebrow") || defaultSiteConfig.heroEyebrow,
    heroTitle: textValue(formData, "heroTitle") || defaultSiteConfig.heroTitle,
    heroSubtitle: textValue(formData, "heroSubtitle") || defaultSiteConfig.heroSubtitle,
    heroSupportText: textValue(formData, "heroSupportText") || defaultSiteConfig.heroSupportText,
    primaryButtonText: textValue(formData, "primaryButtonText") || defaultSiteConfig.primaryButtonText,
    whatsappButtonText: textValue(formData, "whatsappButtonText") || defaultSiteConfig.whatsappButtonText,
    whatsappUrl: textValue(formData, "whatsappUrl") || defaultSiteConfig.whatsappUrl,
    sideEyebrow: textValue(formData, "sideEyebrow") || defaultSiteConfig.sideEyebrow,
    sideTitle: textValue(formData, "sideTitle") || defaultSiteConfig.sideTitle,
    sideText: textValue(formData, "sideText") || defaultSiteConfig.sideText,
    systemsTitle: textValue(formData, "systemsTitle") || defaultSiteConfig.systemsTitle,
    systems,
    benefitsTitle: textValue(formData, "benefitsTitle") || defaultSiteConfig.benefitsTitle,
    benefits: benefits.length > 0 ? benefits : defaultSiteConfig.benefits,
    footerText: textValue(formData, "footerText") || defaultSiteConfig.footerText,
    primaryColor: textValue(formData, "primaryColor") || defaultSiteConfig.primaryColor,
    secondaryColor: textValue(formData, "secondaryColor") || defaultSiteConfig.secondaryColor
  });

  const supabase = await getSupabaseServer();
  const { error } = await (supabase as any).from("core_configuracoes_site").upsert(
    {
      chave: "landing",
      tipo: "json",
      ativo: true,
      config,
      updated_at: new Date().toISOString()
    },
    { onConflict: "chave" }
  );

  if (error) {
    redirect(`/admin/site?error=${messageParam(error.message)}`);
  }

  await logAction({ acao: "editar configuracoes do site", detalhes: { chave: "landing" } });
  revalidatePath("/");
  revalidatePath("/admin/site");
  redirect(`/admin/site?ok=${messageParam("Configuracoes do site salvas com sucesso.")}`);
}
