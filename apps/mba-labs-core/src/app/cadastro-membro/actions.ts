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

export async function registerPublicElshadayMember(formData: FormData) {
  const convite = value(formData, "convite");

  if (value(formData, "website")) {
    go(convite, "ok", "Cadastro enviado com sucesso.");
  }

  const admin = createSupabaseAdminClient() as any;
  const { data: church, error: churchError } = await admin
    .from("igreja_igrejas")
    .select("id")
    .eq("slug", ELSHADAY_SLUG)
    .eq("ativa", true)
    .maybeSingle();

  if (churchError || !church?.id || !convite || !validateElshadayMemberRegistrationToken(church.id, convite)) {
    redirect("/login");
  }

  const nome = value(formData, "nome");
  const whatsapp = digits(value(formData, "whatsapp"));
  const telefone = digits(value(formData, "telefone"));
  const email = value(formData, "email").toLowerCase();
  const cpfRaw = value(formData, "cpf");
  const cpf = digits(cpfRaw);
  const consent = value(formData, "consentimento") === "on";

  if (nome.length < 3) go(convite, "erro", "Informe seu nome completo.");
  if (!whatsapp && !telefone && !email) {
    go(convite, "erro", "Informe pelo menos um contato: WhatsApp, telefone ou e-mail.");
  }
  if (email && !email.includes("@")) go(convite, "erro", "Informe um e-mail válido.");
  if (cpf && cpf.length !== 11) go(convite, "erro", "Confira o CPF informado.");
  if (!consent) go(convite, "erro", "É necessário autorizar o uso dos dados para o cadastro.");

  if (email) {
    const { data } = await admin
      .from("igreja_membros")
      .select("id")
      .eq("igreja_id", church.id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      go(convite, "erro", "Já existe um cadastro com este e-mail. Procure a secretaria para atualizar seus dados.");
    }
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

  const observacaoInformada = optional(formData, "observacoes");
  const observacoes = [
    "Autocadastro realizado por link de convite da igreja.",
    observacaoInformada ? "Informação do membro: " + observacaoInformada : null
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await admin.from("igreja_membros").insert({
    igreja_id: church.id,
    nome,
    data_nascimento: optionalDate(formData, "data_nascimento"),
    cpf: cpf || null,
    telefone: telefone || null,
    whatsapp: whatsapp || null,
    email: email || null,
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

  if (error) {
    go(convite, "erro", "Não foi possível concluir o cadastro. Tente novamente ou procure a secretaria.");
  }

  revalidatePath("/elshaday/membros");
  go(convite, "ok", "Seus dados foram cadastrados com sucesso.");
}
