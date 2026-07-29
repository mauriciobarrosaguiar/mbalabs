import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { DataTable, MessageBanner, PageHeader, StatCard, formatDate } from "@/components/ui-kit";
import { formatGoogleEmpresaStatus, getGoogleEmpresasDashboard } from "@/lib/google-empresas/data";

export const dynamic = "force-dynamic";

export default async function GoogleEmpresasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { empresas, error } = await getGoogleEmpresasDashboard();
  const rows = empresas.map((empresa) => ({
    id: empresa.id,
    nome: empresa.nome,
    categoria: empresa.google_categoria_nome ?? empresa.categoria_principal,
    cidade_uf: [empresa.cidade, empresa.estado].filter(Boolean).join("/") || "-",
    status: formatGoogleEmpresaStatus(empresa.status),
    google: empresa.google_location_name ? "Perfil vinculado" : empresa.google_account_name ? "Conta autorizada" : "Não conectado",
    atualizado: formatDate(empresa.updated_at)
  }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Uso exclusivo do Admin Master"
          title="Google Empresas"
          description="Cadastre empresas, envie a autorização ao cliente, pesquise perfis existentes, crie o Perfil da Empresa e acompanhe a verificação sem sair do MBA Labs."
          actions={
            <Link className="button-primary" href="/google-empresas/nova">
              Nova empresa
            </Link>
          }
        />

        <MessageBanner ok={first(query.ok)} error={first(query.error) ?? error ?? undefined} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Empresas" value={empresas.length} />
          <StatCard label="Aguardando cliente" value={empresas.filter((item) => item.status === "aguardando_cliente").length} />
          <StatCard label="Em verificação" value={empresas.filter((item) => item.status === "aguardando_verificacao").length} />
          <StatCard label="Verificadas" value={empresas.filter((item) => item.status === "verificado").length} />
        </div>

        <div className="panel p-5">
          <h2 className="text-xl font-black">Fluxo do painel</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            1. Cadastre os dados. 2. Envie o link ao cliente. 3. Sincronize e confira duplicidades. 4. Crie ou solicite acesso. 5. Inicie e acompanhe a verificação.
          </p>
        </div>

        <DataTable
          columns={[
            { key: "nome", label: "Empresa" },
            { key: "categoria", label: "Categoria" },
            { key: "cidade_uf", label: "Cidade/UF" },
            { key: "status", label: "Status" },
            { key: "google", label: "Google" },
            { key: "atualizado", label: "Atualizado" }
          ]}
          rows={rows}
          emptyMessage="Nenhuma empresa cadastrada neste painel."
          actions={(row) => (
            <Link className="button-secondary" href={`/google-empresas/${row.id}`}>
              Gerenciar
            </Link>
          )}
        />
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
