"use client";

import Link from "next/link";
import { Building2, ChevronRight, ClipboardList, History, MapPinned, Plus, Sprout, Trash2, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ResourceType = "cliente" | "fazenda" | "talhao" | "os";
type Item = {
  id: string;
  entityId: string;
  type: ResourceType;
  createdAt?: string;
  updatedAt?: string;
  data: Record<string, any>;
};

type Lists = Record<ResourceType, Item[]>;

const emptyLists: Lists = { cliente: [], fazenda: [], talhao: [], os: [] };

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHa(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(num(value));
}

async function api(type: ResourceType, options?: RequestInit) {
  const url = options?.method && options.method !== "GET" ? "/api/dronegestor/cadastros" : `/api/dronegestor/cadastros?type=${type}`;
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Falha na operação.");
  return payload;
}

function Select({ label, value, onChange, children, required = true }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><select required={required} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">{children}</select></label>;
}

function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" /></label>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p><div className="mt-4">{children}</div></section>;
}

export function DroneGestaoClient() {
  const [tab, setTab] = useState<ResourceType>("os");
  const [lists, setLists] = useState<Lists>(emptyLists);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [cliente, setCliente] = useState({ nome: "", cpfCnpj: "", telefone: "", email: "", observacoes: "" });
  const [fazenda, setFazenda] = useState({ clienteId: "", nome: "", municipio: "", uf: "TO", endereco: "", latitude: "", longitude: "", observacoes: "" });
  const [talhao, setTalhao] = useState({ fazendaId: "", nome: "", areaHa: "", culturaPadrao: "", latitude: "", longitude: "", observacoes: "" });
  const [ordem, setOrdem] = useState({ clienteId: "", fazendaId: "", talhaoId: "", cultura: "", alvo: "", areaHa: "", dataPrevista: "", observacoes: "" });

  const clientesById = useMemo(() => new Map(lists.cliente.map((item) => [item.entityId, item])), [lists.cliente]);
  const fazendasById = useMemo(() => new Map(lists.fazenda.map((item) => [item.entityId, item])), [lists.fazenda]);
  const talhoesById = useMemo(() => new Map(lists.talhao.map((item) => [item.entityId, item])), [lists.talhao]);
  const fazendasDaOrdem = lists.fazenda.filter((item) => !ordem.clienteId || item.data.clienteId === ordem.clienteId);
  const talhoesDaOrdem = lists.talhao.filter((item) => !ordem.fazendaId || item.data.fazendaId === ordem.fazendaId);

  async function loadAll() {
    setLoading(true);
    try {
      const [c, f, t, o] = await Promise.all([api("cliente"), api("fazenda"), api("talhao"), api("os")]);
      setLists({ cliente: c.items ?? [], fazenda: f.items ?? [], talhao: t.items ?? [], os: o.items ?? [] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os cadastros.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function create(type: ResourceType, data: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      await api(type, { method: "POST", body: JSON.stringify({ type, data }) });
      setMessage("Cadastro salvo no Supabase.");
      await loadAll();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(type: ResourceType, entityId: string) {
    if (!window.confirm("Inativar este cadastro? O histórico já registrado não será apagado.")) return;
    setSaving(true);
    try {
      await api(type, { method: "DELETE", body: JSON.stringify({ type, entityId }) });
      setMessage("Cadastro inativado.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao inativar.");
    } finally {
      setSaving(false);
    }
  }

  async function useOrder(item: Item) {
    const data = item.data;
    const clienteItem = clientesById.get(data.clienteId);
    const fazendaItem = fazendasById.get(data.fazendaId);
    const talhaoItem = talhoesById.get(data.talhaoId);
    const existing = (() => { try { return JSON.parse(localStorage.getItem("dronegestor:mission:v2") || "{}"); } catch { return {}; } })();
    const mission = {
      ...existing,
      ordemServicoId: item.entityId,
      ordemServicoNumero: data.numero || "",
      clienteId: data.clienteId || "",
      clienteNome: clienteItem?.data.nome || "",
      fazendaId: data.fazendaId || "",
      fazendaNome: fazendaItem?.data.nome || "",
      municipio: fazendaItem?.data.municipio || "",
      uf: fazendaItem?.data.uf || "",
      talhaoId: data.talhaoId || "",
      talhaoNome: talhaoItem?.data.nome || "",
      area: num(data.areaHa) || num(talhaoItem?.data.areaHa),
      cultura: data.cultura || talhaoItem?.data.culturaPadrao || existing.cultura || "",
      alvo: data.alvo || existing.alvo || ""
    };
    localStorage.setItem("dronegestor:mission:v2", JSON.stringify(mission));
    localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
    localStorage.removeItem("dronegestor:operationId:v3");
    localStorage.removeItem("dronegestor:lastFinalizedOperationId:v3");

    try {
      await api("os", { method: "PATCH", body: JSON.stringify({ type: "os", entityId: item.entityId, data: { status: "em_execucao" } }) });
    } catch {
      // A missão pode iniciar offline; o vínculo já ficou salvo no aparelho.
    }

    window.location.href = "/apps/dronegestor/campo";
  }

  async function submitCliente(event: FormEvent) {
    event.preventDefault();
    if (await create("cliente", cliente)) setCliente({ nome: "", cpfCnpj: "", telefone: "", email: "", observacoes: "" });
  }

  async function submitFazenda(event: FormEvent) {
    event.preventDefault();
    if (await create("fazenda", fazenda)) setFazenda({ clienteId: "", nome: "", municipio: "", uf: "TO", endereco: "", latitude: "", longitude: "", observacoes: "" });
  }

  async function submitTalhao(event: FormEvent) {
    event.preventDefault();
    if (await create("talhao", { ...talhao, areaHa: num(talhao.areaHa), latitude: num(talhao.latitude), longitude: num(talhao.longitude) })) setTalhao({ fazendaId: "", nome: "", areaHa: "", culturaPadrao: "", latitude: "", longitude: "", observacoes: "" });
  }

  async function submitOrdem(event: FormEvent) {
    event.preventDefault();
    if (await create("os", { ...ordem, areaHa: num(ordem.areaHa), status: "aberta" })) setOrdem({ clienteId: "", fazendaId: "", talhaoId: "", cultura: "", alvo: "", areaHa: "", dataPrevista: "", observacoes: "" });
  }

  const tabs: Array<[ResourceType, string, React.ReactNode]> = [
    ["os", "Ordens de serviço", <ClipboardList size={18} key="os" />],
    ["cliente", "Clientes", <UserRound size={18} key="cliente" />],
    ["fazenda", "Fazendas", <Building2 size={18} key="fazenda" />],
    ["talhao", "Talhões", <MapPinned size={18} key="talhao" />]
  ];

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_45%,#eef2f7_100%)] px-3 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto grid w-full max-w-6xl gap-4 sm:gap-6">
      <header className="rounded-3xl border border-emerald-200 bg-white/95 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800"><Sprout size={15}/> DroneGestor Agro</div><h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Clientes, áreas e ordens de serviço</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cadastre o produtor uma vez. Depois escolha a fazenda, o talhão e crie a OS que vai alimentar automaticamente a missão de campo.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/apps/dronegestor/campo" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white no-underline">Abrir campo</Link><Link href="/apps/dronegestor/historico" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 no-underline"><History size={17}/> Histórico</Link></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Clientes" value={lists.cliente.length}/><Stat label="Fazendas" value={lists.fazenda.length}/><Stat label="Talhões" value={lists.talhao.length}/><Stat label="OS abertas" value={lists.os.filter((item)=>["aberta","em_execucao"].includes(item.data.status)).length}/></div>
      </header>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</div> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(([key,label,icon])=><button key={key} onClick={()=>setTab(key)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab===key?"bg-slate-950 text-white":"border border-slate-200 bg-white text-slate-700"}`}>{icon}{label}</button>)}</div>

      {loading ? <div className="rounded-3xl bg-white p-10 text-center font-bold text-slate-500">Carregando dados do DroneGestor...</div> : null}

      {!loading && tab === "cliente" ? <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Panel title="Novo cliente" subtitle="Produtor ou empresa contratante do serviço."><form onSubmit={submitCliente} className="grid gap-3"><Input label="Nome / Razão social" value={cliente.nome} onChange={(v)=>setCliente({...cliente,nome:v})} required/><div className="grid gap-3 sm:grid-cols-2"><Input label="CPF / CNPJ" value={cliente.cpfCnpj} onChange={(v)=>setCliente({...cliente,cpfCnpj:v})}/><Input label="Telefone" value={cliente.telefone} onChange={(v)=>setCliente({...cliente,telefone:v})}/></div><Input label="E-mail" type="email" value={cliente.email} onChange={(v)=>setCliente({...cliente,email:v})}/><Input label="Observações" value={cliente.observacoes} onChange={(v)=>setCliente({...cliente,observacoes:v})}/><SaveButton saving={saving}/></form></Panel>
        <Panel title="Clientes cadastrados" subtitle={`${lists.cliente.length} registro(s) ativo(s).`}><div className="grid gap-2">{lists.cliente.map((item)=><Card key={item.entityId} title={item.data.nome} subtitle={[item.data.cpfCnpj,item.data.telefone].filter(Boolean).join(" • ") || "Sem documento/telefone"} onDelete={()=>void remove("cliente",item.entityId)}/>)}</div></Panel>
      </div> : null}

      {!loading && tab === "fazenda" ? <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Panel title="Nova fazenda" subtitle="Vincule a propriedade ao cliente correto."><form onSubmit={submitFazenda} className="grid gap-3"><Select label="Cliente" value={fazenda.clienteId} onChange={(v)=>setFazenda({...fazenda,clienteId:v})}><option value="">Selecione...</option>{lists.cliente.map((item)=><option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}</Select><Input label="Nome da propriedade" value={fazenda.nome} onChange={(v)=>setFazenda({...fazenda,nome:v})} required/><div className="grid gap-3 sm:grid-cols-[1fr_90px]"><Input label="Município" value={fazenda.municipio} onChange={(v)=>setFazenda({...fazenda,municipio:v})} required/><Input label="UF" value={fazenda.uf} onChange={(v)=>setFazenda({...fazenda,uf:v.toUpperCase().slice(0,2)})} required/></div><Input label="Endereço / acesso" value={fazenda.endereco} onChange={(v)=>setFazenda({...fazenda,endereco:v})}/><div className="grid gap-3 sm:grid-cols-2"><Input label="Latitude (opcional)" type="number" value={fazenda.latitude} onChange={(v)=>setFazenda({...fazenda,latitude:v})}/><Input label="Longitude (opcional)" type="number" value={fazenda.longitude} onChange={(v)=>setFazenda({...fazenda,longitude:v})}/></div><SaveButton saving={saving}/></form></Panel>
        <Panel title="Fazendas cadastradas" subtitle={`${lists.fazenda.length} propriedade(s).`}><div className="grid gap-2">{lists.fazenda.map((item)=><Card key={item.entityId} title={item.data.nome} subtitle={`${clientesById.get(item.data.clienteId)?.data.nome || "Cliente"} • ${item.data.municipio}/${item.data.uf}`} onDelete={()=>void remove("fazenda",item.entityId)}/>)}</div></Panel>
      </div> : null}

      {!loading && tab === "talhao" ? <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Panel title="Novo talhão" subtitle="A área do talhão será usada como base da futura missão."><form onSubmit={submitTalhao} className="grid gap-3"><Select label="Fazenda" value={talhao.fazendaId} onChange={(v)=>setTalhao({...talhao,fazendaId:v})}><option value="">Selecione...</option>{lists.fazenda.map((item)=><option key={item.entityId} value={item.entityId}>{item.data.nome} — {item.data.municipio}/{item.data.uf}</option>)}</Select><div className="grid gap-3 sm:grid-cols-2"><Input label="Nome / identificação" value={talhao.nome} onChange={(v)=>setTalhao({...talhao,nome:v})} required/><Input label="Área (ha)" type="number" value={talhao.areaHa} onChange={(v)=>setTalhao({...talhao,areaHa:v})} required/></div><Input label="Cultura padrão" value={talhao.culturaPadrao} onChange={(v)=>setTalhao({...talhao,culturaPadrao:v})} placeholder="Ex.: Milho"/><SaveButton saving={saving}/></form></Panel>
        <Panel title="Talhões cadastrados" subtitle={`${lists.talhao.length} área(s).`}><div className="grid gap-2">{lists.talhao.map((item)=><Card key={item.entityId} title={`${item.data.nome} • ${formatHa(item.data.areaHa)} ha`} subtitle={`${fazendasById.get(item.data.fazendaId)?.data.nome || "Fazenda"}${item.data.culturaPadrao?` • ${item.data.culturaPadrao}`:""}`} onDelete={()=>void remove("talhao",item.entityId)}/>)}</div></Panel>
      </div> : null}

      {!loading && tab === "os" ? <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Panel title="Nova ordem de serviço" subtitle="É a OS que será carregada no Copiloto de Campo."><form onSubmit={submitOrdem} className="grid gap-3"><Select label="Cliente" value={ordem.clienteId} onChange={(v)=>setOrdem({...ordem,clienteId:v,fazendaId:"",talhaoId:""})}><option value="">Selecione...</option>{lists.cliente.map((item)=><option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}</Select><Select label="Fazenda" value={ordem.fazendaId} onChange={(v)=>setOrdem({...ordem,fazendaId:v,talhaoId:""})}><option value="">Selecione...</option>{fazendasDaOrdem.map((item)=><option key={item.entityId} value={item.entityId}>{item.data.nome} — {item.data.municipio}/{item.data.uf}</option>)}</Select><Select label="Talhão" value={ordem.talhaoId} onChange={(v)=>{const t=talhoesById.get(v); setOrdem({...ordem,talhaoId:v,areaHa:String(t?.data.areaHa||""),cultura:ordem.cultura||t?.data.culturaPadrao||""});}}><option value="">Selecione...</option>{talhoesDaOrdem.map((item)=><option key={item.entityId} value={item.entityId}>{item.data.nome} • {formatHa(item.data.areaHa)} ha</option>)}</Select><div className="grid gap-3 sm:grid-cols-2"><Input label="Cultura" value={ordem.cultura} onChange={(v)=>setOrdem({...ordem,cultura:v})}/><Input label="Alvo" value={ordem.alvo} onChange={(v)=>setOrdem({...ordem,alvo:v})} placeholder="Ex.: Cigarrinha"/></div><div className="grid gap-3 sm:grid-cols-2"><Input label="Área da OS (ha)" type="number" value={ordem.areaHa} onChange={(v)=>setOrdem({...ordem,areaHa:v})} required/><Input label="Data prevista" type="date" value={ordem.dataPrevista} onChange={(v)=>setOrdem({...ordem,dataPrevista:v})}/></div><Input label="Observações" value={ordem.observacoes} onChange={(v)=>setOrdem({...ordem,observacoes:v})}/><SaveButton saving={saving} label="Criar ordem de serviço"/></form></Panel>
        <Panel title="Ordens de serviço" subtitle="Toque em usar na missão para abrir o campo já preenchido."><div className="grid gap-3">{lists.os.length===0?<Empty text="Nenhuma OS criada ainda."/>:lists.os.map((item)=>{const c=clientesById.get(item.data.clienteId); const f=fazendasById.get(item.data.fazendaId); const t=talhoesById.get(item.data.talhaoId); return <div key={item.entityId} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${item.data.status==="em_execucao"?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{item.data.status || "aberta"}</span><h3 className="mt-2 font-black text-slate-950">{item.data.numero || "OS"} • {formatHa(item.data.areaHa)} ha</h3><p className="mt-1 text-sm text-slate-600">{c?.data.nome || "Cliente"} → {f?.data.nome || "Fazenda"} → {t?.data.nome || "Talhão"}</p><p className="mt-1 text-xs text-slate-500">{[item.data.cultura,item.data.alvo,item.data.dataPrevista].filter(Boolean).join(" • ")}</p></div><button onClick={()=>void remove("os",item.entityId)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Inativar OS"><Trash2 size={17}/></button></div><button onClick={()=>void useOrder(item)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white">Usar nesta missão <ChevronRight size={18}/></button></div>;})}</div></Panel>
      </div> : null}
    </div>
  </main>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-slate-50 p-3"><strong className="block text-xl font-black text-slate-950">{value}</strong><span className="text-xs font-semibold text-slate-500">{label}</span></div>; }
function SaveButton({ saving, label = "Salvar cadastro" }: { saving: boolean; label?: string }) { return <button disabled={saving} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"><Plus size={17}/>{saving?"Salvando...":label}</button>; }
function Card({ title, subtitle, onDelete }: { title: string; subtitle: string; onDelete: () => void }) { return <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3.5"><div><strong className="text-sm text-slate-950">{title}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div><button type="button" onClick={onDelete} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>; }
