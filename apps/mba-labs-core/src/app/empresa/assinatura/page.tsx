import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, formatDate } from "@/components/ui-kit";
import { getEmpresaDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function EmpresaAssinaturaPage() {
  const data = await getEmpresaDashboardData("/empresa/assinatura");
  const rows = (data.apps as Array<Record<string, unknown>>).map((app) => ({
    ...app,
    data_inicio: formatDate(app.data_inicio),
    data_vencimento: formatDate(app.data_vencimento)
  }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Painel da empresa"
          title="Assinatura"
          description="Resumo dos contratos e vencimentos dos apps da empresa."
          actions={
            <Link className="button-secondary" href="/empresa/dashboard">
              Voltar
            </Link>
          }
        />
        <MessageBanner error={data.error ?? undefined} />
        <DataTable
          columns={[
            { key: "app", label: "App" },
            { key: "plano", label: "Plano" },
            { key: "status", label: "Status" },
            { key: "data_inicio", label: "Início" },
            { key: "data_vencimento", label: "Vencimento" }
          ]}
          rows={rows}
        />
      </section>
    </main>
  );
}
