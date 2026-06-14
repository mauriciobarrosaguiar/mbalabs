import Link from "next/link";
import { ArrowRight, Building2, MessageCircle } from "lucide-react";

const systems = [
  {
    name: "MBA Cotações",
    description: "Sistema para cotações, vendedores, respostas e pedidos.",
    href: "/apps/mbacotacoes"
  },
  {
    name: "LavaGestor",
    description: "Sistema para lava-jatos controlarem lavagens, clientes, funcionários, pagamentos e comissões.",
    href: "/apps/lavagestor"
  },
  {
    name: "BikeComanda",
    description: "Sistema para bicicletarias controlarem comandas, serviços, orçamentos, pagamentos e comissões.",
    href: "/apps/bikecomanda"
  }
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

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="grid gap-7">
            <p className="eyebrow">Gestão simples para negócios</p>
            <div className="grid gap-5">
              <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
                MBA Labs
              </h1>
              <p className="max-w-2xl text-xl leading-8 text-slate-200">
                Sistemas simples para gestão de negócios.
              </p>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                Controle suas operações em um só lugar com soluções práticas para cotações,
                lava-jatos, bicicletarias e outros negócios.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" href="/login">
                Entrar <ArrowRight size={18} />
              </Link>
              <a className="button-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="panel grid gap-4 p-5">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5">
              <p className="eyebrow">Operação no centro</p>
              <h2 className="mt-3 text-2xl font-black">Um portal para acessar todos os seus sistemas.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Cada negócio acessa apenas as ferramentas contratadas, com uma experiência direta e fácil de usar no computador ou no celular.
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
                  Conhecer
                </Link>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
