import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Church, UserRoundPlus } from "lucide-react";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { ElshadaySubmitButton } from "../elshaday/ElshadaySubmitButton";
import { validateElshadayMemberRegistrationToken } from "@/lib/elshaday-member-registration";
import { registerPublicElshadayMember } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastro de membro | Elshaday",
  description: "Cadastro de membros da Igreja Assembleia de Deus Elshaday - Palmas."
};

const ELSHADAY_SLUG = "assembleia-de-deus-elshaday-palmas";

export default async function PublicMemberRegistrationPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const convite = read(query.convite);
  const admin = createSupabaseAdminClient() as any;

  const { data: church, error } = await admin
    .from("igreja_igrejas")
    .select("id,nome,nome_curto,cidade,estado")
    .eq("slug", ELSHADAY_SLUG)
    .eq("ativa", true)
    .maybeSingle();

  if (error || !church?.id || !convite || !validateElshadayMemberRegistrationToken(church.id, convite)) {
    redirect("/login");
  }

  const ok = read(query.ok);
  const erro = read(query.erro);

  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-5 text-slate-950 sm:py-8">
      <div className="mx-auto grid max-w-2xl gap-5">
        <header className="rounded-[28px] bg-[#123d2d] p-5 text-white shadow-[0_16px_40px_rgba(18,61,45,.16)] sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-13 shrink-0 place-items-center rounded-[17px] bg-[#f1d79d] text-[#123d2d]">
              <Church size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.15em] text-[#f1d79d]">Elshaday Palmas</p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">Cadastro de membro</h1>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-emerald-50/90">
            {church.nome || church.nome_curto}
          </p>
        </header>

        {ok ? (
          <section className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
              <div>
                <h2 className="font-black">Cadastro concluído</h2>
                <p className="mt-1 text-sm leading-6">{ok}</p>
              </div>
            </div>
          </section>
        ) : null}

        {erro ? (
          <section className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm font-bold leading-6 text-red-900">
            {erro}
          </section>
        ) : null}

        {!ok ? (
          <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[14px] bg-emerald-50 text-[#176445]">
                <UserRoundPlus size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black">Seus dados</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Preencha para entrar no cadastro de membros.</p>
              </div>
            </div>

            <form action={registerPublicElshadayMember} className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
              <input type="hidden" name="convite" value={convite} />
              <div className="sr-only" aria-hidden="true">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <Field label="Nome completo *" name="nome" autoComplete="name" required wide />
              <Field label="Data de nascimento" name="data_nascimento" type="date" />
              <Field label="CPF" name="cpf" inputMode="numeric" autoComplete="off" placeholder="Opcional" />
              <Field label="WhatsApp" name="whatsapp" inputMode="tel" autoComplete="tel" placeholder="(63) 99999-9999" />
              <Field label="Telefone" name="telefone" inputMode="tel" autoComplete="tel" />
              <Field label="E-mail" name="email" type="email" autoComplete="email" wide />

              <Field label="Data de entrada na igreja" name="data_entrada" type="date" />
              <Field label="Data de conversão" name="data_conversao" type="date" />
              <Field label="Data de batismo" name="data_batismo" type="date" />
              <Field label="Cargo / função" name="cargo" placeholder="Se houver" />
              <Field label="Ministério" name="ministerio" placeholder="Se houver" wide />

              <Field label="Endereço" name="endereco" autoComplete="street-address" wide />
              <Field label="Bairro" name="bairro" />
              <Field label="Cidade" name="cidade" defaultValue="Palmas" />
              <Field label="UF" name="estado" defaultValue="TO" maxLength={2} />

              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
                Observação
                <textarea
                  className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#176445]"
                  name="observacoes"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-[#f7f8f4] p-4 text-sm leading-6 text-slate-700 sm:col-span-2">
                <input className="mt-1 size-5 shrink-0 accent-[#176445]" name="consentimento" type="checkbox" required />
                <span>Autorizo o uso destes dados pela igreja para meu cadastro e comunicação.</span>
              </label>

              <div className="sm:col-span-2">
                <ElshadaySubmitButton
                  className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#123d2d] px-6 text-base font-black text-white"
                  pendingLabel="Enviando cadastro..."
                >
                  Enviar meu cadastro
                </ElshadaySubmitButton>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  wide = false,
  maxLength,
  inputMode,
  autoComplete
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  wide?: boolean;
  maxLength?: number;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  autoComplete?: string;
}) {
  return (
    <label className={"grid min-w-0 gap-2 text-sm font-bold text-slate-700" + (wide ? " sm:col-span-2" : "")}>
      {label}
      <input
        className="min-h-12 w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#176445]"
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
