import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { validateElshadayMemberRegistrationToken } from "@/lib/elshaday-member-registration";
import { MemberRegistrationForm } from "./MemberRegistrationForm";

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
    redirect("/login?app=elshaday");
  }

  const { data: ministries } = await admin
    .from("igreja_ministerios")
    .select("id,nome")
    .eq("igreja_id", church.id)
    .eq("ativo", true)
    .order("nome");

  const ok = read(query.ok);
  const erro = read(query.erro);

  return (
    <main className="min-h-dvh min-w-0 overflow-x-hidden bg-[#f3f6f1] px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-slate-950 [color-scheme:light] sm:px-5 sm:py-8">
      <div className="mx-auto grid min-w-0 max-w-2xl gap-4">
        <header className="rounded-[26px] border border-[#123d2d]/10 bg-white/95 p-4 shadow-[0_12px_35px_rgba(18,61,45,.09)] backdrop-blur sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Voltar para o login"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#123d2d]/15 bg-[#f3f6f1] text-[#123d2d] transition active:scale-95"
              href="/login?app=elshaday"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#123d2d] p-1.5 shadow-sm">
              <Image alt="Logo oficial Elshaday" height={48} priority src="/elshaday/logo.svg" width={48} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black leading-tight text-[#123d2d]">Elshaday</p>
              <p className="mt-0.5 text-xs font-bold leading-4 text-slate-600">
                Assembleia de Deus Elshaday – Palmas
              </p>
            </div>
          </div>
        </header>

        {ok ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
              <div className="min-w-0">
                <h1 className="text-lg font-black">Cadastro enviado</h1>
                <p className="mt-1 text-sm font-semibold leading-6">{ok}</p>
                <Link
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#123d2d] px-5 text-sm font-black text-white sm:w-auto"
                  href="/login?app=elshaday&next=%2Felshaday"
                >
                  Voltar para o login
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {erro ? (
          <section aria-live="polite" className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
            {erro}
          </section>
        ) : null}

        {!ok ? (
          <MemberRegistrationForm
            convite={convite}
            ministryOptions={(ministries ?? []).map((item: any) => ({ id: String(item.id), nome: String(item.nome) }))}
          />
        ) : null}
      </div>
    </main>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
