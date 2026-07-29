import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GoogleEmpresasNav } from "@/components/google-empresas/GoogleEmpresasNav";
import { GoogleEmpresaForm } from "@/components/google-empresas/GoogleEmpresaForm";
import { MessageBanner } from "@/components/ui-kit";
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
    <main className="google-empresas-module">
      <GoogleEmpresasNav active="empresas" />
      <section className="google-empresas-content grid gap-6">
        <header className="google-page-header">
          <div>
            <p className="eyebrow">Google Empresas</p>
            <h1>Cadastrar empresa</h1>
            <p>
              Preencha os dados reais usados pela empresa. O painel utilizará essas informações na pesquisa de duplicidades e na criação do Perfil da Empresa.
            </p>
          </div>
          <Link className="button-secondary inline-flex items-center gap-2" href="/google-empresas">
            <ArrowLeft size={17} />
            Voltar ao painel
          </Link>
        </header>
        <MessageBanner error={first(query.error)} />
        <GoogleEmpresaForm action={criarGoogleEmpresa} />
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
