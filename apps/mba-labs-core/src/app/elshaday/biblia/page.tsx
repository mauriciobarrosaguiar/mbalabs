import { Heart, NotebookPen, Search, Trash2 } from "lucide-react";
import { requireElshadayContext } from "@/lib/elshaday";
import { BibleReader } from "./BibleReader";
import {
  removeBibleFavorite,
  removeBibleNote,
  saveBibleNote
} from "../completion-actions";

export const dynamic = "force-dynamic";

export default async function ElshadayBiblePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/biblia");
  const q = read(query.q).toLowerCase();

  const [favoritesResult, notesResult] = await Promise.all([
    context.admin
      .from("igreja_biblia_favoritos")
      .select("id,referencia,texto,traducao,created_at")
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", context.current.authUser.id)
      .eq("traducao", "almeida")
      .order("created_at", { ascending: false }),
    context.admin
      .from("igreja_biblia_anotacoes")
      .select("id,referencia,anotacao,created_at,updated_at")
      .eq("igreja_id", context.igreja.id)
      .eq("user_id", context.current.authUser.id)
      .order("updated_at", { ascending: false })
  ]);

  if (favoritesResult.error) throw new Error("Falha ao carregar favoritos: " + favoritesResult.error.message);
  if (notesResult.error) throw new Error("Falha ao carregar anotações: " + notesResult.error.message);

  const favorites = (favoritesResult.data ?? []).filter((item: any) =>
    !q ||
    String(item.referencia ?? "").toLowerCase().includes(q) ||
    String(item.texto ?? "").toLowerCase().includes(q)
  );
  const notes = (notesResult.data ?? []).filter((item: any) =>
    !q ||
    String(item.referencia ?? "").toLowerCase().includes(q) ||
    String(item.anotacao ?? "").toLowerCase().includes(q)
  );

  const favoriteReferences = (favoritesResult.data ?? []).map((row: any) => String(row.referencia));

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Leitura e estudo</p>
          <h1 className="mt-1 text-3xl font-black">Bíblia Online</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-sm">
            <Heart className="text-rose-500" size={18} />
            {favoriteReferences.length} favoritos
          </span>
          <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-sm">
            <NotebookPen className="text-[#176445]" size={18} />
            {(notesResult.data ?? []).length} anotações
          </span>
        </div>
      </header>

      <section className="rounded-[30px] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-6">
        <BibleReader
          favoriteReferences={favoriteReferences}
          userKey={context.current.authUser.id}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <div className="flex items-center gap-2">
            <NotebookPen className="text-[#176445]" size={19} />
            <h2 className="font-black">Nova anotação</h2>
          </div>
          <form action={saveBibleNote} className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-bold">
              Referência
              <input className="input" name="referencia" placeholder="Ex.: João 3:16" required />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Anotação pessoal
              <textarea
                className="min-h-36 rounded-2xl border border-slate-200 p-4 outline-none focus:border-emerald-600"
                name="anotacao"
                placeholder="O que este texto falou com você?"
                required
              />
            </label>
            <button className="min-h-11 rounded-xl bg-[#123d2d] px-5 font-black text-white">
              Salvar anotação
            </button>
          </form>
        </article>

        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-black">Meu material salvo</h2>
            </div>
            <form className="relative" method="get">
              <Search className="absolute left-3 top-3.5 text-slate-600" size={16} />
              <input className="input pl-9" name="q" defaultValue={read(query.q)} placeholder="Buscar..." />
            </form>
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-slate-600">Favoritos</p>
              {!favorites.length ? (
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhum favorito encontrado.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {favorites.map((favorite: any) => (
                    <div className="rounded-2xl bg-rose-50 p-4" key={favorite.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-rose-900">{favorite.referencia}</p>
                          {favorite.texto ? (
                            <p className="mt-2 text-sm leading-6 text-slate-700">{favorite.texto}</p>
                          ) : null}
                        </div>
                        <form action={removeBibleFavorite}>
                          <input type="hidden" name="id" value={favorite.id} />
                          <button
                            className="grid size-9 place-items-center rounded-xl bg-white text-red-600"
                            title="Remover favorito"
                          >
                            <Trash2 size={16} />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-slate-600">Anotações</p>
              {!notes.length ? (
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma anotação encontrada.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {notes.map((note: any) => (
                    <details className="rounded-2xl bg-emerald-50 p-4" key={note.id}>
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-emerald-900">{note.referencia}</p>
                          <span className="text-xs font-bold text-emerald-800/60">Abrir</span>
                        </div>
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.anotacao}</p>
                      <div className="mt-4 grid gap-3 border-t border-emerald-100 pt-4">
                        <form action={saveBibleNote} className="grid gap-2">
                          <input type="hidden" name="referencia" value={note.referencia} />
                          <textarea
                            className="min-h-24 rounded-xl border border-emerald-200 bg-white p-3 text-sm"
                            name="anotacao"
                            defaultValue={note.anotacao}
                            required
                          />
                          <button className="min-h-10 rounded-xl bg-emerald-800 px-4 text-sm font-black text-white">
                            Atualizar anotação
                          </button>
                        </form>
                        <form action={removeBibleNote}>
                          <input type="hidden" name="id" value={note.id} />
                          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700">
                            <Trash2 size={15} /> Excluir anotação
                          </button>
                        </form>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

      <p className="text-center text-xs leading-5 text-slate-600">
        Texto bíblico consultado via bible-api.com. Favoritos e anotações ficam vinculados exclusivamente ao seu login.
      </p>

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
    </div>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
