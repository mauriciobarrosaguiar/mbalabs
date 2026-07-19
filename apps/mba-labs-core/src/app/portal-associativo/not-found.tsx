import Link from "next/link";

export default function PortalAssociativoNotFound() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="panel mx-auto grid max-w-xl gap-4 p-6 text-center">
        <p className="eyebrow">Portal Associativo</p>
        <h1 className="text-2xl font-black">Registro não encontrado</h1>
        <p className="text-sm leading-6 text-muted-foreground">O item solicitado não existe ou não pertence à empresa selecionada.</p>
        <Link className="button-primary mx-auto" href="/portal-associativo">Voltar ao dashboard</Link>
      </section>
    </main>
  );
}
