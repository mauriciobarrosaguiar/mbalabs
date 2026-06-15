import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ModuleDashboard, PageHeader } from "@/components/ui-kit";
import { getCurrentUserProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const current = await getCurrentUserProfile("/admin/configuracoes");

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="Configurações"
          title="Configurações do MBA Labs"
          description="Atalhos para editar cadastros centrais, permissões, assinaturas e logs."
          actions={
            <Link className="button-secondary" href="/admin/dashboard">
              Dashboard
            </Link>
          }
        />
        <ModuleDashboard
          items={[
            { title: "Categorias", description: "Tipos de empresas contratantes.", href: "/admin/categorias-empresas" },
            { title: "Empresas", description: "Clientes e status de acesso.", href: "/admin/empresas" },
            { title: "Usuários", description: "Contas, tipos globais e permissões por app.", href: "/admin/usuarios" },
            { title: "Apps", description: "Sistemas disponíveis no portal.", href: "/admin/apps" },
            {
              title: "Configurações do site",
              description: "Textos, logo, WhatsApp, cards e conteúdo público da landing.",
              href: "/admin/site"
            },
            { title: "Planos", description: "Planos comerciais por app.", href: "/admin/planos" },
            { title: "Assinaturas", description: "Vencimentos e status de acesso.", href: "/admin/assinaturas" },
            { title: "Logs", description: "Auditoria de ações importantes.", href: "/admin/logs" }
          ]}
        />
      </section>
    </main>
  );
}
