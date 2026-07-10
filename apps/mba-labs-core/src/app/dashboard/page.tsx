import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { getDashboardData, isSuperAdminType } from "@/lib/core-data";
import { getInternalAppBySlug } from "@/lib/app-registry";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, apps, error } = await getDashboardData();
  const isAdminMaster = isSuperAdminType(profile.tipo);
  const visibleApps = isAdminMaster ? apps : apps.filter((app) => Boolean(getInternalAppBySlug(app.slug)));

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
          {error ? (
            <p className="text-sm text-red-200">
              Aviso: não foi possível carregar todos os dados agora. {error}
            </p>
          ) : null}
        </div>

        {visibleApps.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {visibleApps.map((app) => {
              const knownRoute = Boolean(getInternalAppBySlug(app.slug));
              const canOpen = app.canAccess && knownRoute;

              return (
                <article className="panel grid gap-5 p-5" key={app.slug}>
                  <div>
                    <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                      {statusLabel(app.status)}
                    </div>
                    <h2 className="text-xl font-black">{displayAppName(app)}</h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{displayAppDescription(app)}</p>
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
        ) : (
          <div className="panel p-6 text-slate-300">Nenhum sistema ativo encontrado para este usuário.</div>
        )}
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

function displayAppName(app: { slug: string; nome: string }) {
  return app.slug === "lexgestor" || app.slug === "lex-gestor" ? "LexGestor" : fixEncoding(app.nome);
}

function displayAppDescription(app: { slug: string; descricao: string }) {
  if (app.slug === "lexgestor" || app.slug === "lex-gestor") {
    return "Gestão jurídica inteligente para escritórios de advocacia.";
  }

  return fixEncoding(app.descricao);
}

function fixEncoding(value: string) {
  let output = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!/[ÃÂâ]/.test(output)) break;

    const decoded = Buffer.from(output, "latin1").toString("utf8");
    if (encodingErrorScore(decoded) >= encodingErrorScore(output)) break;
    output = decoded;
  }

  return output;
}

function encodingErrorScore(value: string) {
  return (value.match(/[ÃÂâ�]/g) ?? []).length;
}
