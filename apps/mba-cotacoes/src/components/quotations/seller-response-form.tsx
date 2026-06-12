"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Save, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getUnitLabel, packageQuantityOptions } from "@/lib/constants";
import {
  formatCurrencyBRFromNumber,
  formatCurrencyBRInput,
  formatCurrencyBRL,
  formatDateBR,
  formatInteger,
} from "@/lib/formatters";
import { productTypeLabels, unitLabels } from "@/lib/labels";
import {
  calculateResponseSummary,
  calculateSellerRow,
  getPackageQuantity,
  parseNumberInput,
  validateSellerResponse,
  type SellerResponseRowDraft,
  type SellerResponseSummary as SellerResponseSummaryData,
} from "@/lib/services/seller-response";
import type {
  ModuleType,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/lib/types";

interface SellerIdentity {
  name?: string;
  company?: string;
  whatsapp?: string;
  email?: string;
  billingCompany?: string;
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
}: SellerResponseFormProps) {
  const isBidding = moduleType === "bidding";
  const [seller, setSeller] = useState<SellerIdentity>(() =>
    readDemoDraft(token, moduleType)?.seller ?? buildSellerIdentity(sellerDefaults, initialResponse),
  );
  const [rows, setRows] = useState<SellerResponseRowDraft[]>(() =>
    readDemoDraft(token, moduleType)?.rows ?? buildInitialRows(moduleType, items, initialResponseItems),
  );
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
      const useLocalDemoStorage = isLocalBrowser() && token.includes("demo-token");
      if (useLocalDemoStorage) {
        window.localStorage.setItem(
          demoStorageKey(token, moduleType),
          JSON.stringify({ status, moduleType, seller, rows, updatedAt: new Date().toISOString() }),
        );
      } else if (hasSupabaseBrowserConfig()) {
        const response = await fetch(`/api/public/supplier-response/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleType, status, seller, rows }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Não foi possível salvar a resposta.");
        }
      } else if (isLocalBrowser()) {
        window.localStorage.setItem(
          demoStorageKey(token, moduleType),
          JSON.stringify({ status, moduleType, seller, rows, updatedAt: new Date().toISOString() }),
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

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        {!isBidding ? (
          <div className="mb-4 rounded-md bg-teal-50 p-3 text-sm text-teal-900">
            <p className="font-semibold">{buyerName ?? "Cliente"} · {quotationName ?? "Cotação"}</p>
            <p className="mt-1">Informe os preços dos produtos abaixo{deadlineAt ? ` até ${formatDateBR(deadlineAt)}` : ""}.</p>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-4">
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
          <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-teal-700">Informações adicionais opcionais</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TextField label="Faturamento/distribuidora" value={seller.billingCompany} disabled={locked} onChange={(value) => updateSeller({ billingCompany: value })} />
              <TextField label="Condição de pagamento" value={seller.paymentTerms} disabled={locked} onChange={(value) => updateSeller({ paymentTerms: value })} />
              <TextField label="Observação geral" value={seller.generalObservation} disabled={locked} onChange={(value) => updateSeller({ generalObservation: value })} />
            </div>
          </details>
        ) : null}
      </section>

      <div className="hidden rounded-md border border-slate-200 bg-white shadow-sm md:block">
        {isBidding ? (
          <BiddingDesktopGrid items={items} rows={rows} locked={locked || saving} updateRow={updateRow} />
        ) : (
          <PharmacyDesktopGrid items={items} rows={rows} locked={locked || saving} updateRow={updateRow} />
        )}
      </div>

      <div className="grid gap-3 md:hidden">
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
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isBidding
            ? "Dados do comprador ficam travados. Você responde apenas sua oferta, preço, quantidade, prazo e observação."
            : "Dados da farmácia ficam travados. Você informa apenas preço e observação opcional."}
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
          <TableHead className="min-w-56">Descrição</TableHead>
          <TableHead>Lab. solicitado</TableHead>
          <TableHead>Qtd</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead className="min-w-52">Obs.</TableHead>
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
                <CompactInput value={row.observation} disabled={locked} onChange={(value) => updateRow(item.id, { observation: value })} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
}: {
  item: QuotationItem;
  row: SellerResponseRowDraft;
  moduleType: ModuleType;
  locked: boolean;
  updateRow: (quotationItemId: string, patch: Partial<SellerResponseRowDraft>) => void;
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
            <div className="space-y-2">
              <Label>Obs.</Label>
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
    <section className="grid gap-3 md:grid-cols-5">
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
      attendedQuantity: existing?.availableQuantity ? String(existing.availableQuantity) : "",
      hasStock: existing?.hasStock === false ? "nao" : "sim",
      deliveryText: existing?.deliveryTermText ?? (existing?.deliveryDays ? `${existing.deliveryDays} dias` : ""),
      observation: existing?.sellerObservation ?? "",
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
