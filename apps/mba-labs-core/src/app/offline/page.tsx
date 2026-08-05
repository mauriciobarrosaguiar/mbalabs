import Link from "next/link";
import { CloudOff, RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function OfflinePage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <BrandLogo size="md" />
        <section className="panel grid gap-5 p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
            <CloudOff size={28} />
          </span>
          <div className="grid gap-2">
            <p className="eyebrow">Sem conexão</p>
            <h1 className="text-3xl font-black">Não foi possível acessar a internet</h1>
            <p className="text-sm leading-6 text-slate-300">
              Verifique o Wi-Fi ou os dados móveis. Por segurança, informações dos sistemas e dos clientes não ficam salvas no cache do aparelho.
            </p>
          </div>
          <Link
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            href="/login"
          >
            <RotateCcw size={18} />
            Tentar novamente
          </Link>
        </section>
      </div>
    </main>
  );
}
