import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  dateBR,
  moneyBR,
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = await requireElshadayContext("/elshaday/financeiro/relatorios");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const start = url.searchParams.get("inicio") || "2000-01-01";
  const end = url.searchParams.get("fim") || "2999-12-31";
  const type = url.searchParams.get("tipo") || "";
  const payment = url.searchParams.get("forma") || "";
  const status = url.searchParams.get("status") || "";
  const memberId = url.searchParams.get("membro_id") || "";
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  let entriesQuery = context.admin
    .from("igreja_financeiro_entradas")
    .select("id,membro_id,tipo,descricao,valor,forma_pagamento,data_entrada,anonimo,origem,status,observacoes,created_at")
    .eq("igreja_id", context.igreja.id)
    .gte("data_entrada", start)
    .lte("data_entrada", end)
    .order("data_entrada", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  if (type) entriesQuery = entriesQuery.eq("tipo", type);
  if (payment) entriesQuery = entriesQuery.eq("forma_pagamento", payment);
  if (status) entriesQuery = entriesQuery.eq("status", status);
  if (memberId) entriesQuery = entriesQuery.eq("membro_id", memberId);

  const [entriesResult, membersResult] = await Promise.all([
    entriesQuery,
    context.admin
      .from("igreja_membros")
      .select("id,nome")
      .eq("igreja_id", context.igreja.id)
  ]);

  if (entriesResult.error) {
    return Response.json({ error: entriesResult.error.message }, { status: 500 });
  }
  if (membersResult.error) {
    return Response.json({ error: membersResult.error.message }, { status: 500 });
  }

  const rows = entriesResult.data ?? [];
  const memberMap = new Map(
    (membersResult.data ?? []).map((member: any) => [String(member.id), String(member.nome)])
  );
  const filenameBase = "elshaday-financeiro-" + start + "-a-" + end;

  if (format === "pdf") {
    const bytes = await buildPdf({
      churchName: context.igreja.nome_curto || context.igreja.nome,
      start,
      end,
      rows,
      memberMap
    });
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + filenameBase + '.pdf"',
        "Cache-Control": "no-store"
      }
    });
  }

  const buffer = await buildXlsx({
    churchName: context.igreja.nome_curto || context.igreja.nome,
    start,
    end,
    rows,
    memberMap
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="' + filenameBase + '.xlsx"',
      "Cache-Control": "no-store"
    }
  });
}

async function buildXlsx(input: {
  churchName: string;
  start: string;
  end: string;
  rows: any[];
  memberMap: Map<string, string>;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Labs - Elshaday Gestão";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Financeiro");
  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = input.churchName + " · Relatório financeiro";
  sheet.getCell("A2").value = "Período";
  sheet.getCell("B2").value = dateBR(input.start) + " a " + dateBR(input.end);

  sheet.addRow([]);
  sheet.addRow([
    "Data",
    "Tipo",
    "Membro",
    "Descrição",
    "Forma",
    "Origem",
    "Status",
    "Valor",
    "Observações"
  ]);

  for (const row of input.rows) {
    sheet.addRow([
      dateBR(row.data_entrada),
      typeLabel(row.tipo),
      row.anonimo
        ? "Anônimo"
        : input.memberMap.get(String(row.membro_id ?? "")) || "Sem vínculo",
      row.descricao || "",
      paymentLabel(row.forma_pagamento),
      row.origem === "manual" ? "Manual" : "Automático",
      row.status,
      Number(row.valor ?? 0),
      row.observacoes || ""
    ]);
  }

  sheet.addRow([]);
  const confirmed = input.rows.filter((row) => row.status !== "estornado");
  const total = confirmed.reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
  sheet.addRow(["TOTAL CONFIRMADO", "", "", "", "", "", "", total, ""]);

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 28;
  sheet.getColumn(4).width = 32;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 16;
  sheet.getColumn(8).width = 16;
  sheet.getColumn(9).width = 36;
  sheet.getColumn(8).numFmt = '"R$" #,##0.00';

  const header = sheet.getRow(4);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 4 }];

  return workbook.xlsx.writeBuffer();
}

async function buildPdf(input: {
  churchName: string;
  start: string;
  end: string;
  rows: any[];
  memberMap: Map<string, string>;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 42;
  const lineHeight = 16;
  let page = pdf.addPage(pageSize);
  let y = page.getHeight() - margin;

  const drawHeader = () => {
    page.drawText(safePdf(input.churchName), {
      x: margin,
      y,
      size: 16,
      font: bold,
      color: rgb(0.07, 0.24, 0.18)
    });
    y -= 24;
    page.drawText("Relatório financeiro · " + dateBR(input.start) + " a " + dateBR(input.end), {
      x: margin,
      y,
      size: 10,
      font
    });
    y -= 24;
    page.drawLine({
      start: { x: margin, y },
      end: { x: page.getWidth() - margin, y },
      thickness: 0.7,
      color: rgb(0.8, 0.84, 0.82)
    });
    y -= 18;
  };

  const nextPage = () => {
    page = pdf.addPage(pageSize);
    y = page.getHeight() - margin;
    drawHeader();
  };

  drawHeader();

  for (const row of input.rows) {
    if (y < 90) nextPage();
    const member = row.anonimo
      ? "Anônimo"
      : input.memberMap.get(String(row.membro_id ?? "")) || "Sem vínculo";
    const line1 =
      dateBR(row.data_entrada) +
      " · " +
      typeLabel(row.tipo) +
      " · " +
      safePdf(member) +
      " · " +
      moneyBR(row.valor);
    const line2 =
      paymentLabel(row.forma_pagamento) +
      " · " +
      (row.origem === "manual" ? "Manual" : "Automático") +
      " · " +
      row.status +
      (row.descricao ? " · " + safePdf(row.descricao) : "");

    page.drawText(truncate(line1, 88), { x: margin, y, size: 9, font: bold });
    y -= lineHeight;
    page.drawText(truncate(line2, 105), {
      x: margin,
      y,
      size: 8.5,
      font,
      color: rgb(0.25, 0.3, 0.3)
    });
    y -= lineHeight + 6;
  }

  const confirmed = input.rows.filter((row) => row.status !== "estornado");
  const total = confirmed.reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
  if (y < 100) nextPage();
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 1,
    color: rgb(0.07, 0.24, 0.18)
  });
  y -= 24;
  page.drawText("Total confirmado: " + moneyBR(total), {
    x: margin,
    y,
    size: 13,
    font: bold,
    color: rgb(0.07, 0.24, 0.18)
  });

  return pdf.save();
}

function safePdf(value: unknown) {
  return String(value ?? "")
    .replace(/[^\u0020-\u00FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Outro"
  };
  return labels[value] ?? value;
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao: "Cartão",
    transferencia: "Transferência",
    outro: "Outro"
  };
  return labels[value] ?? value;
}
