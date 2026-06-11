import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { requireSessionProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function CotacoesPortalPage() {
  await requireSessionProfile();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-5 py-8">
        <p className="eyebrow">Sistema conectado</p>
        <h1 className="text-4xl font-black">MBA Cotacoes</h1>
        <p className="max-w-2xl text-slate-300">
          Area inicial do sistema de cotacoes dentro do portal. A app dedicada tambem existe em
          <code className="mx-1 rounded bg-white/10 px-1">apps/mba-cotacoes</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href="/dashboard">
            Voltar ao dashboard
          </Link>
          <a className="button-secondary" href="http://localhost:3001/cotacoes">
            Abrir app local na porta 3001
          </a>
        </div>
      </section>
    </main>
  );
}
