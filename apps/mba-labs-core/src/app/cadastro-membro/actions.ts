"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@mba-labs/shared/supabase/server";
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

  let sessionClient: ReturnType<typeof createSupabaseServerClient> | null = null;
  let sessionUser: any = null;

  try {
    const cookieStore = await cookies();
    sessionClient = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      set: (name, cookieValue, options) => cookieStore.set(name, cookieValue, options as any)
    });
    const sessionResult = await sessionClient.auth.getUser();
    sessionUser = sessionResult.data?.user ?? null;
  } catch {
    sessionClient = null;
    sessionUser = null;
  }

  const inviteMetadata = sessionUser?.user_metadata ?? {};
  const isChurchInvite =
    Boolean(sessionUser?.id && sessionUser?.email) &&
    inviteMetadata.origem === "elshaday-convite-cadastro" &&
    String(inviteMetadata.igreja_id ?? "") === String(church.id);

  const nome = value(formData, "nome");
  const whatsapp = digits(value(formData, "whatsapp"));
  const telefone = digits(value(formData, "telefone"));
  const typedEmail = value(formData, "email").toLowerCase();
  const email = isChurchInvite ? String(sessionUser.email).toLowerCase() : typedEmail;
  const senha = value(formData, "senha");
  const confirmarSenha = value(formData, "confirmar_senha");
  const cpfRaw = value(formData, "cpf");
  const cpf = digits(cpfRaw);
  const consent = value(formData, "consentimento") === "on";
  const requestedRoleId = optional(formData, "cargo_solicitado_id");
  const invitedMemberId = isChurchInvite && inviteMetadata.membro_id
    ? String(inviteMetadata.membro_id)
    : null;

  if (nome.length < 3) go(convite, "erro", "Informe seu nome completo.");
  if (!email || !email.includes("@")) go(convite, "erro", "Informe um e-mail válido para criar seu acesso.");
  if (isChurchInvite && typedEmail !== email) {
    go(convite, "erro", "Use o mesmo e-mail que recebeu o convite da igreja.");
  }
  if (senha.length < 8) go(convite, "erro", "Crie uma senha com pelo menos 8 caracteres.");
  if (senha !== confirmarSenha) go(convite, "erro", "A confirmação da senha não confere.");
  if (!whatsapp && !telefone) go(convite, "erro", "Informe um WhatsApp ou telefone para contato.");
  if (cpf && cpf.length !== 11) go(convite, "erro", "Confira o CPF informado.");
  if (!consent) go(convite, "erro", "É necessário autorizar o uso dos dados para o cadastro.");

  let requestedRole: { id: string; nome: string } | null = null;
  if (requestedRoleId) {
    const { data, error } = await admin
      .from("igreja_cargos")
      .select("id,nome")
      .eq("id", requestedRoleId)
      .eq("igreja_id", church.id)
      .eq("ativo", true)
      .maybeSingle();

    if (error || !data?.id) go(convite, "erro", "O cargo informado não está disponível.");
    if (String(data.nome).toLocaleLowerCase("pt-BR") !== "membro") {
      requestedRole = { id: String(data.id), nome: String(data.nome) };
    }
  }

  let existingMember: any = null;
  if (invitedMemberId) {
    const { data, error } = await admin
      .from("igreja_membros")
      .select("id,user_id,cargo_id,observacoes")
      .eq("igreja_id", church.id)
      .eq("id", invitedMemberId)
      .maybeSingle();
    if (error || !data) go(convite, "erro", "A ficha vinculada a este convite não foi encontrada.");
    existingMember = data;
  } else {
    const { data } = await admin
      .from("igreja_membros")
      .select("id,user_id,cargo_id,observacoes")
      .eq("igreja_id", church.id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    existingMember = data ?? null;
  }

  if (existingMember?.id && !isChurchInvite) {
    go(convite, "erro", "Já existe um cadastro com este e-mail. Use a opção de entrar ou procure a secretaria.");
  }
  if (
    existingMember?.user_id &&
    isChurchInvite &&
    String(existingMember.user_id) !== String(sessionUser.id)
  ) {
    go(convite, "erro", "Esta ficha já está vinculada a outro acesso. Procure a secretaria.");
  }

  if (cpf) {
    const { data } = await admin
      .from("igreja_membros")
      .select("id")
      .eq("igreja_id", church.id)
      .in("cpf", [cpf, formatCpf(cpf)]);

    const duplicate = (data ?? []).find((row: any) => String(row.id) !== String(existingMember?.id ?? ""));
    if (duplicate) {
      go(convite, "erro", "Já existe um cadastro com este CPF. Procure a secretaria para atualizar seus dados.");
    }
  }

  const { data: existingCoreRows } = await admin
    .from("core_usuarios")
    .select("id,auth_user_id,empresa_id,status")
    .ilike("email", email);

  const existingCore = (existingCoreRows ?? []).find(
    (row: any) => String(row.empresa_id) === String(church.empresa_id)
  ) ?? null;
  const foreignCore = (existingCoreRows ?? []).find(
    (row: any) => String(row.empresa_id) !== String(church.empresa_id)
  );

  if (foreignCore) {
    go(convite, "erro", "Este e-mail já pertence a outra organização. Procure a secretaria.");
  }
  if (!isChurchInvite && existingCore) {
    go(convite, "erro", "Já existe uma conta com este e-mail. Use a tela de login ou a recuperação de senha.");
  }
  if (
    isChurchInvite &&
    existingCore?.auth_user_id &&
    String(existingCore.auth_user_id) !== String(sessionUser.id)
  ) {
    go(convite, "erro", "Este e-mail já está vinculado a outro acesso. Procure a secretaria.");
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
    if (isChurchInvite) {
      authUserId = String(sessionUser.id);
      const { error: passwordError } = await admin.auth.admin.updateUserById(authUserId, {
        password: senha,
        email_confirm: true,
        user_metadata: {
          ...inviteMetadata,
          nome,
          cadastro_concluido_em: new Date().toISOString()
        }
      });
      if (passwordError) throw passwordError;
    } else {
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
    }

    let coreUser = existingCore;
    if (!coreUser) {
      const { data, error } = await admin
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
      if (error || !data?.id) throw error ?? new Error("PREPARE_ACCESS_FAILED");
      coreUser = data;
    } else {
      const { data, error } = await admin
        .from("core_usuarios")
        .update({
          auth_user_id: authUserId,
          nome,
          telefone: whatsapp || telefone || null,
          status: "ativo",
          updated_at: new Date().toISOString()
        })
        .eq("id", coreUser.id)
        .eq("empresa_id", church.empresa_id)
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("PREPARE_ACCESS_FAILED");
      coreUser = data;
    }
    coreUserId = String(coreUser.id);

    const { error: permissionError } = await admin
      .from("core_usuario_app_permissoes")
      .upsert({
        usuario_id: coreUserId,
        empresa_id: church.empresa_id,
        app_id: app.id,
        perfil_app: "membro",
        status: "pendente",
        updated_at: new Date().toISOString()
      }, { onConflict: "usuario_id,app_id" });
    if (permissionError) throw permissionError;

    const { error: profileError } = await admin
      .from("igreja_perfis")
      .upsert({
        igreja_id: church.id,
        user_id: authUserId,
        papel: "membro",
        ativo: false,
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,user_id" });
    if (profileError) throw profileError;

    const observacaoInformada = optional(formData, "observacoes");
    const cadastroNote = "Cadastro realizado pelo aplicativo. Acesso aguardando aprovação da igreja.";
    const observacoes = [
      existingMember?.observacoes || null,
      existingMember?.observacoes?.includes(cadastroNote) ? null : cadastroNote,
      observacaoInformada ? "Informação do membro: " + observacaoInformada : null
    ]
      .filter(Boolean)
      .join("\n");

    const ministryName = optional(formData, "ministerio");
    const memberValues = {
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
      ministerio: ministryName,
      situacao: "ativo",
      observacoes,
      cargo_solicitado_id: requestedRole?.id ?? null,
      cargo_solicitado_em: requestedRole ? new Date().toISOString() : null,
      cargo_solicitado_observacao: requestedRole
        ? "Cargo informado pelo membro durante o cadastro."
        : null,
      updated_at: new Date().toISOString()
    };

    let member: any;
    if (existingMember?.id) {
      const { data, error } = await admin
        .from("igreja_membros")
        .update(memberValues)
        .eq("id", existingMember.id)
        .eq("igreja_id", church.id)
        .select("id,cargo_id")
        .single();
      if (error || !data?.id) throw error ?? new Error("UPDATE_MEMBER_FAILED");
      member = data;
    } else {
      const { data, error } = await admin
        .from("igreja_membros")
        .insert({
          igreja_id: church.id,
          ...memberValues,
          cargo: "Membro"
        })
        .select("id,cargo_id")
        .single();
      if (error || !data?.id) throw error ?? new Error("CREATE_MEMBER_FAILED");
      member = data;
    }

    const { data: defaultRole } = await admin
      .from("igreja_cargos")
      .select("id")
      .eq("igreja_id", church.id)
      .eq("ativo", true)
      .ilike("nome", "Membro")
      .maybeSingle();

    if (!member.cargo_id && defaultRole?.id) {
      await admin.rpc("elshaday_set_member_cargo", {
        p_igreja_id: church.id,
        p_membro_id: member.id,
        p_cargo_id: defaultRole.id,
        p_data_inicio: optionalDate(formData, "data_entrada") || new Date().toISOString().slice(0, 10),
        p_observacao: "Cargo inicial definido no cadastro.",
        p_usuario_responsavel: authUserId
      });
    }

    if (ministryName) {
      const { data: ministry } = await admin
        .from("igreja_ministerios")
        .select("id")
        .eq("igreja_id", church.id)
        .eq("ativo", true)
        .ilike("nome", ministryName)
        .maybeSingle();

      if (ministry?.id) {
        await admin.from("igreja_membro_ministerios").upsert({
          igreja_id: church.id,
          membro_id: member.id,
          ministerio_id: ministry.id,
          adicionado_por: authUserId
        }, { onConflict: "igreja_id,membro_id,ministerio_id" });
      }
    }

    await admin.from("core_logs").insert({
      empresa_id: church.empresa_id,
      usuario_id: coreUserId,
      app_slug: "elshaday",
      acao: "elshaday cadastro enviado para aprovação",
      detalhes: {
        membro_id: member.id,
        cargo_solicitado_id: requestedRole?.id ?? null,
        cargo_solicitado: requestedRole?.nome ?? null,
        origem: isChurchInvite ? "convite" : "autocadastro"
      }
    });
  } catch (error) {
    if (!isChurchInvite) {
      await cleanupPartialSignup(admin, {
        churchId: church.id,
        empresaId: church.empresa_id,
        authUserId,
        coreUserId
      });
    }

    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage === "ACCOUNT_EXISTS") {
      go(convite, "erro", "Já existe uma conta com este e-mail. Use a tela de login ou recupere sua senha.");
    }

    go(convite, "erro", "Não foi possível concluir o cadastro. Tente novamente ou procure a secretaria.");
  }

  if (isChurchInvite && sessionClient) {
    await sessionClient.auth.signOut({ scope: "local" }).catch(() => null);
  }

  revalidatePath("/elshaday/membros");
  revalidatePath("/elshaday/acessos");
  go(
    convite,
    "ok",
    requestedRole
      ? "Sua conta foi criada e o cargo informado foi enviado para aprovação. Depois da liberação, entre com o e-mail e a senha criados."
      : "Sua conta foi criada. Agora ela aguarda aprovação da igreja. Depois da liberação, entre com este e-mail e a senha que você acabou de criar."
  );
}
