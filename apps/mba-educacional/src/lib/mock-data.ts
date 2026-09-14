export type Course = {
  slug: string;
  title: string;
  kind: "Rápido" | "Profissionalizante" | "Pós-graduação" | "Técnico";
  category: string;
  hours: string;
  price: string;
  oldPrice?: string;
  badge?: string;
  partner?: string;
  progress?: number;
  tone: "violet" | "blue" | "orange" | "green" | "rose" | "cyan";
};

export const courses: Course[] = [
  { slug: "piloto-drone-agricola", title: "Piloto de Drone Agrícola", kind: "Profissionalizante", category: "Agro", hours: "40h", price: "R$ 197", oldPrice: "R$ 297", badge: "Mais procurado", tone: "green" },
  { slug: "gestao-comercial", title: "Gestão Comercial e Alta Performance", kind: "Pós-graduação", category: "Negócios", hours: "360h", price: "12x R$ 89", badge: "Certificação parceira", partner: "Instituição parceira", tone: "violet" },
  { slug: "tecnico-administracao", title: "Técnico em Administração", kind: "Técnico", category: "Negócios", hours: "800h+", price: "A consultar", badge: "Oferta parceira", partner: "Escola técnica parceira", tone: "blue" },
  { slug: "excel-vendas", title: "Excel Prático para Vendas", kind: "Rápido", category: "Tecnologia", hours: "12h", price: "R$ 59", oldPrice: "R$ 89", tone: "cyan" },
  { slug: "atendimento-cliente", title: "Atendimento que Fideliza", kind: "Rápido", category: "Vendas", hours: "8h", price: "R$ 39", tone: "orange" },
  { slug: "manejo-galinhas", title: "Manejo e Saúde de Galinhas", kind: "Profissionalizante", category: "Agro", hours: "24h", price: "R$ 129", tone: "rose" }
];

export const categories = ["Todos", "Agro", "Negócios", "Tecnologia", "Vendas", "Educação", "Saúde", "Gastronomia"];
