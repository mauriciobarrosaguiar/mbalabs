export type ElshadayRole =
  | "admin"
  | "pastor"
  | "tesouraria"
  | "secretaria"
  | "lider"
  | "membro";

export function elshadayRoleLabel(role: ElshadayRole) {
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
