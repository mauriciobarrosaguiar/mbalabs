import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Building2, CreditCard, FileClock, Globe2, Layers3, Settings2, ShieldCheck, Users } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { PageHeader } from "@/components/ui-kit";
import { getCurrentUserProfile } from "@/lib/core-data";

export const dynamic = "force-dynamic";

const groups = [
  {
    title: "Clientes e acesso",
    description: "Cadastros de clientes e controle de quem pode acessar cada sistema.",
    items: [
      { title: "Empresas", description: "Clientes, situação e responsáveis.", href: "/admin/empresas", icon: Building2 },
      { title: "Usuários e acessos", description: "Contas, perfis e permissões por app.", href: "/admin/usuarios", icon: Users }
    ]
  },
  {
    title: "Produtos e comercial",
    description: "Tudo que define o que o MBA Labs oferece e como comercializa.",
    items: [
      { title: "Apps", description: "Sistemas disponíveis no portal.", href: "/admin/apps", icon: Boxes },
      { title: "Planos", description: "Planos comerciais de cada app.", href: "/admin/planos", icon: Layers3 },
      {
        title: "Categorias de empresas",
        description: "Tipos de empresas atendidas pelo portal.",
        href: "/admin/categorias-empresas",
        icon: ShieldCheck
      },
      { title: "Assinaturas", description: "Vínculos, vencimentos e situação.", href: "/admin/assinaturas", icon: CreditCard }
    ]
  },
  {
    title: "Portal e sistema",
    description: "Configurações institucionais e ferramentas administrativas.",
    items: [
      { title: "Aparência e conteúdo", description: "Landing, marca, textos, WhatsApp e cards.", href: "/admin/site", icon: Globe2 },
      { title: "Integrações", description: "Serviços administrativos e integrações disponíveis.", href: "/admin/configuracoes/asaas", icon: Settings2 },
      { title: "Logs e auditoria", description: "Histórico das ações administrativas.", href: "/admin/logs", icon: FileClock }
    ]
  }
];

export default async function ConfiguracoesPage() {
  const current = await getCurrentUserProfile("/admin/configuracoes");

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen">
      <AdminNav />
      <div className="lg:pl-[280px]">
        <section className="page-shell grid gap-6 py-5 sm:py-8">
          <div className="[&_h1]:text-3xl sm:[&_h1]:text-4xl">
            <PageHeader
              eyebrow="Sistema"
              title="Configurações"
              description="Central organizada por assunto. Alterar uma configuração aqui não modifica o código nem as regras internas dos sistemas contratados."
              actions={
                <Link className="button-secondary" href="/admin/dashboard">
                  Visão geral
                </Link>
              }
            />
          </div>

          <div className="grid gap-6">
            {groups.map((group) => (
              <section className="grid gap-3" key={group.title}>
                <div>
                  <h2 className="text-lg font-black text-white">{group.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{group.description}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        className="group flex min-h-32 flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-violet-400/25 hover:bg-white/[0.04]"
                        href={item.href}
                        key={item.href}
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
                          <Icon size={19} />
                        </span>
                        <span className="mt-5">
                          <strong className="block text-sm font-black text-white">{item.title}</strong>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
