import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";

const systems = [
  {
    name: "MBA Cotacoes",
    description: "Controle de cotacoes, vendedores, respostas e pedidos."
  },
  {
    name: "LavaGestor",
    description: "Gestao simples para lava-jatos, servicos, vales e comissoes."
  },
  {
    name: "Futuros sistemas",
    description: "Uma base unica para novos produtos da MBA Labs."
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="page-shell grid min-h-screen content-center gap-10 py-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xl font-black">MBA Labs</div>
          <div className="flex gap-2">
            <Link className="button-secondary" href="/setup-admin">
              Criar Admin
            </Link>
            <Link className="button-primary" href="/login">
              Entrar
            </Link>
          </div>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="grid gap-7">
            <p className="eyebrow">Portal central SaaS</p>
            <div className="grid gap-5">
              <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
                MBA Labs
              </h1>
              <p className="max-w-2xl text-xl leading-8 text-slate-200">
                Sistemas simples para gestao inteligente de negocios.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" href="/login">
                Entrar <ArrowRight size={18} />
              </Link>
              <a className="button-secondary" href="#sistemas">
                Conhecer sistemas
              </a>
            </div>
          </div>

          <div className="panel grid gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Sistemas iniciais" value="3" />
              <Metric label="Banco unico" value="1" />
              <Metric label="Multiempresa" value="Sim" />
              <Metric label="Deploy" value="Vercel" />
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-200">
                <ShieldCheck size={18} /> Seguranca por empresa
              </div>
              <p className="text-sm leading-6 text-slate-300">
                A estrutura foi pensada para usar RLS no Supabase, permissoes por app e acesso separado por empresa.
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-4" id="sistemas">
          <div className="flex items-center gap-2">
            <Sparkles className="text-cyan-300" size={20} />
            <h2 className="text-2xl font-black">Sistemas da MBA Labs</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {systems.map((system) => (
              <article className="panel p-5" key={system.name}>
                <Building2 className="mb-5 text-emerald-300" size={24} />
                <h3 className="text-lg font-black">{system.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{system.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase text-slate-400">{label}</div>
    </div>
  );
}
