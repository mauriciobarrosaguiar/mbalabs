export type ImportType =
  | "pharmacy_shortage"
  | "bidding_spreadsheet"
  | "products"
  | "purchase_history";

export interface ColumnMappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
}

const columnDictionary: Record<string, string[]> = {
  produto: ["produto", "descrição", "descritivo", "item"],
  ean: ["ean", "codigo de barras", "código de barras"],
  quantidade: ["qtd", "quantidade", "qtde"],
  laboratorio: ["marca", "laboratorio", "laboratório", "fabricante"],
  precoUltimaCompra: ["preço última compra", "ultimo preço", "preco"],
  dataUltimaCompra: ["data última compra", "data compra"],
  quantidadeNecessaria: ["qtd", "quantidade necessaria", "quantidade necessária"],
  unidadeBaseSolicitada: ["und", "unidade", "un"],
  produtoSolicitado: ["descrição", "descritivo", "produto"],
};

export function suggestColumnMapping(columns: string[]): ColumnMappingSuggestion[] {
  return columns.map((column) => {
    const normalized = normalize(column);
    const match = Object.entries(columnDictionary).find(([, aliases]) =>
      aliases.some((alias) => normalized.includes(normalize(alias))),
    );

    return {
      sourceColumn: column,
      targetField: match?.[0] ?? "ignorar",
      confidence: match ? 0.86 : 0.3,
    };
  });
}

export function normalizeImportTypeLabel(type: ImportType) {
  const labels: Record<ImportType, string> = {
    pharmacy_shortage: "Falteiro de farmácia",
    bidding_spreadsheet: "Cotação de licitação/distribuidora",
    products: "Cadastro de produtos",
    purchase_history: "Histórico de compras",
  };
  return labels[type];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
