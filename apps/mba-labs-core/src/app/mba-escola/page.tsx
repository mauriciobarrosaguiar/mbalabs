import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import MbaEscolaClient from "./mba-escola-client-v2";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MBA Escola",
  description: "Comunicação simples entre escola, professores e famílias.",
  applicationName: "MBA Escola",
  manifest: "/mba-escola/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MBA Escola",
    statusBarStyle: "default"
  }
};

export default async function MbaEscolaPage() {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.rpc("escola_is_super_admin");

  if (error && (error.code === "PGRST202" || error.code === "PGRST205" || String(error.message).toLowerCase().includes("schema cache"))) {
    return <SchoolSetupPending />;
  }

  return <MbaEscolaClient />;
}

function SchoolSetupPending() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-5 text-slate-900">
      <section className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#176b5b] text-white">
          <GraduationCap size={34} />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[.15em] text-[#176b5b]">MBA Escola</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Finalizando a configuração</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
          Seu acesso pela MBA Labs já foi validado. A estrutura central do MBA Escola ainda está sendo ativada no servidor.
        </p>
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-left text-sm font-semibold leading-6 text-emerald-900">
          <ShieldCheck className="mr-2 inline" size={18} />
          Não existe segundo login. Assim que a estrutura terminar de ser aplicada, esta mesma entrada abrirá o MBA Escola diretamente.
        </div>
        <Link className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 font-black text-white" href="/dashboard">
          Voltar para MBA Labs
        </Link>
      </section>
    </main>
  );
}
