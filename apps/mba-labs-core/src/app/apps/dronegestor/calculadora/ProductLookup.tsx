"use client";

import { CheckCircle2, Database, Loader2, Search, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ProductVerificationStatus = "verified" | "no_explicit_order" | "review_required";

export type ProductCatalogItem = {
  key: string;
  name: string;
  registration: string;
  activeIngredient: string;
  formulation: string;
  holder: string;
  bulletinUrl: string;
  officialSource: string;
  verification: {
    status: ProductVerificationStatus;
    bulletinUrl: string;
    bulletinVerifiedAt: string;
    preparationSummary: string;
    sequenceGroup: string;
    tankMixNotes: string;
    sourceTitle: string;
  };
};

function statusLabel(status: ProductVerificationStatus) {
  if (status === "verified") return { text: "Bula verificada", cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 };
  if (status === "no_explicit_order") return { text: "Bula sem ordem explícita", cls: "bg-amber-100 text-amber-900", icon: ShieldAlert };
  return { text: "Revisão necessária", cls: "bg-slate-100 text-slate-700", icon: Database };
}

export function ProductLookup({
  value,
  selected,
  onChange,
  onSelect,
  placeholder = "Digite o nome do produto"
}: {
  value: string;
  selected?: ProductCatalogItem | null;
  onChange: (value: string) => void;
  onSelect: (item: ProductCatalogItem) => void;
  placeholder?: string;
}) {
  const [items, setItems] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (selected && selected.name === value) {
      setItems([]);
      setOpen(false);
      setMessage("");
      return;
    }
    if (query.length < 2) {
      setItems([]);
      setOpen(false);
      setMessage("");
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/dronegestor/produtos?q=${encodeURIComponent(query)}&limit=12`, { cache: "no-store" });
        const payload = await response.json();
        if (requestId !== requestRef.current) return;
        const nextItems = Array.isArray(payload?.items) ? payload.items as ProductCatalogItem[] : [];
        setItems(nextItems);
        setOpen(true);
        if (!payload?.officialAvailable && payload?.officialError) setMessage(`Catálogo oficial indisponível agora. ${payload.officialError}`);
        else if (!nextItems.length) setMessage("Nenhum produto encontrado com esse termo.");
      } catch {
        if (requestId !== requestRef.current) return;
        setItems([]);
        setOpen(true);
        setMessage("Não foi possível consultar a biblioteca agora. Você ainda pode digitar o produto manualmente.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value, selected]);

  const badge = selected ? statusLabel(selected.verification.status) : null;
  const BadgeIcon = badge?.icon;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-bold text-slate-700">Produto</label>
      <div className="relative">
        <div className="flex min-h-12 items-center rounded-xl border border-slate-200 bg-white focus-within:border-emerald-500">
          <Search className="ml-3 shrink-0 text-slate-400" size={18}/>
          <input
            className="min-w-0 flex-1 bg-transparent px-3 text-[16px] font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onFocus={() => { if (items.length || message) setOpen(true); }}
            onChange={(event) => onChange(event.target.value)}
          />
          {loading && <Loader2 className="mr-3 animate-spin text-emerald-600" size={18}/>} 
        </div>

        {open && (items.length > 0 || message) && (
          <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
            {items.map((item) => {
              const itemBadge = statusLabel(item.verification.status);
              const ItemIcon = itemBadge.icon;
              return (
                <button
                  key={item.key || `${item.name}-${item.registration}`}
                  type="button"
                  className="grid w-full gap-1 rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { onSelect(item); setOpen(false); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm text-slate-900">{item.name}</strong>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${itemBadge.cls}`}><ItemIcon size={11}/>{itemBadge.text}</span>
                  </div>
                  <span className="text-xs text-slate-500">{item.registration ? `Registro ${item.registration}` : "Registro não identificado"}{item.formulation ? ` • ${item.formulation}` : ""}</span>
                  {item.activeIngredient && <span className="text-xs text-slate-600">{item.activeIngredient}</span>}
                </button>
              );
            })}
            {message && <p className="px-3 py-2 text-xs leading-5 text-slate-500">{message}</p>}
          </div>
        )}
      </div>

      {selected && badge && BadgeIcon && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${badge.cls}`}><BadgeIcon size={12}/>{badge.text}</span>
            {selected.registration && <span className="text-xs font-bold text-slate-600">Registro: {selected.registration}</span>}
          </div>
          {selected.activeIngredient && <p className="mt-1 text-xs leading-5 text-slate-500">Ingrediente ativo: {selected.activeIngredient}</p>}
          {selected.verification.preparationSummary && <p className="mt-1 text-xs leading-5 text-emerald-800"><strong>Preparo verificado:</strong> {selected.verification.preparationSummary}</p>}
          {selected.verification.tankMixNotes && <p className="mt-1 text-xs leading-5 text-amber-900"><strong>Atenção:</strong> {selected.verification.tankMixNotes}</p>}
        </div>
      )}
    </div>
  );
}
