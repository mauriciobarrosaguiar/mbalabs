"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Heart,
  LoaderCircle,
  MessageSquareText,
  Minus,
  Plus,
  Search
} from "lucide-react";
import { saveBibleFavorite } from "../actions";
import { getBibleStudy } from "@/lib/elshaday-bible-study";

type Book = { id: string; name: string; chapters: number };
type Verse = { number: number; text: string };
type Testament = "todos" | "antigo" | "novo";

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

const NEW_TESTAMENT_START = BOOKS.findIndex((book) => book.id === "MAT");

export function BibleReader({ favoriteReferences }: { favoriteReferences: string[] }) {
  const [bookId, setBookId] = useState("");
  const [chapter, setChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [translation, setTranslation] = useState("João Ferreira de Almeida");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [testament, setTestament] = useState<Testament>("todos");
  const [fontSize, setFontSize] = useState(18);

  const book = useMemo(
    () => BOOKS.find((item) => item.id === bookId) ?? null,
    [bookId]
  );
  const favorites = useMemo(() => new Set(favoriteReferences), [favoriteReferences]);

  const filteredBooks = useMemo(() => {
    const term = normalize(search);
    return BOOKS.filter((item, index) => {
      const belongs =
        testament === "todos" ||
        (testament === "antigo" && index < NEW_TESTAMENT_START) ||
        (testament === "novo" && index >= NEW_TESTAMENT_START);
      const matches = !term || normalize(item.name).includes(term);
      return belongs && matches;
    });
  }, [search, testament]);

  useEffect(() => {
    if (!bookId || !chapter) {
      setVerses([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setVerses([]);

    fetch("/api/elshaday/biblia?book=" + encodeURIComponent(bookId) + "&chapter=" + chapter, {
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
        if (reason?.name !== "AbortError") {
          setError(reason?.message || "Falha ao consultar a Bíblia.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [bookId, chapter]);

  function chooseBook(id: string) {
    setBookId(id);
    setChapter(null);
    setVerses([]);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseChapter(number: number) {
    setChapter(number);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToBookChooser() {
    setBookId("");
    setChapter(null);
    setVerses([]);
    setSearch("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goPrevious() {
    if (!book || !chapter) return;
    if (chapter > 1) {
      setChapter(chapter - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const index = BOOKS.findIndex((item) => item.id === book.id);
    if (index <= 0) return;
    const previous = BOOKS[index - 1];
    setBookId(previous.id);
    setChapter(previous.chapters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    if (!book || !chapter) return;
    if (chapter < book.chapters) {
      setChapter(chapter + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const index = BOOKS.findIndex((item) => item.id === book.id);
    if (index < 0 || index >= BOOKS.length - 1) return;
    setBookId(BOOKS[index + 1].id);
    setChapter(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!book) {
    return (
      <div className="grid gap-6">
        <div className="rounded-[28px] bg-gradient-to-br from-[#123d2d] to-[#1b6045] p-6 text-white sm:p-8">
          <div className="flex items-center gap-3 text-[#f1d79d]">
            <BookOpenText size={24} />
            <span className="text-xs font-black uppercase tracking-[.18em]">Comece sua leitura</span>
          </div>
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">Qual livro você quer ler?</h2>
          <p className="mt-2 max-w-2xl leading-7 text-emerald-50/80">
            Escolha livremente um dos 66 livros. Nenhum capítulo é aberto automaticamente.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 outline-none focus:border-emerald-600"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar livro, ex.: Neemias, João, Salmos..."
              value={search}
            />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {([
              ["todos", "Todos"],
              ["antigo", "Antigo Testamento"],
              ["novo", "Novo Testamento"]
            ] as const).map(([value, label]) => (
              <button
                className={
                  "min-h-12 shrink-0 rounded-2xl px-4 text-sm font-black transition " +
                  (testament === value
                    ? "bg-[#123d2d] text-white"
                    : "border border-slate-200 bg-white text-slate-700")
                }
                key={value}
                onClick={() => setTestament(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredBooks.map((item) => (
            <button
              className="group min-h-28 rounded-[22px] border border-emerald-950/10 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-700/30 hover:shadow-md"
              key={item.id}
              onClick={() => chooseBook(item.id)}
              type="button"
            >
              <span className="text-xs font-black uppercase tracking-[.12em] text-[#b6872f]">
                {testamentLabel(item.id)}
              </span>
              <p className="mt-2 text-lg font-black text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">{item.chapters} capítulo{item.chapters === 1 ? "" : "s"}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-black text-[#176445]">
                Escolher
                <ChevronRight className="transition group-hover:translate-x-1" size={14} />
              </div>
            </button>
          ))}
        </div>

        {!filteredBooks.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Nenhum livro encontrado com essa busca.
          </div>
        ) : null}
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="grid gap-6">
        <button
          className="inline-flex w-fit items-center gap-2 text-sm font-black text-[#176445]"
          onClick={goToBookChooser}
          type="button"
        >
          <ArrowLeft size={16} /> Escolher outro livro
        </button>

        <section className="rounded-[30px] bg-[#123d2d] p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#f1d79d]">
            {testamentLabel(book.id)}
          </p>
          <h2 className="mt-2 text-3xl font-black">{book.name}</h2>
          <p className="mt-2 text-emerald-50/75">
            Escolha um capítulo para começar a leitura.
          </p>
        </section>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => (
            <button
              className="aspect-square rounded-2xl border border-emerald-950/10 bg-white text-sm font-black transition hover:bg-[#123d2d] hover:text-white"
              key={number}
              onClick={() => chooseChapter(number)}
              type="button"
            >
              {number}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const study = getBibleStudy(book.id, book.name, chapter, book.chapters);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-emerald-950/10 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black"
            onClick={goToBookChooser}
            type="button"
          >
            <BookOpenText size={16} /> Livros
          </button>
          <select
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            value={book.id}
            onChange={(event) => {
              setBookId(event.target.value);
              setChapter(1);
            }}
          >
            {BOOKS.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            value={chapter}
            onChange={(event) => setChapter(Number(event.target.value))}
          >
            {Array.from({ length: book.chapters }, (_, index) => index + 1).map((number) => (
              <option key={number} value={number}>Capítulo {number}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs font-bold text-slate-400">Letra</span>
          <button
            aria-label="Diminuir letra"
            className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white disabled:opacity-40"
            disabled={fontSize <= 16}
            onClick={() => setFontSize((value) => Math.max(16, value - 1))}
            type="button"
          >
            <Minus size={15} />
          </button>
          <span className="min-w-8 text-center text-sm font-black">{fontSize}</span>
          <button
            aria-label="Aumentar letra"
            className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white disabled:opacity-40"
            disabled={fontSize >= 22}
            onClick={() => setFontSize((value) => Math.min(22, value + 1))}
            type="button"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <article className="overflow-hidden rounded-[30px] border border-[#e8dfc8] bg-[#fffdf7] shadow-sm">
        <header className="border-b border-[#e8dfc8] px-5 py-6 text-center sm:px-10 sm:py-8">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#8c6a28]">{translation}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
            {book.name} {chapter}
          </h2>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Capítulo {chapter} de {book.chapters}
          </p>
        </header>

        {loading ? (
          <div className="grid min-h-72 place-items-center text-slate-500">
            <div className="text-center">
              <LoaderCircle className="mx-auto animate-spin text-[#176445]" size={32} />
              <p className="mt-3 text-sm">Carregando capítulo...</p>
            </div>
          </div>
        ) : error ? (
          <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-800 sm:m-8">
            {error}
          </div>
        ) : verses.length === 0 ? (
          <p className="py-16 text-center text-slate-500">Capítulo sem conteúdo retornado.</p>
        ) : (
          <>
            <div className="mx-auto max-w-4xl px-4 py-7 sm:px-10 sm:py-10">
              <div className="grid gap-1">
                {verses.map((verse) => {
                  const reference = book.name + " " + chapter + ":" + verse.number;
                  const favorite = favorites.has(reference);
                  return (
                    <div
                      className="group grid grid-cols-[1fr_auto] gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/80"
                      key={verse.number}
                    >
                      <p
                        className="font-serif leading-[2.05] text-slate-800"
                        style={{ fontSize: fontSize + "px" }}
                      >
                        <sup className="mr-2 select-none font-sans text-[11px] font-black text-[#b6872f]">
                          {verse.number}
                        </sup>
                        {verse.text}
                      </p>
                      <form action={saveBibleFavorite}>
                        <input type="hidden" name="referencia" value={reference} />
                        <input type="hidden" name="texto" value={verse.text} />
                        <button
                          className={
                            "mt-1 grid size-9 place-items-center rounded-xl transition " +
                            (favorite
                              ? "bg-rose-50 text-rose-500"
                              : "text-slate-300 hover:bg-rose-50 hover:text-rose-500")
                          }
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
            </div>

            <section className="border-t border-[#e8dfc8] bg-[#f8f3e7] px-4 py-6 sm:px-8 sm:py-8">
              <details className="group mx-auto max-w-4xl rounded-[24px] border border-[#dfd2b4] bg-white">
                <summary className="cursor-pointer list-none p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
                        <MessageSquareText size={21} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.12em] text-[#8c6a28]">
                          Bíblia de estudo
                        </p>
                        <h3 className="mt-1 font-black text-slate-900">
                          Clique aqui para ver os comentários
                        </h3>
                      </div>
                    </div>
                    <ChevronRight className="shrink-0 text-slate-400 transition group-open:rotate-90" size={20} />
                  </div>
                </summary>

                <div className="border-t border-[#eee5d1] p-5 sm:p-6">
                  <div className="grid gap-5">
                    {study.kingJamesNotes.length ? (
                      <div className="grid gap-4">
                        {study.kingJamesNotes.map((note) => (
                          <article
                            className="rounded-2xl border border-[#dfd2b4] bg-[#fffaf0] p-4 sm:p-5"
                            key={note.title}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#123d2d] px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[#f1d79d]">
                                {note.source}
                              </span>
                              <span className="text-xs font-bold text-slate-400">
                                Nota fornecida pelo usuário
                              </span>
                            </div>
                            <h4 className="mt-3 font-black text-slate-900">{note.title}</h4>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                              {note.text}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#dfd2b4] bg-[#fffaf0] p-5 text-sm leading-6 text-slate-600">
                        Ainda não há comentário King James cadastrado para este capítulo.
                      </div>
                    )}

                    <details className="rounded-2xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer list-none p-4 font-black text-slate-800">
                        Abrir guia de leitura Elshaday
                      </summary>
                      <div className="grid gap-5 border-t border-slate-200 p-4 sm:p-5">
                        <StudyBlock title={"Contexto de " + book.name} text={study.context} />
                        <StudyBlock title={"Visão geral de " + book.name + " " + chapter} text={study.chapter} />

                        <div>
                          <p className="text-xs font-black uppercase tracking-[.12em] text-[#8c6a28]">
                            Observe durante a leitura
                          </p>
                          <ol className="mt-3 grid gap-3">
                            {study.observe.map((item, index) => (
                              <li className="flex gap-3 text-sm leading-6 text-slate-700" key={item}>
                                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#123d2d] text-xs font-black text-white">
                                  {index + 1}
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <StudyBlock title="Aplicação e reflexão" text={study.application} />
                      </div>
                    </details>
                  </div>
                </div>
              </details>
            </section>
          </>
        )}
      </article>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-black disabled:opacity-40"
          disabled={book.id === BOOKS[0].id && chapter === 1}
          onClick={goPrevious}
          type="button"
        >
          <ChevronLeft size={18} /> Anterior
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#123d2d] font-black text-white disabled:opacity-40"
          disabled={book.id === BOOKS[BOOKS.length - 1].id && chapter === book.chapters}
          onClick={goNext}
          type="button"
        >
          Próximo <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function StudyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[.12em] text-[#8c6a28]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">{text}</p>
    </div>
  );
}

function testamentLabel(bookId: string) {
  const index = BOOKS.findIndex((book) => book.id === bookId);
  return index >= NEW_TESTAMENT_START ? "Novo Testamento" : "Antigo Testamento";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
