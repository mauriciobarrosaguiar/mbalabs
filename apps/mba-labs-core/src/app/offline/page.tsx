import Link from "next/link";
import { BookOpen, CalendarDays, CloudOff, Mic2, RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function OfflinePage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-lg gap-6">
        <BrandLogo size="md" />

        <section className="panel grid gap-5 p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
            <CloudOff size={28} />
          </span>

          <div className="grid gap-2">
            <p className="eyebrow">Modo offline</p>
            <h1 className="text-3xl font-black">Você está sem internet</h1>
            <p className="text-sm leading-6 text-slate-300">
              No Elshaday, páginas de leitura já visitadas e capítulos bíblicos já abertos podem continuar disponíveis neste aparelho.
              Alterações que dependem do servidor serão sincronizadas quando a conexão voltar.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-black text-white"
              href="/elshaday/biblia"
            >
              <BookOpen size={17} />
              Bíblia
            </Link>
            <Link
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-black text-white"
              href="/elshaday/eventos"
            >
              <CalendarDays size={17} />
              Cultos
            </Link>
            <Link
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-black text-white"
              href="/elshaday/pregacoes"
            >
              <Mic2 size={17} />
              Pregações
            </Link>
          </div>

          <Link
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            href="/login"
          >
            <RotateCcw size={18} />
            Tentar conectar novamente
          </Link>

          <p className="text-xs leading-5 text-slate-400">
            Financeiro, acessos administrativos e outras áreas sensíveis não são armazenados para uso offline.
          </p>
        </section>
      </div>
    </main>
  );
}
