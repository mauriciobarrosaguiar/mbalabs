"use client";

import { AlertTriangle, BookOpenCheck, CheckCircle2, ExternalLink, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";

type VerificationStatus = "verified" | "no_explicit_order" | "review_required";
type Verification = {
  status: VerificationStatus;
  bulletinUrl?: string;
  bulletinVerifiedAt?: string;
  preparationSummary?: string;
  sequenceGroup?: string;
  tankMixNotes?: string;
  sourceTitle?: string;
};
type Product = {
  key: string;
  name: string;
  registration?: string;
  activeIngredient?: string;
  formulation?: string;
  holder?: string;
  bulletinUrl?: string;
  officialSource?: string;
  verification: Verification;
};
type ReviewDraft = {
  status: VerificationStatus;
  bulletinUrl: string;
  preparationSummary: string;
  sequenceGroup: string;
  tankMixNotes: string;
  sourceTitle: string;
};

function statusInfo(status: VerificationStatus) {
  if (status === "verified") return { label: "Bula revisada pelo RT", className: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 size={14} /> };
  if (status === "no_explicit_order") return { label: "Sem ordem explícita registrada", className: "bg-sky-100 text-sky-800", icon: <BookOpenCheck size={14} /> };
  return { label: "Precisa revisão técnica", className: "bg-amber-100 text-amber-900", icon: <AlertTriangle size={14} /> };
}

export function DroneProductLibraryClient({ canManage }: { canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [officialAvailable, setOfficialAvailable] = useState(true);
  const [reviewing, setReviewing] = useState<Product | null>(null);
  const [review, setReview] = useState<ReviewDraft>({ status: "review_required", bulletinUrl: "", preparationSummary: "", sequenceGroup: "", tankMixNotes: "", sourceTitle: "Bula / fonte técnica revisada" });
  const [saving, setSaving] = useState(false);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const value = query.trim();
    if (value.length < 2) {
      setMessage("Digite pelo menos 2 caracteres do nome, registro ou ingrediente ativo.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/dronegestor/produtos?q=${encodeURIComponent(value)}&limit=20`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível consultar os produtos.");
      setItems(payload?.items ?? []);
      setOfficialAvailable(payload?.officialAvailable !== false);
      if (!(payload?.items ?? []).length) setMessage("Nenhum produto encontrado com essa busca.");
      else if (payload?.officialAvailable === false) setMessage("A fonte oficial está temporariamente indisponível; exibindo somente revisões locais encontradas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function openReview(item: Product) {
    const verification = item.verification ?? { status: "review_required" as VerificationStatus };
    setReviewing(item);
    setReview({
      status: verification.status || "review_required",
      bulletinUrl: verification.bulletinUrl || item.bulletinUrl || "",
      preparationSummary: verification.preparationSummary || "",
      sequenceGroup: verification.sequenceGroup || "",
      tankMixNotes: verification.tankMixNotes || "",
      sourceTitle: verification.sourceTitle || "Bula / fonte técnica revisada"
    });
    setMessage("");
  }

  async function saveReview() {
    if (!reviewing || !canManage) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          productName: reviewing.name,
          registration: reviewing.registration || "",
          activeIngredient: reviewing.activeIngredient || "",
          formulation: reviewing.formulation || "",
          holder: reviewing.holder || "",
          status: review.status,
          bulletinUrl: review.bulletinUrl,
          preparationSummary: review.preparationSummary,
          sequenceGroup: review.sequenceGroup,
          tankMixNotes: review.tankMixNotes,
          sourceTitle: review.sourceTitle
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a revisão.");
      setReviewing(null);
      setMessage("Revisão técnica salva. A biblioteca passa a mostrar este status para a empresa.");
      await search();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar revisão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><BookOpenCheck size={22}/></span>
          <div>
            <h2 className="text-xl font-black text-slate-950">Consultar produto</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Busque pelo nome comercial, registro ou ingrediente ativo. O sistema consulta a base oficial e mostra se a informação já foi revisada pelo RT.</p>
          </div>
        </div>

        <form onSubmit={search} className="mt-5 flex gap-2">
          <label className="sr-only" htmlFor="drone-product-search">Buscar produto</label>
          <input id="drone-product-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: glifosato, produto ou nº de registro" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500"/>
          <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-60" type="submit">{loading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}<span className="hidden sm:inline">Buscar</span></button>
        </form>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Importante:</strong> esta biblioteca não define dose, não autoriza mistura e não libera aplicação. Dose e uso devem seguir receita, bula vigente e orientação do responsável técnico.
        </div>
      </section>

      {message && <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${officialAvailable ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>{message}</div>}

      {items.length > 0 && (
        <section className="grid gap-3">
          {items.map((item) => {
            const status = statusInfo(item.verification?.status || "review_required");
            const sourceUrl = item.verification?.bulletinUrl || item.bulletinUrl || "";
            return (
              <article key={item.key} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${status.className}`}>{status.icon}{status.label}</span>
                    <h3 className="mt-2 text-lg font-black text-slate-950">{item.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.activeIngredient || "Ingrediente ativo não informado na linha consultada"}</p>
                  </div>
                  {item.registration && <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Registro {item.registration}</span>}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Data label="Formulação" value={item.formulation || "—"}/>
                  <Data label="Registrante" value={item.holder || "—"}/>
                  <Data label="Fonte" value={item.officialSource || "AGROFIT / revisão local"}/>
                </div>

                {item.verification?.preparationSummary && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"><strong>Resumo revisado:</strong> {item.verification.preparationSummary}</div>}
                {item.verification?.sequenceGroup && <div className="mt-2 text-sm text-slate-700"><strong>Grupo/posição registrada:</strong> {item.verification.sequenceGroup}</div>}
                {item.verification?.tankMixNotes && <div className="mt-2 text-sm text-slate-600"><strong>Observação técnica:</strong> {item.verification.tankMixNotes}</div>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 no-underline"><ExternalLink size={16}/> Abrir fonte/bula</a>}
                  {canManage && <button type="button" onClick={() => openReview(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white"><ShieldCheck size={16}/> Revisão do RT</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck size={22}/></span>
              <div className="min-w-0 flex-1"><span className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Somente ADMIN / RT</span><h2 className="mt-1 text-xl font-black text-slate-950">Revisar {reviewing.name}</h2><p className="mt-1 text-sm text-slate-500">Registre somente o que foi conferido na fonte indicada. Não transforme suposição em regra operacional.</p></div>
              <button onClick={() => setReviewing(null)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" aria-label="Fechar"><X size={18}/></button>
            </div>

            <div className="mt-5 grid gap-3">
              <Select label="Status da revisão" value={review.status} onChange={(value) => setReview({ ...review, status: value as VerificationStatus })} options={["review_required|Ainda precisa revisão", "verified|Bula revisada e preparo registrado", "no_explicit_order|Fonte revisada, sem ordem explícita registrada"]}/>
              <Field label="Link da bula/fonte *" value={review.bulletinUrl} onChange={(value) => setReview({ ...review, bulletinUrl: value })} placeholder="https://..."/>
              <Field label="Nome da fonte" value={review.sourceTitle} onChange={(value) => setReview({ ...review, sourceTitle: value })}/>
              <Area label="Resumo do preparo conferido na bula" value={review.preparationSummary} onChange={(value) => setReview({ ...review, preparationSummary: value })} placeholder="Copie apenas a conclusão técnica em linguagem curta; não invente sequência."/>
              <Field label="Grupo / posição validada" value={review.sequenceGroup} onChange={(value) => setReview({ ...review, sequenceGroup: value })} placeholder="Ex.: posição 1 do protocolo interno validado"/>
              <Area label="Observações de mistura / limitações" value={review.tankMixNotes} onChange={(value) => setReview({ ...review, tankMixNotes: value })} placeholder="Compatibilidades, restrições ou observações realmente verificadas."/>
            </div>

            <button disabled={saving} onClick={() => void saveReview()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} {saving ? "Salvando..." : "Salvar revisão técnica"}</button>
          </section>
        </div>
      )}
    </div>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-0.5 block text-sm text-slate-700">{value}</strong></div>;
}
function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500"/></label>;
}
function Area({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500"/></label>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none focus:border-emerald-500">{options.map((entry) => { const [optionValue, text] = entry.split("|"); return <option key={optionValue} value={optionValue}>{text}</option>; })}</select></label>;
}
