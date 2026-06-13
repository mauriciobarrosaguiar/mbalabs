import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, formatDate } from "@/components/ui-kit";
import { getEmpresaDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function EmpresaUsuariosPage() {
  const data = await getEmpresaDashboardData("/empresa/usuarios");
  const rows = (data.usuarios as Array<Record<string, unknown>>).map((usuario) => ({
    ...usuario,
    created_at: formatDate(usuario.created_at)
  }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Painel da empresa"
          title="Usuarios da empresa"
          description="Lista escopada aos usuarios vinculados a empresa logada."
          actions={
            <Link className="button-secondary" href="/empresa/dashboard">
              Voltar
            </Link>
          }
        />
        <MessageBanner error={data.error ?? undefined} />
        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "email", label: "Email" },
            { key: "tipo", label: "Tipo" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows}
        />
      </section>
    </main>
  );
}
