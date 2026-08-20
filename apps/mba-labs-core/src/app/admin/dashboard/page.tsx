import Link from "next/link";
import { ArrowRight, Building2, CreditCard, Users } from "lucide-react";
import { AdminDataTable } from "@/components/AdminDataTable";
import { AdminNav } from "@/components/AdminNav";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { getAdminDashboardData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <main className="min-h-screen">
      <AdminNav />
      <div className="lg:pl-[280px]">
        <section className="page-shell grid gap-6 py-5 sm:py-8">
          <div className="[&_h1]:text-3xl sm:[&_h1]:text-4xl">
            <PageHeader
              eyebrow="Central administrativa"
              title="Visão geral"
              description="Acompanhe clientes, acessos, assinaturas e produtos do MBA Labs sem misturar a administração com os sistemas contratados."
              actions={
                <Link className="button-primary inline-flex items-center gap-2" href="/admin/empresas">
                  Ver empresas
                  <ArrowRight size={16} />
                </Link>
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Link
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-violet-400/25 hover:bg-white/[0.04]"
              href="/admin/empresas"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
                <Building2 size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-white">Clientes</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Empresas e responsáveis</span>
              </span>
              <ArrowRight className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" size={17} />
            </Link>

            <Link
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-violet-400/25 hover:bg-white/[0.04]"
              href="/admin/usuarios"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                <Users size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-white">Acessos</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Usuários e permissões</span>
              </span>
              <ArrowRight className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300" size={17} />
            </Link>

            <Link
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-violet-400/25 hover:bg-white/[0.04]"
              href="/admin/assinaturas"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <CreditCard size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-black text-white">Financeiro</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Assinaturas e vencimentos</span>
              </span>
              <ArrowRight className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" size={17} />
            </Link>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="grid gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Distribuição</p>
                <h2 className="mt-1 text-lg font-black">Empresas por categoria</h2>
              </div>
              <AdminDataTable
                columns={[{ key: "label", label: "Categoria" }, { key: "value", label: "Empresas" }]}
                rows={data.porCategoria}
                showToolbar={false}
              />
            </section>

            <section className="grid gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Produtos</p>
                <h2 className="mt-1 text-lg font-black">Empresas por app contratado</h2>
              </div>
              <AdminDataTable
                columns={[{ key: "label", label: "Sistema" }, { key: "value", label: "Empresas" }]}
                rows={data.porApp}
                showToolbar={false}
              />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
