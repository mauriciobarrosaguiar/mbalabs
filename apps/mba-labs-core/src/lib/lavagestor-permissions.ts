import { redirect } from "next/navigation";
import { type CurrentUserProfile, requireAppAccess } from "./core-data";

export type LavaPerfil =
  | "admin_master"
  | "admin_empresa"
  | "dono"
  | "gerente"
  | "operador"
  | "caixa"
  | "lavador"
  | "visualizador"
  | "usuario";

export async function requireLavaGestorAccess(nextPath = "/lavagestor") {
  const current = await requireAppAccess("lavagestor", nextPath);
  return { current, perfil: getLavaGestorPerfil(current) };
}

export async function requireLavaGestorFinanceAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canViewFinance(access.perfil)) {
    redirect(`/lavagestor?error=${encodeURIComponent("Seu perfil nao pode acessar financeiro completo.")}`);
  }
  return access;
}

export async function requireLavaGestorSettingsAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canManageSettings(access.perfil)) {
    redirect(`/lavagestor?error=${encodeURIComponent("Seu perfil nao pode alterar configuracoes.")}`);
  }
  return access;
}

export function getLavaGestorPerfil(current: CurrentUserProfile): LavaPerfil {
  if (current.isAdminMaster) return "admin_master";
  if (current.tipo === "admin_empresa") return "admin_empresa";

  const permissao = current.permissoes.find((item) => item.appSlug === "lavagestor" && item.podeAcessar);
  const perfil = normalizePerfil(permissao?.perfil || current.tipo || "usuario");

  if (isLavaPerfil(perfil)) {
    return perfil;
  }

  if (perfil === "funcionario") return "lavador";
  if (perfil === "atendente") return "operador";
  return "usuario";
}

export function canViewFinance(perfil: LavaPerfil) {
  return ["admin_master", "admin_empresa", "dono", "gerente", "caixa"].includes(perfil);
}

export function canManageSettings(perfil: LavaPerfil) {
  return ["admin_master", "admin_empresa", "dono"].includes(perfil);
}

export function canOperateCounter(perfil: LavaPerfil) {
  return ["admin_master", "admin_empresa", "dono", "gerente", "operador", "caixa"].includes(perfil);
}

function normalizePerfil(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isLavaPerfil(value: string): value is LavaPerfil {
  return ["admin_master", "admin_empresa", "dono", "gerente", "operador", "caixa", "lavador", "visualizador", "usuario"].includes(value);
}
