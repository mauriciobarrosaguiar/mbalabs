import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MessageCircle } from "lucide-react";

const systems = [
  {
    name: "MBA Cotações",
    description: "Compare preços, receba respostas de vendedores e gere pedidos com mais agilidade para sua farmácia.",
    href: "/apps/mbacotacoes",
    cta: "Conhecer MBA Cotações"
  },
  {
    name: "LavaGestor",
    description: "Controle lavagens, fila de veículos, funcionários, comissões, vales, pagamentos e recibos em um painel simples.",
    href: "/apps/lavagestor",
    cta: "Conhecer LavaGestor"
  },
  {
    name: "BikeComanda",
    description: "Abra comandas de manutenção, cadastre clientes e bicicletas, monte orçamentos, acompanhe status e controle pagamentos.",
    href: "/apps/bikecomanda",
    cta: "Conhecer BikeComanda"
  }
];

const trustBlocks = [
  "Login individual por empresa",
  "Cada cliente vê apenas o sistema contratado",
  "Funciona no computador e no celular",
  "Controle de clientes, pagamentos e operação",
  "Solução simples para equipe leiga usar"
];

export default function HomePage() {
  const whatsappHref =
    process.env.NEXT_PUBLIC_MBA_WHATSAPP_URL ??
    "https://wa.me/5500000000000?text=Ol%C3%A1%2C%20quero%20conhecer%20os%20sistemas%20da%20MBA%20Labs.";

  return (
    <main>
      <section className="page-shell grid min-h-screen gap-12 py-8 md:py-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xl font-black">MBA Labs</div>
          <div className="flex flex-wrap gap-2">
            <a className="button-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
              Falar no WhatsApp
            </a>
            <Link className="button-primary" href="/login">
              Entrar
            </Link>
          </div>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="grid gap-7">
            <p className="eyebrow">Gestão simples para negócios</p>
            <div className="grid gap-5">
              <h1 className="max-w-5xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
                Sistemas simples para negócios que precisam vender, controlar e crescer
              </h1>
              <p className="max-w-3xl text-xl leading-8 text-slate-200">
                O MBA Labs cria soluções práticas para empresas que querem organizar pedidos, atendimentos,
                serviços, pagamentos e clientes sem complicação.
              </p>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                Escolha o sistema ideal para o seu negócio e comece a trabalhar com mais controle, sem planilhas
                soltas e sem processos difíceis para a equipe.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" href="#sistemas">
                Conhecer sistemas <ArrowRight size={18} />
              </Link>
              <a className="button-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="panel grid gap-4 p-5">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5">
              <p className="eyebrow">Operação sob controle</p>
              <h2 className="mt-3 text-2xl font-black">Um sistema certo para cada operação</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Cotação para farmácias, gestão para lava-jatos, comandas para bicicletarias e novas soluções sob demanda.
                Cada cliente acessa apenas o sistema contratado, com login próprio, dados separados e uso simples no
                computador ou celular.
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-4" id="sistemas">
          <h2 className="text-2xl font-black">Sistemas</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {systems.map((system) => (
              <article className="panel p-5" key={system.name}>
                <Building2 className="mb-5 text-emerald-300" size={24} />
                <h3 className="text-lg font-black">{system.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{system.description}</p>
                <Link className="button-secondary mt-5 w-fit" href={system.href}>
                  {system.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-2xl font-black">Por que contratar pelo MBA Labs</h2>
          <div className="grid gap-3 md:grid-cols-5">
            {trustBlocks.map((benefit) => (
              <div className="panel flex items-start gap-3 p-4 text-sm font-bold leading-6 text-slate-100" key={benefit}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                {benefit}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
