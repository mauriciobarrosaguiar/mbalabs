"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuotationItem, Supplier } from "@/modules/cotacoes/lib/types";

type Props = {
  quotationId: string;
  items: QuotationItem[];
  suppliers: Supplier[];
};

function readBrazilianNumber(value: string) {
  const raw = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
}

export function DistributorOffersImport({ quotationId, items, suppliers }: Props) {
  const router = useRouter();
  const distributorSuppliers = suppliers.filter((s) => s.tipoFornecedor === "distribuidora" && s.status === "ativo");
  const [supplierId, setSupplierId] = useState("");
  const [table, setTable] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function importOffers() {
    if (!supplierId) { setMessage("Selecione a distribuidora."); return; }
    const byEan = new Map<string, QuotationItem[]>();
    for (const item of items) {
      const ean = String(item.ean ?? "").replace(/\D/g, "");
      if (!ean) continue;
      byEan.set(ean, [...(byEan.get(ean) ?? []), item]);
    }

    const offers: Array<{ quotationItemId: string; ean: string; unitPrice: number; availableQuantity: number }> = [];
    const seen = new Set<string>();
    const lines = table.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const [index, line] of lines.entries()) {
      const columns = line.split(";").map((part) => part.trim());
      if (index === 0 && /EAN/i.test(columns[0])) continue;
      if (columns.length !== 3) {
        setMessage("Use 3 colunas separadas por ponto e vírgula: EAN;PREÇO;ESTOQUE.");
        return;
      }
      const ean = columns[0].replace(/\D/g, "");
      const matching = byEan.get(ean) ?? [];
      if (matching.length !== 1 || seen.has(matching[0].id)) {
        setMessage("EAN não encontrado, repetido ou ambíguo na cotação: " + ean);
        return;
      }
      const price = readBrazilianNumber(columns[1]);
      const stock = readBrazilianNumber(columns[2]);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < matching[0].requestedQuantity) {
        setMessage("Preço inválido ou estoque menor que a quantidade solicitada para o EAN " + ean);
        return;
      }
      offers.push({ quotationItemId: matching[0].id, ean, unitPrice: price, availableQuantity: stock });
      seen.add(matching[0].id);
    }
    if (!offers.length) { setMessage("Cole ao menos uma linha com preço válido."); return; }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cotacoes/distributor-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId, supplierId, offers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao importar preços.");
      setMessage(payload.message ?? "Preços importados.");
      setTable("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro na importação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">Ofertas diretas das distribuidoras (importação)</h3>
      <p className="text-sm text-muted-foreground">
        Importe uma tabela de preços autorizada enquanto os representantes respondem. Não consulta portais automaticamente:
        a conexão direta depende de homologação com cada distribuidora. Informe o preço por embalagem/unidade cotada; só são aceitos EANs idênticos e estoque suficiente. Itens em comprimidos/cápsulas/gramas exigem conversão antes da importação.
      </p>
      <label className="block space-y-1 text-sm">
        <span>Distribuidora cadastrada</span>
        <select className="w-full rounded-md border p-2" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Selecione</option>
          {distributorSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Tabela de preços (EAN;PREÇO;ESTOQUE)</span>
        <textarea
          className="min-h-24 w-full rounded-md border p-2 font-mono text-sm"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder={"7891234567890;24,90;100\n7891234567891;18,50;60"}
        />
      </label>
      <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={busy || distributorSuppliers.length === 0} onClick={() => void importOffers()}>
        {busy ? "Importando..." : "Importar para o comparativo"}
      </button>
      {distributorSuppliers.length === 0 ? <p className="text-sm text-amber-700">Cadastre primeiro a distribuidora como fornecedor do tipo Distribuidora.</p> : null}
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </section>
  );
}
