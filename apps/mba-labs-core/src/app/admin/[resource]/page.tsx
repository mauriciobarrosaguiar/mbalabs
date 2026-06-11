import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTable } from "@/components/AdminTable";
import { AppNav } from "@/components/AppNav";
import { type AdminResource, getAdminResource, getAdminRows } from "@/lib/core-data";

export const dynamic = "force-dynamic";

const resources = [
  "empresas",
  "usuarios",
  "apps",
  "planos",
  "assinaturas",
  "pagamentos",
  "logs"
];

export default async function AdminResourcePage({
  params
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const config = getAdminResource(resource);

  if (!config) {
    notFound();
  }

  const { rows, error } = await getAdminRows(resource as AdminResource);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <div className="grid gap-2">
          <p className="eyebrow">Administracao</p>
          <h1 className="text-4xl font-black">{config.title}</h1>
          <p className="text-sm leading-6 text-slate-300">
            Primeira tela de leitura para conferencia dos registros no Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {resources.map((item) => (
            <Link
              className={`rounded-[8px] border px-3 py-2 text-sm font-bold ${
                item === resource ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"
              }`}
              href={`/admin/${item}`}
              key={item}
            >
              {item}
            </Link>
          ))}
        </div>

        {error ? <p className="rounded-[8px] border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">{error}</p> : null}
        <AdminTable columns={config.columns} rows={rows} />
      </section>
    </main>
  );
}
