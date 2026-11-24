"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, Loader2, MapPinned, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { AgroDocStatus } from "../../../AgroDocUi";
import { DroneMissionPlanning } from "../../../gestao/planejamento/DroneMissionPlanning";

type Order = {
  entityId: string;
  data: {
    numero?: string;
    clienteNome?: string;
    fazendaNome?: string;
    talhaoNome?: string;
    cultura?: string;
    alvo?: string;
    areaHa?: number;
    status?: string;
    pilotoResponsavelId?: string;
    pilotoResponsavelNome?: string;
  };
};
type Pilot = { id: string; nome: string; usuarioId?: string };
type Document = { id: string; tipo: string; nome: string; uploadedAt: string; url: string };
type Tab = "resumo" | "piloto" | "planejamento" | "mapa" | "documentos";
const ROOT = "/apps/dronegestor";
const tabs: { id: Tab; title: string }[] = [
  { id: "resumo", title: "Resumo" },
  { id: "piloto", title: "Piloto" },
  { id: "planejamento", title: "Planejamento" },
  { id: "mapa", title: "Mapa" },
  { id: "documentos", title: "Documentos" },
];
function labelStatus(status: string | undefined) {
  return ({
    aberta: "Aberta",
    preparacao: "Em preparação",
    em_preparacao: "Em preparação",
    em_execucao: "Em execução",
    suspensa: "Pausada",
    campo_concluido: "Campo concluído",
    concluida: "Encerrada",
    cancelada: "Cancelada",
  } as Record<string, string>)[status || "aberta"] || status || "Aberta";
}
function closed(status: string | undefined) { return ["concluida", "cancelada"].includes(status || ""); }
function editable(status: string | undefined) { return ["aberta", "preparacao", "em_preparacao", undefined].includes(status); }
async function json(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Não foi possível consultar ou salvar os dados.");
  return payload;
}
export function AgroVooOrderDetails({ osId }: { osId: string }) {
  const [tab, setTab] = useState<Tab>("resumo");
  const [order, setOrder] = useState<Order | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [self, setSelf] = useState<{ id: string; nome: string }>({ id: "", nome: "" });
  const [choice, setChoice] = useState("self");
  const [docs, setDocs] = useState<Document[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);setError("");
    try {
      const q = encodeURIComponent(osId);
      const [list, people, documents, map] = await Promise.all([
        fetch("/api/dronegestor/cadastros?type=os", { cache: "no-store" }).then(json),
        fetch("/api/dronegestor/pilotos", { cache: "no-store" }).then(json),
        fetch("/api/dronegestor/documentos?osId=" + q, { cache: "no-store" }).then(json),
        fetch("/api/dronegestor/mapa?osId=" + q, { cache: "no-store" }).then(json),
      ]);
      const item = (list.items as Order[] || []).find((entry) => entry.entityId === osId) || null;
      if (!item) throw new Error("OS não encontrada ou não autorizada para esta empresa.");
      setOrder(item);
      const team = (people.items as Pilot[] || []).filter((p) => Boolean(p.usuarioId));
      setPilots(team);
      const currentId = String(people.currentUserId || "");
      const currentName = String(people.currentUserName || "Gestor");
      setSelf({ id: currentId, nome: currentName });
      const assignee = item.data.pilotoResponsavelId || "";
      const matching = team.find((p) => p.usuarioId === assignee);
      setChoice(matching ? matching.usuarioId! : "self");
      setDocs(documents.items || []);
      setHasPhoto(Boolean(map.evidence?.url || map.evidence?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a OS.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [osId]);
  useEffect(() => { void load(); }, [load]);

  async function savePilot() {
    if (!order || !editable(order.data.status) || saving) return;
    const selected = choice === "self"
      ? { id: self.id, name: self.nome }
      : { id: choice, name: pilots.find((p) => p.usuarioId === choice)?.nome || "" };
    if (!selected.id || !selected.name) {
      setError("O responsável precisa ter um login ativo vinculado.");
      return;
    }
    setSaving(true);setError("");setMessage("");
    try {
      await json(await fetch("/api/dronegestor/cadastros", {
        method: "PATCH", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "os", entityId: osId,
          data: { pilotoResponsavelId: selected.id, pilotoResponsavelNome: selected.name },
        }),
      }));
      setMessage("Piloto vinculado à OS. Agora revise o planejamento técnico.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atribuir piloto.");
    } finally { setSaving(false); }
  }
  function selectFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);setError("");setMessage("");
  }
  const mapDocs = docs.filter((d) => d.tipo === "mapa_aplicacao");
  const hasMap = mapDocs.length > 0 || hasPhoto;
  async function uploadMap() {
    if (!file || !order || saving || closed(order.data.status)) return;
    if (!/\.(jpe?g|png|webp|kml|kmz)$/i.test(file.name)) {
      setError("Selecione JPG/PNG/WebP ou KML/KMZ.");
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError("O arquivo deve ter até 10 MB.");
      return;
    }
    setSaving(true);setError("");setMessage("");
    try {
      const form = new FormData();
      form.append("arquivo", file);
      form.append("tipo", "mapa_aplicacao");
      form.append("ordemServicoId", osId);
      form.append("observacao", "Mapa enviado pela interface AgroVoo");
      const payload = await json(await fetch("/api/dronegestor/documentos", { method: "POST", body: form }));
      setMessage(payload.duplicate ? "Este arquivo já estava vinculado a esta OS." : "Mapa salvo nesta OS. Evidência disponível para conferência.");
      setFile(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar mapa."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen pb-8">
    <div className="mx-auto grid w-full max-w-[1440px] gap-4">
      <Link href={ROOT + "/agrovoo"} className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-black text-emerald-800 no-underline">
        <ArrowLeft size={18}/> Painel AgroVoo
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">Operacional / Ordem de serviço</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{order?.data.numero || "Ordem de serviço"}</h1>
          <p className="mt-1 text-sm text-slate-600">{order ? [order.data.clienteNome, order.data.fazendaNome, order.data.talhaoNome].filter(Boolean).join(" · ") || "Detalhes da operação agrícola" : "Detalhes da operação agrícola"}</p>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">Situação: {order && <AgroDocStatus tone={closed(order.data.status) ? "neutral" : order.data.status === "suspensa" ? "warn" : order.data.status === "em_execucao" ? "good" : "neutral"}>{labelStatus(order.data.status)}</AgroDocStatus>}</div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} aria-label="Atualizar dados da OS" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-emerald-800"><RefreshCw size={16}/> Atualizar</button>
      </header>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{message}</div>}
      {loading ? <p className="rounded-lg bg-white p-6 text-sm text-slate-600"><Loader2 size={17} className="mr-2 inline animate-spin"/>Carregando a operação autorizada...</p> : order && <>
        <nav aria-label="Etapas desta OS" className="agro-compact-grid grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-5">
          {tabs.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined}
            disabled={saving} onClick={() => { setError("");setMessage("");setTab(item.id); }}
            className={"min-h-12 rounded-xl px-3 text-sm font-bold " + (tab === item.id ? "bg-[#123e38] text-white" : "border border-slate-200 bg-white text-slate-800 hover:bg-emerald-50")}>
            {item.title}
          </button>)}
        </nav>
        {tab === "resumo" && <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-950">Dados da operação</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {[
                ["Cultura", order.data.cultura || "Não informada"],
                ["Alvo", order.data.alvo || "Não informado"],
                ["Área planejada", String(order.data.areaHa ?? "—") + " ha"],
                ["Piloto responsável", order.data.pilotoResponsavelNome || "Não atribuído"],
              ].map(([name,value]) => <div key={name} className="border-b border-slate-100 pb-2"><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
            <p className="mt-3 text-xs text-slate-500">A área planejada não substitui os hectares efetivamente registrados pelo piloto.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Próximos passos</h2>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => setTab("piloto")} className="flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-bold">1. Definir piloto <ArrowRight size={17}/></button>
              <button type="button" onClick={() => setTab("planejamento")} className="flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-bold">2. Preparar missão <ArrowRight size={17}/></button>
              <button type="button" onClick={() => setTab("mapa")} className="flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-bold">3. Conferir mapa após voo <ArrowRight size={17}/></button>
              <Link href={ROOT + "/pacote-operacao?osId=" + encodeURIComponent(osId)} className="flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-bold no-underline">4. Conferir pacote <ArrowRight size={17}/></Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Criar ou consultar a OS não dá permissão automática para voar.</p>
          </article>
        </section>}
        {tab === "piloto" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><UserRound className="text-emerald-700"/><h2 className="text-lg font-black">Piloto responsável</h2></div>
          <p className="mt-2 text-sm text-slate-600">Responsável atual: <strong>{order.data.pilotoResponsavelNome || "A definir"}</strong></p>
          {!editable(order.data.status) && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">A OS já iniciou ou foi encerrada. A atribuição fica somente para consulta, preservando o histórico.</p>}
          <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">Selecionar piloto com login ativo
            <select disabled={!editable(order.data.status) || saving} value={choice} onChange={(e) => setChoice(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base">
              <option value="self">{self.nome || "Gestor"} (minha conta)</option>
              {pilots.filter((p) => p.usuarioId && p.usuarioId !== self.id).map((p) => <option key={p.id} value={p.usuarioId}>{p.nome}</option>)}
            </select>
          </label>
          <button type="button" disabled={!editable(order.data.status) || saving} onClick={() => void savePilot()}
            className="mt-4 min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-50">
            {saving ? "Salvando..." : "Vincular piloto"}
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">A API confirma os vínculos e o estado da OS. Não é possível trocar o responsável depois de iniciada a execução.</p>
        </section>}
        {tab === "planejamento" && <section className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-4">
          <div className="p-3">
            <h2 className="text-lg font-black text-slate-950">Planejamento técnico integrado</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use o planejamento existente para selecionar drone, parâmetros e produtos. O sistema mantém a validação no servidor e o histórico da OS.</p>
          </div>
          <DroneMissionPlanning osId={osId}/>
        </section>}
        {tab === "mapa" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><MapPinned className="text-emerald-700"/><h2 className="text-lg font-black">Mapa da operação</h2></div>
          {hasMap ? <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900"><CheckCircle2 size={18}/> Evidência de mapa recebida nesta OS.</p>
            : <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Pendente: o piloto precisa enviar a foto do mapa do controle ou um arquivo KML/KMZ após o voo.</p>}
          <p className="mt-3 text-sm leading-6 text-slate-600">A falta do anexo não impede registrar a aplicação. O mapa permanece pendente para conferência e encerramento da OS. Arquivos recebidos não são validação geoespacial automática.</p>
          {!closed(order.data.status) && <>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-800">Enviar foto do mapa ou KML/KMZ
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.kml,.kmz" onChange={selectFile}
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"/>
            </label>
            <button type="button" disabled={!file || saving} onClick={() => void uploadMap()}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-black text-white disabled:opacity-40">
              <FileUp size={19}/>{saving ? "Enviando..." : "Anexar mapa à OS"}
            </button>
          </>}
          {closed(order.data.status) && <p className="mt-3 text-sm text-slate-600">Envio encerrado para esta OS. Documentos anteriores continuam disponíveis.</p>}
          {mapDocs.length > 0 && <ul className="mt-4 grid gap-2">
            {mapDocs.map((doc) => <li key={doc.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <strong>{doc.nome}</strong> <span className="text-slate-500">({doc.uploadedAt?.slice(0,10) || "data não informada"})</span>
              {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-emerald-800 underline">Consultar evidência</a>}
            </li>)}
          </ul>}
        </section>}
        {tab === "documentos" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700"/><h2 className="text-lg font-black">Regularização e documentos</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Os documentos continuam visíveis e podem ser anexados no centro da OS. A ausência de um documento no sistema não representa autorização legal, nem é motivo automático para impedir registrar a aplicação.</p>
          <Link href={ROOT + "/documentos?osId=" + encodeURIComponent(osId)}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white no-underline">
            Abrir documentos desta OS <ArrowRight size={16}/>
          </Link>
          <h3 className="mt-5 text-sm font-black text-slate-900">Arquivos associados ({docs.length})</h3>
          {docs.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhum documento anexado.</p>
            : <ul className="mt-3 grid gap-2">{docs.map((doc) => <li key={doc.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <span className="block font-semibold text-slate-900">{doc.nome}</span>
              <span className="text-xs text-slate-500">{doc.tipo}</span>
              {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-emerald-800 underline">Abrir arquivo</a>}
            </li>)}</ul>}
        </section>}
      </>}
    </div>
  </main>;
}
