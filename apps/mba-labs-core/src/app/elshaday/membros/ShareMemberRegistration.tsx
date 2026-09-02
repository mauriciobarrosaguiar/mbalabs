"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareMemberRegistration() {
  const [copied, setCopied] = useState(false);

  async function shareLink() {
    const url = window.location.origin + "/cadastro-membro";
    const data = {
      title: "Cadastro de membro - Elshaday",
      text: "Faça seu cadastro de membro da Igreja Assembleia de Deus Elshaday - Palmas:",
      url
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      // Se o compartilhamento nativo for cancelado ou falhar, mantém a opção de copiar.
    }

    await copyLink();
  }

  async function copyLink() {
    const url = window.location.origin + "/cadastro-membro";
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123d2d] px-5 text-sm font-black text-white"
        onClick={shareLink}
        type="button"
      >
        <Share2 size={16} />
        Compartilhar link
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 text-sm font-black text-[#176445]"
        onClick={copyLink}
        type="button"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
