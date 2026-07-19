import { NextResponse } from "next/server";
import { canPortalAccess, listPortalInadimplentes } from "@/lib/portal-associativo-data";
import { createPortalReportPdf } from "@/lib/portal-associativo-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await listPortalInadimplentes({
    responsavel: url.searchParams.get("responsavel") ?? "",
    unidade: url.searchParams.get("unidade") ?? ""
  });
  if (!canPortalAccess(data.perfil, "inadimplentes")) {
    return NextResponse.json({ error: "Seu perfil não permite gerar notificação." }, { status: 403 });
  }
  const rows = data.rows.slice(0, 20);
  const pdf = await createPortalReportPdf({
    entidade: data.companyName,
    titulo: "Notificação de cobranças vencidas",
    filtros: ["Cobranças vencidas em aberto", `Emitido para ${rows[0]?.responsavel ?? "responsável selecionado"}`],
    resumo: [
      ["Responsável", String(rows[0]?.responsavel ?? "-")],
      ["Unidade", String(rows[0]?.unidade ?? "-")],
      ["Total vencido", money(rows.reduce((sum, row) => sum + Number(row.valor_total_vencido ?? 0), 0))]
    ],
    headers: ["Responsável", "Unidade", "Quantidade", "Total", "Mais antiga", "Dias"],
    rows: rows.map((row) => [
      String(row.responsavel ?? ""),
      String(row.unidade ?? ""),
      String(row.quantidade_cobrancas ?? ""),
      money(row.valor_total_vencido),
      String(row.cobranca_mais_antiga ?? ""),
      String(row.dias_atraso ?? "")
    ])
  });

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"notificacao-inadimplencia.pdf\""
    }
  });
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
