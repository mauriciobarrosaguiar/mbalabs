/** Read XLSX rows using a Uint8Array supported by ExcelJS in browser and Node. */
export async function readProductXlsxRows(file: Pick<File, "arrayBuffer">): Promise<string[][]> {
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;
  const workbook = new ExcelJS.Workbook();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) throw new Error("Arquivo Excel vazio.");
  await workbook.xlsx.load(bytes as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets.find((candidate) => candidate.actualRowCount > 0);
  if (!sheet) throw new Error("Planilha sem registros.");
  const rows: string[][] = [];
  sheet.eachRow({includeEmpty: false}, (row) => {
    const count = Math.min(row.cellCount, 45);
    rows.push(Array.from({length: count}, (_, index) =>
      String(row.getCell(index + 1).text ?? "").trim()
    ));
  });
  return rows;
}
