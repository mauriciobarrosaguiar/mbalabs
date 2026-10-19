/** Read XLSX in the browser, including files with prefixed SpreadsheetML elements. */
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

async function normalizePrefixedXlsx(bytes: Uint8Array): Promise<Uint8Array | null> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("xl/workbook.xml");
  const workbookXml = entry ? await entry.async("string") : "";
  if (!workbookXml.includes(`xmlns:x="${MAIN_NS}"`) || !/<x:workbook(?:\s|>)/.test(workbookXml)) {
    return null;
  }

  // ExcelJS 4.4.0 expects unprefixed OOXML elements. Normalize only when required;
  // ZIP components, sheet relationships, cell data and contents are preserved.
  const parts = Object.keys(zip.files).filter(path =>
    /^xl\/(?:workbook\.xml|styles\.xml|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(path)
  );
  for (const path of parts) {
    const component = zip.file(path);
    if (!component) continue;
    const xml = await component.async("string");
    if (!xml.includes(`xmlns:x="${MAIN_NS}"`) || !/<\/?x:/.test(xml)) continue;
    const normalized = xml
      .replace(`xmlns:x="${MAIN_NS}"`, `xmlns="${MAIN_NS}"`)
      .replace(/<(\/?)x:/g, "<$1");
    zip.file(path, normalized);
  }
  return zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
}

export async function readProductXlsxRows(file: Pick<File, "arrayBuffer">): Promise<string[][]> {
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) throw new Error("Arquivo Excel vazio.");

  let workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (error) {
    const normalized = await normalizePrefixedXlsx(bytes);
    if (!normalized) throw error;
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(normalized as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  }

  const sheet = workbook.worksheets.find(candidate => candidate.actualRowCount > 0);
  if (!sheet) throw new Error("Planilha sem registros.");
  const rows: string[][] = [];
  sheet.eachRow({includeEmpty:false}, row => {
    const count = Math.min(row.cellCount,45);
    rows.push(Array.from({length:count},(_,index) =>
      String(row.getCell(index+1).text ?? "").trim()
    ));
  });
  return rows;
}
