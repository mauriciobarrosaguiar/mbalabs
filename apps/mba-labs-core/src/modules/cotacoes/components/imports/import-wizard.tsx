"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/cotacoes/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";

type ImportKind =
  | "products"
  | "suppliers"
  | "distributors"
  | "pharmacies"
  | "laboratories"
  | "pharmacy_items"
  | "bidding_items";

interface ParsedSheet {
  fileName: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  warning?: string;
}

const cards: Array<{ kind: ImportKind; title: string; description: string }> = [
  {
    kind: "products",
    title: "Importar produtos",
    description: "EAN, Produto e Laboratório",
  },
  {
    kind: "suppliers",
    title: "Importar vendedores",
    description: "Nome, empresa, WhatsApp, e-mail, tipo e observacao",
  },
  {
    kind: "distributors",
    title: "Importar distribuidoras",
    description: "Nome, unidade/CD, UF, pedido minimo e prazo",
  },
  {
    kind: "pharmacies",
    title: "Importar farmacias/CNPJs",
    description: "Nome fantasia, razao social, CNPJ, cidade e contatos",
  },
  {
    kind: "laboratories",
    title: "Importar laboratorios",
    description: "Laboratorios, marcas e fabricantes",
  },
  {
    kind: "pharmacy_items",
    title: "Itens cotacao farmacia",
    description: "Produto, EAN, laboratorio desejado, quantidade e tipo",
  },
  {
    kind: "bidding_items",
    title: "Itens cotacao licitacao",
    description: "Produto, principio ativo, dosagem, quantidade e unidade",
  },
];

const fieldsByKind: Record<ImportKind, Array<{ value: string; label: string }>> = {
  products: [
    { value: "ean", label: "EAN" },
    { value: "product_name", label: "Produto" },
    { value: "laboratory", label: "Laboratório" },
    { value: "ignore", label: "ignorar" },
  ],
  suppliers: [
    { value: "name", label: "Nome" },
    { value: "company", label: "Empresa" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "E-mail" },
    { value: "supplier_type", label: "Tipo" },
    { value: "notes", label: "Observacao" },
    { value: "ignore", label: "ignorar" },
  ],
  distributors: [
    { value: "name", label: "Nome" },
    { value: "cd", label: "Unidade/CD" },
    { value: "uf", label: "UF" },
    { value: "minimum_order", label: "Pedido Minimo" },
    { value: "average_deadline", label: "Prazo Medio" },
    { value: "portal", label: "Portal" },
    { value: "notes", label: "Observacao" },
    { value: "ignore", label: "ignorar" },
  ],
  pharmacies: [
    { value: "trade_name", label: "Nome Fantasia" },
    { value: "legal_name", label: "Razao Social" },
    { value: "cnpj", label: "CNPJ" },
    { value: "city", label: "Cidade" },
    { value: "uf", label: "UF" },
    { value: "responsible", label: "Responsavel" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "E-mail" },
    { value: "ignore", label: "ignorar" },
  ],
  laboratories: [
    { value: "name", label: "Nome" },
    { value: "cnpj", label: "CNPJ" },
    { value: "laboratory_type", label: "Tipo" },
    { value: "ignore", label: "ignorar" },
  ],
  pharmacy_items: [
    { value: "product_name", label: "Produto" },
    { value: "ean", label: "EAN" },
    { value: "requested_laboratory", label: "Laboratorio Desejado" },
    { value: "quantity", label: "Quantidade" },
    { value: "product_type", label: "Tipo" },
    { value: "notes", label: "Observacao" },
    { value: "ignore", label: "ignorar" },
  ],
  bidding_items: [
    { value: "product_name", label: "Produto" },
    { value: "active_ingredient", label: "Principio Ativo" },
    { value: "dosage", label: "Dosagem" },
    { value: "requested_quantity", label: "Quantidade Necessaria" },
    { value: "requested_unit", label: "Unidade" },
    { value: "requested_laboratory", label: "Laboratorio Desejado" },
    { value: "product_type", label: "Tipo" },
    { value: "allow_equivalent", label: "Aceita Equivalente" },
    { value: "notes", label: "Observacao" },
    { value: "ignore", label: "ignorar" },
  ],
};

export function ImportWizard() {
  const [kind, setKind] = useState<ImportKind>("products");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isReading, setIsReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const previewRows = useMemo(() => parsed?.rows.slice(0, 8) ?? [], [parsed]);

  async function handleFile(file?: File) {
    if (!file) return;
    setIsReading(true);
    setMessage(null);

    try {
      const parsedFile = await parseImportFile(file);
      setParsed(parsedFile);
      setMapping(
        Object.fromEntries(
          parsedFile.columns.map((column) => [column, guessField(column, kind)]),
        ),
      );
    } catch (error) {
      setParsed(null);
      setMessage(error instanceof Error ? error.message : "Nao foi possivel ler o arquivo.");
    } finally {
      setIsReading(false);
    }
  }

  function confirmImport() {
    if (!parsed) return;
    const importJobs = JSON.parse(localStorage.getItem("cotafarma-demo-import-jobs") ?? "[]") as unknown[];
    localStorage.setItem(
      "cotafarma-demo-import-jobs",
      JSON.stringify([
        {
          id: crypto.randomUUID(),
          kind,
          fileName: parsed.fileName,
          mapping,
          rows: parsed.rows,
          createdAt: new Date().toISOString(),
          status: "previewed",
        },
        ...importJobs,
      ]),
    );
    setMessage("Pre-visualizacao validada. Use os cadastros de cada modulo para confirmar a gravacao no Supabase.");
  }

  function downloadModel() {
    const headers = fieldsByKind[kind]
      .filter((field) => field.value !== "ignore")
      .map((field) => field.label)
      .join(";");
    const blob = new Blob([`\uFEFF${headers}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modelo_${kind}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.kind}
            type="button"
            onClick={() => setKind(card.kind)}
            className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-teal-300 ${
              kind === card.kind ? "border-teal-500 ring-2 ring-teal-100" : "border-slate-200"
            }`}
          >
            <FileSpreadsheet className="mb-3 h-5 w-5 text-teal-700" />
            <span className="block font-semibold text-slate-950">{card.title}</span>
            <span className="mt-2 block text-sm text-slate-500">{card.description}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo e mapeamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-teal-400 hover:bg-teal-50">
            <Upload className="h-6 w-6 text-teal-700" />
            <span className="font-medium text-slate-950">
              {isReading ? "Lendo arquivo..." : "Escolher .xlsx, .xls ou .csv"}
            </span>
            <span className="text-sm text-slate-500">
              CSV e XLSX são processados localmente. Para .xls legado, converta para .xlsx ou .csv antes de confirmar.
            </span>
            <input
              className="hidden"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
          <Button type="button" variant="outline" onClick={downloadModel}>
            <Download className="h-4 w-4" />
            Baixar modelo Excel
          </Button>

          {message ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          ) : null}

          {parsed ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-950">{parsed.fileName}</p>
                <p className="text-sm text-slate-500">
                  {parsed.columns.length} colunas encontradas, {parsed.rows.length} linhas na previa.
                </p>
                {parsed.warning ? <p className="mt-2 text-sm text-amber-700">{parsed.warning}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {parsed.columns.map((column) => (
                  <div key={column} className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">{column}</span>
                    <Select
                      value={mapping[column] ?? "ignore"}
                      onValueChange={(value) =>
                        setMapping((current) => ({ ...current, [column]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldsByKind[kind].map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {parsed.columns.map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, index) => (
                      <TableRow key={index}>
                        {parsed.columns.map((column) => (
                          <TableCell key={column}>{row[column] || "-"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={confirmImport}>Confirmar validacao</Button>
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  Imprimir previa
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

async function parseImportFile(file: File): Promise<ParsedSheet> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseCsv(file);
  }

  if (extension === "xlsx") {
    return parseXlsx(file);
  }

  if (extension === "xls") {
    const csvLike = await parseCsv(file).catch(() => null);
    if (csvLike) return csvLike;
    return {
      fileName: file.name,
      columns: [],
      rows: [],
      warning:
        "Arquivo .xls legado recebido. Converta para .xlsx ou .csv antes da importação final.",
    };
  }

  throw new Error("Formato nao suportado. Use .xlsx, .xls ou .csv.");
}

async function parseCsv(file: File): Promise<ParsedSheet> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("O arquivo esta vazio.");
  const delimiter = detectDelimiter(lines[0]);
  const columns = splitCsvLine(lines[0], delimiter).map((column) => column.trim());
  const rows = lines.slice(1, 51).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return Object.fromEntries(columns.map((column, index) => [column, cells[index]?.trim() ?? ""]));
  });
  return { fileName: file.name, columns, rows };
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Nenhuma aba encontrada no arquivo.");

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values : [];
  const columns = headerValues
    .slice(1)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const rows: Array<Record<string, string>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= 50) return;
    const rowValues = Array.isArray(row.values) ? row.values : [];
    const values = rowValues.slice(1).map((value) => String(value ?? "").trim());
    rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
  });

  return { fileName: file.name, columns, rows };
}

function detectDelimiter(line: string) {
  if (line.includes(";")) return ";";
  if (line.includes("\t")) return "\t";
  return ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function guessField(column: string, kind: ImportKind) {
  const normalized = column
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const direct = fieldsByKind[kind].find((field) => normalizeLabel(field.label) === normalized);
  if (direct) return direct.value;

  if (normalized.includes("cnpj")) return "cnpj";
  if (normalized.includes("whatsapp") || normalized.includes("telefone")) return "whatsapp";
  if (normalized.includes("email") || normalized.includes("e-mail")) return "email";
  if (normalized.includes("ean")) return "ean";
  if (normalized.includes("razao")) return "legal_name";
  if (normalized.includes("fantasia")) return "trade_name";
  if (normalized.includes("cidade")) return "city";
  if (normalized === "uf") return "uf";
  if (normalized.includes("unidade") || normalized === "und") return kind === "bidding_items" ? "requested_unit" : "base_unit";
  if (normalized.includes("quant") || normalized === "qtd") return kind === "bidding_items" ? "requested_quantity" : "quantity";
  if (normalized.includes("labor") || normalized.includes("marca")) return kind === "products" ? "laboratory" : "requested_laboratory";
  if (normalized.includes("princip")) return "active_ingredient";
  if (normalized.includes("dosagem")) return "dosage";
  if (normalized.includes("tipo")) return kind === "laboratories" ? "laboratory_type" : "product_type";
  if (normalized.includes("observ")) return "notes";
  if (normalized.includes("produto") || normalized.includes("descr")) return "product_name";
  if (normalized.includes("nome")) return kind === "products" ? "product_name" : "name";

  return "ignore";
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
