import { NextResponse } from "next/server";
import { canPortalAccess, getPortalRelatorios } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "cobrancas";
  const data = await getPortalRelatorios();

  if (!canPortalAccess(data.perfil, "relatorios")) {
    return NextResponse.json({ error: "Seu perfil nao permite exportar relatorios." }, { status: 403 });
  }

  const rows = tipo === "inadimplencia" ? data.rows.filter((row) => row.status_calculado === "vencida") : data.rows;
  const csv = toCsv([
    ["descricao", "unidade", "responsavel", "status", "vencimento", "valor"],
    ...rows.map((row) => [
      row.descricao,
      row.unidade,
      row.responsavel,
      row.status_calculado ?? row.status,
      row.data_vencimento,
      row.valor_total
    ])
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="portal-associativo-${tipo}.csv"`
    }
  });
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(";")).join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}
