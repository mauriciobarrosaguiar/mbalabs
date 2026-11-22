import JSZip from "jszip";

type CellValue = string | number | null;
type Changes = Record<string, Record<string, CellValue>>;
const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function attribute(xml: string, name: string) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(xml)?.[1] || "";
}
function column(ref: string) {
  let n = 0;
  for (const c of /^[A-Z]+/.exec(ref)![0]) n = n * 26 + c.charCodeAt(0) - 64;
  return n;
}
function cellXml(ref: string, old: string | undefined, value: CellValue) {
  const attrs = old ? /^<c\b([^>]*?)(?:\/>|>)/.exec(old)![1].replace(/\s+t="[^"]*"/g, "") : ` r="${ref}"`;
  if (value === null || value === "") return `<c${attrs}/>`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valor numérico inválido no relatório MAPA.");
    return `<c${attrs}><v>${value}</v></c>`;
  }
  return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}
function patchSheet(xml: string, changes: Record<string, CellValue>) {
  const byRow = new Map<number, Map<string, CellValue>>();
  for (const [ref, value] of Object.entries(changes)) {
    if (!/^[A-Z]{1,3}[1-9]\d*$/.test(ref)) throw new Error("Célula inválida no relatório MAPA.");
    const row = Number(/\d+$/.exec(ref)![0]);
    if (!byRow.has(row)) byRow.set(row, new Map());
    byRow.get(row)!.set(ref, value);
  }
  const data = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (!data) throw new Error("Modelo MAPA sem área de dados reconhecida.");
  const rows = new Map<number, string>();
  for (const match of data[1].matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)) {
    const index = Number(attribute(match[0].slice(0, match[0].indexOf(">") + 1), "r"));
    if (!index || rows.has(index)) throw new Error("Linhas inválidas no modelo MAPA.");
    rows.set(index, match[0]);
  }
  for (const [index, updates] of byRow) {
    const old = rows.get(index);
    const attrs = old ? /^<row\b([^>]*?)(?:\/>|>)/.exec(old)![1] : ` r="${index}"`;
    const cells = new Map<string, string>();
    for (const match of (old || "").matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const ref = attribute(match[0].slice(0, match[0].indexOf(">") + 1), "r");
      if (!ref || cells.has(ref)) throw new Error("Células inválidas no modelo MAPA.");
      cells.set(ref, match[0]);
    }
    for (const [ref, value] of updates) cells.set(ref, cellXml(ref, cells.get(ref), value));
    rows.set(index, `<row${attrs}>${[...cells.entries()].sort((a, b) => column(a[0]) - column(b[0])).map(([, value]) => value).join("")}</row>`);
  }
  const replacement = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value).join("");
  return xml.replace(data[0], () => data[0].replace(data[1], () => replacement));
}

/** Preserve every original XLSX part, patching only explicit report cells. */
export async function populateMapaArchive(template: Buffer, changes: Changes): Promise<Buffer> {
  const archive = await JSZip.loadAsync(template);
  const workbook = await archive.file("xl/workbook.xml")?.async("string");
  const relationships = await archive.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbook || !relationships) throw new Error("Modelo MAPA sem estrutura XLSX válida.");
  for (const [name, cells] of Object.entries(changes)) {
    const sheet = [...workbook.matchAll(/<sheet\b[^>]*\/?\s*>/g)].find(m => attribute(m[0], "name") === name);
    const id = sheet && attribute(sheet[0], "r:id");
    const relation = [...relationships.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].find(m => attribute(m[0], "Id") === id);
    const target = relation && attribute(relation[0], "Target");
    if (!target || /[:\\]/.test(target) || attribute(relation![0], "TargetMode") === "External") throw new Error("Aba MAPA não localizada no modelo.");
    const path = new URL(target, "https://xlsx.invalid/xl/workbook.xml").pathname.slice(1);
    const entry = archive.file(path);
    if (!entry || !path.startsWith("xl/worksheets/")) throw new Error("Aba MAPA inválida no modelo.");
    archive.file(path, patchSheet(await entry.async("string"), cells));
  }
  // Excel recalculates formula caches from the new inputs when opening the file.
  const calc = /<calcPr\b[^>]*\/?\s*>/;
  const existing = calc.exec(workbook)?.[0];
  const updated = existing
    ? existing.replace(/\s+fullCalcOnLoad="[^"]*"/g, "").replace(/\/?\s*>$/, ' fullCalcOnLoad="1"/>')
    : '<calcPr fullCalcOnLoad="1"/>';
  archive.file("xl/workbook.xml", existing ? workbook.replace(existing, updated) : workbook.replace("</workbook>", `${updated}</workbook>`));
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
