"use client";

import { useState } from "react";

export function MessageActions({ message, phone }: { message: string; phone?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="button-secondary" type="button" onClick={copyMessage}>{copied ? "Copiado" : "Copiar"}</button>
      <a className="button-primary" href={whatsappUrl(phone, message)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>
  );
}

function whatsappUrl(phone: string | undefined, message: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const normalized = !digits ? "" : digits.startsWith("55") && digits.length >= 12 ? digits : digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
