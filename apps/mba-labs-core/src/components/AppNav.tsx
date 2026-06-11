import Link from "next/link";

export function AppNav() {
  return (
    <header className="border-b border-white/10 bg-black/20">
      <nav className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
        <Link className="text-lg font-black tracking-tight" href="/">
          MBA Labs
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/dashboard">
            Dashboard
          </Link>
          <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/admin/empresas">
            Empresas
          </Link>
          <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/admin/usuarios">
            Usuarios
          </Link>
          <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href="/login">
            Entrar
          </Link>
        </div>
      </nav>
    </header>
  );
}
