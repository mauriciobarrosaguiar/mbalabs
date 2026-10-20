/** Detect product CSV delimiters using column headings, not punctuation inside medicine names. */
export function detectProductImportDelimiter(text: string): string {
  const delimiters = [";", "\t", ","];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).slice(0, 20);
  if (!lines.length) return ";";

  function splitFields(line: string, delimiter: string): string[] {
    const fields: string[] = [];
    let field = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const character = line[i];
      if (character === '"') {
        if (quoted && line[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && character === delimiter) {
        fields.push(field.trim());
        field = "";
      } else {
        field += character;
      }
    }
    fields.push(field.trim());
    return fields;
  }

  function headerScore(fields: string[]): number {
    const categories = new Set<string>();
    for (const field of fields) {
      const header = field.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (/^(ean|gtin|codigo de barras|cod barras|barcode|cod ean)$/.test(header)) categories.add("ean");
      if (/^(produto|descricao|denominacao|nome do medicamento|item|mercadoria)$/.test(header)) categories.add("nome");
      if (/^(laboratorio|fabricante|industria|marca)$/.test(header)) categories.add("laboratorio");
      if (/^(tipo de produto|status do produto|classificacao|categoria|tipo produto|tipo)$/.test(header)) categories.add("tipoProduto");
    }
    return categories.size;
  }

  let selected: string | null = null;
  let recognized = 0;
  for (const delimiter of delimiters) {
    for (const line of lines) {
      const fields = splitFields(line, delimiter);
      const score = fields.length >= 2 ? headerScore(fields) : 0;
      if (score > recognized) { recognized = score; selected = delimiter; }
    }
  }
  if (recognized >= 2 && selected) return selected;

  // Unrecognized headers: choose from the header line only, not from data rows.
  return delimiters.sort((a, b) =>
    splitFields(lines[0], b).length - splitFields(lines[0], a).length
  )[0];
}
