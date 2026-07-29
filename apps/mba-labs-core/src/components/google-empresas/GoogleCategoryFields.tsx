"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { GOOGLE_BUSINESS_CATEGORIES } from "./google-business-categories";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filterCategories(search: string, excluded: string[] = []) {
  const query = normalize(search);
  const blocked = new Set(excluded.map(normalize));

  return GOOGLE_BUSINESS_CATEGORIES.filter((category) => {
    if (blocked.has(normalize(category))) return false;
    return !query || normalize(category).includes(query);
  }).slice(0, 10);
}

export function GoogleCategoryFields({
  primaryDefault = "",
  secondaryDefault = []
}: {
  primaryDefault?: string | null;
  secondaryDefault?: string[] | null;
}) {
  const [primary, setPrimary] = useState(primaryDefault ?? "");
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [secondary, setSecondary] = useState<string[]>(secondaryDefault ?? []);
  const [secondaryDraft, setSecondaryDraft] = useState("");
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const primaryOptions = useMemo(() => filterCategories(primary), [primary]);
  const secondaryOptions = useMemo(
    () => filterCategories(secondaryDraft, secondary),
    [secondaryDraft, secondary]
  );

  function addSecondary(rawValue: string) {
    const value = rawValue.trim().replace(/,+$/, "");
    if (!value) return;
    if (secondary.some((item) => normalize(item) === normalize(value))) {
      setSecondaryDraft("");
      return;
    }

    setSecondary((current) => [...current, value]);
    setSecondaryDraft("");
    setSecondaryOpen(true);
  }

  function removeSecondary(value: string) {
    setSecondary((current) => current.filter((item) => item !== value));
  }

  const secondarySubmission = [...secondary, secondaryDraft.trim()]
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => normalize(candidate) === normalize(item)) === index)
    .join(", ");

  return (
    <>
      <label className="relative grid gap-2 text-sm font-bold">
        <span>Categoria principal</span>
        <div className="relative">
          <input
            className="input pr-11"
            name="categoria_principal"
            value={primary}
            onChange={(event) => {
              setPrimary(event.target.value);
              setPrimaryOpen(true);
            }}
            onFocus={() => setPrimaryOpen(true)}
            onBlur={() => window.setTimeout(() => setPrimaryOpen(false), 120)}
            placeholder="Digite para pesquisar, ex.: Farmácia"
            autoComplete="off"
            role="combobox"
            aria-expanded={primaryOpen}
            aria-autocomplete="list"
            required
          />
          <button
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-white"
            type="button"
            aria-label="Abrir lista de categorias"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPrimaryOpen((current) => !current)}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {primaryOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[14px] border border-violet-400/25 bg-[#090b18] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)]">
            {primaryOptions.length ? (
              primaryOptions.map((category) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-violet-500/15 hover:text-white"
                  key={category}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setPrimary(category);
                    setPrimaryOpen(false);
                  }}
                >
                  <span>{category}</span>
                  {normalize(primary) === normalize(category) ? <Check size={16} className="text-violet-300" /> : null}
                </button>
              ))
            ) : (
              <button
                className="w-full rounded-[10px] px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-violet-500/15 hover:text-white"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPrimaryOpen(false)}
              >
                Usar “{primary.trim()}” como categoria
              </button>
            )}
          </div>
        ) : null}
      </label>

      <label className="relative grid gap-2 text-sm font-bold">
        <span>Categorias secundárias</span>
        <input type="hidden" name="categorias_secundarias" value={secondarySubmission} />
        <div className="min-h-12 rounded-[12px] border border-slate-700/70 bg-[#050814] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] focus-within:border-violet-400/60 focus-within:ring-4 focus-within:ring-violet-500/15">
          {secondary.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {secondary.map((category) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/12 px-3 py-1.5 text-xs font-bold text-violet-100"
                  key={category}
                >
                  {category}
                  <button
                    className="text-violet-200/70 transition hover:text-white"
                    type="button"
                    aria-label={`Remover ${category}`}
                    onClick={() => removeSecondary(category)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 bg-transparent py-1 text-base font-medium text-white outline-none placeholder:text-slate-500"
              value={secondaryDraft}
              onChange={(event) => {
                const value = event.target.value;
                if (value.endsWith(",")) {
                  addSecondary(value);
                } else {
                  setSecondaryDraft(value);
                  setSecondaryOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSecondary(secondaryDraft);
                }
                if (event.key === "Backspace" && !secondaryDraft && secondary.length) {
                  removeSecondary(secondary[secondary.length - 1]);
                }
              }}
              onFocus={() => setSecondaryOpen(true)}
              onBlur={() => window.setTimeout(() => setSecondaryOpen(false), 120)}
              placeholder="Digite e pressione Enter para adicionar"
              autoComplete="off"
              role="combobox"
              aria-expanded={secondaryOpen}
              aria-autocomplete="list"
            />
            <ChevronDown size={18} className="shrink-0 text-slate-400" />
          </div>
        </div>

        {secondaryOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[14px] border border-violet-400/25 bg-[#090b18] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)]">
            {secondaryOptions.map((category) => (
              <button
                className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-violet-500/15 hover:text-white"
                key={category}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addSecondary(category)}
              >
                <span>{category}</span>
                <span className="text-xs font-bold text-violet-300">Adicionar</span>
              </button>
            ))}

            {secondaryDraft.trim() && !GOOGLE_BUSINESS_CATEGORIES.some((item) => normalize(item) === normalize(secondaryDraft)) ? (
              <button
                className="mt-1 w-full rounded-[10px] border-t border-white/10 px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-violet-500/15 hover:text-white"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addSecondary(secondaryDraft)}
              >
                Adicionar “{secondaryDraft.trim()}”
              </button>
            ) : null}
          </div>
        ) : null}

        <span className="text-xs font-medium leading-5 text-slate-400">
          Selecione quantas forem necessárias. Também é possível escrever uma categoria que ainda não esteja na lista.
        </span>
      </label>
    </>
  );
}
