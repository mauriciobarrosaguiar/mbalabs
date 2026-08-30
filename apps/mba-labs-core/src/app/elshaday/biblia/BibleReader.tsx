"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, LoaderCircle } from "lucide-react";
import { saveBibleFavorite } from "../actions";

type Book = { id: string; name: string; chapters: number };
type Verse = { number: number; text: string };

const BOOKS: Book[] = [
  { id: "GEN", name: "Gênesis", chapters: 50 },
  { id: "EXO", name: "Êxodo", chapters: 40 },
  { id: "LEV", name: "Levítico", chapters: 27 },
  { id: "NUM", name: "Números", chapters: 36 },
  { id: "DEU", name: "Deuteronômio", chapters: 34 },
  { id: "JOS", name: "Josué", chapters: 24 },
  { id: "JDG", name: "Juízes", chapters: 21 },
  { id: "RUT", name: "Rute", chapters: 4 },
  { id: "1SA", name: "1 Samuel", chapters: 31 },
  { id: "2SA", name: "2 Samuel", chapters: 24 },
  { id: "1KI", name: "1 Reis", chapters: 22 },
  { id: "2KI", name: "2 Reis", chapters: 25 },
  { id: "1CH", name: "1 Crônicas", chapters: 29 },
  { id: "2CH", name: "2 Crônicas", chapters: 36 },
  { id: "EZR", name: "Esdras", chapters: 10 },
  { id: "NEH", name: "Neemias", chapters: 13 },
  { id: "EST", name: "Ester", chapters: 10 },
  { id: "JOB", name: "Jó", chapters: 42 },
  { id: "PSA", name: "Salmos", chapters: 150 },
  { id: "PRO", name: "Provérbios", chapters: 31 },
  { id: "ECC", name: "Eclesiastes", chapters: 12 },
  { id: "SNG", name: "Cânticos", chapters: 8 },
  { id: "ISA", name: "Isaías", chapters: 66 },
  { id: "JER", name: "Jeremias", chapters: 52 },
  { id: "LAM", name: "Lamentações", chapters: 5 },
  { id: "EZK", name: "Ezequiel", chapters: 48 },
  { id: "DAN", name: "Daniel", chapters: 12 },
  { id: "HOS", name: "Oséias", chapters: 14 },
  { id: "JOL", name: "Joel", chapters: 3 },
  { id: "AMO", name: "Amós", chapters: 9 },
  { id: "OBA", name: "Obadias", chapters: 1 },
  { id: "JON", name: "Jonas", chapters: 4 },
  { id: "MIC", name: "Miquéias", chapters: 7 },
  { id: "NAM", name: "Naum", chapters: 3 },
  { id: "HAB", name: "Habacuque", chapters: 3 },
  { id: "ZEP", name: "Sofonias", chapters: 3 },
  { id: "HAG", name: "Ageu", chapters: 2 },
  { id: "ZEC", name: "Zacarias", chapters: 14 },
  { id: "MAL", name: "Malaquias", chapters: 4 },
  { id: "MAT", name: "Mateus", chapters: 28 },
  { id: "MRK", name: "Marcos", chapters: 16 },
  { id: "LUK", name: "Lucas", chapters: 24 },
  { id: "JHN", name: "João", chapters: 21 },
  { id: "ACT", name: "Atos", chapters: 28 },
  { id: "ROM", name: "Romanos", chapters: 16 },
  { id: "1CO", name: "1 Coríntios", chapters: 16 },
  { id: "2CO", name: "2 Coríntios", chapters: 13 },
  { id: "GAL", name: "Gálatas", chapters: 6 },
  { id: "EPH", name: "Efésios", chapters: 6 },
  { id: "PHP", name: "Filipenses", chapters: 4 },
  { id: "COL", name: "Colossenses", chapters: 4 },
  { id: "1TH", name: "1 Tessalonicenses", chapters: 5 },
  { id: "2TH", name: "2 Tessalonicenses", chapters: 3 },
  { id: "1TI", name: "1 Timóteo", chapters: 6 },
  { id: "2TI", name: "2 Timóteo", chapters: 4 },
  { id: "TIT", name: "Tito", chapters: 3 },
  { id: "PHM", name: "Filemom", chapters: 1 },
  { id: "HEB", name: "Hebreus", chapters: 13 },
  { id: "JAS", name: "Tiago", chapters: 5 },
  { id: "1PE", name: "1 Pedro", chapters: 5 },
  { id: "2PE", name: "2 Pedro", chapters: 3 },
  { id: "1JN", name: "1 João", chapters: 5 },
  { id: "2JN", name: "2 João", chapters: 1 },
  { id: "3JN", name: "3 João", chapters: 1 },
  { id: "JUD", name: "Judas", chapters: 1 },
  { id: "REV", name: "Apocalipse", chapters: 22 }
];

export function BibleReader({ favoriteReferences }: { favoriteReferences: string[] }) {
  const [bookId, setBookId] = useState("JHN");
  const [chapter, setChapter] = useState(3);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [translation, setTranslation] = useState("João Ferreira de Almeida");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const book = useMemo(() => BOOKS.find((item) => item.id === bookId) ?? BOOKS[0], [bookId]);
  const favorites = useMemo(() => new Set(favoriteReferences), [favoriteReferences]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch(\`/api/elshaday/biblia?book=\${encodeURIComponent(bookId)}&chapter=\${chapter}\`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o capítulo.");
        return data;
      })
      .then((data) => {
        setVerses(Array.isArray(data.verses) ? data.verses : []);
        setTranslation(data.translation || "João Ferreira de Almeida");
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason?.message || "Falha ao consultar a Bíblia.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [bookId, chapter]);

  function changeBook(nextBookId: string) {
    const nextBook = BOOKS.find((item) => item.id === nextBookId);
    setBookId(nextBookId);
    setChapter((current) => Math.min(current, nextBook?.chapters ?? 1));
  }

  function goPrevious() {
    if (chapter > 1) {
      setChapter((value) => value - 1);
      return;
    }
    const index = BOOKS.findIndex((item) => item.id === bookId);
    if (index <= 0) return;
    const previous = BOOKS[index - 1];
    setBookId(previous.id);
    setChapter(previous.chapters);
  }

  function goNext() {
    if (chapter < book.chapters) {
      setChapter((value) => value + 1);
      return;
    }
    const index = BOOKS.findIndex((item) => item.id === bookId);
    if (index < 0 || index >= BOOKS.length - 1) return;
    setBookId(BOOKS[index + 1].id);
    setChapter(1);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_170px_auto]">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Livro
          <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4" value={bookId} onChange={(event) => changeBook(event.target.value)}>
            {BOOKS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Capítulo
          <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4" value={chapter} onChange={(event) => setChapter(Number(event.target.value))}>
            {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white" onClick={goPrevious} type="button" aria-label="Capítulo anterior"><ChevronLeft /></button>
          <button className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-white" onClick={goNext} type="button" aria-label="Próximo capítulo"><ChevronRight /></button>
        </div>
      </div>

      <div className="rounded-[26px] bg-[#f8faf7] p-4 sm:p-6">
        <div className="mb-6 border-b border-emerald-950/10 pb-4">
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">{translation}</p>
          <h2 className="mt-1 text-2xl font-black">{book.name} {chapter}</h2>
        </div>

        {loading ? (
          <div className="grid min-h-48 place-items-center text-slate-500">
            <LoaderCircle className="animate-spin" size={30} />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-800">{error}</div>
        ) : verses.length === 0 ? (
          <p className="py-10 text-center text-slate-500">Capítulo sem conteúdo retornado.</p>
        ) : (
          <div className="grid gap-1">
            {verses.map((verse) => {
              const reference = \`\${book.name} \${chapter}:\${verse.number}\`;
              const favorite = favorites.has(reference);
              return (
                <div className="group grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl px-2 py-2 transition hover:bg-white" key={verse.number}>
                  <span className="pt-1 text-xs font-black text-[#b6872f]">{verse.number}</span>
                  <p className="text-[17px] leading-8 text-slate-800">{verse.text}</p>
                  <form action={saveBibleFavorite}>
                    <input type="hidden" name="referencia" value={reference} />
                    <input type="hidden" name="texto" value={verse.text} />
                    <button
                      className={\`grid size-9 place-items-center rounded-xl transition \${favorite ? "bg-rose-50 text-rose-500" : "text-slate-300 hover:bg-rose-50 hover:text-rose-500"}\`}
                      title={favorite ? "Favoritado" : "Favoritar versículo"}
                      type="submit"
                    >
                      <Heart size={17} fill={favorite ? "currentColor" : "none"} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
