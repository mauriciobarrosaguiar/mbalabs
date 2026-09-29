import { createClient } from "@supabase/supabase-js";
import { QA_TENANTS, requireQaEnvironment } from "./qa-safety.mjs";

const { url, serviceRoleKey, projectRef } = requireQaEnvironment();
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tenantNames = QA_TENANTS.map((tenant) => tenant.name);
const tenantCnpjs = QA_TENANTS.map((tenant) => tenant.cnpj);
const { data: tenants, error: tenantsError } = await supabase
  .from("tenants")
  .select("id,core_empresa_id,nome_fantasia,cnpj,status")
  .in("nome_fantasia", tenantNames)
  .in("cnpj", tenantCnpjs)
  .eq("status", "teste");
if (tenantsError) throw tenantsError;

const tenantIds = (tenants ?? []).map((tenant) => tenant.id);
const coreCompanyIds = (tenants ?? []).map((tenant) => tenant.core_empresa_id).filter(Boolean);
if (tenantIds.length === 0) {
  console.log(`Nenhum tenant QA encontrado no projeto ${projectRef}.`);
  process.exit(0);
}

const { data: memberships, error: membershipsError } = await supabase
  .from("tenant_users")
  .select("user_profile_id")
  .in("tenant_id", tenantIds);
if (membershipsError) throw membershipsError;
const profileIds = [...new Set((memberships ?? []).map((membership) => membership.user_profile_id))];

let authUserIds = [];
if (profileIds.length > 0) {
  const { data: profiles, error: profilesError } = await supabase
    .from("users_profile")
    .select("id,auth_user_id,email")
    .in("id", profileIds)
    .like("email", "%@example.invalid");
  if (profilesError) throw profilesError;
  authUserIds = (profiles ?? []).map((profile) => profile.auth_user_id).filter(Boolean);
}

const { error: deleteTenantError } = await supabase.from("tenants").delete().in("id", tenantIds).eq("status", "teste");
if (deleteTenantError) throw deleteTenantError;

if (profileIds.length > 0) {
  const { error: deleteProfilesError } = await supabase
    .from("users_profile")
    .delete()
    .in("id", profileIds)
    .like("email", "%@example.invalid");
  if (deleteProfilesError) throw deleteProfilesError;
}

if (coreCompanyIds.length > 0) {
  const { error: deleteCoreCompaniesError } = await supabase
    .from("core_empresas")
    .delete()
    .in("id", coreCompanyIds)
    .in("cnpj", tenantCnpjs)
    .eq("status", "teste");
  if (deleteCoreCompaniesError) throw deleteCoreCompaniesError;
}

for (const authUserId of authUserIds) {
  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  if (error) throw error;
}

console.log(`Cleanup MBA Cotações QA concluído no projeto ${projectRef}: ${tenantIds.length} tenants removidos.`);
