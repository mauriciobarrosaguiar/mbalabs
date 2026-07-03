"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Trash2, WandSparkles } from "lucide-react";
import {
  removeGeminiEasyAction,
  saveAndTestGeminiEasyAction,
  startGeminiDemoAction,
  testGeminiEasyAction
} from "@/lib/actions/lavagestor-setup-facil-actions";

type GeminiKeyGuideProps = {
  canEdit: boolean;
  active: boolean;
  apiKeyConfigured: boolean;
  status: string;
  model: string;
  lastError?: string;
  demo: {
    available: boolean;
    used: number;
    limit: number;
    remaining: number;
  };
};

export function GeminiKeyGuide({ canEdit, active, apiKeyConfigured, status, model, lastError, demo }: GeminiKeyGuideProps) {
  const [showKey, setShowKey] = useState(!apiKeyConfigured);

  return (
    <section className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Passo 1</p>
          <h2 className="text-2xl font-black">Ativar IA</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Use uma chave da propria empresa no Google AI Studio.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${active ? "bg-emerald-50 text-emerald-900" : status === "erro" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
          {active ? "Ativada" : status === "erro" ? "Erro" : "Nao ativada"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StepTile number="1" title="Criar chave" text="Abra o Google AI Studio e gere uma API Key." />
        <StepTile number="2" title="Colar chave" text="Cole a chave no campo protegido do LavaGestor." />
        <StepTile number="3" title="Salvar e testar" text="O teste deve responder IAMob conectado." />
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="button-primary" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" aria-hidden />
          Criar chave gratis no Google
        </a>
        <button className="button-secondary" type="button" onClick={() => setShowKey((value) => !value)}>
          <KeyRound className="h-4 w-4" aria-hidden />
          Ja tenho a chave
        </button>
      </div>

      {demo.available ? (
        <form action={startGeminiDemoAction} className="grid gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950 sm:grid-cols-[1fr_auto] sm:items-center">
          <span>Demo MBA Labs: {demo.remaining} de {demo.limit} usos disponiveis hoje.</span>
          <button className="button-secondary bg-white" disabled={!canEdit || demo.remaining <= 0} type="submit">Testar demo</button>
        </form>
      ) : null}

      {showKey ? (
        <form action={saveAndTestGeminiEasyAction} className="grid gap-3">
          <input name="iamob_model" type="hidden" value={model} />
          <label className="grid gap-2">
            <span className="text-sm font-black">API Key Gemini</span>
            <input className="input" name="gemini_api_key" placeholder={apiKeyConfigured ? "Chave configurada. Preencha apenas para trocar." : "Cole a API Key criada no Google AI Studio"} type="password" autoComplete="new-password" disabled={!canEdit} />
          </label>
          <button className="button-primary w-full sm:w-fit" disabled={!canEdit} type="submit">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Salvar e testar IA
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={testGeminiEasyAction}>
          <button className="button-secondary" disabled={!canEdit || !apiKeyConfigured} type="submit">
            <WandSparkles className="h-4 w-4" aria-hidden />
            Testar IA
          </button>
        </form>
        <form action={removeGeminiEasyAction}>
          <button className="button-danger" disabled={!canEdit || !apiKeyConfigured} type="submit">
            <Trash2 className="h-4 w-4" aria-hidden />
            Remover IA
          </button>
        </form>
      </div>

      {lastError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-950">
          <strong className="block text-xs uppercase tracking-[0.1em]">Ultimo erro</strong>
          <span className="break-words">{lastError}</span>
        </div>
      ) : null}
    </section>
  );
}

function StepTile({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-black text-emerald-700">{number}</span>
      <strong className="mt-2 block">{title}</strong>
      <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{text}</span>
    </div>
  );
}
