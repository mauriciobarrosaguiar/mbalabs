"use client";
import { AgroDocDroneIcon as Drone } from "./AgroDocDroneIcon";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  CircleHelp,
  Folder,
  Home,
  Layers,
  Leaf,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ChartNoAxesColumn,
  ClipboardCheck,
  UserRound,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { ROOT } from "./AgroDocUi";
const pages = [
  { path: "", title: "Visão geral", icon: Home },
  {
    path: "diagnostico",
    title: "Diagnóstico e regularização",
    icon: ShieldCheck,
  },
  { path: "gestao", title: "Operações", icon: Drone },
  { path: "conferencia", title: "Conferência AgroDoc", icon: ClipboardCheck },
  {
    path: "relatorio-mensal",
    title: "Relatórios MAPA",
    icon: ChartNoAxesColumn,
  },
  { path: "documentos", title: "Documentos", icon: Folder },
  { path: "cadastros", title: "Cadastros", icon: Layers },
  { path: "piloto-pro", title: "Piloto Pro", icon: BookOpen },
  { path: "configuracoes", title: "Configurações", icon: Settings },
];
export function DroneAppShell({
  children,
  userName = "Minha conta",
}: {
  children: ReactNode;
  userName?: string;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [notice, setNotice] = useState(false);
  if (path === `${ROOT}/calculadora`) return <>{children}</>;
  return (
    <div className="agro-shell">
      <aside className={`agro-sidebar ${menu ? "agro-sidebar-open" : ""}`}>
        <Link className="agro-logo" href="/dashboard">
          <Leaf />
          MBA Labs<sup>®</sup>
        </Link>
        <div className="agro-product">
          <span>
            <Drone />
          </span>
          <div>
            <b>MBA AgroDoc</b>
            <small>
              Drones Agrícolas ·<br />
              Regularização · MAPA
            </small>
          </div>
        </div>
        <button
          className="agro-mobile-close"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <nav aria-label="MBA AgroDoc">
          {pages.map(({ path: p, title, icon: Icon }) => (
            <Link
              key={p}
              href={`${ROOT}${p ? `/${p}` : ""}`}
              onClick={() => setMenu(false)}
              aria-current={
                path === `${ROOT}${p ? `/${p}` : ""}` ? "page" : undefined
              }
            >
              <Icon />
              <span>{title}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="agro-workspace">
        <header className="agro-header">
          <Link href={ROOT} className="agro-mobile-brand">
            <Leaf />
            MBA <em>AgroDoc</em>
          </Link>
          <button
            className="agro-menu-button"
            aria-label="Abrir menu"
            onClick={() => setMenu((v) => !v)}
          >
            <Menu />
          </button>
          <div className="agro-search">
            <Search />
            <input
              aria-label="Buscar páginas no MBA Labs"
              placeholder="Buscar no MBA Labs"
              value={query}
              onFocus={() => setSearch(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearch(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch(false);
              }}
            />
            {search && (
              <div className="agro-search-results">
                {pages
                  .filter((p) =>
                    p.title
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .map((p) => (
                    <Link
                      key={p.path}
                      href={`${ROOT}/${p.path}`}
                      onClick={() => setSearch(false)}
                    >
                      {p.title}
                    </Link>
                  ))}
                <button onClick={() => setSearch(false)}>
                  Fechar pesquisa
                </button>
              </div>
            )}
          </div>
          <div className="agro-header-actions">
            <button
              aria-label="Abrir pendências"
              onClick={() => setNotice((v) => !v)}
            >
              <Bell />
            </button>
            <Link href={`${ROOT}/regulacao`} aria-label="Ajuda e regras">
              <CircleHelp />
            </Link>
            <details className="agro-account">
              <summary>
                <UserRound />
                <span>
                  {userName}
                  <small>Minha conta MBA Labs</small>
                </span>
              </summary>
              <div>
                <Link href={`${ROOT}/perfil-operacional`}>
                  Perfil operacional
                </Link>
                <Link href="/dashboard">Voltar à MBA Labs</Link>
                <form action="/sair" method="post">
                  <button>
                    <LogOut size={16} /> Sair
                  </button>
                </form>
              </div>
            </details>
          </div>
          {notice && (
            <div className="agro-notice">
              <b>Pendências e notificações</b>
              <Link
                href={`${ROOT}/diagnostico`}
                onClick={() => setNotice(false)}
              >
                Ver vencimentos e regularização
              </Link>
              <Link href={`${ROOT}/fichas`} onClick={() => setNotice(false)}>
                Ver minhas operações e correções
              </Link>
            </div>
          )}
        </header>
        <div className="agro-page-content">{children}</div>
      </div>
      <nav
        className={`agro-bottom-nav ${path.startsWith(`${ROOT}/campo`) ? "agro-bottom-nav-field" : ""}`}
        aria-label="Navegação do piloto"
      >
        {[
          { path: "", title: "Início", icon: Home },
          { path: "gestao", title: "Operações", icon: Drone },
          { path: "documentos", title: "Documentos", icon: Folder },
          { path: "perfil-operacional", title: "Perfil", icon: UserRound },
        ].map(({ path: p, title, icon: Icon }) => (
          <Link
            key={p}
            href={`${ROOT}${p ? `/${p}` : ""}`}
            aria-current={
              path === `${ROOT}${p ? `/${p}` : ""}` ? "page" : undefined
            }
          >
            <Icon />
            {title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
