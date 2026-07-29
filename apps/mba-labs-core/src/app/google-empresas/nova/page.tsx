import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { GoogleEmpresaForm } from "@/components/google-empresas/GoogleEmpresaForm";
import { MessageBanner, PageHeader } from "@/components/ui-kit";
import { requireGoogleEmpresasAdmin } from "@/lib/google-empresas/data";
import { criarGoogleEmpresa } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaGoogleEmpresaPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireGoogleEmpresasAdmin("/google-empresas/nova");
  const query = await searchParams;

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Google Empresas"
          title="Cadastrar empresa"
          description="Preencha os dados reais usados pela empresa. O painel utilizará essas informações na pesquisa de duplicidades e na criação do Perfil da Empresa."
          actions={
            <Link className="button-secondary" href="/google-empresas">
              Voltar
            </Link>
          }
        />
        <MessageBanner error={first(query.error)} />
        <GoogleEmpresaForm action={criarGoogleEmpresa} />
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
