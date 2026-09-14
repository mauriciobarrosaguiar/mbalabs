"use client";

import Link from "next/link";
import { ChevronRight, Video } from "lucide-react";
import { usePathname } from "next/navigation";

export function ElshadayHomeVideoCard() {
  const pathname = usePathname();
  const isHome = pathname === "/elshaday" || pathname === "/elshaday/gestao";

  if (!isHome) return null;

  return (
    <Link
      aria-label="Abrir vídeos da igreja"
      className="mt-3 flex min-h-[76px] w-full min-w-0 items-center gap-3 rounded-[22px] border border-emerald-950/10 bg-white p-3.5 shadow-sm transition active:scale-[.99] lg:hidden"
      href="/elshaday/videos"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-red-50 text-red-600">
        <Video size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black leading-tight text-slate-950">Vídeos</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-600">Cultos gravados · Assista no app</p>
      </div>
      <ChevronRight className="shrink-0 text-slate-500" size={20} />
    </Link>
  );
}
