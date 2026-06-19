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
    description: "Configure a oficina, mensagens, regras financeiras e estrutura SaaS."
  }
];

export function BikeComandaApp() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        minWidth: 0,
        maxWidth: "100vw",
        overflow: "hidden",
        background: "#f4f7f6",
        colorScheme: "light"
      }}
    >
      <iframe
        src="/bikecomanda-static/index.html?v=20260619-viewport-2"
        title="BikeComanda"
        style={{
          display: "block",
          width: "100vw",
          height: "100dvh",
          minWidth: 0,
          maxWidth: "100vw",
          border: 0,
          background: "#f4f7f6",
          overflow: "hidden"
        }}
      />
    </main>
  );
}

export function resolveBikeSection(slug?: string) {
  if (!slug) return bikeSections[0];
  return bikeSections.find((section) => section.slug === slug) ?? null;
}
