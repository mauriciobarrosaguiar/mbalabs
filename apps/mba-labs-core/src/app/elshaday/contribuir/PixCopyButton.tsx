"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function PixCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#123d2d] px-5 font-black text-white"
      onClick={copy}
      type="button"
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
      {copied ? "Copiado" : "Copiar PIX"}
    </button>
  );
}
