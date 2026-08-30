import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { requireAppAccess } from "@/lib/core-data";

export type ElshadayRole =
  | "admin"
  | "pastor"
  | "tesouraria"
  | "secretaria"
  | "lider"
  | "membro";

export type ElshadayContext = {
  current: Awaited<ReturnType<typeof requireAppAccess>>;
  admin: any;
  igreja: {
    id: string;
    empresa_id: string | null;
    slug: string;
    nome: string;
    nome_curto: string;
    cidade: string | null;
    estado: string | null;
  };
  papel: ElshadayRole;
};

export async function requireElshadayContext(nextPath = "/elshaday"): Promise<ElshadayContext> {
  const current = await requireAppAccess("elshaday", nextPath);
  const admin = createSupabaseAdminClient() as any;

  let igrejaQuery = admin
    .from("igreja_igrejas")
    .select("id,empresa_id,slug,nome,nome_curto,cidade,estado")
    .eq("ativa", true);

  if (current.isAdminMaster) {
    igrejaQuery = igrejaQuery.eq("slug", "assembleia-de-deus-elshaday-palmas");
  } else {
    if (!current.empresaId) {
      redirect("/acesso-bloqueado?app=elshaday&motivo=empresa");
    }
    igrejaQuery = igrejaQuery.eq("empresa_id", current.empresaId);
  }

  const { data: igreja, error: igrejaError } = await igrejaQuery.limit(1).maybeSingle();

  if (igrejaError) {
    throw new Error(`Falha ao carregar a igreja: ${igrejaError.message}`);
  }

  if (!igreja) {
    redirect("/acesso-bloqueado?app=elshaday&motivo=igreja-nao-configurada");
  }

  if (current.isAdminMaster) {
    return {
      current,
      admin,
      igreja,
      papel: "admin"
    };
  }

  const { data: perfil, error: perfilError } = await admin
    .from("igreja_perfis")
    .select("papel,ativo")
    .eq("igreja_id", igreja.id)
    .eq("user_id", current.authUser.id)
    .eq("ativo", true)
    .maybeSingle();

  if (perfilError) {
    throw new Error(`Falha ao carregar o perfil da igreja: ${perfilError.message}`);
  }

  const portalPermission = current.permissoes.find(
    (permission) => permission.appSlug === "elshaday" && permission.podeAcessar
  );
  const portalRole = current.tipo === "admin_empresa" ? "admin" : portalPermission?.perfil;
  let papel = isElshadayRole(String(perfil?.papel ?? "")) ? (perfil.papel as ElshadayRole) : null;

  if (isElshadayRole(String(portalRole ?? ""))) {
    papel = portalRole as ElshadayRole;

    if (!perfil || perfil.papel !== papel) {
      const { error: syncError } = await admin.from("igreja_perfis").upsert({
        igreja_id: igreja.id,
        user_id: current.authUser.id,
        papel,
        ativo: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "igreja_id,user_id" });

      if (syncError) {
        throw new Error(`Falha ao sincronizar o perfil da igreja: ${syncError.message}`);
      }
    }
  }

  if (!papel) {
    redirect("/acesso-bloqueado?app=elshaday&motivo=perfil");
  }

  return {
    current,
    admin,
    igreja,
    papel
  };
}

function isElshadayRole(value: string): value is ElshadayRole {
  return ["admin", "pastor", "tesouraria", "secretaria", "lider", "membro"].includes(value);
}

export function hasElshadayRole(
  papel: ElshadayRole,
  allowed: ElshadayRole[]
) {
  return allowed.includes(papel);
}

export function requireElshadayRole(
  context: ElshadayContext,
  allowed: ElshadayRole[]
) {
  if (!hasElshadayRole(context.papel, allowed)) {
    redirect("/elshaday");
  }
  return context;
}

export function roleLabel(role: ElshadayRole) {
  const labels: Record<ElshadayRole, string> = {
    admin: "Administrador",
    pastor: "Pastor",
    tesouraria: "Tesouraria",
    secretaria: "Secretaria",
    lider: "Líder",
    membro: "Membro"
  };
  return labels[role];
}

export function moneyBR(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function dateBR(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(date);
}

export function dateTimeBR(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}
