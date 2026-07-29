import { redirect } from "next/navigation";
import { getCurrentUserProfile, isSuperAdminType } from "@/lib/core-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type GoogleEmpresa = {
  id: string;
  criado_por: string | null;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  categoria_principal: string;
  google_categoria_id: string | null;
  google_categoria_nome: string | null;
  categorias_secundarias: string[];
  tipo_atendimento: "local" | "area_servico" | "hibrido";
  endereco_linha1: string | null;
  endereco_linha2: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string;
  areas_atendimento: string[];
  telefone: string | null;
  whatsapp: string | null;
  email_cliente: string | null;
  site: string | null;
  descricao: string | null;
  data_abertura: string | null;
  horario_regular: Record<string, unknown>;
  status: string;
  google_account_name: string | null;
  google_location_name: string | null;
  google_place_id: string | null;
  google_maps_uri: string | null;
  google_verification_name: string | null;
  verification_options: Array<Record<string, unknown>>;
  google_status: Record<string, unknown>;
  ultimo_erro: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleAutorizacao = {
  id: string;
  empresa_id: string;
  public_token: string;
  email_cliente: string | null;
  status: string;
  expires_at: string;
  autorizado_em: string | null;
  revogado_em: string | null;
  google_email: string | null;
  google_subject: string | null;
  google_accounts: Array<Record<string, unknown>>;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  oauth_state: string | null;
  oauth_state_expires_at: string | null;
  ultimo_erro: string | null;
  created_at: string;
  updated_at: string;
};

export async function requireGoogleEmpresasAdmin(nextPath = "/google-empresas") {
  const current = await getCurrentUserProfile(nextPath);

  if (!current.isAdminMaster && !isSuperAdminType(current.tipo)) {
    redirect("/dashboard");
  }

  return current;
}

export async function getGoogleEmpresasDashboard() {
  await requireGoogleEmpresasAdmin();
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("gmb_empresas")
    .select("*")
    .neq("status", "arquivado")
    .order("updated_at", { ascending: false });

  if (error) {
    return { empresas: [] as GoogleEmpresa[], error: error.message };
  }

  return { empresas: (data ?? []) as GoogleEmpresa[], error: null };
}

export async function getGoogleEmpresa(id: string) {
  await requireGoogleEmpresasAdmin(`/google-empresas/${id}`);
  const supabase = getSupabaseAdmin() as any;
  const [{ data: empresa, error: empresaError }, { data: autorizacoes, error: autorizacoesError }, { data: operacoes }] =
    await Promise.all([
      supabase.from("gmb_empresas").select("*").eq("id", id).maybeSingle(),
      supabase.from("gmb_autorizacoes").select("*").eq("empresa_id", id).order("created_at", { ascending: false }),
      supabase.from("gmb_operacoes").select("*").eq("empresa_id", id).order("created_at", { ascending: false }).limit(20)
    ]);

  return {
    empresa: (empresa ?? null) as GoogleEmpresa | null,
    autorizacoes: (autorizacoes ?? []) as GoogleAutorizacao[],
    operacoes: (operacoes ?? []) as Array<Record<string, unknown>>,
    error: empresaError?.message ?? autorizacoesError?.message ?? null
  };
}

export async function getPublicGoogleAuthorization(token: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data: autorizacao, error } = await supabase
    .from("gmb_autorizacoes")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !autorizacao) {
    return { autorizacao: null, empresa: null, error: "Link de autorização não encontrado." };
  }

  const auth = autorizacao as GoogleAutorizacao;
  const expired = new Date(auth.expires_at).getTime() < Date.now();

  if (expired && auth.status === "pendente") {
    await supabase.from("gmb_autorizacoes").update({ status: "expirado" }).eq("id", auth.id);
    auth.status = "expirado";
  }

  const { data: empresa } = await supabase
    .from("gmb_empresas")
    .select("id,nome,razao_social,cnpj,categoria_principal,endereco_linha1,endereco_linha2,bairro,cidade,estado,cep,telefone,site,email_cliente,status")
    .eq("id", auth.empresa_id)
    .maybeSingle();

  return {
    autorizacao: auth,
    empresa: empresa as Partial<GoogleEmpresa> | null,
    error: null
  };
}

export function getGoogleEmpresasBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_CORE_URL ??
    "https://www.mbalabs.com.br"
  ).replace(/\/$/, "");
}

export function getClientAuthorizationUrl(publicToken: string) {
  return `${getGoogleEmpresasBaseUrl()}/google-empresas/autorizar/${publicToken}`;
}

export function formatGoogleEmpresaStatus(status: string) {
  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    aguardando_cliente: "Aguardando cliente",
    autorizado: "Conta autorizada",
    pronto_criacao: "Pronto para criar",
    criado: "Perfil criado",
    aguardando_verificacao: "Aguardando verificação",
    verificado: "Verificado",
    erro: "Com erro",
    arquivado: "Arquivado"
  };

  return labels[status] ?? status;
}
