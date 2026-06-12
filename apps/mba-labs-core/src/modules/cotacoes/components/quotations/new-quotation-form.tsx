"use client";

import { useMemo, useState } from "react";
import { Copy, Download, FileSpreadsheet, MessageCircle, Plus, Search, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { JudgmentTypeSelect } from "@/modules/cotacoes/components/forms/judgment-type-select";
import { ProductTypeSelect } from "@/modules/cotacoes/components/forms/product-type-select";
import { UnitSelect } from "@/modules/cotacoes/components/forms/unit-select";
import { YesNoSwitch } from "@/modules/cotacoes/components/forms/yes-no-switch";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import { Textarea } from "@/modules/cotacoes/components/ui/textarea";
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
import {
  judgmentTypeLabels,
  labelFrom,
  productTypeLabels,
  unitLabels,
} from "@/modules/cotacoes/lib/labels";
import { saveDemoQuotationToLocalStorage } from "@/modules/cotacoes/lib/data/demo-repository";
import { formatDateBR, formatInteger } from "@/modules/cotacoes/lib/formatters";
import type { Laboratory, ModuleType, Product, Supplier } from "@/modules/cotacoes/lib/types";

interface QuotationDraft {
  name: string;
  buyerDocument: string;
  buyerCompanyName: string;
  destinationClient: string;
  processNumber: string;
  bidNumber: string;
  deadlineAt: string;
  quotationType: string;
  judgmentType: string;
  notes: string;
  allowPartialSupply: boolean;
  allowEquivalent: boolean;
  considerMinimumOrder: boolean;
}

interface DraftItem {
  id: string;
  productId?: string;
  itemNumber: string;
  productName: string;
  ean?: string;
  activeIngredient?: string;
  dosage?: string;
  requestedLaboratory: string;
  requestedQuantity: number;
  requestedUnit: string;
  laboratoryRequired: boolean;
  productType: string;
  acceptEquivalent: boolean;
  minimumValidity?: string;
  msRegistrationRequired: boolean;
  maxDeliveryDays?: string;
  buyerObservation?: string;
  lotGroup?: string;
}

const demoSuppliers = [
  { id: "supplier-joao", nome: "João Medicamentos", empresa: "João Medicamentos", whatsapp: "(62) 99911-1111", tipo: "Vendedor" },
  { id: "supplier-ana", nome: "Ana Distribuidora", empresa: "Ana Distribuidora", whatsapp: "(61) 99922-2222", tipo: "Distribuidora" },
  { id: "supplier-carlos", nome: "Carlos Farma", empresa: "Carlos Farma", whatsapp: "(63) 99933-3333", tipo: "Vendedor" },
  { id: "supplier-luiza", nome: "Luiza Farma", empresa: "Rede Farma Luiza", whatsapp: "(62) 99944-4444", tipo: "Vendedora" },
];

type SupplierOption = {
  id: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  email?: string;
  tipo: string;
};

type GeneratedLink = {
  supplierId: string;
  token: string;
  url: string;
  status: "pendente" | "aberto" | "rascunho" | "respondido" | "expirado" | "revogado" | "cancelado";
};

type ParsedSheet = {
  fileName: string;
  columns: string[];
  rows: Array<Record<string, string>>;
};

type ImportField = {
  value: string;
  label: string;
};

const pharmacyImportFields: ImportField[] = [
  { value: "product_name", label: "Produto" },
  { value: "ean", label: "EAN" },
  { value: "requested_laboratory", label: "Laboratório desejado" },
  { value: "quantity", label: "Quantidade" },
  { value: "product_type", label: "Tipo" },
  { value: "notes", label: "Observação" },
  { value: "ignore", label: "ignorar" },
];

const biddingImportFields: ImportField[] = [
  { value: "product_name", label: "Produto" },
  { value: "active_ingredient", label: "Princípio ativo" },
  { value: "dosage", label: "Dosagem" },
  { value: "requested_quantity", label: "Quantidade necessária" },
  { value: "requested_unit", label: "Unidade" },
  { value: "requested_laboratory", label: "Laboratório desejado" },
  { value: "product_type", label: "Tipo" },
  { value: "allow_equivalent", label: "Aceita equivalente" },
  { value: "notes", label: "Observação" },
  { value: "lot_group", label: "Lote/Grupo" },
  { value: "ignore", label: "ignorar" },
];

export function NewQuotationForm({
  moduleType,
  products = [],
  laboratories = [],
  suppliers = [],
}: {
  moduleType: ModuleType;
  products?: Product[];
  laboratories?: Laboratory[];
  suppliers?: Supplier[];
}) {
  const isBidding = moduleType === "bidding";
  const supplierOptions = useMemo<SupplierOption[]>(() => {
    if (suppliers.length > 0) {
      return suppliers
        .filter((supplier) => supplier.status === "ativo")
        .map((supplier) => ({
          id: supplier.id,
          nome: supplier.nome,
          empresa: supplier.empresa,
          whatsapp: supplier.whatsapp,
          email: supplier.email,
          tipo: supplier.tipoFornecedor,
        }));
    }

    return hasSupabaseBrowserConfig() ? [] : demoSuppliers;
  }, [suppliers]);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<QuotationDraft>({
    name: isBidding ? "Pregão medicamentos" : "Falteiro loja matriz",
    buyerDocument: "12.345.678/0001-90",
    buyerCompanyName: "Distribuidora Licitação Exemplo",
    destinationClient: "Município de Goiânia",
    processNumber: "2026.000145",
    bidNumber: "PE 041/2026",
    deadlineAt: getDefaultDeadline(),
    quotationType: "generico_similar",
    judgmentType: "by_item",
    notes: "",
    allowPartialSupply: true,
    allowEquivalent: true,
    considerMinimumOrder: true,
  });
  const [items, setItems] = useState<DraftItem[]>(() => isBidding ? [buildDefaultItem(true)] : []);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(() => supplierOptions.map((supplier) => supplier.id));
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedSuppliers = useMemo(
    () => supplierOptions.filter((supplier) => selectedSupplierIds.includes(supplier.id)),
    [selectedSupplierIds, supplierOptions],
  );

  function updateDraft<K extends keyof QuotationDraft>(key: K, value: QuotationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addItem(item?: DraftItem) {
    if (item) {
      setItems((current) => [
        ...current,
        {
          ...item,
          id: crypto.randomUUID(),
          itemNumber: String(current.length + 1),
        },
      ]);
      return;
    }

    setItems((current) => [...current, { ...buildDefaultItem(isBidding), id: crypto.randomUUID(), itemNumber: String(current.length + 1) }]);
  }

  function duplicateItem(item: DraftItem) {
    setItems((current) => [
      ...current,
      { ...item, id: crypto.randomUUID(), itemNumber: String(current.length + 1) },
    ]);
  }

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function next() {
    if (step === 2 && items.length === 0) {
      toast.error("Adicione pelo menos 1 item para continuar.");
      return;
    }
    if (step === 3 && selectedSupplierIds.length === 0) {
      toast.error("Selecione pelo menos 1 fornecedor.");
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  async function saveDraft() {
    await persist("draft");
    toast.success(hasSupabaseBrowserConfig() ? "Rascunho salvo no Supabase" : "Rascunho salvo no modo demonstração");
  }

  async function generateLinks() {
    if (!draft.deadlineAt) {
      toast.error("Informe a data limite antes de gerar links.");
      return;
    }
    if (isPastDeadline(draft.deadlineAt)) {
      toast.error("Informe uma data limite futura para gerar links.");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos 1 item antes de gerar links.");
      return;
    }
    if (selectedSuppliers.length === 0) {
      toast.error("Selecione pelo menos 1 fornecedor antes de gerar links.");
      return;
    }
    const remoteLinks = await persist("waiting_responses");
    if (remoteLinks.length > 0) {
      setLinks(remoteLinks.map((link) => ({ ...link, status: "pendente" })));
      toast.success("Cotação salva e links públicos gerados");
      return;
    }

    if (hasSupabaseBrowserConfig() || !isLocalBrowser()) {
      return;
    }

    const generated = selectedSuppliers.map((supplier) => {
      const token = `${isBidding ? "licitacao" : "farmacia"}-${supplier.id.replace("supplier-", "")}-${crypto.randomUUID().slice(0, 8)}`;
      const url = `${window.location.origin}/${isBidding ? "licitacao" : "cotacao"}/responder/${token}`;
      return { supplierId: supplier.id, token, url, status: "pendente" as const };
    });
    setLinks(generated);
    toast.success("Links públicos gerados");
  }

  function revokeGeneratedLink(token: string) {
    setLinks((current) => current.map((link) => (
      link.token === token ? { ...link, status: "revogado" } : link
    )));
    toast.success("Link revogado nesta prévia.");
  }

  function regenerateGeneratedLink(supplierId: string) {
    const token = `${isBidding ? "licitacao" : "farmacia"}-${supplierId.replace("supplier-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const origin = typeof window === "undefined" ? "http://localhost:3001" : window.location.origin;
    const url = `${origin}/${isBidding ? "licitacao" : "cotacao"}/responder/${token}`;
    setLinks((current) => current.map((link) => (
      link.supplierId === supplierId ? { supplierId, token, url, status: "pendente" } : link
    )));
    toast.success("Novo token gerado.");
  }

  async function persist(status: "draft" | "waiting_responses") {
    if (hasSupabaseBrowserConfig()) {
      setSaving(true);
      try {
        const response = await fetch("/api/cotacoes/quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleType,
            status,
            draft,
            items,
            suppliers: selectedSuppliers,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar no Supabase.");
        return payload.links as Array<{ supplierId: string; token: string; url: string }>;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao salvar no Supabase.");
        return [] as Array<{ supplierId: string; token: string; url: string }>;
      } finally {
        setSaving(false);
      }
    }

    if (!isLocalBrowser()) {
      toast.error("Supabase não configurado. Em produção, a cotação precisa ser gravada no banco real.");
      return [] as Array<{ supplierId: string; token: string; url: string }>;
    }

    saveDemoQuotationToLocalStorage(moduleType, {
      id: `demo-${isBidding ? "licitacao" : "farmacia"}-${Date.now()}`,
      moduleType,
      status,
      draft,
      items,
      suppliers: selectedSupplierIds,
      createdAt: new Date().toISOString(),
    });
    return [] as Array<{ supplierId: string; token: string; url: string }>;
  }

  return (
    <div className="space-y-5">
      <StepHeader step={step} isBidding={isBidding} />

      {step === 1 ? (
        <StepData draft={draft} isBidding={isBidding} updateDraft={updateDraft} />
      ) : null}
      {step === 2 ? (
        <StepItems
          items={items}
          isBidding={isBidding}
          addItem={addItem}
          duplicateItem={duplicateItem}
          products={products}
          laboratories={laboratories}
          importItems={(importedItems) => setItems((current) => [
            ...current,
            ...importedItems
              .filter((item) => !current.some((currentItem) => sameQuotationProduct(currentItem, item)))
              .map((item, index) => ({
              ...item,
              id: crypto.randomUUID(),
              itemNumber: String(current.length + index + 1),
            })),
          ])}
          quotationType={draft.quotationType}
          removeItem={(id) => setItems((current) => current.filter((item) => item.id !== id))}
          updateItem={updateItem}
        />
      ) : null}
      {step === 3 ? (
        <StepSuppliers
          suppliers={supplierOptions}
          selectedSupplierIds={selectedSupplierIds}
          setSelectedSupplierIds={setSelectedSupplierIds}
        />
      ) : null}
      {step === 4 ? (
        <StepReview
          draft={draft}
          items={items}
          suppliers={selectedSuppliers}
          links={links}
          isBidding={isBidding}
          onRevokeLink={revokeGeneratedLink}
          onRegenerateLink={regenerateGeneratedLink}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}>
          Salvar rascunho
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>
              Voltar
            </Button>
          ) : null}
          {step < 4 ? (
            <Button type="button" onClick={next}>
              Próximo
            </Button>
          ) : (
            <>
            <Button type="button" variant="outline" onClick={generateLinks} disabled={saving}>
              {isBidding ? "Gerar links dos fornecedores" : "Gerar links dos vendedores"}
            </Button>
              <Button type="button" onClick={generateLinks} disabled={saving}>
                <Send className="h-4 w-4" />
                {saving ? "Salvando..." : "Enviar cotação"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
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

function getDefaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function isPastDeadline(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${value}T23:59:59`);
  return deadline.getTime() < today.getTime();
}

function StepHeader({ step, isBidding }: { step: number; isBidding: boolean }) {
  const labels = isBidding
    ? ["Dados", "Itens", "Fornecedores", "Revisão e links"]
    : ["Dados da cotação", "Itens a cotar", "Fornecedores", "Revisão e envio"];
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {labels.map((label, index) => {
        const active = step === index + 1;
        return (
          <div
            key={label}
            className={`rounded-md border px-3 py-2 text-sm ${
              active ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="font-semibold">Etapa {index + 1}</span>
            <span className="block">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StepData({
  draft,
  isBidding,
  updateDraft,
}: {
  draft: QuotationDraft;
  isBidding: boolean;
  updateDraft: <K extends keyof QuotationDraft>(key: K, value: QuotationDraft[K]) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{isBidding ? "Dados da licitação" : "Dados da cotação"}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Nome da cotação" value={draft.name} onChange={(value) => updateDraft("name", value)} />
        <Field label="Data limite" type="date" value={draft.deadlineAt} onChange={(value) => updateDraft("deadlineAt", value)} />
        {isBidding ? (
          <>
            <Field label="Empresa compradora" value={draft.buyerCompanyName} onChange={(value) => updateDraft("buyerCompanyName", value)} />
            <Field label="Cliente/órgão destino" value={draft.destinationClient} onChange={(value) => updateDraft("destinationClient", value)} />
            <Field label="Número do processo" value={draft.processNumber} onChange={(value) => updateDraft("processNumber", value)} />
            <Field label="Número do pregão" value={draft.bidNumber} onChange={(value) => updateDraft("bidNumber", value)} />
            <JudgmentTypeSelect label="Tipo de julgamento" value={draft.judgmentType} onValueChange={(value) => updateDraft("judgmentType", value)} />
          </>
        ) : (
          <>
            <Field label="Farmácia/CNPJ comprador" value={draft.buyerDocument} onChange={(value) => updateDraft("buyerDocument", value)} />
            <ProductTypeSelect label="Tipo da cotação" value={draft.quotationType} onValueChange={(value) => updateDraft("quotationType", value)} />
          </>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Observações</Label>
          <Textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} />
        </div>
        <YesNoSwitch label={isBidding ? "Permitir atendimento parcial" : "Permitir resposta parcial"} checked={draft.allowPartialSupply} onCheckedChange={(checked) => updateDraft("allowPartialSupply", checked)} />
        <YesNoSwitch label={isBidding ? "Aceita equivalente" : "Permitir produto equivalente"} checked={draft.allowEquivalent} onCheckedChange={(checked) => updateDraft("allowEquivalent", checked)} />
        {!isBidding ? (
          <YesNoSwitch label="Considerar pedido mínimo" checked={draft.considerMinimumOrder} onCheckedChange={(checked) => updateDraft("considerMinimumOrder", checked)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function StepItems({
  items,
  isBidding,
  addItem,
  duplicateItem,
  importItems,
  products,
  laboratories,
  quotationType,
  removeItem,
  updateItem,
}: {
  items: DraftItem[];
  isBidding: boolean;
  addItem: (item?: DraftItem) => void;
  duplicateItem: (item: DraftItem) => void;
  importItems: (items: DraftItem[]) => void;
  products: Product[];
  laboratories: Laboratory[];
  quotationType: string;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<DraftItem>) => void;
}) {
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isReading, setIsReading] = useState(false);
  const first = items[0] ?? buildDefaultItem(isBidding);
  const fields = isBidding ? biddingImportFields : pharmacyImportFields;
  const activeProducts = useMemo(
    () => products.filter((product) => product.status === "ativo"),
    [products],
  );
  const validation = useMemo(
    () => parsed ? validateImportedItems(parsed, mapping, isBidding, quotationType, items.length, activeProducts, items, laboratories) : null,
    [parsed, mapping, isBidding, quotationType, activeProducts, items, laboratories],
  );

  async function handleImportFile(file?: File) {
    if (!file) return;
    setIsReading(true);
    try {
      const parsedFile = await parseImportFile(file);
      const initialMapping = Object.fromEntries(
        parsedFile.columns.map((column) => [column, guessImportField(column, isBidding)]),
      );
      setParsed(parsedFile);
      setMapping(initialMapping);
      toast.success("Planilha lida. Confira o mapeamento antes de importar.");
    } catch (error) {
      setParsed(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setIsReading(false);
    }
  }

  function confirmImport() {
    if (!validation) return;
    if (validation.validItems.length === 0) {
      toast.error("Nenhum item válido para importar.");
      return;
    }
    importItems(validation.validItems);
    toast.success(`${validation.validItems.length} itens importados com sucesso. ${validation.errors.length} itens com erro.`);
    setParsed(null);
    setMapping({});
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isBidding ? "Itens da licitação" : "Itens a cotar"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isBidding
            ? "Cadastre os produtos da licitação e a unidade base que será usada no cálculo automático."
            : "Adicione abaixo os produtos que serão enviados aos vendedores para cotação."}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isBidding ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Item número" value={first.itemNumber} onChange={(value) => updateItem(first.id, { itemNumber: value })} />
            <Field label="Produto solicitado" value={first.productName} onChange={(value) => updateItem(first.id, { productName: value })} />
            <Field label="Princípio ativo" value={first.activeIngredient ?? ""} onChange={(value) => updateItem(first.id, { activeIngredient: value })} />
            <Field label="Dosagem" value={first.dosage ?? ""} onChange={(value) => updateItem(first.id, { dosage: value })} />
            <Field label="Quantidade necessária" type="number" value={String(first.requestedQuantity)} onChange={(value) => updateItem(first.id, { requestedQuantity: Number(value) })} />
            <UnitSelect label="Unidade base solicitada" value={first.requestedUnit} onValueChange={(value) => updateItem(first.id, { requestedUnit: value })} />
            <Field label="Laboratório desejado" value={first.requestedLaboratory} onChange={(value) => updateItem(first.id, { requestedLaboratory: value || "Qualquer" })} />
            <YesNoSwitch label="Laboratório obrigatório" checked={first.laboratoryRequired} onCheckedChange={(checked) => updateItem(first.id, { laboratoryRequired: checked })} />
            <ProductTypeSelect label="Tipo do produto" value={first.productType} onValueChange={(value) => updateItem(first.id, { productType: value })} />
            <YesNoSwitch label="Aceita equivalente" checked={first.acceptEquivalent} onCheckedChange={(checked) => updateItem(first.id, { acceptEquivalent: checked })} />
            <Field label="Validade mínima" type="date" value={first.minimumValidity ?? ""} onChange={(value) => updateItem(first.id, { minimumValidity: value })} />
            <YesNoSwitch label="Registro MS obrigatório" checked={first.msRegistrationRequired} onCheckedChange={(checked) => updateItem(first.id, { msRegistrationRequired: checked })} />
            <Field label="Prazo máximo opcional" type="number" value={first.maxDeliveryDays ?? ""} onChange={(value) => updateItem(first.id, { maxDeliveryDays: value })} />
            <Field label="Lote/grupo opcional" value={first.lotGroup ?? ""} onChange={(value) => updateItem(first.id, { lotGroup: value })} />
            <div className="space-y-2 md:col-span-3">
              <Label>Observação para o vendedor</Label>
              <Textarea value={first.buyerObservation ?? ""} onChange={(event) => updateItem(first.id, { buyerObservation: event.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <Button type="button" variant="outline" onClick={() => addItem()}><Plus className="h-4 w-4" />Adicionar item</Button>
              <Button type="button" variant="outline" onClick={() => duplicateItem(first)}><Copy className="h-4 w-4" />Duplicar item</Button>
              <ImportToolbar isBidding={isBidding} isReading={isReading} onImport={handleImportFile} />
            </div>
          </div>
        ) : (
          <PharmacyItemPicker
            products={activeProducts}
            laboratories={laboratories}
            items={items}
            onAdd={addItem}
            isReading={isReading}
            onImport={handleImportFile}
          />
        )}

        {parsed && validation ? (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">Pré-visualização da importação</h3>
                <p className="text-sm text-muted-foreground">
                  {parsed.fileName}: {validation.validItems.length} itens válidos e {validation.errors.length} itens com erro.
                </p>
              </div>
              <Button type="button" onClick={confirmImport}>
                <Upload className="h-4 w-4" />Confirmar importação
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {parsed.columns.map((column) => (
                <div key={column} className="space-y-2">
                  <Label>{column}</Label>
                  <Select
                    value={mapping[column] ?? "ignore"}
                    onValueChange={(value) => setMapping((current) => ({ ...current, [column]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {validation.errors.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold">{validation.errors.length} itens com erro.</p>
                <ul className="mt-2 space-y-1">
                  {validation.errors.slice(0, 8).map((error) => (
                    <li key={`${error.line}-${error.reason}`}>Linha {error.line}: {error.reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Laboratório</TableHead>
                    <TableHead>Tipo</TableHead>
                    {isBidding ? <TableHead>Unidade</TableHead> : <TableHead>EAN</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validation.validItems.slice(0, 10).map((item, index) => (
                    <TableRow key={`${item.productName}-${index}`}>
                      <TableCell>{index + 2}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{formatInteger(item.requestedQuantity)}</TableCell>
                      <TableCell>{item.requestedLaboratory}</TableCell>
                      <TableCell>{labelFrom(productTypeLabels, item.productType)}</TableCell>
                      <TableCell>{isBidding ? labelFrom(unitLabels, item.requestedUnit) : item.ean || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Laboratório</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell>{item.requestedLaboratory || "Qualquer"}</TableCell>
                <TableCell>{formatInteger(item.requestedQuantity)} {labelFrom(unitLabels, item.requestedUnit)}</TableCell>
                <TableCell>{labelFrom(productTypeLabels, item.productType)}</TableCell>
                <TableCell>{item.buyerObservation || "-"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {isBidding ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => duplicateItem(item)}><Copy className="h-4 w-4" />Duplicar</Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" />Remover</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PharmacyItemPicker({
  products,
  laboratories,
  items,
  onAdd,
  isReading,
  onImport,
}: {
  products: Product[];
  laboratories: Laboratory[];
  items: DraftItem[];
  onAdd: (item: DraftItem) => void;
  isReading: boolean;
  onImport: (file?: File) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [requestedLaboratory, setRequestedLaboratory] = useState("Qualquer");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeKey(query);
    if (!normalizedQuery) return products.slice(0, 8);
    return products
      .filter((product) =>
        [product.nome, product.ean, product.apresentacao, product.principioAtivo]
          .filter(Boolean)
          .some((value) => normalizeKey(String(value)).includes(normalizedQuery)),
      )
      .slice(0, 8);
  }, [products, query]);

  function choose(product: Product) {
    setSelectedProduct(product);
    setQuery(product.nome);
    setRequestedLaboratory(laboratoryName(product, laboratories) || "Qualquer");
    setError(null);
  }

  function addSelectedProduct() {
    if (products.length === 0) return;
    if (!selectedProduct) {
      setError("Selecione um produto cadastrado antes de adicionar.");
      return;
    }
    if (items.some((item) => sameQuotationProduct(item, productToDraftItem(selectedProduct, laboratories, 1)))) {
      setError("Este produto já foi adicionado à cotação.");
      return;
    }
    const parsedQuantity = Number(quantity.replace(",", "."));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Informe uma quantidade maior que zero.");
      return;
    }

    onAdd(productToDraftItem(selectedProduct, laboratories, parsedQuantity, requestedLaboratory, observation));
    setSelectedProduct(null);
    setQuery("");
    setQuantity("1");
    setRequestedLaboratory("Qualquer");
    setObservation("");
    setError(null);
    toast.success("Item adicionado à cotação.");
  }

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum produto cadastrado para seleção manual. Você ainda pode importar o falteiro pela planilha e enviar a cotação normalmente.
        </div>
        <ImportToolbar isBidding={false} isReading={isReading} onImport={onImport} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(120px,0.6fr)_minmax(0,1fr)]">
        <div className="relative space-y-2">
          <Label>Produto cadastrado</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedProduct(null);
                setError(null);
              }}
              placeholder="Buscar por nome, EAN ou apresentação"
              className="pl-9"
            />
          </div>
          {query.trim().length > 0 && !selectedProduct ? (
            <div className="absolute z-20 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {suggestions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum produto compatível encontrado.</div>
              ) : (
                suggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                    onClick={() => choose(product)}
                  >
                    <span className="block font-medium text-slate-950">{product.nome}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {product.ean ? `${product.ean} · ` : ""}{product.apresentacao || labelFrom(unitLabels, product.unidadeBase)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <Field label="Quantidade" type="number" value={quantity} onChange={setQuantity} />
        <Field label="Laboratório desejado" value={requestedLaboratory} onChange={(value) => setRequestedLaboratory(value || "Qualquer")} />
        <div className="space-y-2 md:col-span-3">
          <Label>Observação para o vendedor</Label>
          <Textarea value={observation} onChange={(event) => setObservation(event.target.value)} />
        </div>
      </div>

      {selectedProduct ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
          <Summary label="Produto" value={selectedProduct.nome} />
          <Summary label="EAN" value={selectedProduct.ean || "-"} />
          <Summary label="Tipo" value={labelFrom(productTypeLabels, selectedProduct.tipoProduto)} />
          <Summary label="Apresentação" value={selectedProduct.apresentacao || labelFrom(unitLabels, selectedProduct.unidadeBase)} />
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addSelectedProduct}>
          <Plus className="h-4 w-4" />Adicionar item
        </Button>
        <ImportToolbar isBidding={false} isReading={isReading} onImport={onImport} />
      </div>
    </div>
  );
}

function ImportToolbar({
  isBidding,
  isReading,
  onImport,
}: {
  isBidding: boolean;
  isReading: boolean;
  onImport: (file?: File) => void | Promise<void>;
}) {
  return (
    <>
      <Button type="button" variant="outline" onClick={() => void downloadImportModel(isBidding)}>
        <Download className="h-4 w-4" />Baixar modelo padrão
      </Button>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        {isReading ? "Lendo planilha..." : "Importar itens de planilha"}
        <input
          className="hidden"
          type="file"
          accept=".xlsx,.csv"
          onChange={(event) => void onImport(event.target.files?.[0])}
        />
      </label>
    </>
  );
}

function StepSuppliers({
  suppliers,
  selectedSupplierIds,
  setSelectedSupplierIds,
}: {
  suppliers: SupplierOption[];
  selectedSupplierIds: string[];
  setSelectedSupplierIds: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    setSelectedSupplierIds(
      selectedSupplierIds.includes(id)
        ? selectedSupplierIds.filter((supplierId) => supplierId !== id)
        : [...selectedSupplierIds, id],
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fornecedores</CardTitle>
        <p className="text-sm text-muted-foreground">
          Selecione os vendedores/fornecedores que receberão esta cotação.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {suppliers.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Nenhum fornecedor ativo encontrado. Cadastre fornecedores antes de enviar uma cotação real.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setSelectedSupplierIds(suppliers.map((supplier) => supplier.id))}>Selecionar todos</Button>
          <Button type="button" variant="outline" onClick={() => setSelectedSupplierIds([])}>Limpar seleção</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {suppliers.map((supplier) => {
            const checked = selectedSupplierIds.includes(supplier.id);
            return (
              <button
                type="button"
                key={supplier.id}
                onClick={() => toggle(supplier.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  checked ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"
                }`}
              >
                <span className="block font-semibold text-slate-950">{supplier.nome}</span>
                <span className="mt-1 block text-sm text-slate-600">{supplier.empresa}</span>
                <span className="mt-1 block text-sm text-slate-500">{supplier.whatsapp} · {supplier.tipo}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StepReview({
  draft,
  items,
  suppliers,
  links,
  isBidding,
  onRevokeLink,
  onRegenerateLink,
}: {
  draft: QuotationDraft;
  items: DraftItem[];
  suppliers: SupplierOption[];
  links: GeneratedLink[];
  isBidding: boolean;
  onRevokeLink: (token: string) => void;
  onRegenerateLink: (supplierId: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Revisão e envio</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label="Cotação" value={draft.name} />
          <Summary label="Data limite" value={formatDateBR(draft.deadlineAt)} />
          <Summary label="Tipo" value={isBidding ? labelFrom(judgmentTypeLabels, draft.judgmentType) : labelFrom(productTypeLabels, draft.quotationType)} />
          <Summary label="Itens" value={String(items.length)} />
          <Summary label="Fornecedores" value={String(suppliers.length)} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-slate-950">Itens principais</h3>
          <div className="grid gap-2">
            {items.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                {item.productName} · {formatInteger(item.requestedQuantity)} {labelFrom(unitLabels, item.requestedUnit)} · {labelFrom(productTypeLabels, item.productType)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-slate-950">Fornecedores selecionados</h3>
          <div className="flex flex-wrap gap-2">
            {suppliers.map((supplier) => (
              <span key={supplier.id} className="rounded-md bg-slate-100 px-3 py-2 text-sm">{supplier.nome}</span>
            ))}
          </div>
        </div>
        {links.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-semibold text-emerald-950">Links públicos gerados</h3>
            {links.map((link) => {
              const supplier = suppliers.find((item) => item.id === link.supplierId);
              const whatsapp = buildWhatsappUrl(supplier?.whatsapp, draft.deadlineAt, link.url);
              return (
                <div key={link.token} className="flex flex-col gap-2 rounded-md bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-sm font-medium">{supplier?.nome}</span>
                    <span className="mt-1 block text-xs text-slate-500">{supplier?.empresa} · {supplier?.whatsapp}</span>
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{link.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(link.url)}>
                      <Copy className="h-4 w-4" />Copiar link
                    </Button>
                    <Button asChild type="button" variant="outline" size="sm">
                      <a href={whatsapp} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4" />WhatsApp
                      </a>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onRegenerateLink(link.supplierId)}>
                      Novo token
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onRevokeLink(link.token)}>
                      Revogar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function productToDraftItem(
  product: Product,
  laboratories: Laboratory[],
  quantity: number,
  requestedLaboratory = laboratoryName(product, laboratories) || "Qualquer",
  observation = "",
): DraftItem {
  return {
    id: crypto.randomUUID(),
    productId: product.id,
    itemNumber: "1",
    productName: product.nome,
    ean: product.ean ? String(product.ean) : "",
    activeIngredient: product.principioAtivo,
    dosage: product.dosagem,
    requestedLaboratory: requestedLaboratory || "Qualquer",
    requestedQuantity: quantity,
    requestedUnit: product.unidadeBase || "CX",
    laboratoryRequired: false,
    productType: product.tipoProduto,
    acceptEquivalent: true,
    msRegistrationRequired: false,
    buyerObservation: observation,
  };
}

function adHocProductToDraftItem({
  productName,
  ean,
  requestedQuantity,
  requestedLaboratory,
  productType,
  quotationType,
  observation,
}: {
  productName: string;
  ean?: string;
  requestedQuantity: number;
  requestedLaboratory?: string;
  productType?: string;
  quotationType: string;
  observation?: string;
}): DraftItem {
  return {
    id: crypto.randomUUID(),
    itemNumber: "1",
    productName,
    ean,
    requestedLaboratory: requestedLaboratory || "Qualquer",
    requestedQuantity,
    requestedUnit: "CX",
    laboratoryRequired: false,
    productType: normalizeProductType(productType ?? "", quotationType),
    acceptEquivalent: true,
    msRegistrationRequired: false,
    buyerObservation: observation,
  };
}

function laboratoryName(product: Product, laboratories: Laboratory[]) {
  if (!product.laboratorioId) return "";
  return laboratories.find((laboratory) => laboratory.id === product.laboratorioId)?.nome ?? "";
}

function sameQuotationProduct(left: DraftItem, right: DraftItem) {
  if (left.productId && right.productId) return left.productId === right.productId;
  if (left.ean && right.ean) return normalizeKey(left.ean) === normalizeKey(right.ean);
  return normalizeKey(left.productName) === normalizeKey(right.productName);
}

function findImportedProduct(products: Product[], productName: string, ean?: string) {
  const normalizedEan = normalizeKey(ean ?? "");
  if (normalizedEan) {
    const byEan = products.find((product) => product.ean && normalizeKey(product.ean) === normalizedEan);
    if (byEan) return byEan;
  }

  const normalizedName = normalizeKey(productName);
  return products.find((product) => normalizeKey(product.nome) === normalizedName);
}

function buildDefaultItem(isBidding: boolean): DraftItem {
  return isBidding
    ? {
        id: crypto.randomUUID(),
        itemNumber: "1",
        productName: "Duloxetina 30mg",
        activeIngredient: "Cloridrato de Duloxetina",
        dosage: "30mg",
        requestedLaboratory: "Qualquer",
        requestedQuantity: 100000,
        requestedUnit: "CAP",
        laboratoryRequired: false,
        productType: "generico_similar",
        acceptEquivalent: true,
        msRegistrationRequired: false,
        buyerObservation: "Produto solicitado em cápsulas. Cotar caixa e o sistema converterá para unidade.",
      }
    : {
        id: crypto.randomUUID(),
        itemNumber: "1",
        productName: "Losartana 50mg c/30",
        ean: "7890000000011",
        requestedLaboratory: "Qualquer",
        requestedQuantity: 120,
        requestedUnit: "CX",
        laboratoryRequired: false,
        productType: "generico",
        acceptEquivalent: true,
        msRegistrationRequired: false,
        buyerObservation: "",
      };
}

function buildWhatsappUrl(whatsapp: string | undefined, deadline: string, link: string) {
  const phone = whatsapp?.replace(/\D/g, "") ?? "";
  const text = `Olá, estou enviando uma cotação. Acesse o link abaixo, preencha os preços disponíveis e envie sua resposta até ${formatDateBR(deadline)}: ${link}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

async function downloadImportModel(isBidding: boolean) {
  if (isBidding) {
    const columns = ["Produto", "Princípio ativo", "Dosagem", "Quantidade necessária", "Unidade", "Laboratório desejado", "Tipo", "Aceita equivalente", "Observação", "Lote/Grupo"].join(";");
    downloadBlob(new Blob([`\uFEFF${columns}`], { type: "text/csv;charset=utf-8" }), "modelo_itens_licitacao.csv");
    return;
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotações";
  const worksheet = workbook.addWorksheet("Itens");
  worksheet.columns = [
    { header: "Produto", key: "produto", width: 42 },
    { header: "EAN", key: "ean", width: 18, style: { numFmt: "@" } },
    { header: "Laboratório desejado", key: "laboratorio", width: 24 },
    { header: "Quantidade", key: "quantidade", width: 14, style: { numFmt: "0" } },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Observação", key: "observacao", width: 36 },
  ];
  worksheet.addRow({
    produto: "Exemplo Produto 50mg c/30",
    ean: "7890000000011",
    laboratorio: "Qualquer",
    quantidade: 10,
    tipo: "Genérico",
    observacao: "",
  });
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0F2FE" },
  };
  worksheet.autoFilter = "A1:F1";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn("ean").eachCell((cell, rowNumber) => {
    cell.numFmt = "@";
    if (rowNumber > 1) cell.value = String(cell.value ?? "");
  });
  worksheet.getColumn("quantidade").numFmt = "0";
  for (let rowNumber = 2; rowNumber <= 1000; rowNumber += 1) {
    worksheet.getCell(`E${rowNumber}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Gen\u00e9rico,Similar,\u00c9tico,Outros"'],
    };
  }
  worksheet.getCell("E2").dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"Genérico,Similar,Ético,Outros"'],
  };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "modelo_itens_cotacao_farmacia.xlsx",
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function parseImportFile(file: File): Promise<ParsedSheet> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseCsv(file);
  if (extension === "xlsx") return parseXlsx(file);
  throw new Error("Formato nao suportado. Use .xlsx ou .csv.");
}

async function parseCsv(file: File): Promise<ParsedSheet> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("O arquivo está vazio.");
  const delimiter = detectDelimiter(lines[0]);
  const columns = splitCsvLine(lines[0], delimiter).map((column, index) => (
    index === 0 ? column.replace(/^\uFEFF/, "").trim() : column.trim()
  ));
  const rows = lines.slice(1).map((line) => {
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

  const columns: string[] = [];
  worksheet.getRow(1).eachCell((cell) => {
    const value = cell.text || String(cell.value ?? "");
    if (value.trim()) columns.push(value.trim());
  });

  const rows: Array<Record<string, string>> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = columns.map((_, index) => {
      const cell = row.getCell(index + 1);
      return (cell.text || String(cell.value ?? "")).trim();
    });
    if (values.every((value) => !value)) return;
    rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
  });

  return { fileName: file.name, columns, rows };
}

function validateImportedItems(
  parsed: ParsedSheet,
  mapping: Record<string, string>,
  isBidding: boolean,
  quotationType: string,
  currentCount: number,
  products: Product[],
  existingItems: DraftItem[],
  laboratories: Laboratory[],
) {
  const validItems: DraftItem[] = [];
  const errors: Array<{ line: number; reason: string }> = [];

  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    const get = (field: string) => getMappedValue(row, mapping, field);
    const productName = get("product_name").trim();
    const quantityText = get(isBidding ? "requested_quantity" : "quantity").replace(",", ".");
    const requestedQuantity = Number(quantityText);
    const requestedUnit = isBidding ? normalizeUnit(get("requested_unit")) : "CX";

    if (!productName) {
      errors.push({ line, reason: "Produto obrigatório." });
      return;
    }
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      errors.push({ line, reason: isBidding ? "Quantidade necessária obrigatória e maior que zero." : "Quantidade obrigatória e maior que zero." });
      return;
    }
    if (isBidding && !requestedUnit) {
      errors.push({ line, reason: "Unidade obrigatória ou não reconhecida." });
      return;
    }

    if (!isBidding) {
      const ean = normalizeText(get("ean"));
      const product = findImportedProduct(products, productName, ean);
      const draftItem = product
        ? productToDraftItem(
            product,
            laboratories,
            requestedQuantity,
            normalizeText(get("requested_laboratory")) || laboratoryName(product, laboratories) || "Qualquer",
            normalizeText(get("notes")),
          )
        : adHocProductToDraftItem({
            productName,
            ean,
            requestedQuantity,
            requestedLaboratory: normalizeText(get("requested_laboratory")),
            productType: get("product_type"),
            quotationType,
            observation: normalizeText(get("notes")),
          });
      if ([...existingItems, ...validItems].some((item) => sameQuotationProduct(item, draftItem))) {
        errors.push({ line, reason: "Este produto já foi adicionado à cotação." });
        return;
      }
      validItems.push({
        ...draftItem,
        itemNumber: String(currentCount + validItems.length + 1),
      });
      return;
    }

    validItems.push({
      id: crypto.randomUUID(),
      itemNumber: String(currentCount + validItems.length + 1),
      productName,
      ean: normalizeText(get("ean")),
      activeIngredient: normalizeText(get("active_ingredient")),
      dosage: normalizeText(get("dosage")),
      requestedLaboratory: normalizeText(get("requested_laboratory")) || "Qualquer",
      requestedQuantity,
      requestedUnit: requestedUnit || "CX",
      laboratoryRequired: false,
      productType: normalizeProductType(get("product_type"), quotationType),
      acceptEquivalent: parseBoolean(get("allow_equivalent"), true),
      msRegistrationRequired: false,
      buyerObservation: normalizeText(get("notes")),
      lotGroup: normalizeText(get("lot_group")),
    });
  });

  return { validItems, errors };
}

function getMappedValue(row: Record<string, string>, mapping: Record<string, string>, field: string) {
  const column = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
  return column ? row[column] ?? "" : "";
}

function guessImportField(column: string, isBidding: boolean) {
  const normalized = normalizeKey(column);
  if (normalized.includes("ean")) return "ean";
  if (normalized.includes("princip")) return "active_ingredient";
  if (normalized.includes("dosagem")) return "dosage";
  if (normalized.includes("unidade")) return "requested_unit";
  if (normalized.includes("quant")) return isBidding ? "requested_quantity" : "quantity";
  if (normalized.includes("labor") || normalized.includes("marca")) return "requested_laboratory";
  if (normalized.includes("equival")) return "allow_equivalent";
  if (normalized.includes("lote") || normalized.includes("grupo")) return "lot_group";
  if (normalized.includes("tipo")) return "product_type";
  if (normalized.includes("observ")) return "notes";
  if (normalized.includes("produto") || normalized.includes("descr")) return "product_name";
  return "ignore";
}

function normalizeProductType(value: string, fallback: string) {
  const normalized = normalizeKey(value || fallback);
  if (normalized.includes("generico") && normalized.includes("similar")) return "generico_similar";
  if (normalized.includes("similar")) return "similar";
  if (normalized.includes("etico")) return "etico";
  if (normalized.includes("mip")) return "mip";
  if (normalized.includes("perfum")) return "perfumaria";
  if (normalized.includes("control")) return "controlado";
  if (normalized.includes("hospital")) return "hospitalar";
  if (normalized.includes("qualquer")) return "qualquer";
  if (normalized.includes("outro")) return "outros";
  return normalized.includes("generico") ? "generico" : "qualquer";
}

function normalizeUnit(value: string) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (["cp", "comprimido", "comprimidos"].includes(normalized)) return "CP";
  if (["cap", "capsula", "capsulas"].includes(normalized)) return "CAP";
  if (["amp", "ampola", "ampolas"].includes(normalized)) return "AMP";
  if (["fr", "frasco", "frascos"].includes(normalized)) return "FR";
  if (["ml", "mililitro", "mililitros"].includes(normalized)) return "ML";
  if (["g", "grama", "gramas"].includes(normalized)) return "G";
  if (["kg", "quilograma", "quilogramas"].includes(normalized)) return "KG";
  if (["un", "unidade", "unidades"].includes(normalized)) return "UN";
  if (["cx", "caixa", "caixas"].includes(normalized)) return "CX";
  return "";
}

function parseBoolean(value: string, fallback: boolean) {
  const normalized = normalizeKey(value);
  if (!normalized) return fallback;
  if (["sim", "s", "true", "1", "yes"].includes(normalized)) return true;
  if (["nao", "n", "false", "0", "no"].includes(normalized)) return false;
  return fallback;
}

function normalizeText(value: string) {
  return value.trim();
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

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
