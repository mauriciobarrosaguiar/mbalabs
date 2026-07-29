import Link from "next/link";
import {
  AppWindow,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  Users
} from "lucide-react";
import styles from "./GoogleEmpresasTheme.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active?: boolean;
};

export function GoogleEmpresasNav({ active = "dashboard" }: { active?: "dashboard" | "empresas" }) {
  const items: NavItem[] = [
    { href: "/google-empresas", label: "Dashboard", icon: LayoutDashboard, active: active === "dashboard" },
    { href: "/google-empresas", label: "Empresas", icon: Building2, active: active === "empresas" },
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/apps", label: "Apps", icon: AppWindow },
    { href: "/admin/planos", label: "Planos", icon: Sparkles },
    { href: "/admin/assinaturas", label: "Assinaturas", icon: FileText },
    { href: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
    { href: "/admin/logs", label: "Logs", icon: ScrollText },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings }
  ];

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link className={styles.brand} href="/google-empresas" aria-label="MBA Labs Google Empresas">
          <span className={styles.brandMark} aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <span className={styles.brandText}>
            <strong>MBA Labs</strong>
            <small>Google Empresas</small>
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Navegação do painel Google Empresas">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
                href={item.href}
                key={`${item.label}-${item.href}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action="/sair" method="post" className={styles.desktopLogout}>
          <button className={styles.logoutButton} type="submit">
            <LogOut size={16} />
            Sair
          </button>
        </form>

        <details className={styles.mobileMenu}>
          <summary aria-label="Abrir menu do painel">
            <Menu size={21} />
            Menu
          </summary>
          <div className={styles.mobilePanel}>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className={`${styles.mobileLink} ${item.active ? styles.mobileLinkActive : ""}`}
                  href={item.href}
                  key={`mobile-${item.label}-${item.href}`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
            <form action="/sair" method="post">
              <button className={styles.mobileLogout} type="submit">
                <LogOut size={17} />
                Sair
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
