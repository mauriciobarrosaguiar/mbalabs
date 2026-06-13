import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, StatCard, formatDate } from "@/components/ui-kit";
import { getEmpresaDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function EmpresaDashboardPage() {
  const data = await getEmpresaDashboardData();
  const empresa = data.empresa;
  const apps = (data.apps as Array<Record<string, unknown>>).map((app) => ({
    ...app,
    data_vencimento: formatDate(app.data_vencimento)
  }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="Painel da empresa"
          title={String(empresa.nome_fantasia ?? empresa.nome ?? "Empresa")}
          description="Dados da empresa, usuarios, apps contratados e status da assinatura."
        />

        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Categoria" value={String(empresa.categoria || "-")} />
          <StatCard label="Status" value={String(empresa.status || "-")} />
          <StatCard label="Usuarios" value={data.usuarios.length} />
          <StatCard label="Apps contratados" value={data.apps.length} />
        </div>

        <section className="panel grid gap-3 p-5">
          <h2 className="text-xl font-black">Dados da empresa</h2>
          <div className="grid gap-2 text-sm leading-6 text-slate-300 md:grid-cols-2">
            <p>CNPJ: {String(empresa.cnpj ?? "-")}</p>
            <p>Responsavel: {String(empresa.responsavel ?? "-")}</p>
            <p>Cidade/UF: {String(empresa.cidade_uf ?? "-")}</p>
            <p>Razao social: {String(empresa.razao_social ?? "-")}</p>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-black">Apps contratados</h2>
          <DataTable
            columns={[
              { key: "app", label: "App" },
              { key: "plano", label: "Plano" },
              { key: "status", label: "Status" },
              { key: "data_vencimento", label: "Vencimento" }
            ]}
            rows={apps}
            actions={(row) =>
              row.url ? (
                <Link className="button-secondary" href={String(row.url)}>
                  Acessar
                </Link>
              ) : null
            }
          />
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl font-black">Usuarios da empresa</h2>
          <DataTable
            columns={[
              { key: "nome", label: "Nome" },
              { key: "email", label: "Email" },
              { key: "tipo", label: "Tipo" },
              { key: "status", label: "Status" }
            ]}
            rows={data.usuarios}
          />
        </section>
      </section>
    </main>
  );
}
