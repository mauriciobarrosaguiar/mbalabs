import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyBRL, formatPercentBR } from "@/lib/formatters";
import type { PharmacyAnalysisResult } from "@/lib/services/pharmacy-analysis";

export function PharmacyAnalysisTable({
  analysis,
}: {
  analysis: PharmacyAnalysisResult;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Estoque</TableHead>
          <TableHead className="text-right">Preco unitario</TableHead>
          <TableHead className="text-right">Segundo preco</TableHead>
          <TableHead className="text-right">Diferenca</TableHead>
          <TableHead>Ranking</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {analysis.ranking.map((item) => {
          const second = analysis.ranking.find(
            (candidate) =>
              candidate.quotationItemId === item.quotationItemId &&
              candidate.rankingPosition === 2,
          );
          const diff = second?.unitPrice && item.unitPrice ? second.unitPrice - item.unitPrice : 0;
          const diffPercent = item.unitPrice ? (diff / item.unitPrice) * 100 : 0;

          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.supplierId}</TableCell>
              <TableCell>
                <StatusBadge
                  status={item.hasStock ? "paid" : "pending"}
                  label={item.hasStock ? "Sim" : "Parcial"}
                />
              </TableCell>
              <TableCell className="text-right">{formatCurrencyBRL(item.unitPrice)}</TableCell>
              <TableCell className="text-right">
                {second ? formatCurrencyBRL(second.unitPrice) : "-"}
              </TableCell>
              <TableCell className="text-right">
                {second ? `${formatCurrencyBRL(diff)} (${formatPercentBR(diffPercent)})` : "-"}
              </TableCell>
              <TableCell>{item.rankingPosition ? `${item.rankingPosition}o` : "-"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
