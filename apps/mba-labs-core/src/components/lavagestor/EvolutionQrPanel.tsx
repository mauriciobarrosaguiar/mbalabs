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
  showDiagnostics?: boolean;
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
    apiUrl?: string;
    apiKeyConfigured?: boolean;
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
  instance?: string;
};

export function EvolutionQrPanel({ canEdit, manager, integration, showDiagnostics = false }: EvolutionQrPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<QrResult | null>(null);
  const [status, setStatus] = useState(integration.status);
  const [error, setError] = useState(integration.ultimoErro || "");
  const hasInstance = Boolean(integration.instanciaId || result?.instance);
  const connected = status === "conectado" || result?.status === "conectado";
  const qrImage = useMemo(() => imageSource(result?.qrCode), [result?.qrCode]);
  const hasSavedEvolutionConfig = integration.provider === "evolution" && Boolean(integration.apiUrl) && integration.apiKeyConfigured === true;
  const evolutionAvailable = manager.configured || hasSavedEvolutionConfig;
  const managerAlert = evolutionManagerMessage(manager, hasSavedEvolutionConfig, showDiagnostics);

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
          setError(String(next.error || "Não foi possível conferir o WhatsApp."));
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
      if (next.ok) {
        setStatus(String(next.status || "inativo"));
      } else {
        setError(String(next.error || "Não foi possível gerar o QR Code."));
      }
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
        setError(String(next.error || "Não foi possível conferir o WhatsApp."));
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
          {connected ? "Conectado" : error ? "Erro" : hasInstance ? "Aguardando QR Code" : "Não conectado"}
        </span>
      </div>

      {!evolutionAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
          {managerAlert}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-950">
          {showDiagnostics && !manager.configured
            ? <>Configuração de suporte salva. Clique em <strong>Conectar WhatsApp</strong> para criar a instância e depois em <strong>Mostrar QR Code</strong>.</>
            : <>Clique em <strong>Conectar WhatsApp</strong>, depois em <strong>Mostrar QR Code</strong> e leia o código no WhatsApp da empresa.</>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={createEvolutionEasyInstanceAction}>
          <button className="button-primary" disabled={!canEdit || !evolutionAvailable || isPending} type="submit">
            <PlugZap className="h-4 w-4" aria-hidden />
            Conectar WhatsApp
          </button>
        </form>
        <button className="button-secondary" disabled={!canEdit || !evolutionAvailable || isPending} type="button" onClick={loadQr}>
          <QrCode className="h-4 w-4" aria-hidden />
          Mostrar QR Code
        </button>
        <button className="button-secondary" disabled={!canEdit || !evolutionAvailable || isPending} type="button" onClick={checkStatus}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Verificar status
        </button>
        <form action={reconnectEvolutionEasyAction}>
          <button className="button-secondary" disabled={!canEdit || !evolutionAvailable || !hasInstance || isPending} type="submit">Reconectar</button>
        </form>
        <form action={disconnectEvolutionEasyAction}>
          <button className="button-danger" disabled={!canEdit || !hasInstance || isPending} type="submit">
            <PowerOff className="h-4 w-4" aria-hidden />
            Desconectar
          </button>
        </form>
      </div>

      {showDiagnostics ? (
        <details className="rounded-xl border border-border bg-muted/30">
          <summary className="cursor-pointer px-3 py-2 text-sm font-black">Diagnóstico da Evolution central</summary>
          <div className="grid gap-2 border-t border-border p-3 text-sm font-semibold leading-6 text-muted-foreground md:grid-cols-2">
            <DiagnosticItem label="URL central" value={manager.apiUrl ? "Configurada" : "Não configurada"} ok={Boolean(manager.apiUrl)} />
            <DiagnosticItem label="API Key central" value={manager.apiKeyConfigured ? "Configurada" : "Não configurada"} ok={manager.apiKeyConfigured} />
            <DiagnosticItem label="URL salva na empresa" value={integration.apiUrl ? "Configurada" : "Não configurada"} ok={Boolean(integration.apiUrl)} />
            <DiagnosticItem label="API Key salva na empresa" value={integration.apiKeyConfigured ? "Configurada" : "Não configurada"} ok={integration.apiKeyConfigured === true} />
            <DiagnosticItem label="Prefixo das instâncias" value={manager.prefix || "lavagestor"} ok />
            <DiagnosticItem label="Instância atual" value={integration.instanciaId || result?.instance || "Ainda não criada"} ok={hasInstance} />
            {manager.missing.length && !hasSavedEvolutionConfig ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-950 md:col-span-2">
                <strong className="block text-xs uppercase tracking-[0.08em]">Variáveis faltando na Vercel</strong>
                <span>{manager.missing.join(", ")}</span>
              </div>
            ) : null}
            {integration.ultimoErro || error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-950 md:col-span-2">
                <strong className="block text-xs uppercase tracking-[0.08em]">Último erro</strong>
                <span className="break-words">{error || integration.ultimoErro}</span>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {isPending ? <p className="rounded-xl bg-muted p-3 text-sm font-semibold text-muted-foreground">Conferindo WhatsApp...</p> : null}

      {qrImage ? (
        <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 md:grid-cols-[220px_1fr] md:items-center">
          {/* QR Code is a short-lived data URL from Evolution, so next/image cannot optimize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mx-auto aspect-square w-full max-w-[220px] rounded-lg border border-border bg-white p-2" src={qrImage} alt="QR Code do WhatsApp" />
          <div className="grid gap-2 text-sm font-semibold leading-6 text-emerald-950">
            <strong className="text-base">QR Code gerado no app</strong>
            <span>Abra o WhatsApp no celular, toque em Aparelhos conectados e leia este código.</span>
            {result?.pairingCode ? <code className="w-fit rounded bg-white px-2 py-1 font-mono text-sm">{result.pairingCode}</code> : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-950">
          <strong className="block text-xs uppercase tracking-[0.1em]">Último erro</strong>
          <span className="break-words">{error}</span>
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      <strong className="block text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</strong>
      <span className="break-words">{value}</span>
    </div>
  );
}

function evolutionManagerMessage(manager: EvolutionQrPanelProps["manager"], hasSavedEvolutionConfig: boolean, showDiagnostics: boolean) {
  if (hasSavedEvolutionConfig) return showDiagnostics ? "Configuração de suporte da Evolution salva para esta empresa." : "WhatsApp automático pronto para conexão. Clique em Conectar WhatsApp.";
  if (!showDiagnostics) return "A conexão automática do WhatsApp ainda não está pronta. Fale com o suporte da MBA Labs para ativar.";
  if (manager.apiUrl && !manager.apiKeyConfigured) {
    return "A URL da Evolution foi encontrada, mas a API Key central não foi lida pelo app. Cole a AUTHENTICATION_API_KEY no campo avançado Evolution API Key, salve o modo do WhatsApp e tente conectar novamente.";
  }
  if (!manager.apiUrl && manager.apiKeyConfigured) {
    return "A API Key da Evolution foi encontrada, mas a URL central não foi configurada. Configure LAVAGESTOR_EVOLUTION_MANAGER_URL na Vercel e faça redeploy.";
  }
  return "O WhatsApp automático ainda não está disponível. Configure a Evolution central na Vercel ou preencha URL/API Key em Configurações avançadas.";
}

function imageSource(qrCode?: string) {
  const value = String(qrCode ?? "").trim();
  if (!value) return "";
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}
