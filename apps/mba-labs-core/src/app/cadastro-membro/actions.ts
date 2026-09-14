"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { validateElshadayMemberRegistrationToken } from "@/lib/elshaday-member-registration";

const ELSHADAY_SLUG = "assembleia-de-deus-elshaday-palmas";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optional(formData: FormData, name: string) {
  const result = value(formData, name);
  return result || null;
}

function optionalDate(formData: FormData, name: string) {
  const result = value(formData, name);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

function digits(input: string) {
  return input.replace(/\D/g, "");
}

function formatCpf(input: string) {
  const cpf = digits(input);
  if (cpf.length !== 11) return input.trim();
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function go(convite: string, kind: "ok" | "erro", message: string): never {
  redirect("/cadastro-membro?convite=" + encodeURIComponent(convite) + "&" + kind + "=" + encodeURIComponent(message));
}

async function cleanupPartialSignup(admin: any, ids: {
  churchId: string;
  empresaId: string;
  authUserId?: string | null;
  coreUserId?: string | null;
}) {
  const authUserId = ids.authUserId || null;
  const coreUserId = ids.coreUserId || null;

  try {
    if (authUserId) {
      await admin.from("igreja_membros").delete().eq("igreja_id", ids.churchId).eq("user_id", authUserId);
      await admin.from("igreja_perfis").delete().eq("igreja_id", ids.churchId).eq("user_id", authUserId);
    }
  } catch {}

  try {
    if (coreUserId) {
      await admin.from("core_usuario_app_permissoes").delete().eq("usuario_id", coreUserId).eq("empresa_id", ids.empresaId);
      await admin.from("core_usuarios").delete().eq("id", coreUserId).eq("empresa_id", ids.empresaId);
    }
  } catch {}

  try {
    if (authUserId) await admin.auth.admin.deleteUser(authUserId);
  } catch {}
}

export async function registerPublicElshadayMember(formData: FormData) {
  const convite = value(formData, "convite");

  if (value(formData, "website")) {
    go(convite, "ok", "Cadastro enviado com sucesso.");
  }

  const admin = createSupabaseAdminClient() as any;
  const { data: church, error: churchError } = await admin
    .from("igreja_igrejas")
    .select("id,empresa_id")
    .eq("slug", ELSHADAY_SLUG)
    .eq("ativa", true)
    .maybeSingle();

  if (churchError || !church?.id || !convite || !validateElshadayMemberRegistrationToken(church.id, convite)) {
    redirect("/login?app=elshaday");
  }

  if (!church.empresa_id) {
    go(convite, "erro", "A igreja ainda não está pronta para criar acessos. Procure a administração.");
  }

  const nome = value(formData, "nome");
  const whatsapp = digits(value(formData, "whatsapp"));
  const telefone = digits(value(formData, "telefone"));
  const email = value(formData, "email").toLowerCase();
  const senha = value(formData, "senha");
  const confirmarSenha = value(formData, "confirmar_senha");
  const cpfRaw = value(formData, "cpf");
  const cpf = digits(cpfRaw);
  const consent = value(formData, "consentimento") === "on";

  if (nome.length < 3) go(convite, "erro", "Informe seu nome completo.");
  if (!email || !email.includes("@")) go(convite, "erro", "Informe um e-mail válido para criar seu acesso.");
  if (senha.length < 8) go(convite, "erro", "Crie uma senha com pelo menos 8 caracteres.");
  if (senha !== confirmarSenha) go(convite, "erro", "A confirmação da senha não confere.");
  if (!whatsapp && !telefone) go(convite, "erro", "Informe um WhatsApp ou telefone para contato.");
  if (cpf && cpf.length !== 11) go(convite, "erro", "Confira o CPF informado.");
  if (!consent) go(convite, "erro", "É necessário autorizar o uso dos dados para o cadastro.");

  const { data: existingMember } = await admin
    .from("igreja_membros")
    .select("id,user_id")
    .eq("igreja_id", church.id)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingMember?.id) {
    go(convite, "erro", "Já existe um cadastro com este e-mail. Use a opção de entrar ou procure a secretaria.");
  }

  if (cpf) {
    const { data } = await admin
      .from("igreja_membros")
      .select("id")
      .eq("igreja_id", church.id)
      .in("cpf", [cpf, formatCpf(cpf)])
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      go(convite, "erro", "Já existe um cadastro com este CPF. Procure a secretaria para atualizar seus dados.");
    }
  }

  const { data: existingCore } = await admin
    .from("core_usuarios")
    .select("id,empresa_id,status")
    .ilike("email", email);

  if ((existingCore ?? []).length > 0) {
    go(convite, "erro", "Já existe uma conta com este e-mail. Use a tela de login ou a recuperação de senha.");
  }

  const { data: app, error: appError } = await admin
    .from("core_apps")
    .select("id")
    .eq("slug", "elshaday")
    .maybeSingle();

  if (appError || !app?.id) {
    go(convite, "erro", "Não foi possível localizar o aplicativo Elshaday para concluir o cadastro.");
  }

  let authUserId: string | null = null;
  let coreUserId: string | null = null;

  try {
    const authResult = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome,
        origem: "elshaday-autocadastro",
        igreja_id: church.id
      }
    });

    if (authResult.error || !authResult.data?.user?.id) {
      const rawMessage = String(authResult.error?.message ?? "").toLowerCase();
      if (rawMessage.includes("already") || rawMessage.includes("registered") || rawMessage.includes("exists")) {
        throw new Error("ACCOUNT_EXISTS");
      }
      throw authResult.error ?? new Error("CREATE_ACCOUNT_FAILED");
    }

    authUserId = authResult.data.user.id;

    const { data: coreUser, error: coreError } = await admin
      .from("core_usuarios")
      .insert({
        auth_user_id: authUserId,
        empresa_id: church.empresa_id,
        nome,
        email,
        telefone: whatsapp || telefone || null,
        tipo: "usuario",
        tipo_global: "usuario",
        status: "ativo"
      })
      .select("id")
      .single();

    if (coreError || !coreUser?.id) throw coreError ?? new Error("PREPARE_ACCESS_FAILED");
    coreUserId = coreUser.id;

    const { error: permissionError } = await admin
      .from("core_usuario_app_permissoes")
      .insert({
        usuario_id: coreUserId,
        empresa_id: church.empresa_id,
        app_id: app.id,
        perfil_app: "membro",
        status: "pendente"
      });
    if (permissionError) throw permissionError;

    const { error: profileError } = await admin
      .from("igreja_perfis")
      .insert({
        igreja_id: church.id,
        user_id: authUserId,
        papel: "membro",
        ativo: false
      });
    if (profileError) throw profileError;

    const observacaoInformada = optional(formData, "observacoes");
    const observacoes = [
      "Autocadastro realizado pelo aplicativo. Acesso aguardando aprovação da igreja.",
      observacaoInformada ? "Informação do membro: " + observacaoInformada : null
    ]
      .filter(Boolean)
      .join("\n");

    const { error: memberError } = await admin.from("igreja_membros").insert({
      igreja_id: church.id,
      user_id: authUserId,
      nome,
      data_nascimento: optionalDate(formData, "data_nascimento"),
      cpf: cpf || null,
      telefone: telefone || null,
      whatsapp: whatsapp || null,
      email,
      endereco: optional(formData, "endereco"),
      bairro: optional(formData, "bairro"),
      cidade: optional(formData, "cidade") || "Palmas",
      estado: (optional(formData, "estado") || "TO").toUpperCase().slice(0, 2),
      data_conversao: optionalDate(formData, "data_conversao"),
      data_batismo: optionalDate(formData, "data_batismo"),
      data_entrada: optionalDate(formData, "data_entrada"),
      cargo: "Membro",
      ministerio: optional(formData, "ministerio"),
      situacao: "ativo",
      observacoes
    });

    if (memberError) throw memberError;
  } catch (error) {
    await cleanupPartialSignup(admin, {
      churchId: church.id,
      empresaId: church.empresa_id,
      authUserId,
      coreUserId
    });

    const message = error instanceof Error ? error.message : "";
    if (message === "ACCOUNT_EXISTS") {
      go(convite, "erro", "Já existe uma conta com este e-mail. Use a tela de login ou recupere sua senha.");
    }

    go(convite, "erro", "Não foi possível concluir o cadastro. Tente novamente ou procure a secretaria.");
  }

  revalidatePath("/elshaday/membros");
  revalidatePath("/elshaday/acessos");
  go(
    convite,
    "ok",
    "Sua conta foi criada. Agora ela aguarda aprovação da igreja. Depois da liberação, entre com este e-mail e a senha que você acabou de criar."
  );
}
