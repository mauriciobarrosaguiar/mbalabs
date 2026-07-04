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

  gerente: [
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
    "whatsapp.enviar_manual"
  ],

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
    "busca.ver",
    "lavagem.ver",
    "lavagem.iniciar",
    "lavagem.finalizar",
    "checklist.editar",
    "foto.enviar",
    "placa.ler"
  ],

  visualizador: [
    "fila.ver",
    "busca.ver",
    "lavagem.ver",
    "agendamento.ver",
    "relatorio.ver_basico"
  ],

  usuario: [
    "fila.ver",
    "busca.ver",
    "lavagem.ver"
  ]
};

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

export async function requireLavaPermission(permission: LavaPermission, nextPath = "/lavagestor") {
  const access = await requireLavaGestorAccess(nextPath);

  if (!canLavaAccess(access.perfil, permission)) {
    redirect(`/lavagestor?error=${encodeURIComponent("Seu perfil nao tem permissao para acessar esta funcao.")}`);
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

export function canOperateCounter(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  return canLavaAccess(perfil, "pagamento.receber", extras);
}

export function getLavaDefaultRoute(perfil: LavaPerfil, extras: Array<LavaPermission | string> = []) {
  if (canLavaAccess(perfil, "financeiro.ver_caixa", extras) && perfil === "caixa") {
    return "/lavagestor/pagamentos";
  }

  if (["lavador", "operador", "visualizador", "usuario"].includes(perfil)) {
    return "/lavagestor/fila";
  }

  return "/lavagestor";
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
