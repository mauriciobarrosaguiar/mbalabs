import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSessionProfile, isSuperAdminType } from "@/lib/core-data";
import { getSiteConfig } from "@/lib/site-config";

type NavLink = {
  href: string;
  label: string;
};

type NavGroup = {
  title: string;
  links: NavLink[];
};

export async function AppNav() {
  const { user, profile, appsLiberados } = await getSessionProfile();
  const siteConfig = await getSiteConfig();
  const brandName = siteConfig.brandName || "MBA Labs";
  const logoUrl = siteConfig.logoUrl?.trim();
  const firstApp = appsLiberados?.find((app) => app.canAccess);
  const groups = getNavGroups({
    isLoggedIn: Boolean(user),
    isSuperAdmin: Boolean(profile && isSuperAdminType(profile.tipo)),
    isCompanyAdmin: profile?.tipo === "admin_empresa",
    appHref: firstApp?.urlPath ?? "/selecionar-app"
  });
  const desktopLinks = groups.flatMap((group) => group.links);

  return (
    <header className="platform-nav border-b border-white/10 bg-black/20">
      <nav className="page-shell flex min-h-16 items-center justify-between gap-4 py-3">
        <Link className="mba-brand group flex items-center gap-3" href="/" aria-label="MBA Labs - inÃ­cio">
          <span className="mba-brand-mark" aria-hidden="true">
            MB
          </span>
          <span className="grid leading-none">
            <span className="text-lg font-black tracking-tight">MBA Labs</span>
            <span className="hidden text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">
              Plataforma SaaS
            </span>
          </span>
        </Link>

        <div className="hidden flex-wrap items-center gap-2 text-sm text-slate-200 lg:flex">
          {desktopLinks.map((link) => (
            <Link className="platform-nav-link rounded-[8px] px-3 py-2 font-semibold hover:bg-white/10" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          {user ? (
            <form action="/sair" method="post">
              <button className="platform-nav-link rounded-[8px] px-3 py-2 font-semibold hover:bg-white/10" type="submit">
                Sair
              </button>
            </form>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle compact />
          <details className="group relative">
            <summary className="button-secondary min-h-10 cursor-pointer list-none px-3 py-2 text-sm">
              Menu
            </summary>
            <div className="platform-mobile-menu absolute right-0 z-50 mt-3 w-[min(86vw,320px)] rounded-[14px] border border-white/10 bg-[#071016] p-4 shadow-2xl">
              <div className="grid gap-4">
                {groups.map((group) => (
                  <div className="grid gap-1" key={group.title}>
                    {group.title ? (
                      <p className="px-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        {group.title}
                      </p>
                    ) : null}
                    {group.links.map((link) => (
                      <Link className="platform-mobile-link rounded-[8px] px-2 py-2 text-sm font-semibold hover:bg-white/10" href={link.href} key={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ))}
                {user ? (
                  <form action="/sair" className="border-t border-white/10 pt-3" method="post">
                    <button className="platform-mobile-link w-full rounded-[8px] px-2 py-2 text-left text-sm font-semibold hover:bg-white/10" type="submit">
                      Sair
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}

function getNavGroups({
  isLoggedIn,
  isSuperAdmin,
  isCompanyAdmin,
  appHref
}: {
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  appHref: string;
}): NavGroup[] {
  if (!isLoggedIn) {
    return [{ title: "", links: [{ href: "/login", label: "Entrar" }] }];
  }

  if (isSuperAdmin) {
    return [
      { title: "Principal", links: [{ href: "/dashboard", label: "Dashboard" }] },
      {
        title: "GestÃ£o",
        links: [
          { href: "/admin/empresas", label: "Empresas" },
          { href: "/admin/usuarios", label: "UsuÃ¡rios" },
          { href: "/admin/apps", label: "Apps" },
          { href: "/admin/planos", label: "Planos" },
          { href: "/admin/assinaturas", label: "Assinaturas" },
          { href: "/admin/pagamentos", label: "Pagamentos" }
        ]
      },
      {
        title: "Sistema",
        links: [
          { href: "/admin/site", label: "ConfiguraÃ§Ãµes do site" },
          { href: "/admin/logs", label: "Logs" },
          { href: "/admin/configuracoes", label: "ConfiguraÃ§Ãµes" }
        ]
      }
    ];
  }

  if (isCompanyAdmin) {
    return [
      {
        title: "Principal",
        links: [
          { href: "/empresa/dashboard", label: "Dashboard" },
          { href: appHref, label: "Acessar sistema" }
        ]
      },
      {
        title: "GestÃ£o",
        links: [
          { href: "/empresa/usuarios", label: "UsuÃ¡rios" },
          { href: "/empresa/apps", label: "Apps contratados" },
          { href: "/empresa/assinatura", label: "Assinatura" }
        ]
      }
    ];
  }

  return [
    {
      title: "Principal",
      links: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/selecionar-app", label: "Sistemas" },
        { href: appHref, label: "Acessar sistema" }
      ]
    }
  ];
}