import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/formatters";
import { getUnitLabel } from "@/lib/constants";
import type { QuotationItem, SupplierQuoteResponseItem } from "@/lib/types";

export function BiddingRankingTable({
  items,
  responseItems,
  supplierName = (id?: string) => id ?? "-",
}: {
  items: QuotationItem[];
  responseItems: SupplierQuoteResponseItem[];
  supplierName?: (supplierId?: string) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Produto ofertado</TableHead>
          <TableHead className="text-right">Preco embalagem</TableHead>
          <TableHead className="text-right">Qtd embalagem</TableHead>
          <TableHead className="text-right">Preco unitario</TableHead>
          <TableHead>Disponivel</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {responseItems.map((responseItem) => {
          const quotationItem = items.find((item) => item.id === responseItem.quotationItemId);
          return (
            <TableRow key={responseItem.id}>
              <TableCell className="font-medium">{quotationItem?.productName ?? "-"}</TableCell>
              <TableCell>{formatNumberBR(quotationItem?.requestedQuantity)}</TableCell>
              <TableCell>{getUnitLabel(quotationItem?.requestedUnit)}</TableCell>
              <TableCell>{supplierName(responseItem.supplierId)}</TableCell>
              <TableCell>{responseItem.offeredLaboratory ?? "-"}</TableCell>
              <TableCell>{responseItem.offeredProductName ?? "-"}</TableCell>
              <TableCell className="text-right">{formatCurrencyBRL(responseItem.packagePrice)}</TableCell>
              <TableCell className="text-right">{formatNumberBR(responseItem.packageQuantity)}</TableCell>
              <TableCell className="text-right">
                {formatCurrencyBRL(responseItem.convertedUnitPrice)}
              </TableCell>
              <TableCell>
                {responseItem.hasFullQuantity ? "Total" : formatNumberBR(responseItem.availableQuantity)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={responseItem.alertStatus ? "pending" : "paid"}
                  label={responseItem.alertStatus ?? "Valida"}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
