/** Reports use the same business timezone as the monthly MAPA competence. */
export function formatDroneReportDate(value: unknown): string {
  const raw = String(value || "");
  if (!raw) return "Não informado";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Araguaina",
  });
}
