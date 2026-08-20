"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Edit, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { ConfirmDialog } from "@/modules/cotacoes/components/ui/confirm-dialog";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { Textarea } from "@/modules/cotacoes/components/ui/textarea";

type ShortageItem = {
  id: string;
  productName: string;
  ean?: string;
  requestedQuantity: number;
  requestedUnit: string;
  notes?: string;
};

type RegisteredProduct = {
  id: string;
  name: string;
  ean?: string;
  unit?: string;
};

const emptyForm = {
  productName: "",
  ean: "",
  requestedQuantity: "1",
  requestedUnit: "UN",
  notes: "",
};

export function ShortageListPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShortageItem[]>([]);
  const [products, setProducts] = useState<RegisteredProduct[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/cotacoes/shortage-items", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a lista.");
        if (!active) return;
        setItems(payload.items ?? []);
        setProducts(payload.products ?? []);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "Erro ao carregar a lista.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/cotacoes/shortage-items", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, data: form } : form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar o item.");
      const saved = payload.item as ShortageItem;
      setItems((current) => editingId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      resetForm();
      toast.success(editingId ? "Item atualizado." : "Item adicionado à lista.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    try {
      const response = await fetch("/api/cotacoes/shortage-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir o item.");
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      toast.success("Item excluído da lista.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir o item.");
    }
  }

  function selectRegisteredProduct(productId: string) {
    setSelectedProductId(productId);
    if (!productId) return;
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;
    setForm((current) => ({
      ...current,
      productName: product.name,
      ean: product.ean ?? "",
      requestedUnit: normalizeRegisteredUnit(product.unit),
    }));
  }

  function typeProductName(value: string) {
    const exactMatch = products.find((product) => normalizeText(product.name) === normalizeText(value));
    const previousSelected = products.find((product) => product.id === selectedProductId);
    setSelectedProductId(exactMatch?.id ?? "");
    setForm((current) => ({
      ...current,
      productName: value,
      ...(exactMatch
        ? { ean: exactMatch.ean ?? "", requestedUnit: normalizeRegisteredUnit(exactMatch.unit) }
        : previousSelected
          ? { ean: "" }
          : {}),
    }));
  }

  function startEdit(item: ShortageItem) {
    const registered = products.find((product) => (
      (item.ean && product.ean === item.ean) || normalizeText(product.name) === normalizeText(item.productName)
    ));
    setSelectedProductId(registered?.id ?? "");
    setEditingId(item.id);
    setForm({
      productName: item.productName,
      ean: item.ean ?? "",
      requestedQuantity: String(item.requestedQuantity),
      requestedUnit: item.requestedUnit,
      notes: item.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setSelectedProductId("");
    setForm(emptyForm);
  }

  function createQuotation() {
    if (items.length === 0) {
      toast.error("Adicione ao menos um produto antes de criar a cotação.");
      return;
    }
    router.push("/cotacoes/cotacoes-farmacia/nova?fromShortage=1");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardList className="h-6 w-6 text-[#08755f]" />
            Lista de faltas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre produtos em falta ao longo do dia e transforme a lista em uma cotação pronta para revisar.
          </p>
        </div>
        <Button type="button" onClick={createQuotation} disabled={loading || items.length === 0}>
          <Send className="h-4 w-4" />
          Criar cotação com a lista
        </Button>
      </div>

      <Card className="border-teal-100 bg-teal-50/40">
        <CardHeader>
          <CardTitle>{editingId ? "Editar produto em falta" : "Adicionar produto em falta"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveItem} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="shortage-product-select">Produto</Label>
              <select
                id="shortage-product-select"
                value={selectedProductId}
                onChange={(event) => selectRegisteredProduct(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={loading || products.length === 0}
              >
                <option value="">
                  {products.length > 0 ? "Selecionar produto já cadastrado..." : "Nenhum produto cadastrado"}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}{product.ean ? ` · EAN ${product.ean}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Ou digite o produto manualmente abaixo.</p>
              <Input
                id="shortage-product"
                value={form.productName}
                onChange={(event) => typeProductName(event.target.value)}
                placeholder="Digite o nome do produto"
                required
                maxLength={240}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortage-ean">EAN (opcional)</Label>
              <Input
                id="shortage-ean"
                value={form.ean}
                onChange={(event) => setForm((current) => ({ ...current, ean: event.target.value }))}
                inputMode="numeric"
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortage-quantity">Quantidade</Label>
              <Input
                id="shortage-quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.requestedQuantity}
                onChange={(event) => setForm((current) => ({ ...current, requestedQuantity: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortage-unit">Unidade</Label>
              <select
                id="shortage-unit"
                value={form.requestedUnit}
                onChange={(event) => setForm((current) => ({ ...current, requestedUnit: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="UN">Unidade</option>
                <option value="CX">Caixa</option>
                <option value="FR">Frasco</option>
                <option value="PCT">Pacote</option>
                <option value="KIT">Kit</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-4">
              <Label htmlFor="shortage-notes">Observação (opcional)</Label>
              <Textarea
                id="shortage-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Marca, apresentação ou outra preferência"
                maxLength={1000}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? "Salvando..." : editingId ? "Salvar alteração" : "Adicionar"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos aguardando cotação ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum produto na lista. Adicione o primeiro item acima.
                  </TableCell>
                </TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.ean || "-"}</TableCell>
                  <TableCell className="text-right">{item.requestedQuantity}</TableCell>
                  <TableCell>{item.requestedUnit}</TableCell>
                  <TableCell>{item.notes || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <ConfirmDialog
                        title="Excluir produto da lista?"
                        description="O produto será removido definitivamente desta Lista de Faltas."
                        confirmLabel="Excluir"
                        onConfirm={() => deleteItem(item.id)}
                        trigger={
                          <Button type="button" variant="outline" size="icon" aria-label={`Excluir ${item.productName}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeRegisteredUnit(value?: string) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["UN", "CX", "FR", "PCT", "KIT"].includes(normalized)) return normalized;
  if (normalized.includes("CAIX")) return "CX";
  if (normalized.includes("FRASC")) return "FR";
  if (normalized.includes("PACOT")) return "PCT";
  if (normalized.includes("KIT")) return "KIT";
  return "UN";
}

function normalizeText(value: string) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}
