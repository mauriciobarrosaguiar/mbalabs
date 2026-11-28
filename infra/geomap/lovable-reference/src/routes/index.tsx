import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, Ruler, Images, Loader2, CheckCircle2, AlarmClock, HardDrive, Coins, Plus, Map, Route as RouteIcon, Mountain, Box, FileText, Download, ArrowRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PageHeader, Kpi, Panel, StatusBadge, ExpiryBadge, Bar } from "@/components/geo/ui";
import { AerialMap, MapThumb } from "@/components/geo/AerialMap";
import { projects, jobs, expiringFiles, usageSeries, photogrammetryStages, getProject } from "@/lib/mock-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead("Dashboard", "Visão geral dos levantamentos, processamentos e arquivos do MBA GeoMap."),
  component: Dashboard,
});

const shortcuts = [
  { to: "/planejamento", label: "Planejar voo", icon: RouteIcon },
  { to: "/geostudio", label: "GeoStudio", icon: Map },
  { to: "/topografia", label: "Topografia", icon: Mountain },
  { to: "/visualizador-3d", label: "Visualizador 3D", icon: Box },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/exportacoes", label: "Exportações", icon: Download },
] as const;

function Dashboard() {
  const totalArea = projects.reduce((a, p) => a + p.areaHa, 0);
  const totalPhotos = projects.reduce((a, p) => a + p.photos, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Sábado, 28 de novembro de 2026 · 4 processamentos ativos"
        actions={<Button asChild><Link to="/novo-projeto"><Plus className="size-4" /> Novo projeto</Link></Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Projetos" value={String(projects.length)} hint="+3 este mês" icon={FolderKanban} />
        <Kpi label="Área mapeada" value={`${totalArea.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha`} hint="acumulado" icon={Ruler} tone="info" />
        <Kpi label="Fotos processadas" value={totalPhotos.toLocaleString("pt-BR")} icon={Images} tone="info" />
        <Kpi label="Em processamento" value="4" hint="1 falhou" icon={Loader2} />
        <Kpi label="Concluídos" value="3" hint="disponíveis" icon={CheckCircle2} tone="success" />
        <Kpi label="Expiram em 7 dias" value="5 arquivos" hint="38,0 GB" icon={AlarmClock} tone="warning" />
        <Kpi label="Armazenamento" value="97 GB" hint="de 500 GB" icon={HardDrive} tone="info" />
        <Kpi label="Custo computacional" value="R$ 312" hint="novembro" icon={Coins} tone="success" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Mapa geral de levantamentos" className="xl:col-span-2" bodyClass="p-0" action={<span className="text-xs text-muted-foreground">8 áreas · GO, MG, SP</span>}>
          <AerialMap className="h-[340px] rounded-t-none border-0 sm:h-[400px]" variant={2}>
            {projects.map((p) => (
              <g key={p.id} transform={`translate(${p.lng * 1000 - 200} ${p.lat * 700 - 100})`}>
                <circle r={16} fill="var(--primary)" opacity={0.25} />
                <circle r={7} fill={p.status === "Disponível" ? "var(--success)" : p.status === "Falhou" ? "var(--destructive)" : "var(--primary)"} stroke="var(--card)" strokeWidth={2} />
                <text y={-14} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--sidebar-accent-foreground)" paintOrder="stroke" stroke="var(--sidebar)" strokeWidth={3}>{p.city}</text>
              </g>
            ))}
          </AerialMap>
        </Panel>

        <Panel title="Processamentos em andamento" action={<Link to="/processamento" className="text-xs text-primary">Ver central</Link>}>
          <ul className="space-y-4">
            {jobs.map((j) => {
              const p = getProject(j.projectId)!;
              return (
                <li key={j.projectId}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <StatusBadge status={j.status} />
                  </div>
                  <Bar value={j.progress} tone={j.status === "Falhou" ? "destructive" : "primary"} />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{j.progress}% · {photogrammetryStages[j.stage]}</span><span>{j.eta}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Projetos recentes" className="xl:col-span-2" action={<Link to="/projetos" className="text-xs text-primary">Todos</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projects.slice(0, 4).map((p) => (
              <Link key={p.id} to="/projetos/$id" params={{ id: p.id }} className="group overflow-hidden rounded-md border hover:border-primary">
                <MapThumb variant={p.variant} className="h-24 w-full" />
                <div className="p-2">
                  <p className="truncate text-xs font-semibold group-hover:text-primary">{p.name}</p>
                  <div className="mt-1 flex items-center justify-between"><StatusBadge status={p.status} /><ExpiryBadge days={p.daysLeft} /></div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Alertas de exclusão (7 dias)" action={<Link to="/armazenamento" className="text-xs text-primary">Armazenamento</Link>}>
          <ul className="divide-y">
            {expiringFiles.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0"><p className="truncate font-mono text-xs">{f.file}</p><p className="truncate text-[11px] text-muted-foreground">{f.project} · {f.size}</p></div>
                <span className={f.hours < 48 ? "text-xs font-semibold text-destructive" : "text-xs font-semibold text-warning"}>{f.hours} h</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Utilização — últimos 7 dias" className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageSeries}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="gb" name="Armazenamento (GB)" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="horas" name="Horas de CPU/GPU" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Atalhos rápidos">
          <div className="grid grid-cols-3 gap-2">
            {shortcuts.map((s) => (
              <Link key={s.to} to={s.to} className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center text-xs hover:border-primary hover:bg-accent">
                <s.icon className="size-5 text-primary" />{s.label}
              </Link>
            ))}
          </div>
          <Link to="/novo-projeto" className="mt-3 flex items-center justify-between rounded-md bg-primary/10 p-3 text-sm font-medium text-primary hover:bg-primary/15">Iniciar assistente de novo projeto <ArrowRight className="size-4" /></Link>
        </Panel>
      </div>
    </div>
  );
}