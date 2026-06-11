import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { requireSessionProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function LavaGestorPortalPage() {
  await requireSessionProfile();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-5 py-8">
        <p className="eyebrow">Sistema conectado</p>
        <h1 className="text-4xl font-black">LavaGestor</h1>
        <p className="max-w-2xl text-slate-300">
          Area inicial do LavaGestor dentro do portal. A app dedicada tambem existe em
          <code className="mx-1 rounded bg-white/10 px-1">apps/lavagestor</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href="/dashboard">
            Voltar ao dashboard
          </Link>
          <a className="button-secondary" href="http://localhost:3002/lavagestor">
            Abrir app local na porta 3002
          </a>
        </div>
      </section>
    </main>
  );
}
