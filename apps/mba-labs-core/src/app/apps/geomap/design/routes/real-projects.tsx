"use client";
import { useState } from "react";
import { FolderKanban, Ruler, Images, Loader2, CheckCircle2, AlarmClock, HardDrive, Coins, Plus, Map, Route as RouteIcon, Mountain, Box, FileText, Download, ArrowRight, UploadCloud, ChevronLeft, ChevronRight, MapPin, Calendar, Plane, LayoutGrid, List } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PageHeader,Panel,Kpi,Field,StatusBadge } from "../components/geo/ui";
import { Link,useNavigate } from "../lib/navigation";
import { emptyProject, projectInputSchema,type ProjectList,type ProjectInput,type RealProject } from "../../project-model";
import { createGeoMapProject } from "../../project-actions";
import { ProcessingPreparation } from "./processing-preparation";

function Heading({title,subtitle,actions}:{title:string;subtitle?:string;actions?:React.ReactNode}){
 return <PageHeader title={title} subtitle={subtitle} actions={actions} demo={false}/>;
}
function Notice({ready}:{ready:boolean}){
 return !ready?<div role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">Banco de projetos ainda não habilitado neste ambiente. Não serão criados dados fictícios nem exibidos indicadores como se fossem reais.</div>:null;
}
function NewButton(){return <Button asChild><Link to="/novo-projeto"><Plus className="size-4"/> Novo projeto</Link></Button>}
function ProjectCard({p}:{p:RealProject}){
 return <Link to="/projetos/$id" params={{id:p.id}} className="group block overflow-hidden rounded-lg border bg-card hover:border-primary"><div className="grid h-28 place-items-center bg-muted text-muted-foreground"><Map className="size-8"/><span className="text-xs">Sem ortomosaico</span></div><div className="space-y-2 p-3"><p className="font-semibold group-hover:text-primary">{p.name}</p><StatusBadge status="Rascunho"/><p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3.5"/>{p.city}/{p.uf}</p><p className="text-xs text-muted-foreground"><Plane className="mr-1 inline size-3.5"/>{p.drone||"Não informado"}</p></div></Link>;
}
export function RealDashboard({data}:{data:ProjectList}){
 const shortcuts=[["/planejamento","Planejar voo",RouteIcon],["/geostudio","GeoStudio",Map],["/topografia","Topografia",Mountain],["/visualizador-3d","Visualizador 3D",Box],["/relatorios","Relatórios",FileText],["/exportacoes","Exportações",Download]] as const;
 return <div className="space-y-4"><Heading title="Dashboard" subtitle="Ambiente de trabalho · dados reais" actions={<NewButton/>}/><Notice ready={data.ready}/>
 <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
 <Kpi label="Projetos" value={data.ready?String(data.projects.length):"—"} icon={FolderKanban}/>
 <Kpi label="Área mapeada" value="—" icon={Ruler} tone="info"/>
 <Kpi label="Fotos processadas" value="—" icon={Images} tone="info"/>
 <Kpi label="Em processamento" value="—" icon={Loader2}/>
 <Kpi label="Concluídos" value="—" icon={CheckCircle2} tone="success"/>
 <Kpi label="Expiram em 7 dias" value="—" icon={AlarmClock} tone="warning"/>
 <Kpi label="Armazenamento" value="—" icon={HardDrive} tone="info"/>
 <Kpi label="Custo computacional" value="—" icon={Coins} tone="success"/>
 </div>
 <div className="grid gap-4 xl:grid-cols-3"><Panel title="Mapa geral de levantamentos" className="xl:col-span-2" bodyClass="p-0"><div className="grid h-[340px] place-items-center bg-muted text-center text-muted-foreground sm:h-[400px]"><div><Map className="mx-auto mb-2 size-10"/>Mapas reais aparecerão após o processamento.</div></div></Panel><Panel title="Processamentos em andamento" action={<Link to="/processamento" className="text-xs text-primary">Ver central</Link>}><p className="text-sm text-muted-foreground">Fila privada ainda não conectada.</p></Panel></div>
 <div className="grid gap-4 xl:grid-cols-3"><Panel title="Projetos recentes" className="xl:col-span-2" action={<Link to="/projetos" className="text-xs text-primary">Todos</Link>}>{data.projects.length?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.projects.slice(0,4).map(p=><ProjectCard key={p.id} p={p}/>)}</div>:<p className="text-sm text-muted-foreground">{data.ready?"Nenhum projeto cadastrado. Crie seu primeiro projeto.":"Cadastro aguardando habilitação do banco."}</p>}</Panel><Panel title="Alertas de exclusão (7 dias)"><p className="text-sm text-muted-foreground">Nenhum arquivo em armazenamento privado disponível para consulta.</p></Panel></div>
 <div className="grid gap-4 xl:grid-cols-3"><Panel title="Utilização — últimos 7 dias" className="xl:col-span-2"><div className="grid h-56 place-items-center text-sm text-muted-foreground">Sem métricas de computação disponíveis.</div></Panel><Panel title="Atalhos rápidos"><div className="grid grid-cols-3 gap-2">{shortcuts.map(([to,label,Icon])=><Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center text-xs hover:border-primary hover:bg-accent"><Icon className="size-5 text-primary"/>{label}</Link>)}</div><Link to="/novo-projeto" className="mt-3 flex items-center justify-between rounded-md bg-primary/10 p-3 text-sm font-medium text-primary">Iniciar assistente de novo projeto <ArrowRight className="size-4"/></Link></Panel></div></div>;
}
export function RealProjects({data}:{data:ProjectList}){
 const [view,setView]=useState<"grid"|"table">("grid");const [query,setQuery]=useState("");
 const projects=data.projects.filter(p=>[p.name,p.client,p.city,p.drone].some(s=>s.toLowerCase().includes(query.toLowerCase())));
 return <div className="space-y-4"><Heading title="Meus projetos" subtitle={data.ready?projects.length+" levantamentos":"Banco ainda não habilitado"} actions={<><div className="flex rounded-md border p-0.5"><Button size="sm" variant={view==="grid"?"secondary":"ghost"} onClick={()=>setView("grid")} aria-label="Cartões"><LayoutGrid className="size-4"/></Button><Button size="sm" variant={view==="table"?"secondary":"ghost"} onClick={()=>setView("table")} aria-label="Tabela"><List className="size-4"/></Button></div><NewButton/></>}/><Notice ready={data.ready}/><Input placeholder="Buscar projeto, contratante, cidade ou drone" value={query} onChange={e=>setQuery(e.target.value)}/>{!projects.length?<Panel><p className="text-sm text-muted-foreground">{data.ready?"Nenhum projeto encontrado.":"Aguardando banco de projetos."}</p></Panel>:view==="grid"?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{projects.map(p=><ProjectCard key={p.id} p={p}/>)}</div>:<div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Projeto</th><th>Local</th><th>Status</th></tr></thead><tbody>{projects.map(p=><tr key={p.id} className="border-t"><td className="p-3"><Link to="/projetos/$id" params={{id:p.id}} className="text-primary">{p.name}</Link></td><td>{p.city}/{p.uf}</td><td><StatusBadge status="Rascunho"/></td></tr>)}</tbody></table></div>}</div>;
}
const steps=["Identificação","Fotografias","Produtos","Configurações","Revisão"];
function Stepper({active}:{active:number}){return <ol className="mb-5 grid grid-cols-5 gap-1.5">{steps.map((s,i)=><li key={s}><div className={"h-1 rounded-full "+(i<=active?"bg-primary":"bg-muted")}/><div className="mt-2 flex items-center gap-2"><span className={"grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold "+(i===active?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>{i+1}</span><span className="hidden truncate text-xs sm:inline">{s}</span></div></li>)}</ol>}
export function RealWizard({ready}:{ready:boolean}){
 const [input,setInput]=useState<ProjectInput>({...emptyProject});const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const navigate=useNavigate();
 const fields=[["name","Nome do projeto *",2],["client","Contratante",2],["property","Propriedade",1],["operator","Operador",1],["city","Município *",1],["uf","UF *",1],["rt","Responsável técnico (quando aplicável)",1],["date","Data do levantamento",1],["purpose","Finalidade do trabalho",2],["drone","Equipamento",2]] as const;
 async function save(){setMessage("");if(!ready||busy)return;const parsed=projectInputSchema.safeParse(input);if(!parsed.success){setMessage("Informe nome, município e UF válida.");return;}setBusy(true);try{const result=await createGeoMapProject(parsed.data);if(result.ok)navigate({to:"/projetos/$id",params:{id:result.id}});else setMessage(result.message);}catch{setMessage("Falha ao salvar o projeto.");}finally{setBusy(false)}}
 return <div className="mx-auto max-w-6xl"><Heading title="Novo projeto" subtitle="Assistente operacional — identificação do levantamento"/><Stepper active={0}/><Notice ready={ready}/><div className="mt-3"><Button variant="outline" asChild><Link to="/preparar-processamento">Preparar processamento sem criar projeto</Link></Button></div><form className="mt-4" onSubmit={e=>{e.preventDefault();void save()}}><div className="grid gap-4 lg:grid-cols-2"><Panel title="Etapa 1 — Identificação"><div className="grid gap-3 sm:grid-cols-2">{fields.map(([k,l,span])=><div key={k} className={span===2?"sm:col-span-2":""}><Label htmlFor={k} className="mb-1 text-xs">{l}</Label>{k==="uf"?<select id={k} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={input.uf} onChange={e=>setInput(o=>({...o,uf:e.target.value as ProjectInput["uf"]}))}>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(u=><option key={u}>{u}</option>)}</select>:<Input id={k} type={k==="date"?"date":"text"} required={k==="name"||k==="city"} value={input[k]} onChange={e=>setInput(o=>({...o,[k]:e.target.value}))}/>}</div>)}</div></Panel><Panel title="Localização no mapa" bodyClass="p-0"><div className="grid h-[380px] place-items-center bg-muted text-center text-muted-foreground"><div><MapPin className="mx-auto mb-2 size-8"/>Localização geográfica ainda não integrada.</div></div></Panel></div><div className="sticky bottom-0 mt-5 flex justify-between border-t bg-background/90 py-3 backdrop-blur"><Button variant="outline" asChild><Link to="/projetos"><ChevronLeft className="size-4"/> Voltar</Link></Button><Button disabled={!ready||busy} type="submit">{busy?"Salvando…":"Salvar e continuar"} <ChevronRight className="size-4"/></Button></div><p role="status" className="text-sm text-warning">{message}</p></form></div>;
}
export function RealDetail({p,ready}:{p?:RealProject;ready:boolean}){
 if(!p)return <Panel title="Projeto indisponível"><Notice ready={ready}/><Link to="/projetos" className="text-primary">Voltar aos projetos</Link></Panel>;
 return <div className="space-y-4"><Heading title={p.name} subtitle={p.city+"/"+p.uf+" · Rascunho"}/><Panel title="Identificação"><Field label="Contratante" value={p.client||"Não informado"}/><Field label="Drone" value={p.drone||"Não informado"}/><Field label="Finalidade" value={p.purpose||"Não informada"}/></Panel><ProcessingPreparation key={p.id} projectId={p.id}/></div>;
}
