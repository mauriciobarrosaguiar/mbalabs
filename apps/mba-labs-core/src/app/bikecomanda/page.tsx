import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function BikeComandaPage() {
  await requireAppAccess("bikecomanda", "/bikecomanda");

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#17211d]">
      <header className="border-b border-[#dbe5e1] bg-white">
        <div className="mx-auto flex min-h-16 w-[min(1200px,calc(100%-32px))] flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f8a5f]">Terceiro sistema MBA Labs</p>
            <h1 className="text-xl font-black">BikeComanda</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dbe5e1] bg-white px-3 text-sm font-bold"
              href="/dashboard"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              MBA Labs
            </Link>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0f8a5f] px-3 text-sm font-bold text-white"
              href="/bikecomanda-static/index.html"
              target="_blank"
              rel="noreferrer"
            >
              Abrir em nova aba
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <iframe
        className="block h-[calc(100vh-65px)] w-full border-0 bg-white"
        src="/bikecomanda-static/index.html"
        title="BikeComanda"
      />
    </main>
  );
}
