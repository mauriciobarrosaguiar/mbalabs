"use client";

import { useState } from "react";

export function CopyAuthorizationLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button className="button-secondary" type="button" onClick={copy}>
      {copied ? "Link copiado" : "Copiar link"}
    </button>
  );
}
