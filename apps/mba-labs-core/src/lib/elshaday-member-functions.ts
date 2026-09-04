import type { ElshadayRole } from "@/lib/elshaday";

export type ElshadayMemberFunction = {
  value: string;
  label: string;
  role: ElshadayRole;
  privileged: boolean;
};

export const ELSHADAY_MEMBER_FUNCTIONS: ElshadayMemberFunction[] = [
  { value: "Membro", label: "Membro", role: "membro", privileged: false },
  { value: "Obreiro(a)", label: "Obreiro(a)", role: "membro", privileged: false },
  { value: "Diácono/Diaconisa", label: "Diácono/Diaconisa", role: "membro", privileged: false },
  { value: "Presbítero", label: "Presbítero", role: "membro", privileged: false },
  { value: "Evangelista", label: "Evangelista", role: "membro", privileged: false },
  { value: "Missionário(a)", label: "Missionário(a)", role: "membro", privileged: false },
  { value: "Líder", label: "Líder", role: "lider", privileged: true },
  { value: "Secretário(a)", label: "Secretário(a)", role: "secretaria", privileged: true },
  { value: "Tesoureiro(a)", label: "Tesoureiro(a)", role: "tesouraria", privileged: true },
  { value: "Pastor(a)", label: "Pastor(a)", role: "pastor", privileged: true },
  { value: "Administrador", label: "Administrador", role: "admin", privileged: true }
];

function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const aliases: Record<string, string> = {
  "": "Membro",
  membro: "Membro",
  obreiro: "Obreiro(a)",
  obreira: "Obreiro(a)",
  diacono: "Diácono/Diaconisa",
  diaconisa: "Diácono/Diaconisa",
  presbitero: "Presbítero",
  evangelista: "Evangelista",
  missionario: "Missionário(a)",
  missionaria: "Missionário(a)",
  lider: "Líder",
  secretaria: "Secretário(a)",
  secretario: "Secretário(a)",
  tesouraria: "Tesoureiro(a)",
  tesoureiro: "Tesoureiro(a)",
  tesoureira: "Tesoureiro(a)",
  pastor: "Pastor(a)",
  pastora: "Pastor(a)",
  admin: "Administrador",
  administrador: "Administrador",
  administradora: "Administrador"
};

export function memberFunction(value: string | null | undefined): ElshadayMemberFunction {
  const raw = String(value ?? "").trim();
  const normalized = normalize(raw);
  const alias = aliases[normalized] ?? raw;

  return (
    ELSHADAY_MEMBER_FUNCTIONS.find((item) => item.value === alias) ??
    ELSHADAY_MEMBER_FUNCTIONS.find((item) => normalize(item.value) === normalized) ??
    ELSHADAY_MEMBER_FUNCTIONS[0]
  );
}

export function memberFunctionRole(value: string | null | undefined): ElshadayRole {
  return memberFunction(value).role;
}

export function memberFunctionLabel(value: string | null | undefined) {
  return memberFunction(value).label;
}

export function memberFunctionsForActor(actorRole: ElshadayRole) {
  if (actorRole === "admin") return ELSHADAY_MEMBER_FUNCTIONS;
  return ELSHADAY_MEMBER_FUNCTIONS.filter((item) => !item.privileged);
}

export function canAssignMemberFunction(actorRole: ElshadayRole, value: string | null | undefined) {
  const target = memberFunction(value);
  return actorRole === "admin" || !target.privileged;
}
