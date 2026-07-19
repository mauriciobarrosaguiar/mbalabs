"use client";

import Link from "next/link";

export default function PortalAssociativoError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="panel mx-auto grid max-w-xl gap-4 p-6">
        <p className="eyebrow">Portal Associativo</p>
        <h1 className="text-2xl font-black">Não foi possível carregar esta página</h1>
        <p className="text-sm leading-6 text-muted-foreground">{error.message || "Tente novamente ou volte para o dashboard do Portal."}</p>
        <div className="flex flex-wrap gap-2">
          <button className="button-primary" onClick={reset} type="button">Tentar novamente</button>
          <Link className="button-secondary" href="/portal-associativo">Voltar</Link>
        </div>
      </section>
    </main>
  );
}
