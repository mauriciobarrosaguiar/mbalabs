import "server-only";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export type CotacoesTenantBridge = {
  id: string;
  cnpj: string;
  nomeFantasia: string;
  razaoSocial: string;
  tipoCliente: string;
  status: string;
  responsavelEmail?: string;
  responsavelWhatsapp?: string;
};

/**
 * O SSO permanece no MBA Labs. Somente a associação do aplicativo MBA Cotações
 * é gerenciada pelo módulo, sem alterar planos/assinaturas dos demais sistemas.
 */
export async function syncCotacoesCompanyAccess(tenant: CotacoesTenantBridge) {
  const supabase = createSupabaseAdminClient();
  const cnpj = tenant.cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new Error("Informe CNPJ válido de 14 dígitos para liberar o acesso ao MBA Cotações.");
  const { data: app, error: appError } = await supabase.from("core_apps").select("id")
    .in("slug", ["mba-cotacoes", "mbacotacoes"]).limit(1).maybeSingle();
  if (appError) throw appError;
  if (!app) throw new Error("Aplicativo MBA Cotações não cadastrado no portal MBA Labs.");

  const { data: currentTenant, error: tenantError } = await supabase.from("tenants")
    .select("core_empresa_id").eq("id", tenant.id).single();
  if (tenantError) throw tenantError;

  let companyId = currentTenant?.core_empresa_id as string | null;
  if (companyId) {
    // Um CNPJ de um tenant nunca pode herdar o cadastro central de outra empresa.
    const { data: linked, error: linkedError } = await supabase.from("core_empresas")
      .select("id,cnpj").eq("id", companyId).maybeSingle();
    if (linkedError) throw linkedError;
    if (!linked) throw new Error("Vinculo da empresa MBA Labs nao encontrado. Contate o administrador.");
    const linkedCnpj = String(linked.cnpj ?? "").replace(/\\D/g, "");
    if (linkedCnpj && linkedCnpj !== cnpj) {
      throw new Error("O CNPJ difere da empresa ja vinculada ao MBA Labs. Corrija o cadastro central.");
    }
  }
  if (!companyId) {
    // Busca os dois formatos de CNPJ: o portal central pode armazenar CNPJ pontuado.
    const formattedCnpj = cnpj.replace(/^(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})$/, "$1.$2.$3/$4-$5");
    const { data: matches, error: existingError } = await supabase.from("core_empresas")
      .select("id,cnpj").in("cnpj", [cnpj, formattedCnpj]).limit(2);
    if (existingError) throw existingError;
    if ((matches?.length ?? 0) > 1) throw new Error("Mais de uma empresa MBA Labs possui este CNPJ. Contate o administrador.");
    companyId = matches?.[0]?.id ?? null;
  }
  if (!companyId) {
    // Farmacias e drogarias sao classificadas automaticamente como Drogaria.
    // O tipo de modulo nao altera a categoria de empresas ja existentes no MBA Labs.
    const categorySlug = tenant.tipoCliente === "distributor_bidding" ? "distribuidora" : "drogaria";
    const { data: category, error: categoryError } = await supabase.from("core_empresa_categorias")
      .select("id").eq("slug", categorySlug).eq("status", "ativa").maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) throw new Error("Categoria da empresa indisponivel no MBA Labs. Contate o administrador.");

    const { data: created, error: createError } = await supabase.from("core_empresas")
      .insert({
        categoria_id: category.id,
        nome: tenant.razaoSocial || tenant.nomeFantasia,
        nome_fantasia: tenant.nomeFantasia,
        razao_social: tenant.razaoSocial || tenant.nomeFantasia,
        cnpj,
        status: "ativa",
        email: tenant.responsavelEmail || null,
        whatsapp: tenant.responsavelWhatsapp || null,
      }).select("id").single();
    if (createError) throw createError;
    companyId = created.id;
  }

  if (companyId !== currentTenant?.core_empresa_id) {
    const { error } = await supabase.from("tenants")
      .update({ core_empresa_id: companyId }).eq("id", tenant.id);
    if (error) throw error;
  }

  const status = tenant.status === "cancelado" ? "cancelado"
    : tenant.status === "suspenso" ? "bloqueado"
    : tenant.status === "teste" ? "teste" : "ativo";
  const { error: assignmentError } = await supabase.from("core_empresa_apps").upsert({
    empresa_id: companyId,
    app_id: app.id,
    status,
    cotacoes_tipo_acesso: tenant.tipoCliente,
    updated_at: new Date().toISOString(),
  }, { onConflict: "empresa_id,app_id" });
  if (assignmentError) throw assignmentError;
  return companyId;
}
