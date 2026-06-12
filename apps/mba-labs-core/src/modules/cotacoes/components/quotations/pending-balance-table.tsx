import { StatusBadge } from "@/modules/cotacoes/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { formatCurrencyBRL, formatNumberBR } from "@/modules/cotacoes/lib/formatters";
import type { PendingBalance } from "@/modules/cotacoes/lib/types";

export function PendingBalanceTable({
  balances,
}: {
  balances: Array<
    PendingBalance & {
      suppliersCount?: number;
      bestUnitPrice?: number;
    }
  >;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Necessaria</TableHead>
          <TableHead className="text-right">Atendida</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Fornecedores</TableHead>
          <TableHead className="text-right">Menor preco</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {balances.map((balance) => (
          <TableRow key={balance.id}>
            <TableCell className="font-medium">{balance.productName}</TableCell>
            <TableCell className="text-right">{formatNumberBR(balance.requestedQuantity)}</TableCell>
            <TableCell className="text-right">{formatNumberBR(balance.suppliedQuantity)}</TableCell>
            <TableCell className="text-right">{formatNumberBR(balance.pendingQuantity)}</TableCell>
            <TableCell>{balance.unit}</TableCell>
            <TableCell>{balance.suppliersCount ?? "-"}</TableCell>
            <TableCell className="text-right">{formatCurrencyBRL(balance.bestUnitPrice)}</TableCell>
            <TableCell><StatusBadge status={balance.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
