import { AppNav } from "@/components/AppNav";
import { ConteudoIaStudio } from "@/components/conteudo-ia/ConteudoIaStudio";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function ConteudoIaPage() {
  const current = await requireAppAccess("conteudo-ia", "/conteudo-ia");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppNav />
      <section className="page-shell py-6 md:py-8">
        <ConteudoIaStudio userName={current.usuario.nome} />
      </section>
    </main>
  );
}
