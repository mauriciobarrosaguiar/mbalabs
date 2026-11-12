"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Save, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent } from "@/modules/cotacoes/components/ui/card";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
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
import { Textarea } from "@/modules/cotacoes/components/ui/textarea";
import { getUnitLabel, packageQuantityOptions } from "@/modules/cotacoes/lib/constants";
import {
  formatCurrencyBRFromNumber,
  formatCurrencyBRInput,
  formatCurrencyBRL,
  formatDateBR,
  formatDeadlineDateBR,
  formatInteger,
} from "@/modules/cotacoes/lib/formatters";
import { productTypeLabels, unitLabels } from "@/modules/cotacoes/lib/labels";
import {
  calculateResponseSummary,
  calculateSellerRow,
  getPackageQuantity,
  parseNumberInput,
  validateSellerResponse,
  type SellerResponseRowDraft,
  type SellerResponseSummary as SellerResponseSummaryData,
} from "@/modules/cotacoes/lib/services/seller-response";
import type {
  ModuleType,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

interface SellerIdentity {
  name?: string;
  company?: string;
  whatsapp?: string;
  email?: string;
  billingCompany?: string;
  selectedDistributorIds?: string[];
  paymentTerms?: string;
  deliveryTerms?: string;
  generalObservation?: string;
}

interface SellerResponseFormProps {
  token: string;
  moduleType: ModuleType;
  items: QuotationItem[];
  sellerDefaults?: SellerIdentity;
  initialResponse?: SupplierQuoteResponse;
  initialResponseItems?: SupplierQuoteResponseItem[];
  lockedReason?: string;
  buyerName?: string;
  quotationName?: string;
  deadlineAt?: string;
  minimumEnabled?: boolean;
  distributors?: Array<{ id: string; name: string }>;
}

const deliveryOptions = ["Imediato", "1 dia", "2 dias", "3 dias", "5 dias", "7 dias", "Outro"];

export function SellerResponseForm({
  token,
  moduleType,
  items,
  sellerDefaults,
  initialResponse,
  initialResponseItems = [],
  lockedReason,
  buyerName,
  quotationName,
  deadlineAt,
  minimumEnabled = false,
  distributors = [],
}: SellerResponseFormProps) {
  const isBidding = moduleType === "bidding";
  const [seller, setSeller] = useState<SellerIdentity>(() =>
    readDemoDraft(token, moduleType)?.seller ?? buildSellerIdentity(sellerDefaults, initialResponse),
  );
  const [rows, setRows] = useState<SellerResponseRowDraft[]>(() =>
    readDemoDraft(token, moduleType)?.rows ?? buildInitialRows(moduleType, items, initialResponseItems),
  );
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>(() => {
    const byItem = (initialResponseItems ?? []).map((row) => row.distributorId).filter(Boolean) as string[];
    const byName = (initialResponse?.billingCompany ?? "").split(",").map((name) => name.trim().toLocaleLowerCase("pt-BR"));
    const fromNames = distributors.filter((d) => byName.includes(d.name.trim().toLocaleLowerCase("pt-BR"))).map((d) => d.id);
    const local = readDemoDraft(token, moduleType)?.seller?.selectedDistributorIds ?? [];
    return [...new Set([...byItem, ...fromNames, ...(Array.isArray(local) ? local : [])])];
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [finalSubmitted, setFinalSubmitted] = useState(
    initialResponse?.status === "submitted" || readDemoDraft(token, moduleType)?.status === "submitted",
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(
    readDemoDraft(token, moduleType)?.status === "submitted"
      ? "Resposta enviada em modo demo local."
      : null,
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  const locked = Boolean(lockedReason) || finalSubmitted;
  const summary = useMemo(
    () => calculateResponseSummary(moduleType, items, rows),
    [items, moduleType, rows],
  );

  function updateSeller(patch: Partial<SellerIdentity>) {
    setSeller((current) => ({ ...current, ...patch }));
  }

  function updateRow(quotationItemId: string, patch: Partial<SellerResponseRowDraft>) {
    setRows((current) =>
      current.map((row) =>
        row.quotationItemId === quotationItemId ? { ...row, ...patch } : row,
      ),
    );
  }

  async function saveDraft() {
    setErrors([]);
    await persist("draft");
  }

  async function submitFinal() {
    const validationErrors = validateSellerResponse({ moduleType, items, rows });
    const hasAvailableOffer = items.some((item) => {
      const row = rows.find((candidate) => candidate.quotationItemId === item.id);
      if (!row) return false;
      const calculation = calculateSellerRow(moduleType, item, row);
      return calculation.netPrice > 0 && calculation.status !== "sem_estoque";
    });
    if (!isBidding && hasAvailableOffer) {
      if (!selectedDistributorIds.length) validationErrors.push("Selecione uma ou mais distribuidoras cadastradas na farmácia.");
      for (const item of items) {
        const row = rows.find((entry) => entry.quotationItemId === item.id);
        if (!row) continue;
        const result = calculateSellerRow(moduleType, item, row);
        const distributorId = row.distributorId || (selectedDistributorIds.length === 1 ? selectedDistributorIds[0] : "");
        if (result.netPrice > 0 && result.status !== "sem_estoque" && !selectedDistributorIds.includes(distributorId)) {
          validationErrors.push(`Informe a distribuidora do produto "${item.productName}".`);
        }
      }
    }
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0] ?? "Revise os itens antes de enviar.");
      return;
    }

    const confirmed = window.confirm(
      "Após enviar a cotação, a resposta será bloqueada para edição. Deseja continuar?",
    );
    if (!confirmed) return;

    await persist("submitted");
  }

  async function persist(status: "draft" | "submitted") {
    if (locked && status === "submitted") return;
    setSaving(true);

    try {
      const sellerPayload = { ...seller, selectedDistributorIds,
        billingCompany: selectedDistributorIds.map((id) => distributors.find((d) => d.id === id)?.name).filter(Boolean).join(", ") };
      const useLocalDemoStorage = isLocalBrowser() && token.includes("demo-token");
      if (useLocalDemoStorage) {
        window.localStorage.setItem(
          demoStorageKey(token, moduleType),
          JSON.stringify({ status, moduleType, seller: sellerPayload, rows, updatedAt: new Date().toISOString() }),
        );
      } else if (hasSupabaseBrowserConfig()) {
        const response = await fetch(`/api/cotacoes/public/supplier-response/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleType, status, seller: sellerPayload, rows }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Não foi possível salvar a resposta.");
        }
      } else if (isLocalBrowser()) {
        window.localStorage.setItem(
          demoStorageKey(token, moduleType),
          JSON.stringify({ status, moduleType, seller: sellerPayload, rows, updatedAt: new Date().toISOString() }),
        );
      } else {
        throw new Error(
          "Este ambiente de demonstração não grava respostas reais. Configure o Supabase para salvar no banco.",
        );
      }

      if (status === "submitted") {
        setFinalSubmitted(true);
        const message = isBidding
          ? "Resposta enviada com sucesso."
          : "Cotação enviada com sucesso. O comprador analisará os preços informados.";
        setSuccessMessage(message);
        toast.success(message);
      } else {
        toast.success(
          hasSupabaseBrowserConfig()
            ? "Rascunho salvo com sucesso."
            : "Rascunho salvo em modo demo local.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar resposta.");
    } finally {
      setSaving(false);
    }
  }

  async function exportPharmacyExcel() {
    if (isBidding) return;
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cotação");
    worksheet.columns = [
      { header: "Cód.", key: "code", width: 10 },
      { header: "Descrição", key: "description", width: 42 },
      { header: "Laboratório solicitado", key: "laboratory", width: 24 },
      { header: "Qtd", key: "quantity", width: 12 },
      { header: "Preço", key: "price", width: 16 },
      { header: "Obs.", key: "observation", width: 34 },
      { header: "EAN", key: "ean", width: 18, hidden: true },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn("price").numFmt = '"R$" #,##0.00';
    worksheet.getColumn("ean").numFmt = "@";

    for (const item of items) {
      const row = findRow(rows, item.id);
      const price = parseNumberInput(row.netPrice);
      worksheet.addRow({
        code: String(item.itemNumber),
        description: item.productName,
        laboratory: item.requestedLaboratory ?? "Qualquer",
        quantity: item.requestedQuantity,
        price: price > 0 ? price : undefined,
        observation: row.observation ?? "",
        ean: item.ean ? String(item.ean) : "",
      });
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle" };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `cotacao_${sanitizeFileName(buyerName || "cliente")}_${formatDateBR(new Date().toISOString()).replaceAll("/", "-")}.xlsx`,
    );
  }

  async function importPharmacyExcel(file?: File) {
    if (!file || isBidding) return;
    try {
      const parsedRows = await parsePharmacyPriceFile(file);
      let imported = 0;
      let ignored = 0;
      setRows((current) => {
        const nextRows = [...current];
        for (const parsed of parsedRows) {
          const item = items.find((candidate) => String(candidate.itemNumber) === parsed.code);
          if (!item || parsed.price === undefined) {
            ignored += 1;
            continue;
          }
          const index = nextRows.findIndex((row) => row.quotationItemId === item.id);
          const patch: SellerResponseRowDraft = {
            ...(index >= 0 ? nextRows[index] : { quotationItemId: item.id }),
            netPrice: formatCurrencyBRFromNumber(parsed.price),
            observation: parsed.observation,
          };
          if (index >= 0) nextRows[index] = patch;
          else nextRows.push(patch);
          imported += 1;
        }
        return nextRows;
      });
      toast.success(`${imported} preços importados com sucesso. ${ignored} linhas ignoradas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar a planilha.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  if (items.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-5 text-sm text-amber-900">
          Esta cotação não possui itens disponíveis para resposta.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {(lockedReason || successMessage) ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex gap-3 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {successMessage ?? lockedReason}
              </p>
              <p className="mt-1 text-emerald-800">
                Os campos ficam somente leitura e a farmácia/comprador analisará a resposta enviada.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {errors.length > 0 ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="space-y-2 p-4 text-sm text-red-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              Corrija antes de enviar
            </div>
            <ul className="list-inside list-disc space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <SellerResponseSummary
        totalAmount={summary.totalAmount}
        respondedItems={summary.respondedItems}
        totalItems={summary.totalItems}
        missingItems={summary.missingItems}
        partialItems={summary.partialItems}
        outOfStockItems={summary.outOfStockItems}
        locked={locked}
        submitted={finalSubmitted}
        moduleType={moduleType}
      />

      <section className="min-w-0 rounded-md border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        {!isBidding ? (
          <div className="mb-4 rounded-md bg-teal-50 p-3 text-sm text-teal-900">
            <p className="font-semibold">{buyerName ?? "Cliente"} · {quotationName ?? "Cotação"}</p>
            <p className="mt-1">Informe os preços dos produtos abaixo{deadlineAt ? ` até ${formatDeadlineDateBR(deadlineAt)}` : ""}.</p>
          </div>
        ) : null}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Seu nome" value={seller.name} disabled={locked} onChange={(value) => updateSeller({ name: value })} />
          <TextField label="Empresa" value={seller.company} disabled={locked} onChange={(value) => updateSeller({ company: value })} />
          <TextField label="WhatsApp" value={seller.whatsapp} disabled={locked} onChange={(value) => updateSeller({ whatsapp: value })} />
          <TextField label="E-mail opcional" value={seller.email} disabled={locked} onChange={(value) => updateSeller({ email: value })} />
          {isBidding ? (
            <>
              <TextField label="Prazo geral" value={seller.deliveryTerms} disabled={locked} onChange={(value) => updateSeller({ deliveryTerms: value })} />
              <TextField label="Observação geral" value={seller.generalObservation} disabled={locked} onChange={(value) => updateSeller({ generalObservation: value })} />
            </>
          ) : null}
        </div>
        {!isBidding ? (
          <div className="mt-4 space-y-3 rounded-md border border-teal-200 bg-teal-50 p-3">
            <p className="font-semibold text-teal-950">Distribuidoras para faturamento</p>
            <p className="text-sm text-teal-900">Marque uma ou várias distribuidoras cadastradas pela farmácia. Em cada produto, escolha qual vai faturá-lo.</p>
            {distributors.length ? <details className="rounded-md border border-teal-200 bg-white">
              <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-teal-950">
                {selectedDistributorIds.length
                  ? `${selectedDistributorIds.length} distribuidora(s) selecionada(s): ${distributors.filter((d) => selectedDistributorIds.includes(d.id)).map((d) => d.name).join(", ")}`
                  : "Toque para selecionar distribuidoras"}
              </summary>
              <div className="grid gap-2 border-t border-teal-100 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {distributors.map((d) => <label key={d.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border bg-white p-3 text-sm">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-teal-700" disabled={locked || saving}
                  checked={selectedDistributorIds.includes(d.id)} onChange={(e) => {
                    const next = e.target.checked ? [...selectedDistributorIds, d.id] : selectedDistributorIds.filter((id) => id !== d.id);
                    setSelectedDistributorIds(next);
                    if (!e.target.checked) setRows((old) => old.map((row) => row.distributorId === d.id ? { ...row, distributorId: undefined } : row));
                  }} />
                <span className="min-w-0 break-words">{d.name}</span>
              </label>)}
              </div>
            </details> : <p className="text-sm text-amber-800">A farmácia precisa cadastrar distribuidoras ativas para receber a cotação.</p>}
            {minimumEnabled ? <p className="text-xs text-teal-900">O pedido mínimo será verificado por distribuidora.</p> : null}
          </div>
        ) : null}
        {!isBidding ? (
          <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-teal-700">Informações adicionais opcionais</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TextField label="Condição de pagamento" value={seller.paymentTerms} disabled={locked} onChange={(value) => updateSeller({ paymentTerms: value })} />
              <TextField label="Observação geral" value={seller.generalObservation} disabled={locked} onChange={(value) => updateSeller({ generalObservation: value })} />
            </div>
          </details>
        ) : null}
      </section>

      <div className="hidden min-w-0 overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm lg:block">
        {isBidding ? (
          <BiddingDesktopGrid items={items} rows={rows} locked={locked || saving} updateRow={updateRow} />
        ) : (
          <PharmacyDesktopGrid items={items} rows={rows} locked={locked || saving} updateRow={updateRow} distributors={distributors.filter((d) => selectedDistributorIds.includes(d.id))} />
        )}
      </div>

      <div className="grid min-w-0 gap-3 lg:hidden">
        {items.map((item) => {
          const row = findRow(rows, item.id);
          return (
            <SellerResponseMobileCard
              key={item.id}
              item={item}
              row={row}
              moduleType={moduleType}
              locked={locked || saving}
              updateRow={updateRow}
              distributors={distributors.filter((d) => selectedDistributorIds.includes(d.id))}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isBidding
            ? "Dados do comprador ficam travados. Você responde apenas sua oferta, preço, quantidade, prazo e observação."
            : "Dados da farmácia ficam travados. Informe preço e, quando souber, estoque e quantidade disponível. Observação e equivalente autorizado são opcionais."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isBidding ? (
            <>
              <Button type="button" variant="outline" size="lg" disabled={saving} onClick={exportPharmacyExcel}>
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={locked || saving} onClick={() => importInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Importar Excel
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => {
                  void importPharmacyExcel(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
          <Button type="button" variant="outline" size="lg" disabled={locked || saving} onClick={saveDraft}>
            <Save className="h-4 w-4" />
            Salvar rascunho
          </Button>
          <Button type="button" size="lg" disabled={locked || saving} onClick={submitFinal}>
            <Send className="h-4 w-4" />
            Enviar cotação
          </Button>
        </div>
      </div>
    </div>
  );
}

function PharmacyDesktopGrid({
  items,
  rows,
  locked,
  updateRow,
  distributors,
}: {
  items: QuotationItem[];
  rows: SellerResponseRowDraft[];
  locked: boolean;
  updateRow: (quotationItemId: string, patch: Partial<SellerResponseRowDraft>) => void;
  distributors: Array<{ id: string; name: string }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead>Cód.</TableHead>
          <TableHead className="min-w-56">Descrição</TableHead>
          <TableHead>Lab. solicitado</TableHead>
          <TableHead>Qtd</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead className="min-w-52">Estoque / qtd. disponível</TableHead>
          <TableHead className="min-w-40">Distribuidora</TableHead>
          <TableHead className="min-w-52">Produto alternativo / obs.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const row = findRow(rows, item.id);
          return (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs">{item.itemNumber}</TableCell>
              <TableCell>
                <PharmacyReadOnlyProduct item={item} />
              </TableCell>
              <TableCell>{item.requestedLaboratory ?? "Qualquer"}</TableCell>
              <TableCell title={getUnitLabel(item.requestedUnit)}>{formatInteger(item.requestedQuantity)}</TableCell>
              <TableCell>
                <PriceInput
                  value={row.netPrice}
                  disabled={locked}
                  onChange={(value) => updateRow(item.id, { netPrice: value })}
                />
              </TableCell>
              <TableCell>
                <PharmacyStockInputs item={item} row={row} locked={locked} onChange={(patch) => updateRow(item.id, patch)} />
            <DistributorSelect distributors={distributors} value={row.distributorId || (distributors.length === 1 ? distributors[0].id : "")} disabled={locked} itemName={item.productName} onChange={(id) => updateRow(item.id, { distributorId: id })} />
              </TableCell>
              <TableCell><DistributorSelect distributors={distributors} value={row.distributorId || (distributors.length === 1 ? distributors[0].id : "")} disabled={locked} itemName={item.productName} onChange={(id) => updateRow(item.id, { distributorId: id })} /></TableCell>
              <TableCell>
                {item.acceptEquivalent ? (
                  <CompactInput
                    value={row.offeredProductName === item.productName ? "" : row.offeredProductName}
                    disabled={locked}
                    placeholder="Outro produto (se equivalente)"
                    onChange={(value) => updateRow(item.id, { offeredProductName: value || item.productName })}
                  />
                ) : (
                  <p className="mb-1 text-xs text-slate-500">Equivalente não autorizado</p>
                )}
                <CompactInput value={row.observation} placeholder="Observação opcional" disabled={locked} onChange={(value) => updateRow(item.id, { observation: value })} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DistributorSelect({ distributors, value, disabled, itemName, onChange }: {
  distributors: Array<{ id: string; name: string }>;
  value?: string; disabled: boolean; itemName: string; onChange: (id: string) => void;
}) {
  return <label className="block min-w-0 space-y-1 text-xs font-medium text-slate-700">
    <span>Distribuidora do produto</span>
    <select className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
      value={value ?? ""} disabled={disabled || !distributors.length}
      aria-label={`Distribuidora de ${itemName}`} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione a distribuidora</option>
      {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  </label>;
}

function PharmacyStockInputs({
  item, row, locked, onChange,
}: {
  item: QuotationItem;
  row: SellerResponseRowDraft;
  locked: boolean;
  onChange: (patch: Partial<SellerResponseRowDraft>) => void;
}) {
  const available = row.hasStock !== "nao";
  return (
    <div className="grid gap-2">
      <label className="text-xs font-medium text-slate-700">
        Disponibilidade
        <select
          className="mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
          aria-label={`Disponibilidade de ${item.productName}`}
          value={row.hasStock ?? ""}
          disabled={locked}
          onChange={(event) => onChange({
            hasStock: event.target.value === "sim" ? "sim" : event.target.value === "nao" ? "nao" : undefined,
            ...(event.target.value === "nao" ? { attendedQuantity: "" } : {}),
          })}
        >
          <option value="">Não informada</option>
          <option value="sim">Disponível</option>
          <option value="nao">Sem estoque</option>
        </select>
      </label>
      {available ? (
        <label className="text-xs font-medium text-slate-700">
          Quantidade disponível (opcional)
          <Input
            type="number" min={1} max={item.requestedQuantity} step="1"
            inputMode="numeric"
            className="mt-1 h-9 bg-white text-sm"
            value={row.attendedQuantity ?? ""}
            disabled={locked}
            placeholder={`Até ${item.requestedQuantity}`}
            onChange={(event) => onChange({
              attendedQuantity: event.target.value,
              hasStock: event.target.value ? "sim" : row.hasStock,
            })}
          />
        </label>
      ) : null}
      <p className="text-xs text-slate-500">
        {row.hasStock === "nao"
          ? "Este produto não participará do julgamento."
          : row.attendedQuantity?.trim()
            ? `Quantidade declarada: ${row.attendedQuantity} de ${item.requestedQuantity}.`
            : "Se informar apenas preço, a quantidade integral será presumida, sem confirmação de estoque."}
      </p>
      {!item.allowPartialSupply ? (
        <p className="text-xs text-amber-800">A farmácia não permite atendimento parcial deste item.</p>
      ) : null}
    </div>
  );
}

function BiddingDesktopGrid({
  items,
  rows,
  locked,
  updateRow,
}: {
  items: QuotationItem[];
  rows: SellerResponseRowDraft[];
  locked: boolean;
  updateRow: (quotationItemId: string, patch: Partial<SellerResponseRowDraft>) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead>Cód.</TableHead>
          <TableHead className="min-w-56">Descrição solicitada</TableHead>
          <TableHead>Qtd pedida</TableHead>
          <TableHead>Unid.</TableHead>
          <TableHead className="min-w-44">Produto ofertado</TableHead>
          <TableHead className="min-w-36">Lab./marca</TableHead>
          <TableHead>Unid. ofertada</TableHead>
          <TableHead>Qtd/emb.</TableHead>
          <TableHead>Preço emb.</TableHead>
          <TableHead>Preço un.</TableHead>
          <TableHead>Qtd atendida</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead>Total</TableHead>
          <TableHead className="min-w-52">Obs.</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const row = findRow(rows, item.id);
          const calculation = calculateSellerRow("bidding", item, row);
          return (
            <TableRow key={item.id} className={calculation.status === "sem_resposta" ? "bg-amber-50/40" : ""}>
              <TableCell className="font-mono text-xs">{item.itemNumber}</TableCell>
              <TableCell><ReadOnlyProduct item={item} /></TableCell>
              <TableCell>{formatInteger(item.requestedQuantity)}</TableCell>
              <TableCell>{getUnitLabel(item.requestedUnit)}</TableCell>
              <TableCell>
                <CompactInput value={row.offeredProductName} disabled={locked} onChange={(value) => updateRow(item.id, { offeredProductName: value })} />
              </TableCell>
              <TableCell>
                <CompactInput value={row.offeredLaboratory} disabled={locked} onChange={(value) => updateRow(item.id, { offeredLaboratory: value })} />
              </TableCell>
              <TableCell>
                <UnitSelectCompact value={row.offeredUnit} disabled={locked} onChange={(value) => updateRow(item.id, { offeredUnit: value })} />
              </TableCell>
              <TableCell>
                <PackageQuantityCompact row={row} disabled={locked} onChange={(patch) => updateRow(item.id, patch)} />
              </TableCell>
              <TableCell>
                <CompactInput value={row.packagePrice} placeholder="0,00" disabled={locked} onChange={(value) => updateRow(item.id, { packagePrice: value })} />
              </TableCell>
              <TableCell className="font-semibold">{formatCurrencyBRL(calculation.convertedUnitPrice)}</TableCell>
              <TableCell>
                <CompactInput value={row.attendedQuantity} placeholder={formatInteger(item.requestedQuantity)} disabled={locked} onChange={(value) => updateRow(item.id, { attendedQuantity: value, hasFullQuantity: "nao" })} />
              </TableCell>
              <TableCell>
                <DeliverySelect value={row.deliveryText} disabled={locked} onChange={(value) => updateRow(item.id, { deliveryText: value })} />
              </TableCell>
              <TableCell className="font-semibold">{formatCurrencyBRL(calculation.itemTotal)}</TableCell>
              <TableCell>
                <CompactInput value={row.observation} disabled={locked} onChange={(value) => updateRow(item.id, { observation: value })} />
              </TableCell>
              <TableCell><RowStatus status={calculation.status} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SellerResponseMobileCard({
  item,
  row,
  moduleType,
  locked,
  updateRow,
  distributors,
}: {
  item: QuotationItem;
  row: SellerResponseRowDraft;
  moduleType: ModuleType;
  locked: boolean;
  updateRow: (quotationItemId: string, patch: Partial<SellerResponseRowDraft>) => void;
  distributors: Array<{ id: string; name: string }>;
}) {
  const calculation = calculateSellerRow(moduleType, item, row);
  const isBidding = moduleType === "bidding";

  if (!isBidding) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Item {item.itemNumber}</p>
            <h3 className="font-semibold text-slate-950">{item.productName}</h3>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
              <span title={getUnitLabel(item.requestedUnit)}>Qtd: {formatInteger(item.requestedQuantity)}</span>
              <span>Lab. solicitado: {item.requestedLaboratory ?? "Qualquer"}</span>
            </div>
          </div>

          <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-teal-700">Ver detalhes</summary>
            <div className="mt-2 grid gap-1 text-muted-foreground">
              <span>Tipo: {productTypeLabels[item.productType] ?? item.productType}</span>
              {item.buyerObservation ? <span>Obs. farmácia: {item.buyerObservation}</span> : null}
            </div>
          </details>

          <div className="grid gap-3">
            <PriceField
              label="Preço"
              value={row.netPrice}
              disabled={locked}
              onChange={(value) => updateRow(item.id, { netPrice: value })}
            />
            <PharmacyStockInputs item={item} row={row} locked={locked} onChange={(patch) => updateRow(item.id, patch)} />
            <DistributorSelect
              distributors={distributors}
              value={row.distributorId || (distributors.length === 1 ? distributors[0].id : "")}
              disabled={locked || row.hasStock === "nao"}
              itemName={item.productName}
              onChange={(id) => updateRow(item.id, { distributorId: id })}
            />
            {item.acceptEquivalent ? (
              <TextField
                label="Produto equivalente ofertado (opcional)"
                value={row.offeredProductName === item.productName ? "" : row.offeredProductName}
                placeholder="Nome/apresentação do produto alternativo"
                disabled={locked}
                onChange={(value) => updateRow(item.id, { offeredProductName: value || item.productName })}
              />
            ) : (
              <p className="text-xs text-slate-600">Esta cotação não permite produto equivalente para este item.</p>
            )}
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={row.observation ?? ""} disabled={locked} onChange={(event) => updateRow(item.id, { observation: event.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Item {item.itemNumber}</p>
            <h3 className="font-semibold text-slate-950">{item.productName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Qtd pedida: {formatInteger(item.requestedQuantity)} {getUnitLabel(item.requestedUnit)}
            </p>
            <p className="text-sm text-muted-foreground">
              Lab. solicitado: {item.requestedLaboratory ?? "Qualquer"}
            </p>
          </div>
          <RowStatus status={calculation.status} />
        </div>

        <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-teal-700">Ver detalhes do item</summary>
          <div className="mt-2 grid gap-1 text-muted-foreground">
            <span>Tipo: {productTypeLabels[item.productType] ?? item.productType}</span>
            {item.minimumValidity ? <span>Validade mínima: {item.minimumValidity}</span> : null}
            <span>Registro MS obrigatório: {item.msRegistrationRequired ? "Sim" : "Não"}</span>
            {item.buyerObservation ? <span>Obs. comprador: {item.buyerObservation}</span> : null}
          </div>
        </details>

        <div className="grid gap-3">
          <TextField label="Produto ofertado" value={row.offeredProductName} disabled={locked} onChange={(value) => updateRow(item.id, { offeredProductName: value })} />
          <TextField label="Laboratório/marca ofertada" value={row.offeredLaboratory} disabled={locked} onChange={(value) => updateRow(item.id, { offeredLaboratory: value })} />
          <LabeledSelect label="Unidade ofertada">
            <UnitSelectCompact value={row.offeredUnit} disabled={locked} onChange={(value) => updateRow(item.id, { offeredUnit: value })} />
          </LabeledSelect>
          <LabeledSelect label="Quantidade por embalagem">
            <PackageQuantityCompact row={row} disabled={locked} onChange={(patch) => updateRow(item.id, patch)} />
          </LabeledSelect>
          <TextField label="Preço da embalagem" value={row.packagePrice} disabled={locked} onChange={(value) => updateRow(item.id, { packagePrice: value })} />

          <TextField label="Quantidade atendida" value={row.attendedQuantity} placeholder={formatInteger(item.requestedQuantity)} disabled={locked} onChange={(value) => updateRow(item.id, { attendedQuantity: value, hasFullQuantity: "nao" })} />
          <LabeledSelect label="Prazo de entrega">
            <DeliverySelect value={row.deliveryText} disabled={locked} onChange={(value) => updateRow(item.id, { deliveryText: value })} />
          </LabeledSelect>
          <div className="space-y-2">
            <Label>Observação do item</Label>
            <Textarea value={row.observation ?? ""} disabled={locked} onChange={(event) => updateRow(item.id, { observation: event.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
          <SummaryCell label="Preço por unidade" value={formatCurrencyBRL(calculation.netPrice)} />
          <SummaryCell label="Total do item" value={formatCurrencyBRL(calculation.itemTotal)} />
          <SummaryCell label="Embalagens" value={formatInteger(calculation.packagesToBuy)} />
          {calculation.quantityShortage > 0 ? <SummaryCell label="Saldo faltante" value={formatInteger(calculation.quantityShortage)} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SellerResponseSummary({
  totalAmount,
  respondedItems,
  totalItems,
  missingItems,
  partialItems,
  outOfStockItems,
  locked,
  submitted,
  moduleType,
}: SellerResponseSummaryData & { locked: boolean; submitted: boolean; moduleType: ModuleType }) {
  if (moduleType === "pharmacy") {
    return (
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryBox label="Total informado" value={formatCurrencyBRL(totalAmount)} tone="strong" />
        <SummaryBox label="Itens respondidos" value={`${respondedItems} de ${totalItems}`} />
        <SummaryBox label="Sem preço" value={formatInteger(missingItems)} />
        <SummaryBox label="Status" value={submitted ? "Enviada" : "Em preenchimento"} />
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      <SummaryBox label="Total geral" value={formatCurrencyBRL(totalAmount)} tone="strong" />
      <SummaryBox label="Itens respondidos" value={`${respondedItems} de ${totalItems}`} />
      <SummaryBox label="Sem resposta" value={formatInteger(missingItems)} />
      <SummaryBox label="Parciais" value={formatInteger(partialItems)} />
      <SummaryBox label="Status" value={locked ? "Bloqueada" : "Em preenchimento"} />
      {outOfStockItems > 0 ? <SummaryBox label="Sem estoque" value={formatInteger(outOfStockItems)} /> : null}
    </section>
  );
}

function ReadOnlyProduct({ item }: { item: QuotationItem }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-slate-950">{item.productName}</p>
      <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">
        {item.buyerObservation ?? productTypeLabels[item.productType] ?? item.productType}
      </p>
    </div>
  );
}

function PharmacyReadOnlyProduct({ item }: { item: QuotationItem }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-slate-950">{item.productName}</p>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-medium text-teal-700">Ver detalhes</summary>
        <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
          <span>Tipo: {productTypeLabels[item.productType] ?? item.productType}</span>
          {item.buyerObservation ? <span>Obs. farmácia: {item.buyerObservation}</span> : null}
        </div>
      </details>
    </div>
  );
}

function RowStatus({ status }: { status: ReturnType<typeof calculateSellerRow>["status"] }) {
  const map = {
    respondido: { label: "Respondido", className: "bg-emerald-50 text-emerald-700" },
    sem_resposta: { label: "Sem resposta", className: "bg-amber-50 text-amber-700" },
    parcial: { label: "Parcial", className: "bg-blue-50 text-blue-700" },
    sem_estoque: { label: "Sem estoque", className: "bg-red-50 text-red-700" },
  };
  return <Badge className={map[status].className}>{map[status].label}</Badge>;
}

function CompactInput({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 min-w-24 rounded-md text-sm"
    />
  );
}

function PriceInput({
  value,
  disabled,
  invalid,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      value={value ?? ""}
      placeholder="0,00"
      disabled={disabled}
      inputMode="numeric"
      onKeyDown={(event) => {
        if ([".", ",", "-", "+", "e", "E"].includes(event.key)) {
          event.preventDefault();
        }
      }}
      onChange={(event) => onChange(formatCurrencyBRInput(event.target.value))}
      aria-invalid={invalid}
      className={`h-8 min-w-24 rounded-md text-sm ${invalid ? "border-red-500 ring-1 ring-red-500" : ""}`}
    />
  );
}

function PriceField({
  label,
  value,
  disabled,
  invalid,
  onChange,
}: {
  label: string;
  value?: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <PriceInput value={value} disabled={disabled} invalid={invalid} onChange={onChange} />
      {invalid ? <p className="text-xs text-red-600">Informe um preço maior que zero.</p> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DeliverySelect({
  value,
  disabled,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? ""} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-28">
        <SelectValue placeholder="Prazo" />
      </SelectTrigger>
      <SelectContent>
        {deliveryOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UnitSelectCompact({
  value,
  disabled,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? ""} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-32">
        <SelectValue placeholder="Unidade" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(unitLabels)
          .filter(([code]) => code !== "CX")
          .map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function PackageQuantityCompact({
  row,
  disabled,
  onChange,
}: {
  row: SellerResponseRowDraft;
  disabled?: boolean;
  onChange: (patch: Partial<SellerResponseRowDraft>) => void;
}) {
  return (
    <div className="grid gap-2">
      <Select
        value={row.packageQuantity ?? ""}
        disabled={disabled}
        onValueChange={(value) => onChange({ packageQuantity: value })}
      >
        <SelectTrigger className="h-8 min-w-28">
          <SelectValue placeholder="Qtd" />
        </SelectTrigger>
        <SelectContent>
          {packageQuantityOptions.map((quantity) => (
            <SelectItem key={quantity} value={String(quantity)}>
              {quantity}
            </SelectItem>
          ))}
          <SelectItem value="outro">Outro</SelectItem>
        </SelectContent>
      </Select>
      {row.packageQuantity === "outro" ? (
        <Input
          value={row.packageQuantityOther ?? ""}
          disabled={disabled}
          placeholder="Manual"
          onChange={(event) => onChange({ packageQuantityOther: event.target.value })}
          className="h-8"
        />
      ) : null}
      {getPackageQuantity(row) > 0 ? null : (
        <span className="text-xs text-amber-700">Informe a embalagem</span>
      )}
    </div>
  );
}

function LabeledSelect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "strong";
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "strong" ? "mt-1 text-lg font-semibold text-teal-700" : "mt-1 font-semibold text-slate-950"}>
        {value}
      </p>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function findRow(rows: SellerResponseRowDraft[], quotationItemId: string) {
  return rows.find((row) => row.quotationItemId === quotationItemId) ?? {
    quotationItemId,
  };
}

function buildSellerIdentity(
  defaults?: SellerIdentity,
  response?: SupplierQuoteResponse,
): SellerIdentity {
  return {
    name: response?.sellerName ?? defaults?.name ?? "",
    company: response?.sellerCompany ?? defaults?.company ?? "",
    whatsapp: response?.sellerWhatsapp ?? defaults?.whatsapp ?? "",
    email: response?.sellerEmail ?? defaults?.email ?? "",
    billingCompany: response?.billingCompany ?? defaults?.billingCompany ?? "",
    paymentTerms: response?.paymentTerms ?? defaults?.paymentTerms ?? "",
    deliveryTerms: response?.deliveryTerms ?? defaults?.deliveryTerms ?? "",
    generalObservation: response?.generalObservation ?? defaults?.generalObservation ?? "",
  };
}

function buildInitialRows(
  moduleType: ModuleType,
  items: QuotationItem[],
  responseItems: SupplierQuoteResponseItem[],
): SellerResponseRowDraft[] {
  return items.map((item) => {
    const existing = responseItems.find((responseItem) => responseItem.quotationItemId === item.id);
    if (moduleType === "bidding") {
      return {
        quotationItemId: item.id,
        offeredProductName: existing?.offeredProductName ?? item.productName,
        offeredLaboratory: existing?.offeredLaboratory ?? item.requestedLaboratory ?? "",
        offeredUnit: existing?.offeredUnit ?? item.requestedUnit,
        packageQuantity: existing?.packageQuantity ? String(existing.packageQuantity) : "",
        packagePrice: existing?.packagePrice ? String(existing.packagePrice).replace(".", ",") : "",
        hasFullQuantity: existing?.hasFullQuantity === false ? "nao" : "sim",
        attendedQuantity: existing?.availableQuantity ? String(existing.availableQuantity) : "",
        deliveryText: existing?.deliveryTermText ?? (existing?.deliveryDays ? `${existing.deliveryDays} dias` : ""),
        observation: existing?.sellerObservation ?? "",
      };
    }

    return {
      quotationItemId: item.id,
      offeredProductName: existing?.offeredProductName ?? item.productName,
      offeredLaboratory: existing?.offeredLaboratory ?? item.requestedLaboratory ?? "",
      grossPrice: existing?.grossPrice
        ? formatCurrencyBRFromNumber(existing.grossPrice)
        : existing?.unitPrice
          ? formatCurrencyBRFromNumber(existing.unitPrice)
          : "",
      extraDiscount: existing?.extraDiscount ? formatCurrencyBRFromNumber(existing.extraDiscount) : "",
      netPrice: (existing?.netPrice ?? existing?.unitPrice)
        ? formatCurrencyBRFromNumber(existing.netPrice ?? existing.unitPrice)
        : "",
      attendedQuantity: existing?.availableQuantity != null && existing.availableQuantity > 0 ? String(existing.availableQuantity) : "",
      // Sem resposta explícita de estoque, não presumir confirmação física.
      hasStock: existing?.hasStock === false ? "nao" :
        existing?.availableQuantity != null ? "sim" : undefined,
      deliveryText: existing?.deliveryTermText ?? (existing?.deliveryDays ? `${existing.deliveryDays} dias` : ""),
      observation: existing?.sellerObservation ?? "",
      distributorId: existing?.distributorId ?? undefined,
    };
  });
}

type ParsedPharmacyPriceRow = {
  code: string;
  price?: number;
  observation?: string;
};

async function parsePharmacyPriceFile(file: File): Promise<ParsedPharmacyPriceRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parsePharmacyCsv(await file.text());
  if (extension === "xlsx" || extension === "xls") return parsePharmacyWorkbook(file);
  throw new Error("Envie um arquivo .xlsx, .xls ou .csv.");
}

async function parsePharmacyWorkbook(file: File): Promise<ParsedPharmacyPriceRow[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("Não foi possível ler a planilha. Use o modelo exportado pelo sistema.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("A planilha não possui abas para importar.");

  const headerRow = worksheet.getRow(1);
  const headers = (headerRow.values as unknown[]).slice(1);
  const codeIndex = findColumnIndex(headers, ["cod", "codigo", "código"]);
  const priceIndex = findColumnIndex(headers, ["preco", "preço", "valor"]);
  const observationIndex = findColumnIndex(headers, ["obs", "observacao", "observação"]);

  if (!codeIndex || !priceIndex) {
    throw new Error("A planilha precisa ter as colunas Cód. e Preço.");
  }

  const parsed: ParsedPharmacyPriceRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellText(row.getCell(codeIndex)).trim();
    if (!code) return;
    const priceCell = row.getCell(priceIndex);
    const rawPrice = cellText(priceCell).trim();
    const price = rawPrice ? parseImportedPrice(priceCell.value, rawPrice) : undefined;
    parsed.push({
      code,
      price: price && price > 0 ? price : undefined,
      observation: observationIndex ? cellText(row.getCell(observationIndex)).trim() : "",
    });
  });
  return parsed;
}

function parsePharmacyCsv(text: string): ParsedPharmacyPriceRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error("O arquivo CSV está vazio.");

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const codeIndex = findColumnIndex(headers, ["cod", "codigo", "código"]);
  const priceIndex = findColumnIndex(headers, ["preco", "preço", "valor"]);
  const observationIndex = findColumnIndex(headers, ["obs", "observacao", "observação"]);

  if (!codeIndex || !priceIndex) {
    throw new Error("O CSV precisa ter as colunas Cód. e Preço.");
  }

  return lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line, delimiter);
    const code = cells[codeIndex - 1]?.trim() ?? "";
    if (!code) return [];
    const rawPrice = cells[priceIndex - 1]?.trim() ?? "";
    const price = rawPrice ? parseImportedPrice(rawPrice, rawPrice) : undefined;
    return [{
      code,
      price: price && price > 0 ? price : undefined,
      observation: observationIndex ? cells[observationIndex - 1]?.trim() ?? "" : "",
    }];
  });
}

function findColumnIndex(headers: unknown[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(String(header ?? ""))));
  return index >= 0 ? index + 1 : 0;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function cellText(cell: { text?: string; value?: unknown }) {
  if (cell.text) return cell.text;
  if (cell.value == null) return "";
  return String(cell.value);
}

function parseImportedPrice(value: unknown, fallback: string) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "result" in value && typeof value.result === "number") {
    return value.result;
  }

  const text = String(fallback ?? value ?? "").trim();
  const withoutCurrency = text.replace(/[R$\s]/g, "");
  if (!withoutCurrency.includes(",") && /^\d+(\.\d{1,6})?$/.test(withoutCurrency)) {
    return Number(withoutCurrency);
  }

  return parseNumberInput(text);
}

function detectCsvDelimiter(line: string) {
  return line.includes(";") ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function sanitizeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "cotacao";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function demoStorageKey(token: string, moduleType: ModuleType) {
  return `cotafarma-demo-public-response-${moduleType}-${token}`;
}

function readDemoDraft(token: string, moduleType: ModuleType) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(demoStorageKey(token, moduleType));
    if (!raw) return null;
    return JSON.parse(raw) as {
      status?: "draft" | "submitted";
      seller?: SellerIdentity;
      rows?: SellerResponseRowDraft[];
    };
  } catch {
    return null;
  }
}

function hasSupabaseBrowserConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
