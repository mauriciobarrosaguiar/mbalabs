"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

export function ShareMemberRegistration({ registrationPath }: { registrationPath: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return registrationPath;
    return window.location.origin + registrationPath;
  }, [registrationPath]);

  async function shareLink() {
    const data = {
      title: "Cadastro de membro - Elshaday",
      text: "Faça seu cadastro de membro da Igreja Assembleia de Deus Elshaday - Palmas:",
      url: fullUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      // Se o compartilhamento nativo for cancelado, mantém a opção de copiar.
    }

    await copyLink();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="grid gap-3">
      <div className="break-all rounded-2xl border border-emerald-200 bg-white p-3 text-xs font-bold text-emerald-950">
        {fullUrl}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123d2d] px-4 text-sm font-black text-white"
          onClick={shareLink}
          type="button"
        >
          <Share2 size={16} />
          Compartilhar
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-black text-[#176445]"
          onClick={copyLink}
          type="button"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
