import Link from "next/link";
import { getSessionProfile, isSuperAdminType } from "@/lib/core-data";

export async function AppNav() {
  const { user, profile, appsLiberados } = await getSessionProfile();
  const firstApp = appsLiberados?.find((app) => app.canAccess);
  const links = getLinks({
    isLoggedIn: Boolean(user),
    isSuperAdmin: Boolean(profile && isSuperAdminType(profile.tipo)),
    isCompanyAdmin: profile?.tipo === "admin_empresa",
    appHref: firstApp?.urlPath ?? "/selecionar-app"
  });

  return (
    <header className="border-b border-white/10 bg-black/20">
      <nav className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link className="text-lg font-black tracking-tight" href="/">
          MBA Labs
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          {links.map((link) => (
            <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          {user ? (
            <form action="/sair" method="post">
              <button className="rounded-[8px] px-3 py-2 hover:bg-white/10" type="submit">
                Sair
              </button>
            </form>
          ) : null}
        </div>
      </nav>
    </header>
  );
}

function getLinks({
  isLoggedIn,
  isSuperAdmin,
  isCompanyAdmin,
  appHref
}: {
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  appHref: string;
}) {
  if (!isLoggedIn) {
    return [{ href: "/login", label: "Entrar" }];
  }

  if (isSuperAdmin) {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/admin/dashboard", label: "Administracao" },
      { href: "/admin/empresas", label: "Empresas" },
      { href: "/admin/usuarios", label: "Usuarios" },
      { href: "/admin/apps", label: "Apps" },
      { href: "/admin/planos", label: "Planos" },
      { href: "/admin/assinaturas", label: "Assinaturas" },
      { href: "/admin/pagamentos", label: "Pagamentos" },
      { href: "/admin/logs", label: "Logs" },
      { href: "/admin/configuracoes", label: "Configuracoes" }
    ];
  }

  if (isCompanyAdmin) {
    return [
      { href: "/empresa/dashboard", label: "Dashboard" },
      { href: "/empresa/usuarios", label: "Usuarios" },
      { href: "/empresa/apps", label: "Apps contratados" },
      { href: "/empresa/assinatura", label: "Assinatura" },
      { href: appHref, label: "Acessar sistema" }
    ];
  }

  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/selecionar-app", label: "Sistemas" },
    { href: appHref, label: "Acessar sistema" }
  ];
}
