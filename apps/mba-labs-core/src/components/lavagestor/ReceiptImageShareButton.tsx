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
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    setConversationUrl(null);

    try {
      const response = await fetch("/api/lavagestor/recibos/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: receipt.id })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.ok) {
        setMessage("Recibo enviado automaticamente ao cliente pelo WhatsApp.");
        return;
      }

      const serverMessage = payload?.error ? String(payload.error) : "";
      const file = await makeReceiptImage(receipt);
      const text = receiptMessage(receipt);
      const url = buildWhatsappUrl(receipt.whatsapp, text);

      downloadFile(file);

      if (url) {
        setConversationUrl(url);
        setMessage(serverMessage ? `${serverMessage} Imagem do recibo gerada para envio manual.` : "Imagem do recibo gerada. Abra a conversa do cliente e anexe a imagem baixada.");
        return;
      }

      const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ title: `Recibo ${receipt.numero}`, text, files: [file] } as ShareData);
        setMessage("Imagem pronta para enviar no WhatsApp.");
        return;
      }

      setMessage("Imagem do recibo baixada. O cliente não possui WhatsApp válido cadastrado.");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível gerar a imagem do recibo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button className="button-primary" disabled={loading} onClick={handleClick} type="button">
        {loading ? "Gerando imagem..." : "Enviar recibo via WhatsApp"}
      </button>
      {conversationUrl ? <a className="button-secondary text-center" href={conversationUrl} target="_blank" rel="noreferrer">Abrir conversa do cliente</a> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950">{message}</p> : null}
    </div>
  );
}

async function makeReceiptImage(receipt: ReceiptImageData) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const width = 1080;
  const primary = receipt.corPrincipal || "#059669";
  const ink = "#10201a";
  const muted = "#64748b";
  const soft = "#f8fafc";
  const greenSoft = "#ecfdf5";
  const border = "#dbe4de";
  const margin = 64;
  const lineH = 34;
  const services = receipt.servicos.length ? receipt.servicos : [{ descricao: "Serviço", valor: receipt.totalFinal }];
  const payments = receipt.pagamentos.length ? receipt.pagamentos : [];
  const estimatedHeight = 980 + services.length * 80 + payments.length * 58;

  canvas.width = width;
  canvas.height = Math.max(estimatedHeight, 1500);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 72;
  text(ctx, "RECIBO DE SERVIÇO", margin, y, 24, primary, 900);
  y += 48;
  text(ctx, receipt.empresaNome, margin, y, 52, ink, 900);
  y += 42;
  if (receipt.empresaRazao) {
    y = wrap(ctx, receipt.empresaRazao, margin, y, width - margin * 2, 24, muted, 700, lineH);
  }
  if (receipt.empresaInfo) {
    y = wrap(ctx, receipt.empresaInfo, margin, y + 4, width - margin * 2, 22, muted, 650, 30);
  }

  y += 24;
  box(ctx, margin, y, width - margin * 2, 132, greenSoft, border);
  text(ctx, "Nº", margin + 26, y + 40, 22, primary, 900);
  text(ctx, receipt.numero, margin + 26, y + 88, 46, ink, 900);
  right(ctx, receipt.entrada, width - margin - 26, y + 88, 22, muted, 800);
  y += 170;

  line(ctx, margin, y, width - margin, border);
  y += 44;

  const infoRows = [
    ["CLIENTE", receipt.cliente, "WHATSAPP", receipt.whatsapp || "Não informado"],
    ["VEÍCULO / ITEM", receipt.veiculo, "LAVADOR", receipt.lavador],
    ["ENTRADA", receipt.entrada, "FINALIZAÇÃO", receipt.finalizacao],
    ["PAGAMENTO", receipt.pagamento, "ENTREGA", receipt.entrega]
  ];

  for (const row of infoRows) {
    drawInfo(ctx, margin, y, 454, row[0], row[1], soft, muted, ink);
    drawInfo(ctx, margin + 486, y, 454, row[2], row[3], soft, muted, ink);
    y += 122;
  }

  y += 20;
  text(ctx, "SERVIÇOS", margin, y, 26, muted, 900);
  y += 42;
  for (const item of services) {
    box(ctx, margin, y, width - margin * 2, 70, "#ffffff", border);
    wrap(ctx, item.descricao, margin + 24, y + 42, 650, 23, ink, 800, 28);
    right(ctx, item.valor, width - margin - 24, y + 44, 25, ink, 900);
    y += 84;
  }

  y += 12;
  box(ctx, margin, y, width - margin * 2, 238, soft, "transparent");
  y += 44;
  y = money(ctx, "Total bruto", receipt.totalBruto, margin + 28, y, width - margin * 2 - 56, false);
  y = money(ctx, "Desconto", receipt.desconto, margin + 28, y, width - margin * 2 - 56, false);
  y = money(ctx, "Total final", receipt.totalFinal, margin + 28, y, width - margin * 2 - 56, true);
  y = money(ctx, "Valor recebido", receipt.valorRecebido, margin + 28, y, width - margin * 2 - 56, false);
  y = money(ctx, "Valor pendente", receipt.valorPendente, margin + 28, y, width - margin * 2 - 56, false);
  y += 44;

  if (payments.length) {
    text(ctx, "PAGAMENTOS", margin, y, 26, muted, 900);
    y += 42;
    for (const payment of payments) {
      box(ctx, margin, y, width - margin * 2, 54, "#ffffff", border);
      text(ctx, payment, margin + 24, y + 35, 21, ink, 750);
      y += 66;
    }
  }

  y += 26;
  line(ctx, margin, y, width - margin, border);
  y += 42;
  center(ctx, "Obrigado pela preferência.", width / 2, y, 22, muted, 800);
  y += 32;
  center(ctx, `Recibo gerado pelo LavaGestor · ${receipt.empresaNome}`, width / 2, y, 20, muted, 700);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG não gerado")), "image/png", 0.95);
  });

  return new File([blob], `recibo-${receipt.numero}.png`, { type: "image/png" });
}

function drawInfo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, bg: string, muted: string, ink: string) {
  box(ctx, x, y, w, 104, bg, "transparent");
  text(ctx, label, x + 20, y + 32, 20, muted, 900);
  wrap(ctx, value, x + 20, y + 68, w - 40, 23, ink, 800, 28);
}

function money(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, w: number, strong: boolean) {
  text(ctx, label, x, y, strong ? 27 : 23, "#475569", strong ? 900 : 700);
  right(ctx, value, x + w, y, strong ? 31 : 24, "#10201a", 900);
  return y + 40;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke !== "transparent") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight: number) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(value, x, y);
}

function right(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight: number) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(value, x, y);
  ctx.textAlign = "left";
}

function center(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight: number) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(value, x, y);
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color: string, weight: number, lineHeight: number) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  const words = String(value || "-").split(/\s+/);
  let lineText = "";
  for (const word of words) {
    const test = lineText ? `${lineText} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && lineText) {
      ctx.fillText(lineText, x, y);
      y += lineHeight;
      lineText = word;
    } else {
      lineText = test;
    }
  }
  ctx.fillText(lineText || "-", x, y);
  return y + lineHeight;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function receiptMessage(receipt: ReceiptImageData) {
  return [
    `Olá, ${receipt.cliente}!`,
    `Segue o recibo da lavagem ${receipt.numero}.`,
    `Veículo/item: ${receipt.veiculo}.`,
    `Total pago: ${receipt.totalFinal}.`,
    "A imagem do recibo já foi gerada com as fotos registradas."
  ].join("\n");
}

function buildWhatsappUrl(whatsapp: string, message: string) {
  const phone = normalizeWhatsapp(whatsapp);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeWhatsapp(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12) return digits;
  return "";
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
