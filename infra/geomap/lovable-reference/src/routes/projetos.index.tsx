import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, LayoutGrid, List, MoreVertical, Plus, MapPin, Calendar, Plane, Images, Ruler } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, StatusBadge, ExpiryBadge } from "@/components/geo/ui";
import { MapThumb } from "@/components/geo/AerialMap";
import { projects, type Project } from "@/lib/mock-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/projetos/")({
  head: () => pageHead("Meus projetos", "Biblioteca visual de levantamentos aerofotogramétricos."),
  component: Projects,
});

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

function Actions({ p }: { p: Project }) {
  const demo = (a: string) => toast(`${a}`, { description: "Ação demonstrativa do protótipo." });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Ações"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link to="/projetos/$id" params={{ id: p.id }}>Abrir projeto</Link></DropdownMenuItem>
        <DropdownMenuItem onClick={() => demo("Editar informações")}>Editar informações</DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/novo-projeto">Novo levantamento</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/geostudio">Visualizar mapa</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/relatorios">Gerar relatório</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/exportacoes">Baixar arquivos</Link></DropdownMenuItem>
        <DropdownMenuItem onClick={() => demo("Histórico do projeto")}>Consultar histórico</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => demo("Excluir projeto")}>Excluir projeto</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full sm:w-44" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: todos</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Projects() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [status, setStatus] = useState("all");
  const [drone, setDrone] = useState("all");
  const [uf, setUf] = useState("all");
  const [period, setPeriod] = useState("all");
  const uniq = (k: keyof Project) => [...new Set(projects.map((p) => String(p[k])))];
  const list = useMemo(() => projects.filter((p) =>
    (status === "all" || p.status === status) && (drone === "all" || p.drone === drone) && (uf === "all" || p.uf === uf) &&
    (period === "all" || (period === "Últimos 7 dias" ? p.date >= "2026-11-21" : p.date >= "2026-11-01"))), [status, drone, uf, period]);

  return (
    <div>
      <PageHeader icon={FolderKanban} title="Meus projetos" subtitle={`${list.length} de ${projects.length} levantamentos`}
        actions={<>
          <div className="flex rounded-md border p-0.5">
            <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")} aria-label="Cartões"><LayoutGrid className="size-4" /></Button>
            <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")} aria-label="Tabela"><List className="size-4" /></Button>
          </div>
          <Button asChild><Link to="/novo-projeto"><Plus className="size-4" /> Novo projeto</Link></Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Filter label="Período" value={period} onChange={setPeriod} options={["Últimos 7 dias", "Novembro 2026"]} />
        <Filter label="UF" value={uf} onChange={setUf} options={uniq("uf")} />
        <Filter label="Equipamento" value={drone} onChange={setDrone} options={uniq("drone")} />
        <Filter label="Status" value={status} onChange={setStatus} options={uniq("status")} />
      </div>

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-lg border bg-card shadow-xs">
              <Link to="/projetos/$id" params={{ id: p.id }} className="relative block">
                <MapThumb variant={p.variant} className="h-36 w-full" />
                <div className="absolute left-2 top-2"><StatusBadge status={p.status} /></div>
                <div className="absolute right-2 top-2 rounded-md bg-card/90 px-1"><ExpiryBadge days={p.daysLeft} /></div>
              </Link>
              <div className="p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <Link to="/projetos/$id" params={{ id: p.id }} className="block truncate text-sm font-semibold hover:text-primary">{p.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{p.client}</p>
                  </div>
                  <Actions p={p} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 truncate"><MapPin className="size-3 shrink-0" />{p.city}/{p.uf}</span>
                  <span className="flex items-center gap-1"><Calendar className="size-3" />{fmtDate(p.date)}</span>
                  <span className="flex items-center gap-1 truncate"><Plane className="size-3 shrink-0" />{p.drone.replace("DJI ", "")}</span>
                  <span className="flex items-center gap-1"><Ruler className="size-3" />{p.areaHa.toLocaleString("pt-BR")} ha</span>
                  <span className="flex items-center gap-1"><Images className="size-3" />{p.photos.toLocaleString("pt-BR")} fotos</span>
                </dl>
                <div className="mt-2 flex flex-wrap gap-1">{p.products.map((x) => <span key={x} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{x}</span>)}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>{["", "Projeto", "Local", "Data", "Equipamento", "Área", "Fotos", "Status", "Prazo", ""].map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2"><MapThumb variant={p.variant} className="h-9 w-14 rounded" /></td>
                  <td className="px-3 py-2"><Link to="/projetos/$id" params={{ id: p.id }} className="font-medium hover:text-primary">{p.name}</Link><p className="text-xs text-muted-foreground">{p.client}</p></td>
                  <td className="px-3 py-2">{p.city}/{p.uf}</td>
                  <td className="px-3 py-2">{fmtDate(p.date)}</td>
                  <td className="px-3 py-2 text-xs">{p.drone}</td>
                  <td className="px-3 py-2">{p.areaHa.toLocaleString("pt-BR")} ha</td>
                  <td className="px-3 py-2">{p.photos.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2"><ExpiryBadge days={p.daysLeft} /></td>
                  <td className="px-3 py-2"><Actions p={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}