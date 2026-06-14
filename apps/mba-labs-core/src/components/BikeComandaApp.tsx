import { BikeComandaClient } from "@/components/BikeComandaClient";

export type BikeSection = {
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
    description: "Acompanhe comandas, pagamentos, serviços e responsáveis da bicicletaria."
  },
  {
    slug: "nova-comanda",
    label: "Nova comanda",
    title: "Nova comanda",
    description: "Abra uma comanda guiada com cliente, bicicleta, serviços, orçamento, mecânico e pagamento."
  },
  {
    slug: "comandas",
    label: "Comandas",
    title: "Comandas",
    description: "Veja número, cliente, bicicleta, status, valor, responsável e ações de cada atendimento."
  },
  {
    slug: "clientes",
    label: "Clientes",
    title: "Clientes",
    description: "Cadastre, edite e consulte os clientes atendidos pela bicicletaria."
  },
  {
    slug: "bicicletas",
    label: "Bicicletas",
    title: "Bicicletas",
    description: "Cadastre bicicletas, vincule ao cliente e mantenha dados de identificação."
  },
  {
    slug: "servicos",
    label: "Serviços",
    title: "Serviços",
    description: "Configure serviços, peças, preço base e comissão padrão."
  },
  {
    slug: "mecanicos",
    label: "Mecânicos",
    title: "Mecânicos",
    description: "Cadastre responsáveis e acompanhe quem executa cada serviço."
  },
  {
    slug: "comissoes",
    label: "Comissões",
    title: "Comissões",
    description: "Calcule comissões por serviço, mecânico e comanda."
  },
  {
    slug: "pagamentos",
    label: "Pagamentos",
    title: "Pagamentos",
    description: "Registre pagamentos totais ou parciais e acompanhe valores em aberto."
  },
  {
    slug: "relatorios",
    label: "Relatórios",
    title: "Relatórios",
    description: "Resumo operacional de comandas, serviços, receita e pagamentos."
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    title: "Configurações",
    description: "Regras de status, armazenamento local e estrutura preparada para Supabase."
  }
];

export function BikeComandaApp({ activeSlug = "dashboard" }: { activeSlug?: string }) {
  const active = bikeSections.find((section) => section.slug === activeSlug) ?? bikeSections[0];
  return <BikeComandaClient active={active} sections={bikeSections} />;
}

export function resolveBikeSection(slug?: string) {
  if (!slug) return bikeSections[0];
  return bikeSections.find((section) => section.slug === slug) ?? null;
}
