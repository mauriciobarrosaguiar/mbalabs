import { NextResponse } from "next/server";
import { canPortalAccess, getPortalRelatorios } from "@/lib/portal-associativo-data";
import { createPortalReportPdf } from "@/lib/portal-associativo-pdf";
import { buildPortalStorageFolder, getPortalStorageConnection, uploadToPortalStorage } from "@/lib/portal-associativo-storage";
import { ensurePortalStorageEnvAliases } from "../_storage-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  ensurePortalStorageEnvAliases();
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "cobrancas";
  const formato = url.searchParams.get("formato") ?? "csv";
  const data = await getPortalRelatorios();

  if (!canPortalAccess(data.perfil, "relatorios")) {
    return NextResponse.json({ error: "Seu perfil nao permite exportar relatorios." }, { status: 403 });
  }

  const rows = tipo === "inadimplencia" ? data.rows.filter((row) => row.status_calculado === "vencida") : data.rows;

  if (formato === "pdf") {
    const pdf = await createPortalReportPdf({
      entidade: data.companyName,
      titulo: tipo === "inadimplencia" ? "Relatorio de inadimplencia" : "Relatorio de cobrancas",
      filtros: [`Tipo: ${tipo}`, "Periodo: todos os registros carregados"],
      resumo: [
        ["Total de cobrancas", String(data.resumo.totalCobrancas)],
        ["Pago", money(data.resumo.totalPago)],
        ["Em aberto", money(data.resumo.totalAberto)],
        ["Vencido", money(data.resumo.totalVencido)]
      ],
      headers: ["Descricao", "Unidade", "Responsavel", "Status", "Vencimento", "Valor"],
      rows: rows.map((row) => [
        String(row.descricao ?? ""),
        String(row.unidade ?? ""),
        String(row.responsavel ?? ""),
        String(row.status_calculado ?? row.status ?? ""),
        String(row.data_vencimento ?? ""),
        money(row.valor_total)
      ])
    });
    await trySaveReport(data, pdf, tipo);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="portal-associativo-${tipo}.pdf"`
      }
    });
  }

  const csv = toCsv([
    ["descricao", "loteamento", "chacara_lote", "responsavel", "status", "vencimento", "valor"],
    ...rows.map((row) => [
      row.descricao,
      row.loteamento,
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

async function trySaveReport(data: Awaited<ReturnType<typeof getPortalRelatorios>>, pdf: Buffer, tipo: string) {
  try {
    const connection = await getPortalStorageConnection(data.current);
    if (!connection) return;
    const folderPath = buildPortalStorageFolder({
      root: String(connection.root_folder_path ?? "/Portal Associativo"),
      area: "relatorio"
    });
    const fileName = `Relatorio - ${tipo} - ${new Date().toISOString().slice(0, 10)}.pdf`;
    const uploaded = await uploadToPortalStorage({
      current: data.current,
      fileName,
      mimeType: "application/pdf",
      bytes: pdf,
      folderPath
    });
    if (!uploaded) return;
    await data.client.from("assoc_arquivos").insert({
      empresa_id: data.empresaId,
      provedor: String(connection.provedor ?? "manual"),
      file_id: uploaded.fileId || null,
      file_name: fileName,
      mime_type: "application/pdf",
      size: pdf.length,
      path: uploaded.path,
      shared_url: uploaded.url || null,
      visibility: "interno",
      liberado_associado: false,
      categoria: "relatorio",
      descricao: `Relatorio ${tipo}`,
      criado_por: data.current.usuario.id,
      atualizado_por: data.current.usuario.id
    });
  } catch {
    // Export should still work if external storage is temporarily unavailable.
  }
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(";")).join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
