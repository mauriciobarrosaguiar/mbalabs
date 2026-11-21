import { droneGestorRole } from "./dronegestor-role";

type Access = Parameters<typeof droneGestorRole>[0];
export function isDroneSystemAdministrator(input: Access) {
  const type = String(input.tipo ?? "").trim().toLowerCase().replaceAll(" ", "_");
  return input.isAdminMaster === true || ["super_admin", "admin_master"].includes(type);
}
export function canAdministerDroneCompany(input: Access) {
  return isDroneSystemAdministrator(input) || droneGestorRole(input) === "admin_empresa";
}
export const droneEmployeeRoles = ["gestor_operacional", "responsavel_tecnico", "piloto", "aplicador_caar", "visualizador"] as const;
export type DroneEmployeeRole = typeof droneEmployeeRoles[number];
export function isDroneEmployeeRole(value: unknown): value is DroneEmployeeRole {
  return typeof value === "string" && (droneEmployeeRoles as readonly string[]).includes(value);
}
