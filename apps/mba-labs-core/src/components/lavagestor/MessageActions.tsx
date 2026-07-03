"use client";

import { useState } from "react";

export function MessageActions({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="button-secondary" type="button" onClick={copyMessage}>{copied ? "Copiado" : "Copiar"}</button>
      <a className="button-primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>
  );
}
