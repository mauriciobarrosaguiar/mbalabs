"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Edit, FileSpreadsheet, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DemoCrudField {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "select" | "hidden";
  options?: Record<string, string>;
  help?: string;
  defaultValue?: string | number;
  required?: boolean;
}

export type DemoCrudRow = Record<string, string | number | undefined> & {
  id: string;
  status?: string;
};

export function DemoCrudTable({
  entity,
  storageKey,
  title,
  fields,
  initialRows,
  primaryKey = "nome",
  statusOptions = defaultStatusOptions,
  emptyMessage = "Nenhum registro encontrado.",
  showStatus = true,
}: {
  entity?: "products" | "suppliers" | "distributors" | "laboratories" | "pharmacies" | "plans" | "monthly_subscriptions";
  storageKey: string;
  title: string;
  fields: DemoCrudField[];
  initialRows: DemoCrudRow[];
  primaryKey?: string;
  statusOptions?: Record<string, string>;
  emptyMessage?: string;
  showStatus?: boolean;
}) {
  const [rows, setRows] = useState<DemoCrudRow[]>(() => {
    if (typeof window === "undefined") return initialRows;
    if (remoteCrudEnabled(entity)) return initialRows;
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as DemoCrudRow[]) : initialRows;
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editing, setEditing] = useState<DemoCrudRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [importPreview, setImportPreview] = useState<DemoCrudRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const visibleFields = fields.filter((field) => field.type !== "hidden");

  useEffect(() => {
    if (remoteCrudEnabled(entity)) return;
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [entity, rows, storageKey]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "todos" || String(row.status ?? "ativo") === statusFilter;
      const matchesQuery =
        !normalized ||
        Object.values(row).some((value) =>
          String(value ?? "").toLowerCase().includes(normalized),
        );
      return matchesStatus && matchesQuery;
    });
  }, [rows, query, statusFilter]);

  const draft = editing ?? buildEmptyRow(fields);

  async function save(formData: FormData) {
    const row = fields.reduce<DemoCrudRow>(
      (acc, field) => {
        const raw = String(formData.get(field.key) ?? "");
        acc[field.key] = field.type === "number" ? Number(raw.replace(",", ".")) : raw;
        return acc;
      },
      {
        id: editing?.id ?? crypto.randomUUID(),
        status: String(formData.get("status") ?? editing?.status ?? "ativo"),
      },
    );

    const missingRequired = fields.find((field) => (
      field.required &&
      field.type !== "hidden" &&
      !String(row[field.key] ?? "").trim()
    ));
    if (missingRequired) {
      toast.error(`${missingRequired.label} é obrigatório.`);
      return;
    }

    if (remoteCrudEnabled(entity)) {
      try {
        const exists = rows.some((item) => item.id === row.id);
        const response = await fetch(`/api/crud/${entity}`, {
          method: exists ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, data: row }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Nao foi possivel salvar no Supabase.");
        const savedRow = (payload.row ?? row) as DemoCrudRow;
        setRows((current) =>
          exists
            ? current.map((item) => (item.id === savedRow.id ? savedRow : item))
            : [savedRow, ...current],
        );
        setEditing(null);
        setIsCreating(false);
        toast.success(`${title} salvo no Supabase`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao salvar registro.");
      }
      return;
    }

    setRows((current) => {
      const exists = current.some((item) => item.id === row.id);
      return exists
        ? current.map((item) => (item.id === row.id ? row : item))
        : [row, ...current];
    });
    setEditing(null);
    setIsCreating(false);
    toast.success(`${title} salvo em modo demo`);
  }

  async function inactivate(id: string) {
    if (remoteCrudEnabled(entity)) {
      try {
        const response = await fetch(`/api/crud/${entity}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, data: { status: "inativo" } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Nao foi possivel inativar no Supabase.");
        const savedRow = (payload.row ?? { id, status: "inativo" }) as DemoCrudRow;
        setRows((current) => current.map((row) => (row.id === id ? { ...row, ...savedRow } : row)));
        toast.success("Registro inativado no Supabase");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao inativar registro.");
      }
      return;
    }

    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status: "inativo" } : row)),
    );
    toast.success("Registro inativado");
  }

  async function remove(id: string) {
    if (remoteCrudEnabled(entity)) {
      try {
        const response = await fetch(`/api/crud/${entity}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Nao foi possivel remover no Supabase.");
        setRows((current) => current.map((row) => (row.id === id ? { ...row, status: "inativo" } : row)));
        toast.success("Registro inativado no Supabase");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao remover registro.");
      }
      return;
    }

    setRows((current) => current.filter((row) => row.id !== id));
    toast.success("Registro removido do demo local");
  }

  async function handleImport(file?: File) {
    if (!file) return;
    try {
      const parsed = await parseImportFile(file, fields);
      const errors = validateImportRows(parsed, fields);
      setImportPreview(parsed);
      setImportErrors(errors);
      toast.success("Arquivo lido. Revise a prévia antes de confirmar.");
    } catch (error) {
      setImportPreview([]);
      setImportErrors([error instanceof Error ? error.message : "Erro ao ler arquivo."]);
    }
  }

  async function confirmImport() {
    if (importPreview.length === 0 || importErrors.length > 0) return;
    for (const row of importPreview) {
      await save(rowToFormData(row, fields));
    }
    setImportPreview([]);
    toast.success("Importação confirmada.");
  }

  function exportRows() {
    downloadText(`${storageKey}-lista.csv`, toCsv(visibleRows, fields));
  }

  async function downloadModel() {
    if (entity === "products") {
      await downloadProductModel(fields);
      return;
    }
    downloadText(`${storageKey}-modelo.csv`, fields.filter((field) => field.type !== "hidden").map((field) => field.label).join(";"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-2xl sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
          {showStatus ? (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos os status</option>
              {Object.entries(statusOptions).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void downloadModel()}>
            <FileSpreadsheet className="h-4 w-4" />
            Baixar modelo Excel
          </Button>
          <Button variant="outline" onClick={exportRows}>
            <Download className="h-4 w-4" />
            Exportar lista
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" />
            Importar em massa
            <input
              className="hidden"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </label>
          <Button onClick={() => { setIsCreating(true); setEditing(null); }}>
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      {importPreview.length > 0 || importErrors.length > 0 ? (
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="font-medium text-slate-950">Pré-visualização da importação</p>
              <p className="text-sm text-muted-foreground">
                As colunas são mapeadas pelo cabeçalho do modelo. Corrija os erros antes de confirmar.
              </p>
            </div>
            {importErrors.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {importErrors.map((error) => <p key={error}>{error}</p>)}
              </div>
            ) : null}
            {importPreview.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleFields.slice(0, 5).map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 8).map((row) => (
                      <TableRow key={row.id}>
                        {visibleFields.slice(0, 5).map((field) => <TableCell key={field.key}>{formatCell(field, row[field.key])}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <Button onClick={confirmImport} disabled={importErrors.length > 0 || importPreview.length === 0}>
              Confirmar importação
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(isCreating || editing) ? (
        <Card className="border-teal-100 bg-teal-50/40">
          <CardContent className="p-4">
            <form action={save} className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              {fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  {field.type === "hidden" ? (
                    <input type="hidden" name={field.key} defaultValue={String(draft[field.key] ?? field.defaultValue ?? "")} />
                  ) : (
                  <>
                  <Label htmlFor={`${storageKey}-${field.key}`}>{field.label}</Label>
                  {field.type === "select" && field.options ? (
                    <select
                      id={`${storageKey}-${field.key}`}
                      name={field.key}
                      defaultValue={String(draft[field.key] ?? "")}
                      required={field.required}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(field.options).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`${storageKey}-${field.key}`}
                      name={field.key}
                      type={field.type ?? "text"}
                      required={field.required}
                      defaultValue={String(draft[field.key] ?? "")}
                    />
                  )}
                  {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
                  </>
                  )}
                </div>
              ))}
              {showStatus ? (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    name="status"
                    defaultValue={draft.status ?? "ativo"}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(statusOptions).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="status" defaultValue={String(draft.status ?? "ativo")} />
              )}
              <div className="flex items-end gap-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="outline" onClick={() => { setEditing(null); setIsCreating(false); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleFields.slice(0, 5).map((field) => (
                <TableHead key={field.key}>{field.label}</TableHead>
              ))}
              {showStatus ? <TableHead>Status</TableHead> : null}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleFields.slice(0, 5).length + (showStatus ? 2 : 1)} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {visibleFields.slice(0, 5).map((field, index) => (
                    <TableCell key={field.key} className={index === 0 ? "font-medium" : undefined}>
                      {formatCell(field, row[field.key])}
                    </TableCell>
                  ))}
                  {showStatus ? <TableCell><StatusBadge status={row.status ?? "ativo"} /></TableCell> : null}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => inactivate(row.id)}>
                        Inativar
                      </Button>
                      <ConfirmDialog
                        title="Excluir registro?"
                        description={remoteCrudEnabled(entity) ? "O registro sera inativado no Supabase." : "No modo demo, isso remove apenas do armazenamento local deste navegador."}
                        confirmLabel={remoteCrudEnabled(entity) ? "Inativar" : "Excluir"}
                        onConfirm={() => remove(row.id)}
                        trigger={
                          <Button variant="outline" size="icon" aria-label={`Excluir ${row[primaryKey] ?? "registro"}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const defaultStatusOptions: Record<string, string> = {
  teste: "Teste",
  ativo: "Ativo",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
  inativo: "Inativo",
};

function remoteCrudEnabled(entity?: string) {
  return Boolean(
    entity &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function formatCell(field: DemoCrudField, value: string | number | undefined) {
  if (value === undefined || value === "") return "-";
  if (field.options) return field.options[String(value)] ?? String(value);
  return String(value);
}

async function downloadProductModel(fields: DemoCrudField[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotações";
  const worksheet = workbook.addWorksheet("Produtos");
  const modelFields = fields.filter((field) => field.type !== "hidden");
  worksheet.columns = modelFields.map((field) => ({
    header: field.label,
    key: field.key,
    width: field.key === "nome" ? 42 : 24,
    style: field.key === "ean" ? { numFmt: "@" } : undefined,
  }));
  worksheet.addRow({
    ean: "7890000000011",
    nome: "Exemplo Produto 50mg c/30",
    laboratorio: "Qualquer",
  });
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0F2FE" },
  };
  worksheet.autoFilter = `A1:${String.fromCharCode(64 + modelFields.length)}1`;
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn("ean").eachCell((cell, rowNumber) => {
    cell.numFmt = "@";
    if (rowNumber > 1) cell.value = String(cell.value ?? "");
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "modelo_produtos.xlsx",
  );
}

function buildEmptyRow(fields: DemoCrudField[]) {
  return fields.reduce<DemoCrudRow>(
    (acc, field) => {
      acc[field.key] = field.defaultValue ?? "";
      return acc;
    },
    { id: "", status: "ativo" },
  );
}

async function parseImportFile(file: File, fields: DemoCrudField[]) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const rows = extension === "xlsx"
    ? await parseXlsx(file, fields)
    : extension === "csv" || extension === "xls"
      ? await parseCsv(file, fields)
      : null;

  if (!rows) throw new Error("Formato não suportado. Use .xlsx, .xls ou .csv.");
  return rows;
}

async function parseCsv(file: File, fields: DemoCrudField[]) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("O arquivo precisa ter cabeçalho e pelo menos uma linha.");
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    return buildImportRow(headers, cells, fields);
  });
}

async function parseXlsx(file: File, fields: DemoCrudField[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Nenhuma aba encontrada no arquivo.");
  const headers = rowValues(worksheet.getRow(1));
  const rows: DemoCrudRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push(buildImportRow(headers, rowValues(row, headers.length), fields));
  });
  return rows;
}

function rowValues(row: { values: unknown; getCell?: (index: number) => { text?: string; value?: unknown } }, length?: number) {
  const count = length ?? (Array.isArray(row.values) ? row.values.length - 1 : 0);
  return Array.from({ length: count }, (_, index) => {
    const cell = row.getCell?.(index + 1);
    return String(cell?.text ?? cell?.value ?? "").trim();
  });
}

function buildImportRow(headers: string[], cells: string[], fields: DemoCrudField[]) {
  const row = { id: crypto.randomUUID(), status: "ativo" } as DemoCrudRow;
  for (const field of fields) {
    const index = headers.findIndex((header) => normalize(header) === normalize(field.label) || normalize(header) === normalize(field.key));
    row[field.key] = index >= 0 ? cells[index] ?? "" : field.defaultValue ?? "";
  }
  return row;
}

function validateImportRows(rows: DemoCrudRow[], fields: DemoCrudField[]) {
  const errors: string[] = [];
  const requiredFields = fields.filter((field) => field.required && field.type !== "hidden");
  rows.forEach((row, index) => {
    for (const field of requiredFields) {
      if (!String(row[field.key] ?? "").trim()) {
        errors.push(`Linha ${index + 2}: ${field.label} é obrigatório.`);
      }
    }
  });
  return errors.slice(0, 20);
}

function rowToFormData(row: DemoCrudRow, fields: DemoCrudField[]) {
  const formData = new FormData();
  fields.forEach((field) => formData.set(field.key, String(row[field.key] ?? "")));
  formData.set("status", String(row.status ?? "ativo"));
  return formData;
}

function toCsv(rows: DemoCrudRow[], fields: DemoCrudField[]) {
  const headers = [...fields.map((field) => field.label), "Status"];
  const body = rows.map((row) =>
    [...fields.map((field) => row[field.key] ?? ""), row.status ?? "ativo"]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(";"),
  );
  return [headers.join(";"), ...body].join("\r\n");
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, fileName);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
