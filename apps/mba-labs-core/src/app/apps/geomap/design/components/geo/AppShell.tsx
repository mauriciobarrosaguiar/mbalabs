"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "../../lib/navigation";
import {
  LayoutDashboard, FolderKanban, Route as RouteIcon, Cpu, Map, Mountain, Box, Sprout, FileText, Download, Plane, Server, HardDrive, Bell, Settings,
  Search, Moon, Sun, Plus, PanelLeftClose, PanelLeftOpen, Menu, Satellite,
} from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { notifications } from "../../lib/mock-data";
import { cn } from "../../lib/utils";

const nav = [
  { group: "Visão geral", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projetos", label: "Meus projetos", icon: FolderKanban },
  ] },
  { group: "Mapeamento", items: [
    { to: "/planejamento", label: "Planejamento de voo", icon: RouteIcon },
    { to: "/processamento", label: "Processamento", icon: Cpu },
  ] },
  { group: "Geoprocessamento", items: [
    { to: "/geostudio", label: "GeoStudio", icon: Map },
    { to: "/topografia", label: "Topografia", icon: Mountain },
    { to: "/visualizador-3d", label: "Visualizador 3D", icon: Box },
    { to: "/agricultura", label: "Agricultura de precisão", icon: Sprout },
  ] },
  { group: "Documentação", items: [
    { to: "/relatorios", label: "Relatórios", icon: FileText },
    { to: "/exportacoes", label: "Exportações", icon: Download },
  ] },
  { group: "Administração", items: [
    { to: "/equipamentos", label: "Equipamentos", icon: Plane },
    { to: "/servidores", label: "Servidores", icon: Server },
    { to: "/armazenamento", label: "Armazenamento", icon: HardDrive },
    { to: "/notificacoes", label: "Notificações", icon: Bell },
    { to: "/configuracoes", label: "Configurações", icon: Settings },
  ] },
] as const;

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]"><Satellite className="size-4.5" /></div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="font-display text-sm font-extrabold tracking-tight text-[color:var(--sidebar-accent-foreground)]">MBA GeoMap</p>
          <p className="text-[10px] text-[color:var(--sidebar-foreground)]/70">Inteligência Geoespacial</p>
        </div>
      )}
    </Link>
  );
}

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {nav.map((g) => (
        <div key={g.group}>
          {!compact && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--sidebar-foreground)]/50">{g.group}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
              return (
                <li key={it.to}>
                  <Link to={it.to} onClick={onNavigate} title={it.label}
                    className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors", compact && "justify-center",
                      active ? "bg-[var(--sidebar-primary)]/15 font-medium text-[color:var(--sidebar-accent-foreground)] ring-1 ring-[var(--sidebar-primary)]/40" : "text-[color:var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[color:var(--sidebar-accent-foreground)]")}>
                    <it.icon className={cn("size-4 shrink-0", active && "text-[color:var(--sidebar-ring)]")} />
                    {!compact && <span className="truncate">{it.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("geomap-theme");
    if (saved) setDark(saved === "dark");
  }, []);
  useEffect(() => {
    localStorage.setItem("geomap-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="geomap-surface flex min-h-screen bg-background" data-theme={dark ? "dark" : "light"}><div id="geomap-overlay-root" />
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width] lg:flex", collapsed ? "w-16" : "w-60")}>
        <div className="flex h-14 items-center border-b border-[var(--sidebar-border)] px-3"><Brand compact={collapsed} /></div>
        <NavList compact={collapsed} />
        <div className="border-t border-[var(--sidebar-border)] p-2">
          <button onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-[color:var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Recolher menu</>}
          </button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-64 flex-col border-[var(--sidebar-border)] bg-[var(--sidebar)] p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-14 items-center border-b border-[var(--sidebar-border)] px-3"><Brand /></div>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input disabled title="Busca global ainda não integrada" placeholder="Buscar projetos, camadas, arquivos…" className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-hidden focus:ring-2 focus:ring-ring" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={() => setDark((d) => !d)}>{dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notificações" className="relative"><Bell className="size-4.5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-warning" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((n) => (
                  <DropdownMenuItem key={n.title} className="flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/notificacoes">Ver todas</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm" className="ml-1"><Link to="/novo-projeto"><Plus className="size-4" /><span className="hidden sm:inline">Novo projeto</span></Link></Button>
            <div className="ml-2 hidden items-center gap-2 border-l pl-3 md:flex">
              <div className="grid size-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">MA</div>
              <div className="leading-tight"><p className="text-xs font-semibold">Administrador GeoMap</p><p className="text-[10px] text-muted-foreground">Administrador</p></div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}