export type DroneOsAccessContext = {
  userId: string;
  empresaId: string | null;
  canManage: boolean;
};

export class DroneOsAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DroneOsAccessError";
    this.status = status;
  }
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export function scopeDroneOsQuery(query: any, current: DroneOsAccessContext) {
  return current.empresaId
    ? query.eq("empresa_id", current.empresaId)
    : query.eq("usuario_id", current.userId);
}

export async function requireDroneOsAccess(
  admin: any,
  current: DroneOsAccessContext,
  osId: string,
) {
  const id = text(osId, 120);
  if (!id) throw new DroneOsAccessError("Selecione uma OS primeiro.", 400);

  let query = admin
    .from("core_logs")
    .select("id,usuario_id,empresa_id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", "ordem_servico")
    .contains("detalhes", { entityId: id })
    .limit(1);
  query = scopeDroneOsQuery(query, current);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || data.detalhes?.ativo === false) {
    throw new DroneOsAccessError("OS não encontrada ou inativa.", 404);
  }

  const osData = object(data.detalhes?.data);
  const assigned = text(osData.pilotoResponsavelId || osData.pilotoId, 120);

  // Em empresa/equipe, o piloto só acessa a OS que foi explicitamente atribuída a ele.
  // Gestor/RT pode acessar qualquer OS da empresa. Em modo solo, o próprio escopo por
  // usuario_id já garante que a OS pertence ao usuário autenticado.
  if (current.empresaId && !current.canManage) {
    if (!assigned) {
      throw new DroneOsAccessError(
        "Esta OS ainda não tem um piloto responsável definido.",
        403,
      );
    }
    if (assigned !== current.userId) {
      throw new DroneOsAccessError("Esta OS pertence a outro piloto.", 403);
    }
  }

  return { row: data, data: osData, assignedPilotId: assigned };
}

export function droneOsErrorResponse(error: unknown) {
  if (error instanceof DroneOsAccessError) {
    return { status: error.status, message: error.message };
  }
  return null;
}
