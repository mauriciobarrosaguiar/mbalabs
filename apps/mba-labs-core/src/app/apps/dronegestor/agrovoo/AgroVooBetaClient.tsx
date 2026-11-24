"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ClipboardList, FileCheck2, Leaf,
  Plus, RefreshCw, ShieldCheck, TriangleAlert, MapPinned,
} from "lucide-react";
import { useAgroData } from "../AgroDocUi";

const ROOT = "/apps/dronegestor";
type OsStage = {
  osId: string;
  numero: string;
  cliente: string;
  fazenda: string;
  talhao: string;
  status: string;
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
type OsDraft = {
  clienteId: string;
  fazendaId: string;
  talhaoId: string;
  cultura: string;
  alvo: string;
  areaHa: string;
  dataPrevista: string;
  observacoes: string;
};
const emptyDraft: OsDraft = {
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
  const [draft, setDraft] = useState<OsDraft>(emptyDraft);
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

  function change<K extends keyof OsDraft>(key: K, value: OsDraft[K]) {
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
    if (step === 0 && (!draft.clienteId || !draft.fazendaId || !draft.talhaoId)) {
      setError("Selecione cliente, fazenda e talhão para continuar.");
      return;
    }
    if (step === 1 && (!draft.cultura.trim() || !draft.alvo.trim() || !(Number(draft.areaHa) > 0))) {
      setError("Preencha cultura, alvo e uma área maior que zero.");
      return;
    }
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
        body: JSON.stringify({
          type: "os",
          data: {
            clienteId: draft.clienteId,
            fazendaId: draft.fazendaId,
            talhaoId: draft.talhaoId,
            cultura: draft.cultura.trim(),
            alvo: draft.alvo.trim(),
            areaHa: Number(draft.areaHa),
            dataPrevista: draft.dataPrevista,
            observacoes: draft.observacoes.trim(),
          },
        }),
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

  return <main className="min-h-screen bg-[#f5f9f6] px-3 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="rounded-3xl bg-gradient-to-r from-[#073d2c] to-[#126f4e] p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-200">
          <Leaf size={17} /> AgroVoo Gestão · Fase 2 (prévia)
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">
          {screen === "home" ? "Seu trabalho, em um só lugar" : "Nova ordem de serviço"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-emerald-100">
          {screen === "home"
            ? "Olá, " + userName + ". Confira suas operações sem percorrer vários módulos."
            : "Um passo de cada vez. Os dados são salvos somente ao confirmar a criação."}
        </p>
        <p className="mt-2 text-xs text-emerald-200">Prévia isolada. As funcionalidades antigas continuam disponíveis.</p>
      </header>

      {screen === "home" ? <>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openNew}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-black text-white sm:flex-none">
            <Plus size={20} /> Nova OS
          </button>
          <Link href={ROOT + "/gestao"} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 no-underline">
            Ver todas as OS
          </Link>
          <button type="button" onClick={() => board.refresh()} aria-label="Atualizar operações"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
            <RefreshCw size={17} /> Atualizar
          </button>
        </div>
        {board.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{board.error}</p>}
        <section aria-label="Resumo das operações" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["OS ativas", count?.total, "Acompanhamento operacional"],
            ["Em execução", count?.aplicando, "Aplicações em andamento"],
            ["Pausadas", count?.pausada, "Retomada com conferência"],
            ["Para conferir", count?.prontaEncerrar, "Campo registrado, pendente de revisão"],
          ].map(([label, value, subtitle]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-600">{label}</div>
            <div className="mt-2 text-3xl font-black text-emerald-900">{value ?? "—"}</div>
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
          </article>)}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">Ordens em acompanhamento</h2>
            <Link href={ROOT + "/gestao"} className="text-sm font-bold text-emerald-700">Lista completa</Link>
          </div>
          {!board.data ? <p className="mt-4 text-sm text-slate-600">Carregando dados autorizados da empresa...</p>
            : active.length === 0 ? <p className="mt-4 text-sm text-slate-600">Nenhuma OS ativa encontrada.</p>
            : <div className="mt-4 grid gap-3">
              {active.slice(0, 6).map((os) => <article key={os.osId} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-slate-950">{os.numero || "OS"}</strong>
                    <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + statusTone(os.status)}>{os.stageLabel || os.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{os.cliente || "Cliente"} · {os.fazenda || "Propriedade"}</p>
                  <p className="mt-1 text-xs text-slate-500">{os.talhao || "Talhão"} · {fmt(os.progressHa)} de {fmt(os.areaHa)} ha · {os.pilotName || "Piloto não atribuído"}</p>
                </div>
                <Link href={ROOT + "/gestao?tab=os&osId=" + encodeURIComponent(os.osId)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-emerald-800 no-underline">
                  Ver OS <ArrowRight size={16}/>
                </Link>
              </article>)}
            </div>}
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="text-emerald-700" size={20}/> Regularização</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Consulte documentos e vencimentos. Ausência de anexo não impede registrar o serviço, mas não comprova autorização legal.</p>
            <Link href={ROOT + "/diagnostico"} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-black text-emerald-700">Consultar documentos <ArrowRight size={16}/></Link>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-lg font-black"><MapPinned className="text-emerald-700" size={20}/> Mapa da aplicação</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Foto do controle ou KML/KMZ. O registro de campo pode continuar offline; a conferência final aguarda a evidência recebida.</p>
            <Link href={ROOT + "/documentos"} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-black text-emerald-700">Ver anexos <ArrowRight size={16}/></Link>
          </article>
        </section>
      </> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setScreen("home")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">
            <ArrowLeft size={17}/> Voltar ao painel
          </button>
          <span className="text-xs font-bold text-slate-500">Etapa {step + 1} de 4</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-label="Progresso da criação da OS">
          {steps.map((name, index) => <div key={name}
            className={"rounded-xl p-2 text-center text-[10px] font-bold sm:text-sm " + (index === step ? "bg-emerald-700 text-white" : index < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
            {index < step ? <Check size={14} className="mx-auto" aria-label="Concluída"/> : index + 1}. {name}
          </div>)}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {createdId ? <div className="grid gap-4">
            <FileCheck2 size={36} className="text-emerald-700"/>
            <h2 className="text-xl font-black">OS criada com sucesso</h2>
            <p className="text-sm leading-6 text-slate-700">A OS foi gravada na empresa. Agora atribua o piloto e complete o planejamento técnico na tela existente. Esta criação não representa autorização para decolar.</p>
            <Link href={ROOT + "/gestao/planejamento?osId=" + encodeURIComponent(createdId)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white no-underline">
              Continuar planejamento <ArrowRight size={17}/>
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
