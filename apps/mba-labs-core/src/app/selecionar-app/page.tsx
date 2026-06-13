import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { AccessDenied, PageHeader } from "@/components/ui-kit";
import { requireSessionProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function SelecionarAppPage() {
  const { profile, appsLiberados } = await requireSessionProfile("/selecionar-app");
  const apps = appsLiberados.filter((app) => app.canAccess);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="Acesso aos sistemas"
          title="Escolha o sistema que deseja acessar"
          description={`Usuario: ${profile.nome}. Somente apps contratados e ativos aparecem aqui.`}
        />

        {apps.length === 0 ? (
          <AccessDenied appName="os sistemas MBA Labs" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {apps.map((app) => (
              <article className="panel grid gap-5 p-5" key={app.slug}>
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                    {app.status}
                  </div>
                  <h2 className="text-xl font-black">{app.nome}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">
                    {app.descricao ?? "Sistema contratado pela empresa."}
                  </p>
                </div>
                <Link className="button-primary" href={app.urlPath}>
                  Acessar
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
