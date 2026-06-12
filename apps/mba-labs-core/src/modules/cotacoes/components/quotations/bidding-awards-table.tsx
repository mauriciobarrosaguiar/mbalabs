import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { formatCurrencyBRL, formatNumberBR } from "@/modules/cotacoes/lib/formatters";
import type { QuotationAward, QuotationItem, SupplierQuoteResponseItem } from "@/modules/cotacoes/lib/types";

export function BiddingAwardsTable({
  awards,
  items,
  responseItems,
}: {
  awards: QuotationAward[];
  items: QuotationItem[];
  responseItems: SupplierQuoteResponseItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Ordem</TableHead>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead className="text-right">Preco unitario</TableHead>
          <TableHead>Disponivel</TableHead>
          <TableHead className="text-right">Qtd recomendada</TableHead>
          <TableHead className="text-right">Embalagens</TableHead>
          <TableHead className="text-right">Preco embalagem</TableHead>
          <TableHead className="text-right">Valor total</TableHead>
          <TableHead className="text-right">Saldo apos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {awards.map((award) => {
          const responseItem = responseItems.find((item) => item.id === award.supplierResponseItemId);
          const quotationItem = items.find((item) => item.id === award.quotationItemId);
          return (
            <TableRow key={award.id}>
              <TableCell className="font-medium">{quotationItem?.productName ?? "-"}</TableCell>
              <TableCell>{award.rankingPosition}o</TableCell>
              <TableCell>{award.supplierName}</TableCell>
              <TableCell>{responseItem?.offeredLaboratory ?? "-"}</TableCell>
              <TableCell className="text-right">{formatCurrencyBRL(award.unitPrice)}</TableCell>
              <TableCell>
                {responseItem?.hasFullQuantity ? "Total" : formatNumberBR(responseItem?.availableQuantity)}
              </TableCell>
              <TableCell className="text-right">{formatNumberBR(award.awardedQuantity)}</TableCell>
              <TableCell className="text-right">{formatNumberBR(award.awardedPackages)}</TableCell>
              <TableCell className="text-right">{formatCurrencyBRL(award.packagePrice)}</TableCell>
              <TableCell className="text-right">{formatCurrencyBRL(award.totalPrice)}</TableCell>
              <TableCell className="text-right">{formatNumberBR(award.remainingBalanceAfter)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
