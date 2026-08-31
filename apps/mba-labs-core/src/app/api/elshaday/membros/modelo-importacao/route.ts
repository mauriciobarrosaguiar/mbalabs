import ExcelJS from "exceljs";
import {
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireElshadayContext("/elshaday/membros");
  requireElshadayRole(context, ["admin", "pastor", "secretaria"]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Labs - Elshaday Gestão";

  const sheet = workbook.addWorksheet("Membros");
  sheet.columns = [
    { header: "nome", key: "nome", width: 32 },
    { header: "data_nascimento", key: "data_nascimento", width: 18 },
    { header: "cpf", key: "cpf", width: 18 },
    { header: "telefone", key: "telefone", width: 18 },
    { header: "whatsapp", key: "whatsapp", width: 18 },
    { header: "email", key: "email", width: 32 },
    { header: "endereco", key: "endereco", width: 36 },
    { header: "bairro", key: "bairro", width: 22 },
    { header: "cidade", key: "cidade", width: 22 },
    { header: "estado", key: "estado", width: 10 },
    { header: "cargo", key: "cargo", width: 22 },
    { header: "ministerio", key: "ministerio", width: 24 },
    { header: "situacao", key: "situacao", width: 16 },
    { header: "observacoes", key: "observacoes", width: 40 }
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.addRow({
    nome: "EXEMPLO - APAGUE ESTA LINHA",
    data_nascimento: "1990-01-31",
    cpf: "",
    telefone: "(63) 99999-9999",
    whatsapp: "(63) 99999-9999",
    email: "exemplo@dominio.com",
    endereco: "Rua Exemplo, 100",
    bairro: "Centro",
    cidade: "Palmas",
    estado: "TO",
    cargo: "Membro",
    ministerio: "",
    situacao: "ativo",
    observacoes: "Esta linha serve apenas como exemplo e deve ser removida antes da importação."
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-membros-elshaday.xlsx"',
      "Cache-Control": "no-store"
    }
  });
}
