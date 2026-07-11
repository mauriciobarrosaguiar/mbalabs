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

export type LavaPermission =
  | "fila.ver"
  | "busca.ver"
  | "lavagem.ver"
  | "lavagem.criar"
  | "lavagem.editar"
  | "lavagem.iniciar"
  | "lavagem.finalizar"
  | "lavagem.cancelar"
  | "lavagem.alterar_responsavel"
  | "checklist.editar"
  | "foto.enviar"
  | "placa.ler"
  | "cliente.criar"
  | "cliente.editar"
  | "veiculo.criar"
  | "veiculo.editar"
  | "agendamento.ver"
  | "agendamento.criar"
  | "agendamento.editar"
  | "pagamento.ver_valor"
  | "pagamento.receber"
  | "pagamento.enviar_recibo"
  | "pagamento.ver_todos"
  | "financeiro.ver_caixa"
  | "comissao.ver_propria"
  | "comissao.ver_todas"
  | "relatorio.ver_basico"
  | "estoque.ver"
  | "estoque.editar"
  | "servico.gerenciar"
  | "funcionario.gerenciar"
  | "whatsapp.enviar_manual"
  | "whatsapp.configurar"
  | "configuracao.editar"
  | "usuarios.gerenciar";

export const ALL_LAVA_PERMISSIONS: LavaPermission[] = [
  "fila.ver",
  "busca.ver",
  "lavagem.ver",
  "lavagem.criar",
  "lavagem.editar",
  "lavagem.iniciar",
  "lavagem.finalizar",
  "lavagem.cancelar",
  "lavagem.alterar_responsavel",
  "checklist.editar",
  "foto.enviar",
  "placa.ler",
  "cliente.criar",
  "cliente.editar",
  "veiculo.criar",
  "veiculo.editar",
  "agendamento.ver",
  "agendamento.criar",
  "agendamento.editar",
  "pagamento.ver_valor",
  "pagamento.receber",
  "pagamento.enviar_recibo",
  "pagamento.ver_todos",
  "financeiro.ver_caixa",
  "comissao.ver_propria",
  "comissao.ver_todas",
  "relatorio.ver_basico",
  "estoque.ver",
  "estoque.editar",
  "servico.gerenciar",
  "funcionario.gerenciar",
  "whatsapp.enviar_manual",
  "whatsapp.configurar",
  "configuracao.editar",
  "usuarios.gerenciar"
];

const LAVA_PERMISSION_DEPENDENCIES: Partial<Record<LavaPermission, LavaPermission[]>> = {
  "pagamento.receber": ["pagamento.ver_valor", "pagamento.enviar_recibo", "fila.ver", "lavagem.ver"],
  "pagamento.enviar_recibo": ["pagamento.ver_valor", "lavagem.ver"],
  "financeiro.ver_caixa": ["pagamento.ver_valor", "pagamento.ver_todos"],
  "lavagem.criar": ["fila.ver", "lavagem.ver", "cliente.criar", "veiculo.criar"],
  "lavagem.editar": ["fila.ver", "lavagem.ver"],
  "lavagem.cancelar": ["fila.ver", "lavagem.ver"],
  "agendamento.criar": ["agendamento.ver"],
  "agendamento.editar": ["agendamento.ver"],
  "comissao.ver_todas": ["comissao.ver_propria"]
};

export const LAVA_BASE_PERMISSIONS: Record<LavaPerfil, LavaPermission[]> = {
  admin_master: ALL_LAVA_PERMISSIONS,
  admin_empresa: ALL_LAVA_PERMISSIONS,
  dono: ALL_LAVA_PERMISSIONS,
  gerente: ALL_LAVA_PERMISSIONS,

  operador: [
    "fila.ver",
    "busca.ver",
    "lavagem.ver",
    "lavagem.criar",
    "lavagem.editar",
    "lavagem.iniciar",
    "lavagem.finalizar",
    "lavagem.alterar_responsavel",
    "checklist.editar",
    "foto.enviar",
    "placa.ler",
    "cliente.criar",
    "cliente.editar",
    "veiculo.criar",
    "veiculo.editar",
    "agendamento.ver",
    "agendamento.criar",
    "agendamento.editar",
    "relatorio.ver_basico"
  ],

  caixa: [
    "fila.ver",
    "busca.ver",
    "lavagem.ver",
    "pagamento.ver_valor",
    "pagamento.receber",
    "pagamento.enviar_recibo",
    "pagamento.ver_todos",
    "financeiro.ver_caixa",
    "relatorio.ver_basico"
  ],

  lavador: [
    "fila.ver",
    "lavagem.ver",
    "lavagem.iniciar",
    "lavagem.finalizar",
    "checklist.editar",
    "foto.enviar"
  ],

  visualizador: [
    "fila.ver",
    "lavagem.ver"
  ],

  usuario: [
    "fila.ver",
    "lavagem.ver"
  ]
};

export async function requireLavaGestorAccess(nextPath = "/lavagestor/operacao") {
  const current = await requireAppAccess("lavagestor", nextPath);
  return { current, perfil: getLavaGestorPerfil(current) };
}

export async function requireLavaGestorFinanceAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canViewFinance(access.perfil, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não pode acessar financeiro completo.")}`);
  }
  return access;
}

export async function requireLavaGestorSettingsAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canManageSettings(access.perfil, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não pode alterar configurações.")}`);
  }
  return access;
}

export async function requireLavaGestorOwnerAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canViewOwnerDashboard(access.perfil, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não pode acessar a visão de gestão.")}`);
  }
  return access;
}

export async function requireLavaGestorOperationAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canViewOperation(access.perfil, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não pode acessar a operação.")}`);
  }
  return access;
}

export async function requireLavaGestorCounterAccess(nextPath: string) {
  const access = await requireLavaGestorAccess(nextPath);
  if (!canOperateCounter(access.perfil, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não pode acessar esta área.")}`);
  }
  return access;
}

export async function requireLavaPermission(permission: LavaPermission, nextPath = "/lavagestor/operacao") {
  const access = await requireLavaGestorAccess(nextPath);

  if (!canLavaAccess(access.perfil, permission, getLavaGestorPermissionExtras(access.current))) {
    redirect(`/lavagestor/operacao?error=${encodeURIComponent("Seu perfil não tem permissão para acessar esta função.")}`);
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

export function getLavaGestorPermissionExtras(current: CurrentUserProfile) {
  const permissao = current.permissoes.find((item) => item.appSlug === "lavagestor" && item.podeAcessar);
  return normalizeLavaPermissions(permissao?.permissoesExtras ?? []);
}

export function getBaseLavaPermissions(perfil: LavaPerfil) {
  return expandLavaPermissions(LAVA_BASE_PERMISSIONS[perfil] ?? LAVA_BASE_PERMISSIONS.usuario);
}

export function getEffectiveLavaPermissions(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  const basePermissions = getBaseLavaPermissions(perfil);
  const extraPermissions = normalizeLavaPermissions(extras);
  return expandLavaPermissions([...basePermissions, ...extraPermissions]);
}

export function canLavaAccess(perfil: LavaPerfil, permission: LavaPermission, extras: Array<LavaPermission | string> = []) {
  return getEffectiveLavaPermissions(perfil, extras).includes(permission);
}

export function canReceivePayment(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "pagamento.receber", extras);
}

export function canViewPaymentValue(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "pagamento.ver_valor", extras);
}

export function canViewFinance(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "financeiro.ver_caixa", extras);
}

export function canManageSettings(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "configuracao.editar", extras);
}

export function canViewOwnerDashboard(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canViewFinance(perfil, extras);
}

export function canViewAdminCadastros(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return ["cliente.criar", "cliente.editar", "veiculo.criar", "veiculo.editar", "funcionario.gerenciar", "servico.gerenciar", "estoque.ver"]
    .some((permission) => canLavaAccess(perfil, permission as LavaPermission, extras));
}

export function canViewOperation(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "fila.ver", extras) || canLavaAccess(perfil, "lavagem.ver", extras);
}

export function canOperateCounter(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  if (["lavador", "visualizador", "usuario"].includes(perfil)) return false;
  return ["lavagem.criar", "pagamento.receber", "agendamento.criar", "placa.ler", "whatsapp.enviar_manual", "busca.ver"]
    .some((permission) => canLavaAccess(perfil, permission as LavaPermission, extras));
}

export function getLavaDefaultRoute() {
  return "/lavagestor/operacao";
}

export function normalizeLavaPermissions(values: Array<LavaPermission | string> = []) {
  const normalized = values
    .map((value) => normalizePermissionKey(String(value)))
    .filter(isLavaPermission);

  return Array.from(new Set(normalized));
}

export function isLavaPermission(value: string): value is LavaPermission {
  return ALL_LAVA_PERMISSIONS.includes(value as LavaPermission);
}

function expandLavaPermissions(values: Array<LavaPermission | string>) {
  const queue = normalizeLavaPermissions(values);
  const permissions = new Set<LavaPermission>(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const dependencies = LAVA_PERMISSION_DEPENDENCIES[current] ?? [];
    for (const dependency of dependencies) {
      if (!permissions.has(dependency)) {
        permissions.add(dependency);
        queue.push(dependency);
      }
    }
  }

  return Array.from(permissions);
}

function normalizePermissionKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type LavaEmpresaAccessCurrent = Pick<CurrentUserProfile, "empresaId"> & { isAdminMaster?: boolean };

export async function assertLavaEmpresaAccess(current: LavaEmpresaAccessCurrent, empresaId: string | null | undefined) {
  if (!empresaId) {
    throw new Error("Empresa do recurso não identificada.");
  }
  if (current.isAdminMaster) return String(empresaId);
  if (current.empresaId && current.empresaId === empresaId) return String(empresaId);
  throw new Error("Você não tem acesso a esta empresa.");
}

export function currentForLavaEmpresa(current: CurrentUserProfile, empresaId: string): CurrentUserProfile {
  return { ...current, empresaId };
}

export async function resolveLavaEmpresaIdFromLavagem(client: any, lavagemId: string) {
  const { data, error } = await client
    .from("lava_lavagens")
    .select("empresa_id")
    .eq("id", lavagemId)
    .maybeSingle();
  if (error || !data?.empresa_id) {
    throw new Error(error?.message ?? "Lavagem não encontrada.");
  }
  return String(data.empresa_id);
}

export async function resolveLavaEmpresaIdFromWhatsappEnvio(client: any, envioId: string) {
  const { data, error } = await client
    .from("lava_whatsapp_envios")
    .select("empresa_id")
    .eq("id", envioId)
    .maybeSingle();
  if (error || !data?.empresa_id) {
    throw new Error(error?.message ?? "Mensagem de WhatsApp não encontrada.");
  }
  return String(data.empresa_id);
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
