"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveGoogleAuthorization } from "@/lib/google-empresas/auth";
import {
  completeGoogleBusinessVerification,
  createGoogleBusinessLocation,
  fetchGoogleVerificationOptions,
  listGoogleBusinessAccounts,
  listGoogleBusinessLocations,
  listGoogleBusinessVerifications,
  resolveGoogleBusinessCategory,
  searchGoogleBusinessLocations,
  startGoogleBusinessVerification
} from "@/lib/google-empresas/google-api";
import { requireGoogleEmpresasAdmin, type GoogleEmpresa } from "@/lib/google-empresas/data";

const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export async function criarGoogleEmpresa(formData: FormData) {
  const current = await requireGoogleEmpresasAdmin("/google-empresas/nova");
  const supabase = getSupabaseAdmin() as any;
  const payload = buildEmpresaPayload(formData);
  const { data, error } = await supabase
    .from("gmb_empresas")
    .insert({ ...payload, criado_por: current.usuario.id })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/google-empresas/nova?error=${encodeURIComponent(error?.message ?? "Não foi possível cadastrar a empresa.")}`);
  }

  await logOperation(data.id, current.usuario.id, "empresa_criada", "sucesso", { nome: payload.nome });
  redirect(`/google-empresas/${data.id}?ok=${encodeURIComponent("Empresa cadastrada. Agora gere o link de autorização do cliente.")}`);
}

export async function atualizarGoogleEmpresa(formData: FormData) {
  const id = required(formData, "id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${id}`);
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase.from("gmb_empresas").update(buildEmpresaPayload(formData)).eq("id", id);

  if (error) redirectEmpresa(id, "error", error.message);
  await logOperation(id, current.usuario.id, "empresa_atualizada", "sucesso", {});
  revalidatePath(`/google-empresas/${id}`);
  redirectEmpresa(id, "ok", "Dados atualizados com sucesso.");
}

export async function gerarLinkAutorizacao(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;
  const empresa = await getEmpresaForAction(empresaId);

  await supabase
    .from("gmb_autorizacoes")
    .update({ status: "revogado", revogado_em: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("status", "pendente");

  const { data, error } = await supabase
    .from("gmb_autorizacoes")
    .insert({
      empresa_id: empresaId,
      email_cliente: text(formData, "email_cliente") || empresa.email_cliente,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select("id,public_token")
    .single();

  if (error || !data) redirectEmpresa(empresaId, "error", error?.message ?? "Não foi possível gerar o link.");

  await supabase.from("gmb_empresas").update({ status: "aguardando_cliente", ultimo_erro: null }).eq("id", empresaId);
  await logOperation(empresaId, current.usuario.id, "link_autorizacao_gerado", "sucesso", { autorizacao_id: data.id });
  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Link criado. Copie ou envie pelo WhatsApp ao cliente.");
}

export async function revogarAutorizacao(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const autorizacaoId = required(formData, "autorizacao_id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase
    .from("gmb_autorizacoes")
    .update({ status: "revogado", revogado_em: new Date().toISOString() })
    .eq("id", autorizacaoId)
    .eq("empresa_id", empresaId);

  if (error) redirectEmpresa(empresaId, "error", error.message);
  await logOperation(empresaId, current.usuario.id, "autorizacao_revogada", "sucesso", { autorizacao_id: autorizacaoId });
  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Autorização revogada.");
}

export async function selecionarContaGoogle(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const accountName = required(formData, "google_account_name");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase
    .from("gmb_empresas")
    .update({ google_account_name: accountName, ultimo_erro: null })
    .eq("id", empresaId);

  if (error) redirectEmpresa(empresaId, "error", error.message);
  await logOperation(empresaId, current.usuario.id, "conta_google_selecionada", "sucesso", { accountName });
  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Conta Google selecionada.");
}

export async function sincronizarComGoogle(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;

  try {
    const empresa = await getEmpresaForAction(empresaId);
    const { autorizacao, accessToken } = await getActiveGoogleAuthorization(empresaId);
    let accounts = autorizacao.google_accounts ?? [];

    if (!accounts.length) {
      accounts = await listGoogleBusinessAccounts(accessToken);
      await supabase.from("gmb_autorizacoes").update({ google_accounts: accounts }).eq("id", autorizacao.id);
    }

    const accountName = empresa.google_account_name ?? String(accounts[0]?.name ?? "");
    if (!accountName) throw new Error("A conta autorizada não possui uma conta do Perfil da Empresa disponível.");

    const ownedLocations = await listGoogleBusinessLocations(accessToken, accountName);
    const ownedMatch = findLocationMatch(empresa, ownedLocations);
    const possibleMatches = await searchGoogleBusinessLocations(accessToken, empresa);
    const bestPossible = possibleMatches[0] ?? null;
    const nextStatus = ownedMatch ? "criado" : "pronto_criacao";

    const { error } = await supabase
      .from("gmb_empresas")
      .update({
        google_account_name: accountName,
        google_location_name: ownedMatch?.name ?? empresa.google_location_name,
        google_place_id: ownedMatch?.metadata?.placeId ?? bestPossible?.location?.metadata?.placeId ?? empresa.google_place_id,
        google_maps_uri: ownedMatch?.metadata?.mapsUri ?? bestPossible?.location?.metadata?.mapsUri ?? empresa.google_maps_uri,
        google_status: {
          accounts,
          ownedLocations,
          possibleMatches,
          requestAdminRightsUri: bestPossible?.requestAdminRightsUri ?? null,
          syncedAt: new Date().toISOString()
        },
        status: nextStatus,
        ultimo_erro: null
      })
      .eq("id", empresaId);

    if (error) throw new Error(error.message);
    await logOperation(empresaId, current.usuario.id, "sincronizacao_google", "sucesso", {
      contas: accounts.length,
      locais: ownedLocations.length,
      correspondencias: possibleMatches.length,
      localEncontrado: Boolean(ownedMatch)
    });
  } catch (error) {
    const message = errorMessage(error);
    await markCompanyError(empresaId, message);
    await logOperation(empresaId, current.usuario.id, "sincronizacao_google", "erro", { erro: message });
    redirectEmpresa(empresaId, "error", message);
  }

  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Google sincronizado. Verifique as correspondências antes de criar um novo perfil.");
}

export async function criarPerfilNoGoogle(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;

  try {
    const empresa = await getEmpresaForAction(empresaId);
    if (empresa.google_location_name) throw new Error("Esta empresa já está vinculada a um perfil do Google.");
    if (!empresa.google_account_name) throw new Error("Selecione ou sincronize uma conta Google antes de criar o perfil.");

    const { accessToken } = await getActiveGoogleAuthorization(empresaId);
    const category = empresa.google_categoria_id
      ? { name: empresa.google_categoria_id, displayName: empresa.google_categoria_nome ?? empresa.categoria_principal }
      : await resolveGoogleBusinessCategory(accessToken, empresa.categoria_principal);

    if (!category?.name) {
      throw new Error("O Google não encontrou uma categoria válida. Ajuste a categoria principal e tente novamente.");
    }

    const location = await createGoogleBusinessLocation({
      accessToken,
      accountName: empresa.google_account_name,
      empresa,
      categoryId: String(category.name)
    });

    const { error } = await supabase
      .from("gmb_empresas")
      .update({
        google_categoria_id: String(category.name),
        google_categoria_nome: String(category.displayName ?? empresa.categoria_principal),
        google_location_name: location.name,
        google_place_id: location.metadata?.placeId ?? null,
        google_maps_uri: location.metadata?.mapsUri ?? null,
        google_status: { ...(empresa.google_status ?? {}), createdLocation: location, createdAt: new Date().toISOString() },
        status: "criado",
        ultimo_erro: null
      })
      .eq("id", empresaId);

    if (error) throw new Error(error.message);
    await logOperation(empresaId, current.usuario.id, "perfil_google_criado", "sucesso", { locationName: location.name });
  } catch (error) {
    const message = errorMessage(error);
    await markCompanyError(empresaId, message);
    await logOperation(empresaId, current.usuario.id, "perfil_google_criado", "erro", { erro: message });
    redirectEmpresa(empresaId, "error", message);
  }

  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Perfil criado no Google. Agora consulte as opções de verificação.");
}

export async function carregarOpcoesVerificacao(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;

  try {
    const empresa = await getEmpresaForAction(empresaId);
    if (!empresa.google_location_name) throw new Error("O perfil ainda não foi criado ou vinculado no Google.");
    const { accessToken } = await getActiveGoogleAuthorization(empresaId);
    const [options, verifications] = await Promise.all([
      fetchGoogleVerificationOptions(accessToken, empresa.google_location_name, empresa),
      listGoogleBusinessVerifications(accessToken, empresa.google_location_name)
    ]);
    const completed = verifications.some((item) => ["COMPLETED", "VERIFIED"].includes(String(item.state ?? item.status ?? "")));

    const { error } = await supabase
      .from("gmb_empresas")
      .update({
        verification_options: options,
        google_status: { ...(empresa.google_status ?? {}), verifications, verificationSyncedAt: new Date().toISOString() },
        status: completed ? "verificado" : "aguardando_verificacao",
        ultimo_erro: null
      })
      .eq("id", empresaId);
    if (error) throw new Error(error.message);
    await logOperation(empresaId, current.usuario.id, "opcoes_verificacao_consultadas", "sucesso", { opcoes: options.length });
  } catch (error) {
    const message = errorMessage(error);
    await markCompanyError(empresaId, message);
    await logOperation(empresaId, current.usuario.id, "opcoes_verificacao_consultadas", "erro", { erro: message });
    redirectEmpresa(empresaId, "error", message);
  }

  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Opções de verificação atualizadas.");
}

export async function iniciarVerificacao(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const method = required(formData, "method");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;

  try {
    const empresa = await getEmpresaForAction(empresaId);
    if (!empresa.google_location_name) throw new Error("O perfil ainda não foi criado ou vinculado no Google.");
    const { accessToken } = await getActiveGoogleAuthorization(empresaId);
    const verification = await startGoogleBusinessVerification({
      accessToken,
      locationName: empresa.google_location_name,
      method,
      emailUserName: text(formData, "email_user_name") || undefined,
      phoneNumber: text(formData, "phone_number") || undefined
    });

    const { error } = await supabase
      .from("gmb_empresas")
      .update({
        google_verification_name: verification.name ?? null,
        google_status: { ...(empresa.google_status ?? {}), currentVerification: verification },
        status: "aguardando_verificacao",
        ultimo_erro: null
      })
      .eq("id", empresaId);
    if (error) throw new Error(error.message);
    await logOperation(empresaId, current.usuario.id, "verificacao_iniciada", "sucesso", { method, verification });
  } catch (error) {
    const message = errorMessage(error);
    await markCompanyError(empresaId, message);
    await logOperation(empresaId, current.usuario.id, "verificacao_iniciada", "erro", { erro: message, method });
    redirectEmpresa(empresaId, "error", message);
  }

  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Verificação iniciada. Siga a instrução exibida pelo Google.");
}

export async function concluirVerificacao(formData: FormData) {
  const empresaId = required(formData, "empresa_id");
  const pin = required(formData, "pin");
  const current = await requireGoogleEmpresasAdmin(`/google-empresas/${empresaId}`);
  const supabase = getSupabaseAdmin() as any;

  try {
    const empresa = await getEmpresaForAction(empresaId);
    if (!empresa.google_verification_name) throw new Error("Nenhuma verificação por código está em andamento.");
    const { accessToken } = await getActiveGoogleAuthorization(empresaId);
    const result = await completeGoogleBusinessVerification(accessToken, empresa.google_verification_name, pin);
    const { error } = await supabase
      .from("gmb_empresas")
      .update({
        google_status: { ...(empresa.google_status ?? {}), completedVerification: result },
        status: "verificado",
        ultimo_erro: null
      })
      .eq("id", empresaId);
    if (error) throw new Error(error.message);
    await logOperation(empresaId, current.usuario.id, "verificacao_concluida", "sucesso", { result });
  } catch (error) {
    const message = errorMessage(error);
    await markCompanyError(empresaId, message);
    await logOperation(empresaId, current.usuario.id, "verificacao_concluida", "erro", { erro: message });
    redirectEmpresa(empresaId, "error", message);
  }

  revalidatePath(`/google-empresas/${empresaId}`);
  redirectEmpresa(empresaId, "ok", "Verificação concluída e registrada.");
}

async function getEmpresaForAction(id: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("gmb_empresas").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Empresa não encontrada.");
  return data as GoogleEmpresa;
}

function buildEmpresaPayload(formData: FormData) {
  return {
    nome: required(formData, "nome"),
    razao_social: text(formData, "razao_social") || null,
    cnpj: text(formData, "cnpj") || null,
    categoria_principal: required(formData, "categoria_principal"),
    categorias_secundarias: splitList(text(formData, "categorias_secundarias")),
    tipo_atendimento: text(formData, "tipo_atendimento") || "local",
    endereco_linha1: text(formData, "endereco_linha1") || null,
    endereco_linha2: text(formData, "endereco_linha2") || null,
    bairro: text(formData, "bairro") || null,
    cidade: text(formData, "cidade") || null,
    estado: text(formData, "estado").toUpperCase() || null,
    cep: text(formData, "cep") || null,
    pais: "BR",
    areas_atendimento: splitList(text(formData, "areas_atendimento")),
    telefone: text(formData, "telefone") || null,
    whatsapp: text(formData, "whatsapp") || null,
    email_cliente: text(formData, "email_cliente") || null,
    site: normalizeUrl(text(formData, "site")),
    descricao: text(formData, "descricao") || null,
    data_abertura: text(formData, "data_abertura") || null,
    horario_regular: buildSchedule(formData),
    observacoes: text(formData, "observacoes") || null,
    ultimo_erro: null
  };
}

function buildSchedule(formData: FormData) {
  const schedule: Record<string, unknown> = {};
  for (const day of weekDays) {
    const open = text(formData, `hours_${day}_open`);
    const close = text(formData, `hours_${day}_close`);
    const closed = formData.get(`hours_${day}_closed`) === "true";
    if (open || close || closed) schedule[day] = { open, close, closed };
  }
  return schedule;
}

function findLocationMatch(empresa: GoogleEmpresa, locations: Array<Record<string, any>>) {
  const wantedName = normalize(empresa.nome);
  const wantedCep = digits(empresa.cep ?? "");
  return locations.find((location) => {
    const sameName = normalize(String(location.title ?? "")) === wantedName;
    const locationCep = digits(String(location.storefrontAddress?.postalCode ?? ""));
    return sameName && (!wantedCep || !locationCep || wantedCep === locationCep);
  });
}

async function markCompanyError(empresaId: string, message: string) {
  const supabase = getSupabaseAdmin() as any;
  await supabase.from("gmb_empresas").update({ status: "erro", ultimo_erro: message }).eq("id", empresaId);
}

async function logOperation(
  empresaId: string,
  usuarioId: string,
  tipo: string,
  status: "sucesso" | "erro" | "pendente",
  detalhes: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin() as any;
  await supabase.from("gmb_operacoes").insert({ empresa_id: empresaId, usuario_id: usuarioId, tipo, status, detalhes });
}

function required(formData: FormData, name: string) {
  const value = text(formData, name);
  if (!value) throw new Error(`O campo ${name} é obrigatório.`);
  return value;
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function splitList(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeUrl(value: string) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

function redirectEmpresa(id: string, type: "ok" | "error", message: string): never {
  redirect(`/google-empresas/${id}?${type}=${encodeURIComponent(message)}`);
}
