import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { getDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, apps, error } = await getDashboardData();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <div className="grid gap-2">
          <p className="eyebrow">Dashboard principal</p>
          <h1 className="text-4xl font-black">Ola, {profile.nome}</h1>
          <p className="text-slate-300">
            Perfil: <strong>{profile.tipo}</strong>
          </p>
          {error ? <p className="text-sm text-red-200">Aviso Supabase: {error}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {apps.map((app) => (
            <article className="panel grid gap-5 p-5" key={app.slug}>
              <div>
                <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                  {app.canAccess ? app.status : "bloqueado"}
                </div>
                <h2 className="text-xl font-black">{app.nome}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{app.descricao}</p>
              </div>
              {app.canAccess ? (
                <Link className="button-primary" href={app.url_path}>
                  Acessar
                </Link>
              ) : (
                <button className="button-secondary cursor-not-allowed opacity-70" type="button">
                  Sem assinatura ativa
                </button>
              )}
            </article>
          ))}
          <article className="panel grid gap-5 p-5 opacity-80">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                em breve
              </div>
              <h2 className="text-xl font-black">Novo sistema</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">
                A monorepo ja esta pronta para receber novos produtos.
              </p>
            </div>
            <button className="button-secondary cursor-not-allowed opacity-70" type="button">
              Em breve
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
