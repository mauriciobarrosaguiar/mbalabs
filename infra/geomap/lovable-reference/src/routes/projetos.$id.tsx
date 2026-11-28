import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, FileText, ArrowLeft, Clock, CheckCircle2, MapPin, Target, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel, StatusBadge, Field, Kpi, Bar } from "@/components/geo/ui";
import { AerialMap, HypsoLegend, MapThumb, type MapMode } from "@/components/geo/AerialMap";
import { PointCloud } from "@/components/geo/PointCloud";
import { getProject, photogrammetryStages } from "@/lib/mock-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/projetos/$id")({
  loader: ({ params }) => {
    const p = getProject(params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => loaderData ? pageHead(loaderData.name, `Resultados do levantamento ${loaderData.name}.`) : { meta: [{ title: "Projeto não encontrado" }, { name: "robots", content: "noindex" }] },
  component: ProjectPage,
  notFoundComponent: () => <div className="p-10 text-center"><p className="font-semibold">Projeto não encontrado.</p><Link to="/projetos" className="text-primary">Voltar aos projetos</Link></div>,
  errorComponent: () => <div className="p-10 text-center">Não foi possível carregar o projeto.</div>,
});

const tabs = ["Visão geral", "Ortomosaico", "Modelos de elevação", "Curvas de nível", "Nuvem de pontos", "Modelo 3D", "Qualidade", "Relatórios", "Downloads", "Histórico"] as const;
type Tab = (typeof tabs)[number];

function Countdown({ days }: { days: number }) {
  const [left, setLeft] = useState(days * 86400 - 4 * 3600 - 17 * 60);
  useEffect(() => { const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(id); }, []);
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  return (
    <div className="flex gap-1.5 font-mono">
      {[[d, "d"], [h, "h"], [m, "min"], [s, "s"]].map(([v, u]) => (
        <div key={u} className="min-w-11 rounded-md bg-warning/15 px-1.5 py-1 text-center"><p className="text-lg font-bold leading-none text-warning">{String(v).padStart(2, "0")}</p><p className="text-[9px] text-muted-foreground">{u}</p></div>
      ))}
    </div>
  );
}

const files = [
  ["Ortomosaico", "ortomosaico.tif", "GeoTIFF", "9,8 GB"], ["Ortomosaico (web)", "ortomosaico.kmz", "KMZ", "412 MB"], ["MDT", "mdt.tif", "GeoTIFF", "2,1 GB"], ["MDS", "mds.tif", "GeoTIFF", "2,4 GB"],
  ["Curvas de nível", "curvas_1m.shp", "SHP", "38 MB"], ["Curvas de nível", "curvas_1m.dxf", "DXF", "52 MB"], ["Nuvem de pontos", "nuvem_densa.laz", "LAZ", "6,2 GB"], ["Modelo 3D", "modelo.glb", "GLB", "820 MB"],
  ["Relatório de processamento", "relatorio_odm.pdf", "PDF", "14 MB"],
];

function ProjectPage() {
  const p = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("Visão geral");
  const [elev, setElev] = useState<MapMode>("mdt");
  const mode: MapMode = tab === "Modelos de elevação" ? elev : tab === "Curvas de nível" ? "hypso" : "ortho";
  const days = p.daysLeft ?? 0;
  const done = p.status === "Disponível";

  return (
    <div className="space-y-4">
      <Link to="/projetos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-3" /> Meus projetos</Link>
      <PageHeader title={p.name} subtitle={`${p.client} · ${p.city}/${p.uf} · ${p.drone}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/relatorios"><FileText className="size-4" /> Relatório</Link></Button>
          <Button disabled={!done} onClick={() => toast.success("Pacote completo em preparação", { description: "pacote_" + p.id + ".zip · 23,6 GB (demonstração)" })}><Download className="size-4" /> Baixar pacote completo</Button>
        </>} />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Área mapeada" value={`${p.areaHa.toLocaleString("pt-BR")} ha`} icon={MapPin} tone="info" />
          <Kpi label="GSD médio" value={`${p.gsd.toFixed(1)} cm/px`} icon={Target} />
          <Kpi label="RMSE horizontal" value="2,8 cm" hint="6 GCPs" icon={Crosshair} tone="success" />
          <Kpi label="Imagens calibradas" value={`${Math.round(p.photos * 0.997)} / ${p.photos}`} icon={CheckCircle2} tone="success" />
        </div>
        {done ? (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <Clock className="size-5 text-warning" />
            <div><p className="mb-1 text-xs text-muted-foreground">Exclusão automática em</p><Countdown days={days} /></div>
          </div>
        ) : <div className="flex items-center gap-2 rounded-lg border p-3 text-sm"><StatusBadge status={p.status} /> <span className="text-muted-foreground">{p.progress}%</span></div>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="overflow-x-auto"><TabsList className="w-max">{tabs.map((t) => <TabsTrigger key={t} value={t} className="text-xs">{t}</TabsTrigger>)}</TabsList></div>
      </Tabs>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {tab === "Nuvem de pontos" || tab === "Modelo 3D" ? (
            <div className="h-[460px] overflow-hidden rounded-lg border"><PointCloud color={tab === "Modelo 3D" ? "rgb" : "altitude"} mesh={tab === "Modelo 3D"} variant={p.variant} /></div>
          ) : ["Qualidade", "Relatórios", "Downloads", "Histórico"].includes(tab) ? (
            <SideTab tab={tab} p={p} />
          ) : (
            <AerialMap className="h-[460px]" variant={p.variant} mode={mode} contours={tab === "Curvas de nível"}
              overlay={<>
                {tab === "Modelos de elevação" && (
                  <div className="absolute left-2 top-2 flex rounded-md border bg-card/90 p-0.5 text-xs">
                    {(["mdt", "mds", "hypso"] as const).map((m) => <button key={m} onClick={() => setElev(m)} className={`rounded px-2 py-1 ${elev === m ? "bg-primary text-primary-foreground" : ""}`}>{m === "hypso" ? "Hipsometria" : m.toUpperCase()}</button>)}
                  </div>
                )}
                {(tab === "Curvas de nível" || elev === "hypso") && tab !== "Ortomosaico" && tab !== "Visão geral" && <div className="absolute bottom-9 left-2"><HypsoLegend /></div>}
              </>} />
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Metadados">
            <Field label="Data do voo" value={new Date(p.date + "T12:00").toLocaleDateString("pt-BR")} />
            <Field label="Fotografias" value={p.photos.toLocaleString("pt-BR")} />
            <Field label="Finalidade" value={p.purpose} />
            <Field label="Sistema" value="SIRGAS 2000 / UTM 22S" />
            <Field label="Motor" value="OpenDroneMap 3.5 · NodeODM" />
            <Field label="Qualidade" value="Equilibrado" />
          </Panel>
          <Panel title="Produtos gerados">
            <div className="grid grid-cols-3 gap-2">
              {(["ortho", "mdt", "hypso", "slope", "vari", "mds"] as const).map((m, i) => (
                <div key={m} className="overflow-hidden rounded border"><MapThumb variant={p.variant} mode={m === "vari" ? "vari" : "ortho"} className="h-14 w-full" /><p className="truncate px-1 py-0.5 text-[10px]">{["Ortomosaico", "MDT", "Hipsometria", "Declividade", "VARI", "MDS"][i]}</p></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SideTab({ tab, p }: { tab: string; p: { photos: number } }) {
  if (tab === "Qualidade")
    return (
      <Panel title="Relatório de qualidade do processamento">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Field label="RMSE X" value="2,1 cm" /><Field label="RMSE Y" value="1,9 cm" /><Field label="RMSE Z" value="4,6 cm" />
            <Field label="Erro de reprojeção médio" value="0,82 px" /><Field label="Pontos de enlace" value="1.284.551" /><Field label="Densidade da nuvem" value="142 pts/m²" />
          </div>
          <div className="space-y-3 text-sm">
            {[["Sobreposição média", 92], ["Imagens calibradas", 99.7], ["Cobertura de GCPs", 85], ["Nitidez média", 88]].map(([l, v]) => (
              <div key={l as string}><div className="mb-1 flex justify-between text-xs"><span>{l}</span><span>{v}%</span></div><Bar value={v as number} tone={(v as number) > 90 ? "success" : "primary"} /></div>
            ))}
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Relatório descritivo do processamento. Não constitui laudo técnico nem certificação de precisão.</p>
          </div>
        </div>
      </Panel>
    );
  if (tab === "Downloads")
    return (
      <Panel title="Downloads individuais" bodyClass="p-0">
        <ul className="divide-y">{files.map(([prod, f, fmt, size]) => (
          <li key={f} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-16 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-center font-mono text-[10px]">{fmt}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{prod}</p><p className="truncate font-mono text-xs text-muted-foreground">{f} · {size}</p></div>
            <Button size="sm" variant="outline" onClick={() => toast(`Download de ${f} (demonstração)`)}><Download className="size-3.5" /></Button>
          </li>))}</ul>
      </Panel>
    );
  if (tab === "Relatórios")
    return (
      <Panel title="Relatórios">
        <div className="grid gap-3 sm:grid-cols-2">
          {["Relatório de processamento (automático)", "Relatório técnico personalizado"].map((r) => (
            <div key={r} className="rounded-md border p-3"><FileText className="mb-2 size-6 text-primary" /><p className="text-sm font-medium">{r}</p><Button size="sm" variant="outline" className="mt-2" asChild><Link to="/relatorios">Abrir editor</Link></Button></div>
          ))}
        </div>
      </Panel>
    );
  return (
    <Panel title="Histórico do projeto">
      <ol className="relative space-y-3 border-l pl-4 text-sm">
        {[`Projeto criado · ${p.photos} fotos enviadas`, ...photogrammetryStages.map((s) => `${s} concluída`), "Arquivos disponibilizados — prazo de 7 dias iniciado"].map((e, i) => (
          <li key={i}><span className="absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-card bg-success" /><p>{e}</p><p className="text-xs text-muted-foreground">24/11/2026 {String(8 + Math.floor(i / 2)).padStart(2, "0")}:{String((i * 7) % 60).padStart(2, "0")}</p></li>
        ))}
      </ol>
    </Panel>
  );
}