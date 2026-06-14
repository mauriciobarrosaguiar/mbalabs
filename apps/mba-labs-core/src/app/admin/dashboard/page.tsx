import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, PageHeader, StatCard } from "@/components/ui-kit";
import { getAdminDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="MBA Labs"
          title="Dashboard principal"
          description="Visão central das empresas, assinaturas, usuários, categorias e sistemas contratados."
          actions={
            <>
              <Link className="button-secondary" href="/admin/empresas">
                Empresas
              </Link>
              <Link className="button-primary" href="/admin/usuarios">
                Usuários
              </Link>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="grid gap-3">
            <h2 className="text-xl font-black">Empresas por categoria</h2>
            <DataTable columns={[{ key: "label", label: "Categoria" }, { key: "value", label: "Empresas" }]} rows={data.porCategoria} />
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-black">Empresas por app contratado</h2>
            <DataTable columns={[{ key: "label", label: "Sistema" }, { key: "value", label: "Empresas" }]} rows={data.porApp} />
          </section>
        </div>
      </section>
    </main>
  );
}
