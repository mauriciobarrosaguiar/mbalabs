"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, FileCheck2,
  Plus, RefreshCw, ShieldCheck, TriangleAlert, MapPinned, Users, UserRound, Layers, Leaf, Search, ClipboardCheck,
} from "lucide-react";
import { useAgroData } from "../AgroDocUi";
import { filterAgroVooOrders, paginateAgroVooOrders } from "@/lib/agrovoo-board-view";
import { buildAgroVooOsPayload, validateAgroVooStep, type AgroVooOsDraft } from "@/lib/agrovoo-os-wizard";

const ROOT = "/apps/dronegestor";
type OsStage = {
  osId: string;
  numero: string;
  cliente: string;
  fazenda: string;
  talhao: string;
  status: string;
  stage: string;
  stageLabel: string;
  areaHa: number;
  progressHa: number;
  pilotName: string;
};
type Board = {
  ok: boolean;
  counts: { total: number; aplicando: number; pausada: number; prontaEncerrar: number };
  items: OsStage[];
};
type RecordItem = {
  entityId: string;
  data: {
    nome?: string;
    clienteId?: string;
    fazendaId?: string;
    areaHa?: number;
    culturaPadrao?: string;
  };
};
type ResourceList = { items: RecordItem[] };
const emptyDraft: AgroVooOsDraft = {
  clienteId: "", fazendaId: "", talhaoId: "", cultura: "", alvo: "",
  areaHa: "", dataPrevista: "", observacoes: "",
};
const steps = ["Cliente e área", "Serviço", "Agendamento", "Conferir"];

function fmt(value: number | undefined, decimals = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : "—";
}
function statusTone(value: string) {
  if (value === "em_execucao") return "bg-emerald-100 text-emerald-900";
  if (value === "suspensa") return "bg-amber-100 text-amber-900";
  if (value === "campo_concluido") return "bg-violet-100 text-violet-900";
  return "bg-slate-100 text-slate-700";
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700">
    {label}
    {children}
  </label>;
}
const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export function AgroVooBetaClient({ userName }: { userName: string }) {
  const board = useAgroData<Board>("/api/dronegestor/painel-gestor");
  const clients = useAgroData<ResourceList>("/api/dronegestor/cadastros?type=cliente");
  const farms = useAgroData<ResourceList>("/api/dronegestor/cadastros?type=fazenda");
  const fields = useAgroData<ResourceList>("/api/dronegestor/cadastros?type=talhao");
  const [screen, setScreen] = useState<"home" | "new">("home");
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("ativas");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [draft, setDraft] = useState<AgroVooOsDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState("");

  const farmItems = useMemo(
    () => (farms.data?.items || []).filter((x) => x.data.clienteId === draft.clienteId),
    [farms.data, draft.clienteId],
  );
  const fieldItems = useMemo(
    () => (fields.data?.items || []).filter((x) => x.data.fazendaId === draft.fazendaId),
    [fields.data, draft.fazendaId],
  );
  const cliente = clients.data?.items.find((x) => x.entityId === draft.clienteId)?.data.nome;
  const fazenda = farmItems.find((x) => x.entityId === draft.fazendaId)?.data.nome;
  const talhao = fieldItems.find((x) => x.entityId === draft.talhaoId)?.data.nome;
  const active = board.data?.items || [];
  const count = board.data?.counts;
  const filtered = filterAgroVooOrders(active, query, stageFilter);
  const { totalPages, currentPage, visibleOrders } = paginateAgroVooOrders(filtered, page, pageSize);

  function change<K extends keyof AgroVooOsDraft>(key: K, value: AgroVooOsDraft[K]) {
    setError("");
    setDraft((old) => ({ ...old, [key]: value }));
  }
  function openNew() {
    setDraft(emptyDraft);
    setCreatedId("");
    setError("");
    setStep(0);
    setScreen("new");
  }
  function goNext() {
    const nextError = validateAgroVooStep(step, draft);
    if (nextError) { setError(nextError); return; }
    setError("");
    setStep((s) => Math.min(3, s + 1));
  }
  async function createOs() {
    if (saving || createdId || step !== 3) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dronegestor/cadastros", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAgroVooOsPayload(draft)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.item?.entityId) {
        throw new Error(payload?.error || "Não foi possível criar a OS.");
      }
      setCreatedId(String(payload.item.entityId));
      board.refresh();
      window.dispatchEvent(new Event("dronegestor:cadastros-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar OS.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen pb-8">
    <div className="mx-auto grid w-full max-w-[1500px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">Gestão operacional</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{screen === "home" ? "Dashboard" : "Nova ordem de serviço"}</h1>
          <p className="mt-1 text-sm text-slate-600">{screen === "home" ? "Olá, " + userName + ". Acompanhe a operação da sua empresa." : "Preencha as quatro etapas para cadastrar a ordem."}</p>
        </div>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">Homologação</span>
      </header>

      {screen === "home" ? <>
        {board.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{board.error}</p>}
        <section aria-label="Operacional" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#123e38] px-4 py-2.5 text-white"><h2 className="flex items-center gap-2 text-base font-bold"><ClipboardCheck size={18}/> Operacional</h2><Link href={ROOT + "/ajuda"} className="text-sm font-semibold text-white underline-offset-2 hover:underline">Ajuda</Link></div>
          <div className="grid gap-3 p-3 sm:p-4">
            <div className="agro-compact-grid grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
              <button type="button" onClick={openNew} className="flex min-h-14 items-center justify-center gap-2 rounded-md bg-[#185a47] px-3 py-3 text-sm font-bold text-white hover:brightness-110"><Plus size={19}/> Nova ordem</button>
              {[
                {title:"Clientes",href:"/gestao?tab=cliente",icon:Users,color:"bg-[#16734e]"},
                {title:"Propriedades",href:"/gestao?tab=fazenda",icon:Layers,color:"bg-[#146779]"},
                {title:"Aeronaves",href:"/equipamentos",icon:MapPinned,color:"bg-[#a45916]"},
                {title:"Pilotos",href:"/pilotos",icon:UserRound,color:"bg-[#66528d]"},
              ].map(({title,href,icon:Icon,color})=><Link key={href} href={ROOT + href} className={"flex min-h-14 items-center justify-center gap-2 rounded-md px-3 py-3 text-sm font-bold text-white hover:brightness-110 " + color}><Icon size={19} className="shrink-0"/>{title}</Link>)}
            </div>
            <div className="agro-compact-grid grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                {label:"Ordens ativas",value:count?.total,href:"/gestao",icon:ClipboardCheck},
                {label:"Clientes",value:clients.data?.items.length,href:"/gestao?tab=cliente",icon:Users},
                {label:"Propriedades",value:farms.data?.items.length,href:"/gestao?tab=fazenda",icon:Layers},
                {label:"Talhões",value:fields.data?.items.length,href:"/gestao?tab=talhao",icon:MapPinned},
                {label:"Para conferir",value:count?.prontaEncerrar,href:"/conferencia",icon:ShieldCheck},
              ].map(({label,value,href,icon:Icon})=><Link key={label} href={ROOT + href} className="rounded-md border border-slate-200 p-3 text-slate-800 hover:border-emerald-400"><div className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-600"><span>{label}</span><Icon size={18} className="shrink-0 text-emerald-700"/></div><strong className="mt-1 block text-2xl font-bold tabular-nums text-slate-900">{value ?? "—"}</strong><span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">Ver <ArrowRight size={13}/></span></Link>)}
            </div>
            {(clients.error || farms.error || fields.error) && <p role="alert" className="text-xs text-red-700">Alguns cadastros não puderam ser consultados. {clients.error || farms.error || fields.error}</p>}
          </div>
        </section>
        <section aria-label="Situação das operações" className="agro-compact-grid grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {label:"OS ativas",value:count?.total,style:"border-l-emerald-700",filter:"ativas"},
            {label:"Aplicando",value:count?.aplicando,style:"border-l-teal-600",filter:"aplicando"},
            {label:"Pausadas",value:count?.pausada,style:"border-l-amber-600",filter:"pausada"},
            {label:"Para encerrar",value:count?.prontaEncerrar,style:"border-l-violet-600",filter:"pronta_encerrar"},
          ].map(({label,value,style,filter})=><button type="button" key={label} onClick={()=>{setStageFilter(filter);setPage(0);}} aria-pressed={stageFilter===filter} className={"rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-left shadow-sm hover:bg-slate-50 " + style}><span className="text-xs font-semibold text-slate-600">{label}</span><strong className="mt-1 block text-2xl font-bold tabular-nums text-slate-900">{value ?? "—"}</strong></button>)}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><h2 className="text-base font-bold text-slate-900">Ordens de serviço</h2><div className="flex items-center gap-2"><button type="button" onClick={() => board.refresh()} aria-label="Atualizar operações" className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700"><RefreshCw size={16}/> Atualizar</button><Link href={ROOT + "/gestao"} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800">Gestão completa <ArrowRight size={15}/></Link></div></div>
          <div className="flex flex-wrap gap-2 p-3 sm:p-4">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3"><Search size={18} className="shrink-0 text-slate-400"/><input type="search" aria-label="Buscar ordens" placeholder="Buscar OS, cliente, fazenda ou piloto" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"/></label>
            <select aria-label="Filtrar situação" value={stageFilter} onChange={e=>{setStageFilter(e.target.value);setPage(0);}} className="min-h-11 rounded-md border border-slate-300 px-3 text-sm sm:!w-auto"><option value="ativas">Ativas</option><option value="todas">Todas</option><option value="aberta">Abertas</option><option value="preparacao">Preparação</option><option value="aguardando_sarpas">Aguardando SARPAS</option><option value="aplicando">Aplicando</option><option value="pausada">Pausadas</option><option value="regularizacao">Campo concluído</option><option value="pronta_encerrar">Para encerrar</option><option value="encerrada">Encerradas</option><option value="cancelada">Canceladas</option></select>
          </div>
          {!board.data ? <p className="px-4 pb-4 text-sm text-slate-600">{board.error ? "Não foi possível carregar as ordens." : "Carregando dados autorizados da empresa..."}</p>
            : visibleOrders.length === 0 ? <p className="px-4 pb-5 text-sm text-slate-600">Nenhuma OS encontrada com estes filtros.</p>
            : <>
              <div role="region" aria-label="Tabela de ordens de serviço" tabIndex={0} className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs font-semibold text-slate-600"><tr>{["OS","Cliente / propriedade","Piloto","Área planejada","Situação","Ação"].map(label=><th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead><tbody>
                  {visibleOrders.map(os=><tr key={os.osId} className="border-b border-slate-100 even:bg-slate-50/70"><td className="px-3 py-3 font-semibold">{os.numero || "OS"}</td><td className="px-3 py-3"><strong className="block font-medium">{os.cliente || "Cliente"}</strong><span className="text-xs text-slate-500">{os.fazenda} · {os.talhao}</span></td><td className="px-3 py-3">{os.pilotName || "Não atribuído"}</td><td className="px-3 py-3 tabular-nums">{fmt(os.areaHa)} ha</td><td className="px-3 py-3"><span className={"inline-flex rounded-full px-2 py-1 text-xs font-semibold " + statusTone(os.status)}>{os.stageLabel || os.status}</span></td><td className="px-3 py-3"><Link href={ROOT + "/agrovoo/os/" + encodeURIComponent(os.osId)} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-800">Ver OS <ArrowRight size={14}/></Link></td></tr>)}
                </tbody></table>
              </div>
              <div className="grid gap-2 px-3 pb-3 md:hidden">{visibleOrders.map(os=><article key={os.osId} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{os.numero || "OS"}</strong><span className={"rounded-full px-2 py-1 text-xs font-semibold " + statusTone(os.status)}>{os.stageLabel || os.status}</span></div><p className="mt-2 text-sm font-medium">{os.cliente} · {os.fazenda}</p><p className="mt-1 text-xs text-slate-600">{os.talhao} · {fmt(os.areaHa)} ha · {os.pilotName}</p><Link href={ROOT + "/agrovoo/os/" + encodeURIComponent(os.osId)} className="mt-2 flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800">Ver OS <ArrowRight size={15}/></Link></article>)}</div>
            </>}
          {board.data && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-xs text-slate-600">
            <span>{filtered.length ? currentPage*pageSize+1 : 0}–{Math.min((currentPage+1)*pageSize,filtered.length)} de {filtered.length} ordens disponíveis</span>
            <div className="flex items-center gap-2"><select aria-label="Ordens por página" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}} className="min-h-11 !w-auto rounded-md border border-slate-200 px-2"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} className="min-h-11 rounded-md border border-slate-200 px-3 disabled:opacity-40" aria-label="Página anterior"><ArrowLeft size={16}/></button><span>{currentPage+1}/{totalPages}</span><button type="button" disabled={currentPage>=totalPages-1} onClick={()=>setPage(currentPage+1)} className="min-h-11 rounded-md border border-slate-200 px-3 disabled:opacity-40" aria-label="Próxima página"><ArrowRight size={16}/></button></div>
          </div>}
        </section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#123e38] px-4 py-2.5 text-white"><h2 className="text-base font-bold">Documentação e ferramentas</h2></div>
          <div className="agro-compact-grid grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">{[
            {title:"Regularização",text:"Documentos e vencimentos",href:"/diagnostico",icon:ShieldCheck},
            {title:"Mapas e evidências",text:"Foto do controle ou KML/KMZ",href:"/documentos",icon:MapPinned},
            {title:"Relatório mensal MAPA",text:"Conferir e gerar relatórios",href:"/relatorio-mensal",icon:FileCheck2},
            {title:"Defensivos",text:"Consultar produtos e AGROFIT",href:"/produtos",icon:Leaf},
          ].map(({title,text,href,icon:Icon})=><Link key={href} href={ROOT + href} className="rounded-md border border-slate-200 p-3 hover:border-emerald-400"><Icon size={22} className="text-emerald-700"/><strong className="mt-2 block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs text-slate-600">{text}</span></Link>)}</div>
          <p className="px-4 pb-3 text-xs text-slate-600">A falta de anexo não impede cadastrar a OS; a autorização legal continua necessária. O encerramento depende das evidências exigidas.</p>
        </section>
      </> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setScreen("home")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">
            <ArrowLeft size={17}/> Voltar ao painel
          </button>
          <span className="text-xs font-bold text-slate-500">Etapa {step + 1} de 4</span>
        </div>
        <div className="agro-compact-grid grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progresso da criação da OS">
          {steps.map((name, index) => <div key={name}
            className={"rounded-xl p-3 text-center text-xs font-bold sm:text-sm " + (index === step ? "bg-emerald-700 text-white" : index < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
            {index < step ? <Check size={14} className="mx-auto" aria-label="Concluída"/> : index + 1}. {name}
          </div>)}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {createdId ? <div className="grid gap-4">
            <FileCheck2 size={36} className="text-emerald-700"/>
            <h2 className="text-xl font-black">OS criada com sucesso</h2>
            <p className="text-sm leading-6 text-slate-700">A OS foi gravada na empresa. Abra os detalhes para vincular o piloto e completar o planejamento técnico, antes de encaminhar a missão. Criar não representa autorização para decolar.</p>
            <Link href={ROOT + "/agrovoo/os/" + encodeURIComponent(createdId)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white no-underline">
              Abrir OS e concluir planejamento <ArrowRight size={17}/>
            </Link>
            <button type="button" onClick={() => { setScreen("home"); board.refresh(); }} className="min-h-11 rounded-xl border border-slate-200 text-sm font-bold">Voltar ao painel</button>
          </div> : <>
            <h2 className="text-xl font-black text-slate-950">{steps[step]}</h2>
            <p className="mt-1 mb-5 text-sm text-slate-500">Avance somente depois de concluir as informações desta etapa.</p>
            <div className="grid gap-4">
              {step === 0 && <>
                <Field label="Cliente *"><select className={inputClass} value={draft.clienteId}
                  onChange={(e) => setDraft((old) => ({ ...old, clienteId: e.target.value, fazendaId: "", talhaoId: "", areaHa: "", cultura: "" }))}>
                  <option value="">Selecione o cliente</option>{(clients.data?.items || []).map((item) => <option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}
                </select></Field>
                <Field label="Fazenda *"><select className={inputClass} disabled={!draft.clienteId} value={draft.fazendaId}
                  onChange={(e) => setDraft((old) => ({ ...old, fazendaId: e.target.value, talhaoId: "", areaHa: "", cultura: "" }))}>
                  <option value="">Selecione a fazenda</option>{farmItems.map((item) => <option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}
                </select></Field>
                <Field label="Talhão *"><select className={inputClass} disabled={!draft.fazendaId} value={draft.talhaoId}
                  onChange={(e) => { const selected = fieldItems.find((item) => item.entityId === e.target.value);
                    setDraft((old) => ({ ...old, talhaoId: e.target.value, areaHa: selected?.data.areaHa ? String(selected.data.areaHa) : "", cultura: selected?.data.culturaPadrao || "" })); }}>
                  <option value="">Selecione o talhão</option>{fieldItems.map((item) => <option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}
                </select></Field>
                {clients.error || farms.error || fields.error ? <p role="alert" className="text-sm text-red-700">{clients.error || farms.error || fields.error}</p> : null}
                <Link href={ROOT + "/gestao?tab=cliente"} className="text-sm font-bold text-emerald-700">Precisa cadastrar cliente, fazenda ou talhão? Abrir cadastros existentes</Link>
              </>}
              {step === 1 && <>
                <Field label="Cultura *"><input className={inputClass} value={draft.cultura} onChange={(e) => change("cultura", e.target.value)} placeholder="Ex.: Milho"/></Field>
                <Field label="Alvo do serviço *"><input className={inputClass} value={draft.alvo} onChange={(e) => change("alvo", e.target.value)} placeholder="Ex.: Alvo definido no receituário"/></Field>
                <Field label="Área planejada (ha) *"><input className={inputClass} type="number" min="0.01" step="any" value={draft.areaHa} onChange={(e) => change("areaHa", e.target.value)}/></Field>
                <p className="text-xs leading-5 text-slate-500">Área planejada não é área aplicada. Os hectares reais serão registrados posteriormente pelo piloto.</p>
              </>}
              {step === 2 && <>
                <Field label="Data prevista (opcional)"><input className={inputClass} type="date" value={draft.dataPrevista} onChange={(e) => change("dataPrevista", e.target.value)}/></Field>
                <Field label="Observações para a equipe (opcional)"><textarea className={inputClass} rows={4} maxLength={800} value={draft.observacoes} onChange={(e) => change("observacoes", e.target.value)} placeholder="Acesso, orientações, particularidades do local"/></Field>
                <p className="rounded-xl bg-sky-50 p-3 text-sm leading-6 text-sky-900">O piloto, a aeronave, os produtos e os parâmetros técnicos serão definidos no planejamento após a criação da OS. Essa API ainda usa um fluxo separado.</p>
              </>}
              {step === 3 && <>
                {[
                  ["Cliente", cliente], ["Fazenda", fazenda], ["Talhão", talhao],
                  ["Cultura", draft.cultura], ["Alvo", draft.alvo],
                  ["Área planejada", fmt(Number(draft.areaHa)) + " ha"],
                  ["Data prevista", draft.dataPrevista || "Não informada"],
                ].map(([label, value]) => <div key={String(label)} className="border-b border-slate-100 py-2">
                  <span className="block text-xs text-slate-500">{label}</span><strong className="text-sm text-slate-900">{value || "—"}</strong>
                </div>)}
                <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <TriangleAlert size={16} className="mr-1 inline"/> Criar a OS não significa iniciar a aplicação. Documentos ficam disponíveis para conferência, sem bloquear este cadastro.
                </p>
              </>}
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={step === 0 || saving} onClick={() => { setError(""); setStep((s) => Math.max(0, s - 1)); }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold disabled:opacity-40">
                <ArrowLeft size={17}/> Anterior
              </button>
              <button type="button" disabled={saving} onClick={step === 3 ? () => void createOs() : goNext}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-50">
                {step === 3 ? (saving ? "Gravando..." : "Criar OS") : "Concluir etapa e avançar"} <ArrowRight size={17}/>
              </button>
            </div>
          </>}
        </section>
      </>}
      <p className="pb-6 text-center text-xs text-slate-500">
        AgroVoo Gestão · prévia vinculada às APIs atuais · nenhuma migração de dados.
      </p>
    </div>
  </main>;
}
