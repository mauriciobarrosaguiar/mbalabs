import Link from "next/link";
import { getSessionProfile } from "@/lib/core-data";

export async function AppNav() {
  const { user } = await getSessionProfile();

  return (
    <header className="border-b border-white/10 bg-black/20">
      <nav className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link className="text-lg font-black tracking-tight" href="/">
          MBA Labs
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          {user ? (
            <>
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/dashboard">
                Dashboard
              </Link>
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/cotacoes">
                Cotacoes
              </Link>
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/admin/empresas">
                Empresas
              </Link>
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/admin/usuarios">
                Usuários
              </Link>
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/sair">
                Sair
              </Link>
            </>
          ) : (
            <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/login">
              Entrar
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
