"use client";
import { AgroDocDroneIcon as Drone } from "./AgroDocDroneIcon";
import Link from "next/link";
import {
  Bell,
  Calculator,
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
  { path: "campo", title: "Modo campo", icon: Drone },
  { path: "historico", title: "Histórico de operações", icon: Folder },
  { path: "ferramentas", title: "MBA Calda e calculadoras", icon: ChartNoAxesColumn },
  { path: "equipamentos", title: "Drones e equipamentos", icon: Drone },
  { path: "equipe", title: "Minha equipe", icon: UserRound },
  { path: "regulacao", title: "Legislação e fontes", icon: BookOpen },
  { path: "", title: "Visão geral", icon: Home },
  {
    path: "diagnostico",
    title: "Diagnóstico e regularização",
    icon: ShieldCheck,
  },
  { path: "gestao", title: "Operações", icon: Drone },
  { path: "conferencia", title: "Conferência de operações", icon: ClipboardCheck },
  {
    path: "relatorio-mensal",
    title: "Relatórios MAPA",
    icon: ChartNoAxesColumn,
  },
  { path: "documentos", title: "Documentos", icon: Folder },
  { path: "cadastros", title: "Cadastros", icon: Layers },
  { path: "piloto-pro", title: "Piloto Pro", icon: BookOpen },
  { path: "produtos", title: "Defensivos e AGROFIT", icon: Leaf },
  { path: "perfil-operacional", title: "Perfil operacional", icon: UserRound },
  { path: "configuracoes", title: "Configurações", icon: Settings },
];
const navigation = [
 { title: "Visão geral", paths: [""] },
 { title: "Operações", paths: ["gestao", "campo", "historico"] },
 { title: "Ferramentas", paths: ["ferramentas"] },
 { title: "Gestão", paths: ["cadastros", "equipamentos", "equipe"] },
 { title: "Regularização", paths: ["diagnostico", "documentos", "regulacao", "relatorio-mensal", "conferencia"] },
 { title: "Piloto Pro", paths: ["piloto-pro", "produtos"] },
 { title: "Configurações", paths: ["perfil-operacional", "configuracoes"] },
];
const managerPaths = new Set(["conferencia", "cadastros", "pilotos", "equipe", "configuracoes"]);
export function DroneAppShell({
  children,
  userName = "Minha conta",
  canManage = false,
}: {
  children: ReactNode;
  userName?: string;
  canManage?: boolean;
}) {
  const path = usePathname();
  const availablePages = pages.filter(p => canManage || !managerPaths.has(p.path));
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [notice, setNotice] = useState(false);
  if (path === `${ROOT}/calculadora`) return <>{children}</>;
  return (
    <div className={`agro-shell ${collapsed ? "agro-shell-collapsed" : ""}`}>
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
            <b>MBA DroneGestor</b>
            <small>
              Drones Agrícolas ·<br />
              Operações · Piloto Pro
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
        <button className="agro-collapse-toggle" onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed}>{collapsed ? "Expandir menu" : "Recolher menu"}</button>
        <nav aria-label="MBA DroneGestor">
          {navigation.map(group => {
            const entries = group.paths.map(p => availablePages.find(item => item.path === p)).filter((p): p is typeof pages[number] => Boolean(p));
            if (!entries.length) return null;
            return <details key={group.title} open={entries.some(p => path === `${ROOT}${p.path ? `/${p.path}` : ""}`)}><summary>{group.title}</summary>
              {entries.map(({path:p,title,icon:Icon}) => <Link key={p} title={title} href={`${ROOT}${p ? `/${p}` : ""}`} onClick={() => setMenu(false)} aria-current={path === `${ROOT}${p ? `/${p}` : ""}` ? "page" : undefined}><Icon/><span>{title}</span></Link>)}
            </details>;
          })}
        </nav>
        <div className="agro-mobile-account"><Link href="/dashboard" onClick={()=>setMenu(false)}>Voltar à MBA Labs</Link><form action="/sair" method="post"><button type="submit"><LogOut size={17}/> Sair</button></form></div>
      </aside>
      {menu && <button className="agro-menu-dismiss fixed inset-0 z-[80] bg-black/40" aria-label="Fechar menu" onClick={()=>setMenu(false)}/>}
      <div className="agro-workspace">
        <header className="agro-header">
          <Link href={ROOT} className="agro-mobile-brand">
            <Leaf />
            MBA <em>DroneGestor</em>
          </Link>
          <button
            className="agro-menu-button"
            aria-label="Abrir menu"
            aria-expanded={menu}
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
                {availablePages
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
        className="agro-bottom-nav"
        aria-label="Navegação do piloto"
      >
        {[
          { path: "", title: "Início", icon: Home },
          { path: "gestao", title: "Operações", icon: Drone },
          { path: "ferramentas", title: "Calda", icon: Calculator },
          { path: "piloto-pro", title: "Piloto Pro", icon: BookOpen },
        ].map(({ path: p, title, icon: Icon }) => (
          <Link
            key={p}
            href={`${ROOT}${p ? `/${p}` : ""}`}
            aria-current={
              (path === `${ROOT}${p ? `/${p}` : ""}` || (p==="gestao"&&path.startsWith(`${ROOT}/campo`))) ? "page" : undefined
            }
          >
            <Icon />
            {title}
          </Link>
        ))}
        <button type="button" className="agro-mobile-more" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><Menu/>Mais</button>
      </nav>
    </div>
  );
}
