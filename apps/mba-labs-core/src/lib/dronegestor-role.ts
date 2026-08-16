type DronePermission = {
  appSlug?: string;
  perfil?: string;
  podeAcessar?: boolean;
};

type DroneRoleInput = {
  tipo?: string | null;
  isAdminMaster?: boolean;
  permissoes?: DronePermission[] | null;
};

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
}

export function droneGestorRole(input: DroneRoleInput) {
  const globalType = normalize(input.tipo);
  if (input.isAdminMaster || ["super_admin", "admin_master"].includes(globalType)) return "admin_empresa";
  if (globalType === "admin_empresa") return "admin_empresa";
  const permission = (input.permissoes ?? []).find(
    (item) => item.appSlug === "dronegestor" && item.podeAcessar !== false,
  );
  return normalize(permission?.perfil) || globalType || "usuario";
}

export function canManageDroneGestor(input: DroneRoleInput) {
  return ["admin_empresa", "gestor_operacional", "responsavel_tecnico", "rt"].includes(
    droneGestorRole(input),
  );
}

export function isDroneGestorPilot(input: DroneRoleInput) {
  return ["piloto", "aplicador_caar"].includes(droneGestorRole(input));
}
