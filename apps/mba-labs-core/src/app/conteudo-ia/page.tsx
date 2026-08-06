import { AppNav } from "@/components/AppNav";
import { ConteudoIaModeSelector } from "@/components/conteudo-ia/ConteudoIaModeSelector";
import { ConteudoIaStudio } from "@/components/conteudo-ia/ConteudoIaStudio";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function ConteudoIaPage() {
  const current = await requireAppAccess("conteudo-ia", "/conteudo-ia");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050817] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(168,85,247,0.14),transparent_26%),radial-gradient(circle_at_88%_16%,rgba(217,70,239,0.12),transparent_24%),linear-gradient(180deg,#07091a_0%,#050817_55%,#040612_100%)]" />
      <AppNav />
      <section className="page-shell relative py-6 md:py-9">
        <div className="grid gap-6">
          <ConteudoIaModeSelector />
          <ConteudoIaStudio userName={current.usuario.nome} />
        </div>
      </section>
    </main>
  );
}
