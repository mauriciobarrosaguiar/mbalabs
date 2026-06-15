import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { getDashboardData, isSuperAdminType } from "@/lib/core-data";
import { getInternalAppBySlug } from "@/lib/app-registry";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, apps, error } = await getDashboardData();
  const isAdminMaster = isSuperAdminType(profile.tipo);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <div className="grid gap-2">
          <p className="eyebrow">Dashboard principal</p>
          <h1 className="text-4xl font-black">Olá, {profile.nome}</h1>
          <p className="text-slate-300">
            Perfil: <strong>{profileLabel(profile.tipo)}</strong>
          </p>
          {error ? <p className="text-sm text-red-200">Aviso: não foi possível carregar todos os dados agora. {error}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {apps.map((app) => {
            const knownRoute = Boolean(getInternalAppBySlug(app.slug));
            const canOpen = app.canAccess && knownRoute;

            return (
              <article className="panel grid gap-5 p-5" key={app.slug}>
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                    {statusLabel(app.canAccess ? app.status : "sem_assinatura")}
                  </div>
                  <h2 className="text-xl font-black">{app.nome}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{app.descricao}</p>
                  {!knownRoute && isAdminMaster ? (
                    <p className="mt-3 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                      Rota não encontrada no projeto. Verifique a implementação.
                    </p>
                  ) : null}
                </div>
                {canOpen ? (
                  <Link className="button-primary" href={app.url_path}>
                    Acessar
                  </Link>
                ) : (
                  <button className="button-secondary cursor-not-allowed opacity-70" type="button">
                    {knownRoute ? "Sem assinatura ativa" : "Rota indisponível"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function profileLabel(type: string) {
  const labels: Record<string, string> = {
    super_admin: "Admin Master",
    admin_master: "Admin Master",
    admin_empresa: "Admin da empresa",
    operador: "Operador",
    usuario: "Usuário"
  };

  return labels[type] ?? "Usuário";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    teste: "Ativo",
    vencido: "Bloqueado",
    bloqueado: "Bloqueado",
    cancelado: "Sem assinatura",
    sem_assinatura: "Sem assinatura"
  };

  return labels[status] ?? status;
}
