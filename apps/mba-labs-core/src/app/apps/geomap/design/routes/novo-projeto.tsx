"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "../lib/navigation";
import { Check, ChevronLeft, ChevronRight, UploadCloud, FolderOpen, AlertTriangle, Copy, MapPinOff, FileX, Focus, Rocket, Zap, Scale, Gem, Clock, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { PageHeader, Panel, Field, Bar } from "../components/geo/ui";
import { AerialMap, MapThumb, type MapMode } from "../components/geo/AerialMap";
import { equipment } from "../lib/mock-data";
import { cn } from "../lib/utils";


const steps = ["Identificação", "Fotografias", "Produtos", "Configurações", "Revisão"];

const productList: { id: string; name: string; mode: MapMode; desc: string }[] = [
  { id: "orto", name: "Ortomosaico", mode: "ortho", desc: "Uma única foto aérea gigante, corrigida e sem distorções, onde é possível medir distâncias e áreas." },
  { id: "mdt", name: "MDT", mode: "mdt", desc: "Modelo do terreno 'pelado': mostra o relevo do solo, sem árvores nem construções." },
  { id: "mds", name: "MDS", mode: "mds", desc: "Modelo da superfície: inclui tudo que está sobre o solo, como copas, prédios e pilhas." },
  { id: "curvas", name: "Curvas de nível", mode: "hypso", desc: "Linhas que ligam pontos de mesma altitude. Base para projetos de terraplenagem e drenagem." },
  { id: "decliv", name: "Mapa de declividade", mode: "slope", desc: "Mostra onde o terreno é plano ou inclinado, em cores. Útil para máquinas e erosão." },
  { id: "hipso", name: "Mapa hipsométrico", mode: "hypso", desc: "Colore o terreno por faixas de altitude, facilitando a leitura do relevo." },
  { id: "nuvem", name: "Nuvem de pontos", mode: "mdt", desc: "Milhões de pontos 3D com cor e altitude. Matéria-prima para volumes e modelos." },
  { id: "3d", name: "Modelo 3D", mode: "ortho", desc: "Malha texturizada navegável, ideal para apresentações e inspeções visuais." },
  { id: "rgb", name: "Índices vegetativos RGB", mode: "vari", desc: "VARI, ExG e GLI destacam o vigor das plantas usando câmera comum (não substitui NDVI)." },
  { id: "rel-proc", name: "Relatório de processamento", mode: "ortho", desc: "Documento automático com qualidade, precisão e parâmetros utilizados." },
  { id: "rel-pers", name: "Relatório personalizado", mode: "hypso", desc: "Relatório com sua marca, mapas escolhidos e textos técnicos editáveis." },
  { id: "pacote", name: "Pacote completo", mode: "ortho", desc: "Todos os produtos acima organizados em pastas, num único arquivo ZIP." },
];

const presets = [
  { id: "rapido", name: "Rápido", icon: Zap, desc: "Resolução reduzida (25%), ideal para conferência em campo.", time: 1.4, cost: 18 },
  { id: "equilibrado", name: "Equilibrado", icon: Scale, desc: "Qualidade profissional com bom tempo de entrega.", time: 3.6, cost: 46 },
  { id: "alta", name: "Alta qualidade", icon: Gem, desc: "Resolução total e nuvem densa ultra. Para topografia e volumes.", time: 7.9, cost: 104 },
];

export function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [id, setId] = useState({ name: "Fazenda Santa Clara — Safra 26/27", client: "Agro Santa Clara Ltda.", property: "Fazenda Santa Clara", city: "Rio Verde", uf: "GO", operator: "Mauricio Aguiar", rt: "", date: "2026-11-28", purpose: "Agricultura de precisão" });
  const [photos, setPhotos] = useState({ count: 0, size: 0, uploaded: 0 });
  const [products, setProducts] = useState<string[]>(["orto", "mdt", "curvas", "rel-proc"]);
  const [preset, setPreset] = useState("equilibrado");
  const [cfg, setCfg] = useState({ drone: equipment[0]!.name, crs: "SIRGAS 2000 / UTM 22S", gcp: true, check: false, eq: "1" });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (photos.count === 0 || photos.uploaded >= photos.count) return;
    const t = setTimeout(() => setPhotos((p) => ({ ...p, uploaded: Math.min(p.count, p.uploaded + Math.ceil(p.count / 25)) })), 120);
    return () => clearTimeout(t);
  }, [photos]);

  const valid = [id.name && id.client && id.city && id.uf, photos.count > 0 && photos.uploaded >= photos.count, products.length > 0, true, true][step];
  const pr = presets.find((x) => x.id === preset)!;
  const factor = Math.max(1, photos.count / 400);
  const addPhotos = (count: number, size: number) => setPhotos({ count, size, uploaded: 0 });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Novo projeto" subtitle="Assistente operacional — demonstração local; nenhuma fotografia será enviada à nuvem." />

      <ol className="mb-5 grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => (
          <li key={s}>
            <button disabled={i > step} onClick={() => setStep(i)} className="w-full text-left disabled:cursor-not-allowed">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", i < step ? "bg-success text-[color:var(--success-foreground)]" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
                <span className={cn("hidden truncate text-xs sm:inline", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
              </div>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Etapa 1 — Identificação">
            <div className="grid gap-3 sm:grid-cols-2">
              {([["name", "Nome do projeto *", 2], ["client", "Contratante *", 2], ["property", "Propriedade", 1], ["operator", "Operador", 1], ["city", "Município *", 1], ["uf", "UF *", 1], ["rt", "Responsável técnico (quando aplicável)", 1], ["date", "Data do levantamento", 1]] as const).map(([k, l, span]) => (
                <div key={k} className={span === 2 ? "sm:col-span-2" : ""}>
                  <Label htmlFor={k} className="mb-1 text-xs">{l}</Label>
                  <Input id={k} type={k === "date" ? "date" : "text"} value={id[k]} onChange={(e) => setId({ ...id, [k]: e.target.value })} placeholder={k === "rt" ? "Nome e registro CREA/CFT" : ""} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label className="mb-1 text-xs">Finalidade do trabalho</Label>
                <Select value={id.purpose} onValueChange={(v) => setId({ ...id, purpose: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Agricultura de precisão", "Topografia / loteamento", "Volumetria de pilhas", "Regularização ambiental (CAR)", "Inspeção de ativos", "Projeto rodoviário"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
          <Panel title="Localização no mapa" bodyClass="p-0">
            <AerialMap className="h-[380px] rounded-t-none border-0" variant={3}>
              <polygon points="300,200 680,170 740,460 340,520" fill="var(--primary)" fillOpacity={0.18} stroke="var(--info)" strokeWidth={3} />
            </AerialMap>
          </Panel>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <Panel title="Etapa 2 — Fotografias">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const fs = [...e.dataTransfer.files]; addPhotos(fs.length, fs.reduce((a, f) => a + f.size, 0)); }}
                className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors", dragOver ? "border-primary bg-primary/10" : "border-border")}
              >
                <UploadCloud className="mb-2 size-10 text-primary" />
                <p className="font-semibold">Arraste e solte as fotografias aqui</p>
                <p className="mb-3 text-xs text-muted-foreground">JPG/TIFF com EXIF e GPS · envio retomável em caso de queda da internet</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => fileRef.current?.click()}><UploadCloud className="size-4" /> Selecionar fotos</Button>
                  <Button size="sm" variant="outline" onClick={() => addPhotos(412, 412 * 9.4e6)}><FolderOpen className="size-4" /> Selecionar pasta (demo)</Button>
                </div>
                <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) addPhotos(fs.length, fs.reduce((a, f) => a + f.size, 0)); }} />
              </div>
              {photos.count > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted p-2"><p className="text-lg font-bold">{photos.count}</p><p className="text-[10px] text-muted-foreground">arquivos</p></div>
                    <div className="rounded-md bg-muted p-2"><p className="text-lg font-bold">{(photos.size / 1e9).toFixed(2)} GB</p><p className="text-[10px] text-muted-foreground">tamanho total</p></div>
                    <div className="rounded-md bg-muted p-2"><p className="text-lg font-bold">{Math.round((photos.uploaded / photos.count) * 100)}%</p><p className="text-[10px] text-muted-foreground">enviado</p></div>
                  </div>
                  <Bar value={(photos.uploaded / photos.count) * 100} tone={photos.uploaded >= photos.count ? "success" : "primary"} />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wifi className="size-3.5" /> Envio retomável ativo — se a conexão cair, o envio continua de onde parou.</p>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {[[Copy, "3 duplicadas", "text-warning"], [MapPinOff, "2 sem coordenadas", "text-warning"], [FileX, "1 inválida", "text-destructive"], [Focus, "4 possível desfoque", "text-warning"]].map(([I, t, c], k) => {
                      const Icon = I as typeof Copy;
                      return <div key={k} className="flex items-center gap-1.5 rounded-md border p-2"><Icon className={cn("size-3.5", c as string)} />{t as string}</div>;
                    })}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} className="relative overflow-hidden rounded border">
                        <MapThumb variant={(i % 8) + 1} className="aspect-square w-full" />
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted"><div className="h-full bg-success" style={{ width: `${Math.min(100, (photos.uploaded / photos.count) * 100 * (1 + i / 20))}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
          <Panel title="Distribuição espacial das fotografias" bodyClass="p-0">
            <AerialMap className="h-[460px] rounded-t-none border-0" variant={3}>
              {photos.count > 0 && Array.from({ length: 14 }, (_, row) => Array.from({ length: 22 }, (_, c) => (
                <circle key={`${row}-${c}`} cx={290 + c * 20 + row * 2} cy={190 + row * 24} r={3.2} fill={row === 3 && c === 7 ? "var(--destructive)" : "var(--info)"} stroke="var(--sidebar)" strokeWidth={1} opacity={(row * 22 + c) / 308 <= photos.uploaded / photos.count ? 1 : 0.25} />
              )))}
            </AerialMap>
          </Panel>
        </div>
      )}

      {step === 2 && (
        <Panel title="Etapa 3 — Produtos desejados" action={<span className="text-xs text-muted-foreground">{products.length} selecionados</span>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {productList.map((pr) => {
              const on = products.includes(pr.id);
              return (
                <button key={pr.id} onClick={() => setProducts(on ? products.filter((x) => x !== pr.id) : [...products, pr.id])} aria-pressed={on}
                  className={cn("overflow-hidden rounded-lg border text-left transition-all", on ? "border-primary ring-2 ring-primary/40" : "hover:border-primary/50")}>
                  <div className="relative"><MapThumb variant={4} mode={pr.mode} className="h-24 w-full" />
                    <span className={cn("absolute right-2 top-2 grid size-5 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-card bg-card/70")}>{on && <Check className="size-3" />}</span>
                  </div>
                  <div className="p-3"><p className="text-sm font-semibold">{pr.name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pr.desc}</p></div>
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel title="Etapa 4 — Configurações técnicas">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Qualidade do processamento</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {presets.map((x) => (
                <button key={x.id} onClick={() => setPreset(x.id)} className={cn("rounded-lg border p-3 text-left", preset === x.id ? "border-primary bg-primary/8 ring-2 ring-primary/40" : "hover:border-primary/50")}>
                  <x.icon className="mb-2 size-5 text-primary" /><p className="text-sm font-semibold">{x.name}</p><p className="mt-1 text-xs text-muted-foreground">{x.desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><Label className="mb-1 text-xs">Modelo do drone</Label>
                <Select value={cfg.drone} onValueChange={(v) => setCfg({ ...cfg, drone: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{equipment.map((e) => <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1 text-xs">Sistema de coordenadas</Label>
                <Select value={cfg.crs} onValueChange={(v) => setCfg({ ...cfg, crs: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["SIRGAS 2000 / UTM 22S", "SIRGAS 2000 / UTM 23S", "SIRGAS 2000 / UTM 24S", "WGS 84 (EPSG:4326)"].map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1 text-xs">Resolução desejada</Label><Input defaultValue="Automática (GSD nativo)" /></div>
              <div><Label className="mb-1 text-xs">Equidistância das curvas (m)</Label>
                <Select value={cfg.eq} onValueChange={(v) => setCfg({ ...cfg, eq: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["0.5", "1", "2", "5"].map((e) => <SelectItem key={e} value={e}>{e} m</SelectItem>)}</SelectContent></Select></div>
              <label className="flex items-center justify-between rounded-md border p-3 text-sm">Pontos de controle em solo (GCP)<Switch checked={cfg.gcp} onCheckedChange={(v) => setCfg({ ...cfg, gcp: v })} /></label>
              <label className="flex items-center justify-between rounded-md border p-3 text-sm">Pontos independentes de checagem<Switch checked={cfg.check} onCheckedChange={(v) => setCfg({ ...cfg, check: v })} /></label>
            </div>
            <Accordion type="single" collapsible className="mt-3">
              <AccordionItem value="adv">
                <AccordionTrigger className="text-sm">Configurações avançadas (OpenDroneMap)</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
                    {[["feature-quality", "high"], ["pc-quality", preset === "alta" ? "ultra" : "medium"], ["min-num-features", "10000"], ["dem-resolution", "5"], ["orthophoto-resolution", "3"], ["mesh-octree-depth", "11"], ["use-3dmesh", "true"], ["auto-boundary", "true"]].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded border bg-muted/40 px-2 py-1.5"><span>--{k}</span><span className="text-primary">{v}</span></div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Panel>
          {cfg.gcp && (
            <Panel title="Pontos de controle (GCP)">
              <div className="mb-2 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Importar arquivo gcp_list.txt / CSV</div>
              <table className="w-full font-mono text-[11px]"><thead className="text-muted-foreground"><tr><th className="text-left">ID</th><th>E (m)</th><th>N (m)</th><th>h (m)</th></tr></thead>
                <tbody>{["GCP-01", "GCP-02", "GCP-03", "GCP-04", "GCP-05", "GCP-06"].map((g, i) => <tr key={g}><td>{g}</td><td className="text-right">{(512340 + i * 213.4).toFixed(2)}</td><td className="text-right">{(8032110 + i * 157.9).toFixed(2)}</td><td className="text-right">{(742.31 + i * 3.1).toFixed(2)}</td></tr>)}</tbody></table>
            </Panel>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border-2 border-warning bg-warning/10 p-4">
            <Clock className="mt-0.5 size-6 shrink-0 text-warning" />
            <div><p className="font-semibold">Atenção: os arquivos deverão ser baixados em até 7 dias.</p>
              <p className="text-sm text-muted-foreground">Após a disponibilização, todos os produtos e fotografias originais ficarão armazenados por sete dias e serão <strong>excluídos automaticamente</strong>, sem possibilidade de recuperação.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Projeto">{[["Nome", id.name], ["Contratante", id.client], ["Local", `${id.city}/${id.uf}`], ["Data", new Date(id.date + "T12:00").toLocaleDateString("pt-BR")], ["Finalidade", id.purpose]].map(([l, v]) => <Field key={l} label={l!} value={v} />)}</Panel>
            <Panel title="Fotografias"><Field label="Arquivos" value={photos.count} /><Field label="Tamanho" value={`${(photos.size / 1e9).toFixed(2)} GB`} /><Field label="Avisos" value="10 itens revisados" /><Field label="Com GPS" value={`${photos.count - 2}`} /></Panel>
            <Panel title="Produtos"><div className="flex flex-wrap gap-1">{products.map((x) => <span key={x} className="rounded bg-secondary px-1.5 py-0.5 text-xs">{productList.find((p) => p.id === x)?.name}</span>)}</div></Panel>
            <Panel title="Configurações"><Field label="Qualidade" value={pr.name} /><Field label="Drone" value={cfg.drone.replace("DJI ", "")} /><Field label="SRC" value={cfg.crs} /><Field label="GCPs" value={cfg.gcp ? "6 pontos" : "Não"} /><Field label="Curvas" value={`${cfg.eq} m`} /></Panel>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Duração estimada</p><p className="font-display text-2xl font-bold">≈ {(pr.time * factor).toFixed(1)} h</p></div>
            <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Consumo estimado</p><p className="font-display text-2xl font-bold">{Math.round(photos.size / 1e9 * 3.2 + 4)} GB</p></div>
            <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Custo computacional estimado</p><p className="font-display text-2xl font-bold">R$ {(pr.cost * factor).toFixed(2).replace(".", ",")}</p></div>
          </div>
        </div>
      )}

      {!valid && step < 2 && <p className="mt-3 flex items-center gap-1.5 text-xs text-warning"><AlertTriangle className="size-3.5" />{step === 0 ? "Preencha os campos obrigatórios (*)." : "Adicione as fotografias e aguarde o envio terminar."}</p>}
      <div className="sticky bottom-0 mt-5 flex justify-between border-t bg-background/90 py-3 backdrop-blur">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="size-4" /> Voltar</Button>
        {step < 4 ? (
          <Button disabled={!valid} onClick={() => setStep(step + 1)}>Continuar <ChevronRight className="size-4" /></Button>
        ) : (
          <Button className="bg-success text-[color:var(--success-foreground)] hover:bg-success/90" onClick={() => { toast("Simulação de processamento", { description: `${id.name} entrou na fila (demonstração).` }); navigate({ to: "/processamento" }); }}><Rocket className="size-4" /> Iniciar processamento</Button>
        )}
      </div>
    </div>
  );
}