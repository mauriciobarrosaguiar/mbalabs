"use client";

import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Database, ExternalLink, Loader2, Save, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { ProductCatalogItem, ProductVerificationStatus } from "../calculadora/ProductLookup";

const SEQUENCE_GROUPS = [
  ["", "Sem grupo definido"],
  ["COND", "Condicionador / corretor de água"],
  ["WG_WDG_DF", "WG / WDG / DF"],
  ["WP", "WP"],
  ["SG_SP", "SG / SP"],
  ["SC_SE_CS", "SC / SE / CS"],
  ["OD", "OD"],
  ["EC_EW_ME", "EC / EW / ME"],
  ["SL", "SL"],
  ["ADJ_OIL", "Óleo / adjuvante"],
  ["BIO_FERT_OTHER", "Biológico / fertilizante / outro — sem ordem automática"]
] as const;

type EditState = {
  status: ProductVerificationStatus;
  bulletinUrl: string;
  preparationSummary: string;
  sequenceGroup: string;
  tankMixNotes: string;
};

function badge(status: ProductVerificationStatus) {
  if (status === "verified") return { text: "Bula verificada", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 };
  if (status === "no_explicit_order") return { text: "Bula sem ordem explícita", cls: "bg-amber-100 text-amber-900", Icon: ShieldAlert };
  return { text: "Revisão necessária", cls: "bg-slate-100 text-slate-700", Icon: Database };
}

function editFromItem(item: ProductCatalogItem): EditState {
  return {
    status: item.verification.status,
    bulletinUrl: item.verification.bulletinUrl || item.bulletinUrl || "",
    preparationSummary: item.verification.preparationSummary || "",
    sequenceGroup: item.verification.sequenceGroup || "",
    tankMixNotes: item.verification.tankMixNotes || ""
  };
}

export function ProductLibraryClient() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [selected, setSelected] = useState<ProductCatalogItem | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("");
  const [officialAvailable, setOfficialAvailable] = useState<boolean | null>(null);

  async function searchProducts(search = query) {
    const q = search.trim();
    if (q.length < 2) { setMessage("Digite pelo menos 2 caracteres."); return; }
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/dronegestor/produtos?q=${encodeURIComponent(q)}&limit=25`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Falha na consulta.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setCanManage(payload.canManage === true);
      setOfficialAvailable(payload.officialAvailable !== false);
      if (payload.officialError) setMessage(`Catálogo oficial: ${payload.officialError}`);
      else if (!payload.items?.length) setMessage("Nenhum produto encontrado.");
    } catch (error) {
      setItems([]);
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar a biblioteca.");
    } finally { setLoading(false); }
  }

  function choose(item: ProductCatalogItem) {
    setSelected(item);
    setEdit(editFromItem(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveReview() {
    if (!selected || !edit || !canManage) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/dronegestor/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: selected.name,
          registration: selected.registration,
          activeIngredient: selected.activeIngredient,
          formulation: selected.formulation,
          holder: selected.holder,
          status: edit.status,
          bulletinUrl: edit.bulletinUrl,
          preparationSummary: edit.preparationSummary,
          sequenceGroup: edit.sequenceGroup,
          tankMixNotes: edit.tankMixNotes,
          sourceTitle: edit.status === "verified" ? "Bula verificada pelo ADMIN/RT" : "Bula revisada pelo ADMIN/RT"
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Falha ao salvar revisão.");
      setMessage("Revisão salva. A Calda Fácil já passará a usar este status.");
      await searchProducts(selected.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar revisão.");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#052e16_0%,#065f46_16%,#f8fafc_16%,#f8fafc_100%)] px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-[26px] border border-emerald-200 bg-white p-4 shadow-xl shadow-emerald-950/10 sm:p-5">
          <div className="flex items-start gap-3">
            <Link href="/apps/dronegestor/calculadora" className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-emerald-700"><BookOpenCheck size={16}/> DroneGestor Agro</div><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Biblioteca de produtos e bulas</h1><p className="mt-2 text-sm leading-5 text-slate-600">Catálogo oficial para identificação do produto + revisão técnica da instrução de preparo.</p></div>
          </div>
        </header>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex gap-2"><div className="flex min-h-12 min-w-0 flex-1 items-center rounded-xl border border-slate-200 focus-within:border-emerald-500"><Search className="ml-3 text-slate-400" size={18}/><input className="min-w-0 flex-1 px-3 text-[16px] font-semibold text-slate-950 outline-none" value={query} placeholder="Nome, registro ou ingrediente ativo" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchProducts(); }}/></div><button type="button" disabled={loading} onClick={() => void searchProducts()} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Buscar</button></div>
          {officialAvailable === false && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">O catálogo oficial está temporariamente indisponível. Resultados locais verificados ainda podem aparecer.</p>}
          {message && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-600">{message}</p>}
        </section>

        {selected && edit && <section className="rounded-[26px] border border-emerald-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.registration ? `Registro ${selected.registration}` : "Registro não identificado"}{selected.formulation ? ` • ${selected.formulation}` : ""}</p>{selected.activeIngredient && <p className="mt-1 text-sm text-slate-600">{selected.activeIngredient}</p>}</div>{(() => { const info = badge(edit.status); return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${info.cls}`}><info.Icon size={14}/>{info.text}</span>; })()}</div>

          {!canManage ? <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">Você pode consultar a biblioteca. A validação da bula é restrita a ADMIN/RT.</div> : <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Status<select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] text-slate-900" value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value as ProductVerificationStatus })}><option value="review_required">Revisão necessária</option><option value="no_explicit_order">Bula revisada — não traz ordem explícita</option><option value="verified">Bula verificada — preparo/posição registrado</option></select></label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Link / fonte da bula<input className="min-h-12 rounded-xl border border-slate-200 px-3 text-[16px] text-slate-900" value={edit.bulletinUrl} placeholder="URL oficial ou fonte consultada" onChange={(event) => setEdit({ ...edit, bulletinUrl: event.target.value })}/></label>
            {edit.bulletinUrl && <a href={edit.bulletinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-emerald-700"><ExternalLink size={14}/> Abrir fonte informada</a>}
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Grupo/posição usada na sequência<select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] text-slate-900" value={edit.sequenceGroup} onChange={(event) => setEdit({ ...edit, sequenceGroup: event.target.value })}>{SEQUENCE_GROUPS.map(([value, label]) => <option key={value || "empty"} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Resumo do preparo indicado na bula<textarea className="min-h-28 rounded-xl border border-slate-200 p-3 text-[16px] leading-6 text-slate-900" value={edit.preparationSummary} placeholder="Registre somente o que foi conferido na bula, sem inferir." onChange={(event) => setEdit({ ...edit, preparationSummary: event.target.value })}/></label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Compatibilidade / observações de mistura<textarea className="min-h-24 rounded-xl border border-slate-200 p-3 text-[16px] leading-6 text-slate-900" value={edit.tankMixNotes} placeholder="Ex.: bula não autoriza inferir mistura com outros produtos; consultar RT." onChange={(event) => setEdit({ ...edit, tankMixNotes: event.target.value })}/></label>
            <button type="button" disabled={saving} onClick={() => void saveReview()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Salvar revisão da bula</button>
          </div>}
        </section>}

        <section className="grid gap-3">
          {items.map((item) => { const info = badge(item.verification.status); return <button type="button" key={item.key || `${item.name}-${item.registration}`} onClick={() => choose(item)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block text-base text-slate-950">{item.name}</strong><span className="mt-1 block text-xs text-slate-500">{item.registration ? `Registro ${item.registration}` : "Registro não identificado"}{item.formulation ? ` • ${item.formulation}` : ""}</span>{item.activeIngredient && <span className="mt-1 block text-xs text-slate-600">{item.activeIngredient}</span>}</div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${info.cls}`}><info.Icon size={12}/>{info.text}</span></div></button>; })}
        </section>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Regra da biblioteca:</strong> estar no catálogo oficial identifica o produto, mas não confirma automaticamente ordem de mistura. O selo “Bula verificada” só aparece depois de uma revisão registrada por ADMIN/RT com fonte e resumo do preparo.</div>
      </div>
    </main>
  );
}
