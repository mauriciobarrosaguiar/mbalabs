import { BookOpen, Heart } from "lucide-react";
import { requireElshadayContext } from "@/lib/elshaday";
import { BibleReader } from "./BibleReader";

export const dynamic = "force-dynamic";

export default async function ElshadayBiblePage() {
  const context = await requireElshadayContext("/elshaday/biblia");

  const { data: favorites } = await context.admin
    .from("igreja_biblia_favoritos")
    .select("referencia")
    .eq("igreja_id", context.igreja.id)
    .eq("user_id", context.current.authUser.id)
    .eq("traducao", "almeida");

  const favoriteReferences = (favorites ?? []).map((row: any) => String(row.referencia));

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Área do membro</p>
          <h1 className="mt-1 text-3xl font-black">Bíblia Online</h1>
          <p className="mt-2 text-slate-600">João Ferreira de Almeida · leitura por livro e capítulo.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-sm">
          <Heart className="text-rose-500" size={18} />
          {favoriteReferences.length} favoritos
        </div>
      </header>

      <section className="rounded-[30px] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          <BookOpen className="shrink-0" size={21} />
          <p>
            Selecione um livro e capítulo. O conteúdo é carregado sob demanda e armazenado em cache para melhorar a velocidade.
          </p>
        </div>
        <BibleReader favoriteReferences={favoriteReferences} />
      </section>

      <p className="text-center text-xs leading-5 text-slate-500">
        Texto bíblico consultado via bible-api.com. O serviço é externo; em caso de indisponibilidade temporária, tente novamente.
      </p>
    </div>
  );
}
