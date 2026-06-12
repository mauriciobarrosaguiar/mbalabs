import Link from "next/link";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { ModeBadge } from "./mode-badge";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-sm font-bold text-white">
              MBA
            </span>
            <span>
              <span className="block font-semibold text-slate-950">MBA Cotações</span>
              <span className="block text-xs text-muted-foreground">Área pública</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ModeBadge />
            <Badge variant="outline">Sem login</Badge>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
