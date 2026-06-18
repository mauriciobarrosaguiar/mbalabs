import type { CurrentUserProfile } from "@/lib/core-data";

export type LexPlanoComercial = {
  slug: "inicial" | "profissional" | "escritorio";
  nome: string;
  limiteAdvogados: number | null;
  limiteClientes: number | null;
  limiteCasosAtivos: number | null;
  limiteDocumentos: number | null;
  permiteDossie: boolean;
  permiteRelatorios: boolean;
  suportePrioritario: boolean;
};

export type LexUsoPlano = {
  advogados: number;
  clientes: number;
  casosAtivos: number;
  documentos: number;
};

export type LexPlanLimitCheck = {
  allowed: boolean;
  message: string;
};

export const LEX_PLANOS_COMERCIAIS: Record<LexPlanoComercial["slug"], LexPlanoComercial> = {
  inicial: {
    slug: "inicial",
    nome: "Plano Inicial",
    limiteAdvogados: 2,
    limiteClientes: 50,
    limiteCasosAtivos: 30,
    limiteDocumentos: 300,
    permiteDossie: false,
    permiteRelatorios: true,
    suportePrioritario: false,
  },
  profissional: {
    slug: "profissional",
    nome: "Plano Profissional",
    limiteAdvogados: 8,
    limiteClientes: 300,
    limiteCasosAtivos: 180,
    limiteDocumentos: 2500,
    permiteDossie: true,
    permiteRelatorios: true,
    suportePrioritario: false,
  },
  escritorio: {
    slug: "escritorio",
    nome: "Plano Escritório",
    limiteAdvogados: null,
    limiteClientes: null,
    limiteCasosAtivos: null,
    limiteDocumentos: null,
    permiteDossie: true,
    permiteRelatorios: true,
    suportePrioritario: true,
  },
};

export async function obterPlanoLexGestor(client: any, current: CurrentUserProfile): Promise<LexPlanoComercial> {
  if (!current.empresaId) {
    return LEX_PLANOS_COMERCIAIS.profissional;
  }

  try {
    const { data } = await client
      .from("core_empresa_apps")
      .select("status,core_apps(slug),core_planos(nome,limite_usuarios,limite_registros)")
      .eq("empresa_id", current.empresaId)
      .in("status", ["ativo", "teste"])
      .limit(20);

    const row = ((data ?? []) as Array<Record<string, unknown>>).find((item) => {
      const app = relationObject(item.core_apps);
      return normalizeAppSlug(String(app?.slug ?? "")) === "lexgestor";
    });

    const plano = relationObject(row?.core_planos);
    const nome = String(plano?.nome ?? "").toLowerCase();
    const base =
      nome.includes("escrit") || nome.includes("office")
        ? LEX_PLANOS_COMERCIAIS.escritorio
        : nome.includes("inicial") || nome.includes("starter")
          ? LEX_PLANOS_COMERCIAIS.inicial
          : LEX_PLANOS_COMERCIAIS.profissional;

    return {
      ...base,
      limiteAdvogados: numericLimit(plano?.limite_usuarios, base.limiteAdvogados),
      limiteClientes: numericLimit(plano?.limite_registros, base.limiteClientes),
    };
  } catch {
    return LEX_PLANOS_COMERCIAIS.profissional;
  }
}

export function checarLimiteLexGestor(
  plano: LexPlanoComercial,
  uso: LexUsoPlano,
  recurso: "advogados" | "clientes" | "casosAtivos" | "documentos" | "dossie",
): LexPlanLimitCheck {
  if (recurso === "dossie") {
    return plano.permiteDossie
      ? { allowed: true, message: "" }
      : {
          allowed: false,
          message: "Seu plano atual ainda não libera dossiê em PDF. Fale com o MBA Labs para ativar este recurso.",
        };
  }

  const limits = {
    advogados: plano.limiteAdvogados,
    clientes: plano.limiteClientes,
    casosAtivos: plano.limiteCasosAtivos,
    documentos: plano.limiteDocumentos,
  };
  const labels = {
    advogados: "advogados/equipe",
    clientes: "clientes",
    casosAtivos: "casos ativos",
    documentos: "documentos",
  };
  const limit = limits[recurso];

  if (limit === null || uso[recurso] < limit) {
    return { allowed: true, message: "" };
  }

  return {
    allowed: false,
    message: `Limite de ${labels[recurso]} atingido no ${plano.nome}. Atualize o plano para continuar.`,
  };
}

export function resumoLimite(value: number | null) {
  return value === null ? "Ilimitado" : String(value);
}

function numericLimit(value: unknown, fallback: number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAppSlug(slug: string) {
  if (slug === "mbacotacoes") return "mba-cotacoes";
  if (slug === "bike-comanda") return "bikecomanda";
  if (slug === "lex-gestor") return "lexgestor";
  return slug;
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}
