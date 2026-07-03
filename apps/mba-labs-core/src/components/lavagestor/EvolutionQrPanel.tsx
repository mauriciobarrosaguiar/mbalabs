"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PlugZap, PowerOff, QrCode, RefreshCw } from "lucide-react";
import {
  checkEvolutionEasyStatusAction,
  createEvolutionEasyInstanceAction,
  disconnectEvolutionEasyAction,
  getEvolutionEasyQrAction,
  reconnectEvolutionEasyAction
} from "@/lib/actions/lavagestor-setup-facil-actions";

type EvolutionQrPanelProps = {
  canEdit: boolean;
  manager: {
    configured: boolean;
    apiUrl: string;
    apiKeyConfigured: boolean;
    prefix: string;
    missing: string[];
  };
  integration: {
    provider: string;
    status: string;
    instanciaId: string;
    ultimoErro?: string;
  };
};

type QrResult = {
  ok?: boolean;
  qrCode?: string;
  pairingCode?: string;
  status?: string;
  state?: string;
  error?: string;
};

export function EvolutionQrPanel({ canEdit, manager, integration }: EvolutionQrPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<QrResult | null>(null);
  const [status, setStatus] = useState(integration.status);
  const [error, setError] = useState(integration.ultimoErro || "");
  const hasInstance = Boolean(integration.instanciaId);
  const connected = status === "conectado" || result?.status === "conectado";
  const qrImage = useMemo(() => imageSource(result?.qrCode), [result?.qrCode]);

  useEffect(() => {
    if (!result?.qrCode || connected) return;
    const timer = window.setInterval(() => {
      startTransition(async () => {
        const next = (await checkEvolutionEasyStatusAction()) as QrResult;
        if (next.ok) {
          setStatus(String(next.status || "inativo"));
          setError("");
          if (next.status === "conectado") window.clearInterval(timer);
        } else {
          setError(String(next.error || "Nao foi possivel conferir o WhatsApp."));
        }
      });
    }, 7000);
    return () => window.clearInterval(timer);
  }, [connected, result?.qrCode]);

  function loadQr() {
    startTransition(async () => {
      setError("");
      const next = (await getEvolutionEasyQrAction()) as QrResult;
      setResult(next);
      if (next.ok) setStatus(String(next.status || "inativo"));
      else setError(String(next.error || "Nao foi possivel gerar o QR Code."));
    });
  }

  function checkStatus() {
    startTransition(async () => {
      setError("");
      const next = (await checkEvolutionEasyStatusAction()) as QrResult;
      if (next.ok) {
        setStatus(String(next.status || "inativo"));
        setResult(next);
      } else {
        setError(String(next.error || "Nao foi possivel conferir o WhatsApp."));
      }
    });
  }

  return (
    <section className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Passo 2</p>
          <h2 className="text-2xl font-black">Conectar WhatsApp</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Leia o QR Code no WhatsApp do celular da empresa.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${connected ? "bg-emerald-50 text-emerald-900" : error ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
          {connected ? "Conectado" : error ? "Erro" : hasInstance ? "Aguardando QR Code" : "Nao conectado"}
        </span>
      </div>

      {!manager.configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
          O WhatsApp automatico ainda nao esta disponivel. Fale com a MBA Labs para ativar.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={createEvolutionEasyInstanceAction}>
          <button className="button-primary" disabled={!canEdit || !manager.configured} type="submit">
            <PlugZap className="h-4 w-4" aria-hidden />
            Criar conexao
          </button>
        </form>
        <button className="button-secondary" disabled={!canEdit || !manager.configured || (!hasInstance && !result?.ok) || isPending} type="button" onClick={loadQr}>
          <QrCode className="h-4 w-4" aria-hidden />
          Mostrar QR Code
        </button>
        <button className="button-secondary" disabled={!canEdit || !manager.configured || isPending} type="button" onClick={checkStatus}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Verificar status
        </button>
        <form action={reconnectEvolutionEasyAction}>
          <button className="button-secondary" disabled={!canEdit || !manager.configured || !hasInstance} type="submit">Reconectar</button>
        </form>
        <form action={disconnectEvolutionEasyAction}>
          <button className="button-danger" disabled={!canEdit || !hasInstance} type="submit">
            <PowerOff className="h-4 w-4" aria-hidden />
            Desconectar
          </button>
        </form>
      </div>

      {isPending ? <p className="rounded-xl bg-muted p-3 text-sm font-semibold text-muted-foreground">Conferindo WhatsApp...</p> : null}

      {qrImage ? (
        <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 md:grid-cols-[220px_1fr] md:items-center">
          {/* QR Code is a short-lived data URL from Evolution, so next/image cannot optimize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mx-auto aspect-square w-full max-w-[220px] rounded-lg border border-border bg-white p-2" src={qrImage} alt="QR Code do WhatsApp" />
          <div className="grid gap-2 text-sm font-semibold leading-6 text-emerald-950">
            <strong className="text-base">QR Code gerado no app</strong>
            <span>Abra o WhatsApp no celular, toque em Aparelhos conectados e leia este codigo.</span>
            {result?.pairingCode ? <code className="w-fit rounded bg-white px-2 py-1 font-mono text-sm">{result.pairingCode}</code> : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-950">
          <strong className="block text-xs uppercase tracking-[0.1em]">Ultimo erro</strong>
          <span className="break-words">{error}</span>
        </div>
      ) : null}
    </section>
  );
}

function imageSource(qrCode?: string) {
  const value = String(qrCode ?? "").trim();
  if (!value) return "";
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}
