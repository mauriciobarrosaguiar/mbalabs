"use client";

import { useState } from "react";

export type ReceiptImageData = {
  id: string;
  numero: string;
  empresaNome: string;
  empresaRazao?: string;
  empresaInfo?: string;
  corPrincipal?: string;
  cliente: string;
  whatsapp: string;
  veiculo: string;
  lavador: string;
  entrada: string;
  finalizacao: string;
  pagamento: string;
  entrega: string;
  servicos: { descricao: string; valor: string }[];
  totalBruto: string;
  desconto: string;
  totalFinal: string;
  valorRecebido: string;
  valorPendente: string;
  pagamentos: string[];
};

export function ReceiptImageShareButton({ receipt }: { receipt: ReceiptImageData }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/lavagestor/recibos/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: receipt.id })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.ok) {
        setMessage("Recibo enviado automaticamente pela Evolution API do WhatsApp.");
        return;
      }

      setError(payload?.error ? String(payload.error) : "Não foi possível enviar o recibo pela API do WhatsApp.");
    } catch (err) {
      console.error(err);
      setError("Falha ao chamar a API de envio do recibo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button className="button-primary" disabled={loading} onClick={handleClick} type="button">
        {loading ? "Enviando pela API..." : "Enviar recibo via WhatsApp"}
      </button>
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950">{message}</p> : null}
      {error ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-950">{error}</p> : null}
    </div>
  );
}
