import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
  Wrench
} from "lucide-react";

type BikeSection = {
  slug: string;
  label: string;
  title: string;
  description: string;
};

export const bikeSections: BikeSection[] = [
  {
    slug: "dashboard",
    label: "Dashboard",
    title: "Dashboard BikeComanda",
    description: "Visão geral das comandas, pagamentos e serviços da bicicletaria."
  },
  {
    slug: "nova-comanda",
    label: "Nova comanda",
    title: "Nova comanda",
    description: "Abra uma comanda com cliente, bicicleta, serviços, orçamento e responsável."
  },
  {
    slug: "comandas",
    label: "Comandas",
    title: "Comandas",
    description: "Acompanhe comandas abertas, em manutenção, aguardando aprovação e finalizadas."
  },
  {
    slug: "clientes",
    label: "Clientes",
    title: "Clientes",
    description: "Cadastre clientes e mantenha o histórico de atendimentos."
  },
  {
    slug: "bicicletas",
    label: "Bicicletas",
    title: "Bicicletas",
    description: "Controle bicicletas vinculadas a cada cliente."
  },
  {
    slug: "servicos",
    label: "Serviços",
    title: "Serviços",
    description: "Organize revisão, regulagem, peças, mão de obra e serviços avulsos."
  },
  {
    slug: "mecanicos",
    label: "Mecânicos",
    title: "Mecânicos",
    description: "Gerencie responsáveis, produtividade e comissões."
  },
  {
    slug: "comissoes",
    label: "Comissões",
    title: "Comissões",
    description: "Acompanhe comissões por serviço, mecânico e período."
  },
  {
    slug: "pagamentos",
    label: "Pagamentos",
    title: "Pagamentos",
    description: "Veja pagamentos em aberto, parciais e quitados."
  },
  {
    slug: "relatorios",
    label: "Relatórios",
    title: "Relatórios",
    description: "Resumo de comandas, serviços, receita e comissões."
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    title: "Configurações",
    description: "Preferências da operação, status e regras da bicicletaria."
  }
];

const metrics = [
  { label: "Comandas abertas", value: "0" },
  { label: "Em manutenção", value: "0" },
  { label: "Aguardando aprovação", value: "0" },
  { label: "Finalizadas", value: "0" },
  { label: "Pagamentos em aberto", value: "R$ 0,00" }
];

const workflow = [
  "Cliente",
  "Bicicleta",
  "Serviços",
  "Orçamento",
  "Responsável",
  "Pagamento"
];

export function BikeComandaApp({ activeSlug = "dashboard" }: { activeSlug?: string }) {
  const active = bikeSections.find((section) => section.slug === activeSlug) ?? bikeSections[0];

  return (
    <div className="min-h-screen bg-[#f6f9fb] text-[#17212b]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-[#d9e6ee] bg-white px-4 py-5 lg:block">
        <Link className="block" href="/bikecomanda">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f6b99] text-white">
            <Bike className="h-5 w-5" aria-hidden />
          </div>
          <div className="mt-3 text-xl font-black tracking-tight text-[#0f4665]">BikeComanda</div>
          <p className="mt-1 text-sm text-[#5d7180]">Comandas para bicicletarias</p>
        </Link>

        <nav className="mt-8 space-y-1">
          {bikeSections.map((item) => (
            <Link
              aria-current={item.slug === active.slug ? "page" : undefined}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold text-[#263d4f] hover:bg-[#edf6fb] aria-[current=page]:bg-[#dff2fb] aria-[current=page]:text-[#0f4665]"
              href={item.slug === "dashboard" ? "/bikecomanda" : `/bikecomanda/${item.slug}`}
              key={item.slug}
            >
              {iconFor(item.slug)}
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="absolute inset-x-4 bottom-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9e6ee] bg-white px-3 text-sm font-bold shadow-sm" href="/dashboard">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao MBA Labs
        </Link>
      </aside>

      <header className="sticky top-0 z-10 border-b border-[#d9e6ee] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/bikecomanda">
            <div className="font-black text-[#0f4665]">BikeComanda</div>
            <div className="text-xs text-[#5d7180]">Comandas para bicicletarias</div>
          </Link>
          <Link className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-sm font-bold" href="/dashboard">
            MBA Labs
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {bikeSections.map((item) => (
            <Link
              aria-current={item.slug === active.slug ? "page" : undefined}
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-[#edf6fb] px-3 text-sm font-bold text-[#263d4f] aria-[current=page]:bg-[#0f6b99] aria-[current=page]:text-white"
              href={item.slug === "dashboard" ? "/bikecomanda" : `/bikecomanda/${item.slug}`}
              key={`${item.slug}-mobile`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#0f6b99]">BikeComanda</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{active.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d7180]">{active.description}</p>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#0f6b99] px-4 font-bold text-white shadow-sm" href="/bikecomanda/nova-comanda">
              Nova comanda
            </Link>
          </div>

          {active.slug === "dashboard" ? <DashboardContent /> : <SectionContent section={active} />}
        </div>
      </main>
    </div>
  );
}

export function resolveBikeSection(slug?: string) {
  if (!slug) return bikeSections[0];
  return bikeSections.find((section) => section.slug === slug) ?? null;
}

function DashboardContent() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div className="rounded-lg border border-[#d9e6ee] bg-white p-4 shadow-sm" key={metric.label}>
            <p className="text-sm font-semibold text-[#5d7180]">{metric.label}</p>
            <p className="mt-2 text-2xl font-black">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Fluxo da comanda</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {workflow.map((step, index) => (
            <div className="rounded-lg bg-[#edf6fb] p-4" key={step}>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f6b99]">Passo {index + 1}</p>
              <p className="mt-2 font-bold">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionContent({ section }: { section: BikeSection }) {
  if (section.slug === "nova-comanda") {
    return (
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Abertura de comanda</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {workflow.map((step) => (
            <div className="rounded-lg border border-[#d9e6ee] p-4" key={step}>
              <p className="font-bold">{step}</p>
              <p className="mt-2 text-sm leading-6 text-[#5d7180]">Estrutura preparada para o cadastro guiado desta etapa.</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{section.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5d7180]">
        Tela inicial criada dentro do app publicado. Ela já evita 404 e deixa o módulo pronto para receber banco e ações específicas.
      </p>
      <div className="mt-5 rounded-lg bg-[#edf6fb] p-4 text-sm font-semibold text-[#0f4665]">
        Nenhum registro cadastrado ainda.
      </div>
    </section>
  );
}

function iconFor(slug: string) {
  const className = "h-4 w-4 text-[#0f6b99]";
  if (slug === "dashboard") return <LayoutDashboard className={className} aria-hidden />;
  if (slug === "nova-comanda" || slug === "comandas") return <ClipboardList className={className} aria-hidden />;
  if (slug === "clientes") return <Users className={className} aria-hidden />;
  if (slug === "bicicletas") return <Bike className={className} aria-hidden />;
  if (slug === "servicos") return <Wrench className={className} aria-hidden />;
  if (slug === "mecanicos") return <UserRound className={className} aria-hidden />;
  if (slug === "pagamentos") return <CreditCard className={className} aria-hidden />;
  if (slug === "relatorios") return <FileText className={className} aria-hidden />;
  if (slug === "configuracoes") return <Settings className={className} aria-hidden />;
  return <ClipboardList className={className} aria-hidden />;
}
