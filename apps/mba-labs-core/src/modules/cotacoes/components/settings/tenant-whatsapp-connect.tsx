"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, QrCode, Smartphone, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";

type Connection = {
  connected: boolean;
  status: string;
  instanceName: string;
  qr?: string;
  message?: string;
};

export function TenantWhatsappConnect({ canManage }: { canManage: boolean }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "refresh" | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/cotacoes/whatsapp-conexao", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar o WhatsApp.");
    setConnection((previous) => ({ ...result, qr: result.connected ? undefined : previous?.qr }));
    return result as Connection;
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch((err) => { if (active) setError(String(err.message ?? err)); });
    const interval = window.setInterval(() => {
      if (active) void refresh().catch(() => undefined);
    }, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [refresh]);

  async function perform(action: "connect" | "disconnect") {
    if (busy) return;
    if (action === "disconnect" &&
        !window.confirm("Desconectar o WhatsApp desta empresa? Os próximos envios automáticos serão interrompidos.")) return;
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/cotacoes/whatsapp-conexao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível realizar a ação.");
      if (action === "disconnect") {
        setConnection({ connected: false, status: "desconectado", instanceName: connection?.instanceName ?? "" });
        toast.success("WhatsApp da empresa desconectado.");
      } else {
        setConnection(result);
        toast[result.connected ? "success" : "info"](
          result.connected ? "WhatsApp da empresa conectado." : "QR Code solicitado. Escaneie pelo WhatsApp do cliente.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao configurar o WhatsApp.");
      toast.error("A conexão não foi concluída.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-teal-700" />
        <div>
          <h2 className="text-lg font-semibold">WhatsApp próprio da empresa</h2>
          <p className="text-sm text-slate-600">As cotações serão enviadas usando somente esta conta conectada, nunca o número central.</p>
        </div>
      </div>
      <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
        {connection?.connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
          <Unplug className="h-5 w-5 text-amber-600" />}
        <strong>{connection?.connected ? "Conectado" : connection?.status === "aguardando_qr" ? "Aguardando leitura do QR Code" : "Não conectado"}</strong>
      </div>
      {connection?.qr && !connection.connected ? (
        <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-950">Abra o WhatsApp do cliente → Aparelhos conectados → Conectar um aparelho</p>
          {/* Imagem efêmera de QR Code recebida da API; nunca persiste no banco ou armazenamento do navegador. */}
          <img alt="QR Code de conexão do WhatsApp da empresa" src={connection.qr}
            className="mx-auto h-60 w-60 rounded-lg bg-white p-2" />
          <p className="text-center text-xs text-slate-600">A conexão será confirmada automaticamente após o escaneamento.</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void perform("connect")} disabled={!canManage || busy !== null || Boolean(connection?.connected)}
          className="active:scale-95">
          {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          {busy === "connect" ? "Solicitando QR..." : "Conectar meu WhatsApp"}
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => {
          setBusy("refresh");
          void refresh().then((state) => toast.info(state.connected ? "Conexão confirmada." : "Ainda não conectado."))
            .catch((err) => setError(String(err.message ?? err))).finally(() => setBusy(null));
        }}>
          {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verificar conexão
        </Button>
        <Button type="button" variant="destructive" disabled={!canManage || busy !== null || !connection?.instanceName}
          onClick={() => void perform("disconnect")}>
          {busy === "disconnect" ? "Desconectando..." : "Desconectar"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        O celular precisa permanecer vinculado à conta. Em caso de desconexão, novos envios são bloqueados até reconectar.
        Os dados de infraestrutura e as chaves da Evolution API não ficam disponíveis ao cliente.
      </p>
    </div>
  );
}
