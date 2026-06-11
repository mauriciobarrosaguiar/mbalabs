import Link from "next/link";

const links = [
  ["/cotacoes", "Dashboard"],
  ["/cotacoes/produtos", "Produtos"],
  ["/cotacoes/vendedores", "Vendedores"],
  ["/cotacoes/nova", "Nova cotacao"]
];

export function CotacoesShell({ children }: { children: React.ReactNode }) {
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL ?? "http://localhost:3000";

  return (
    <main>
      <header className="border-b border-white/10 bg-black/20">
        <nav className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <Link className="text-lg font-black" href="/cotacoes">
            MBA Cotacoes
          </Link>
          <div className="flex flex-wrap gap-2 text-sm">
            {links.map(([href, label]) => (
              <Link className="rounded-[8px] px-3 py-2 hover:bg-white/10" href={href} key={href}>
                {label}
              </Link>
            ))}
            <a className="rounded-[8px] px-3 py-2 hover:bg-white/10" href={`${coreUrl}/dashboard`}>
              Portal
            </a>
          </div>
        </nav>
      </header>
      {children}
    </main>
  );
}

export function LoginRequired({ error }: { error?: string | null }) {
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL ?? "http://localhost:3000";

  return (
    <section className="page-shell grid gap-4 py-8">
      <div className="panel max-w-xl p-6">
        <p className="eyebrow">Acesso protegido</p>
        <h1 className="mt-3 text-3xl font-black">Entre pelo portal MBA Labs</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          As telas de cotacoes exigem login e permissao ativa para a empresa.
        </p>
        {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
        <a className="button-primary mt-5" href={`${coreUrl}/login`}>
          Ir para login
        </a>
      </div>
    </section>
  );
}

export function RowsPreview({
  title,
  description,
  rows,
  columns
}: {
  title: string;
  description: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
}) {
  return (
    <section className="page-shell grid gap-5 py-8">
      <div>
        <p className="eyebrow">MBA Cotacoes</p>
        <h1 className="mt-2 text-4xl font-black">{title}</h1>
        <p className="mt-2 max-w-2xl text-slate-300">{description}</p>
      </div>
      <div className="overflow-x-auto rounded-[8px] border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/10 text-xs uppercase text-slate-300">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-300" colSpan={columns.length}>
                  Nenhum registro encontrado ainda.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="border-t border-white/10" key={String(row.id ?? index)}>
                  {columns.map((column) => (
                    <td className="max-w-[260px] truncate px-4 py-3" key={column}>
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
