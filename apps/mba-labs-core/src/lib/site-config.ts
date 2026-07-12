import { getCurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export type SiteSystemConfig = {
  key: "mbacotacoes" | "lavagestor" | "bikecomanda" | "chama-diarista";
  name: string;
  description: string;
  cta: string;
  href: string;
  visible: boolean;
};

export type SiteConfig = {
  brandName: string;
  logoUrl: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroSupportText: string;
  primaryButtonText: string;
  whatsappButtonText: string;
  whatsappUrl: string;
  sideEyebrow: string;
  sideTitle: string;
  sideText: string;
  systemsTitle: string;
  systems: SiteSystemConfig[];
  benefitsTitle: string;
  benefits: string[];
  footerText: string;
  primaryColor: string;
  secondaryColor: string;
};

export const defaultSiteConfig: SiteConfig = {
  brandName: "MBA Labs",
  logoUrl: "",
  heroEyebrow: "Gestão simples para negócios reais",
  heroTitle: "Sistemas práticos para organizar vendas, atendimentos e serviços sem complicar sua equipe",
  heroSubtitle:
    "O MBA Labs reúne soluções prontas para empresas que precisam controlar clientes, pedidos, serviços, pagamentos e equipes em uma rotina simples.",
  heroSupportText:
    "Você escolhe o sistema certo para sua operação, libera o acesso da equipe e acompanha tudo pelo login central do MBA Labs.",
  primaryButtonText: "Conhecer sistemas",
  whatsappButtonText: "Falar no WhatsApp",
  whatsappUrl:
    "https://wa.me/5500000000000?text=Ol%C3%A1%2C%20quero%20conhecer%20os%20sistemas%20da%20MBA%20Labs.",
  sideEyebrow: "Operação sob controle",
  sideTitle: "Um app para cada frente do seu negócio",
  sideText:
    "Cotações para farmácias, gestão para lava-jatos, comandas para bicicletarias e novas soluções sob demanda. Cada empresa acessa apenas o que contratou, com dados separados e uso simples no computador ou celular.",
  systemsTitle: "Sistemas",
  systems: [
    {
      key: "mbacotacoes",
      name: "MBA Cotações",
      description: "Compare preços, receba respostas de vendedores e gere pedidos com mais agilidade para sua farmácia.",
      href: "/apps/mbacotacoes",
      cta: "Conhecer MBA Cotações",
      visible: true
    },
    {
      key: "lavagestor",
      name: "LavaGestor",
      description: "Controle lavagens, fila de veículos, funcionários, comissões, vales, pagamentos e recibos em um painel simples.",
      href: "/apps/lavagestor",
      cta: "Conhecer LavaGestor",
      visible: true
    },
    {
      key: "bikecomanda",
      name: "BikeComanda",
      description: "Abra comandas de manutenção, cadastre clientes e bicicletas, monte orçamentos, acompanhe status e controle pagamentos.",
      href: "/apps/bikecomanda",
      cta: "Conhecer BikeComanda",
      visible: true
    },
    {
      key: "chama-diarista",
      name: "ChamaDiarista",
      description: "Receba pedidos de limpeza, acompanhe diaristas, agenda, pagamentos e avaliacoes em um painel central.",
      href: "/chama-diarista",
      cta: "Conhecer ChamaDiarista",
      visible: true
    }
  ],
  benefitsTitle: "Por que contratar pelo MBA Labs",
  benefits: [
    "Login central com acesso por empresa",
    "Cada cliente vê apenas o sistema contratado",
    "Funciona no computador e no celular",
    "Rotina guiada para equipes não técnicas",
    "Controle de clientes, pagamentos e operação"
  ],
  footerText: "MBA Labs cria sistemas simples para pequenos negócios venderem, atenderem e acompanharem a operação com mais controle.",
  primaryColor: "#28d8a5",
  secondaryColor: "#38bdf8"
};

export async function getSiteConfig() {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await (supabase as any)
      .from("core_configuracoes_site")
      .select("config")
      .eq("chave", "landing")
      .eq("ativo", true)
      .maybeSingle();

    if (error || !data?.config) {
      return defaultSiteConfig;
    }

    return mergeSiteConfig(data.config);
  } catch {
    return defaultSiteConfig;
  }
}

export async function getSiteConfigForAdmin() {
  const current = await getCurrentUserProfile("/admin/site");

  if (!current.isAdminMaster) {
    return { current, config: defaultSiteConfig };
  }

  return { current, config: await getSiteConfig() };
}

export function mergeSiteConfig(value: unknown): SiteConfig {
  if (!value || typeof value !== "object") {
    return defaultSiteConfig;
  }

  const input = value as Partial<SiteConfig>;
  const systems = defaultSiteConfig.systems.map((fallback) => {
    const custom = Array.isArray(input.systems)
      ? input.systems.find((item) => item && typeof item === "object" && (item as SiteSystemConfig).key === fallback.key)
      : null;

    return {
      ...fallback,
      ...(custom ?? {}),
      href: fallback.href,
      key: fallback.key,
      visible: custom ? (custom as Partial<SiteSystemConfig>).visible !== false : fallback.visible
    };
  });

  return {
    ...defaultSiteConfig,
    ...input,
    systems,
    benefits: normalizeTextList(input.benefits, defaultSiteConfig.benefits),
    primaryColor: normalizeColor(input.primaryColor, defaultSiteConfig.primaryColor),
    secondaryColor: normalizeColor(input.secondaryColor, defaultSiteConfig.secondaryColor)
  };
}

function normalizeTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const list = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return list.length > 0 ? list : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}
