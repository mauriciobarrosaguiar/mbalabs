import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");
loadEnvFile(".env");

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAIL",
  "ADMIN_NAME",
];

const missing = required.filter((key) => !process.env[key]);
const password = process.env.ADMIN_PASSWORD_TEMP || process.env.ADMIN_PASSWORD;
if (!password) missing.push("ADMIN_PASSWORD ou ADMIN_PASSWORD_TEMP");

if (missing.length > 0) {
  console.error(`Variaveis ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const email = process.env.ADMIN_EMAIL;
const name = process.env.ADMIN_NAME;
const forcePasswordChange = parseBoolean(process.env.ADMIN_FORCE_PASSWORD_CHANGE);

const authUser = await getOrCreateUser(email, password, name, forcePasswordChange);
const profileId = await upsertSuperAdminProfile(authUser.id, email, name, forcePasswordChange);
const planId = await ensureInitialPlan();
const tenantId = await ensureInitialTenant(planId);
await ensureTenantUser(tenantId, profileId);

console.log(`Admin configurado: ${email}`);
console.log(`Senha temporaria definida. Troca obrigatoria no primeiro login: ${forcePasswordChange ? "sim" : "nao"}`);

async function getOrCreateUser(userEmail, userPassword, userName, mustChangePassword) {
  const existing = await findUserByEmail(userEmail);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: userName,
        must_change_password: mustChangePassword,
      },
    });
    if (updateError) throw updateError;
    const refreshed = await findUserByEmail(userEmail);
    if (!refreshed) throw new Error("Usuario atualizado, mas nao encontrado apos refresh.");
    return refreshed;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
    user_metadata: {
      full_name: userName,
      must_change_password: mustChangePassword,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error("Supabase nao retornou o usuario criado.");
  return data.user;
}

async function findUserByEmail(userEmail) {
  let page = 1;
  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === userEmail.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  return null;
}

async function upsertSuperAdminProfile(authUserId, userEmail, userName, mustChangePassword) {
  const { data, error } = await supabase.from("users_profile").upsert(
    {
      auth_user_id: authUserId,
      full_name: userName,
      email: userEmail,
      role: "SUPER_ADMIN",
      status: "ativo",
      must_change_password: mustChangePassword,
    },
    { onConflict: "auth_user_id" },
  ).select("id").single();

  if (error) throw error;
  return data.id;
}

async function ensureInitialPlan() {
  const { data: existing, error: findError } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("name", "Plano Inicial")
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({
      name: "Plano Inicial",
      description: "Plano criado pelo setup inicial",
      monthly_price: 0,
      max_users: 5,
      max_quotations_month: 100,
      modules: "both",
      status: "ativo",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function ensureInitialTenant(planId) {
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("cnpj", "00000000000000")
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (tenant?.id) return tenant.id;

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      nome_fantasia: "Empresa Inicial",
      razao_social: "Empresa Inicial",
      cnpj: "00000000000000",
      tipo_cliente: "both",
      responsavel_nome: name,
      responsavel_email: email,
      responsavel_whatsapp: "",
      plano_id: planId,
      status: "ativo",
      valor_mensal: 0,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function ensureTenantUser(tenantId, userProfileId) {
  const { error } = await supabase.from("tenant_users").upsert(
    {
      tenant_id: tenantId,
      user_profile_id: userProfileId,
      role: "ADMIN_EMPRESA",
      status: "ativo",
    },
    { onConflict: "tenant_id,user_profile_id" },
  );

  if (error) throw error;
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseBoolean(value) {
  return String(value ?? "false").toLowerCase() === "true";
}
