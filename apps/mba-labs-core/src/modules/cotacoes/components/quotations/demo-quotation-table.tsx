"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Eye, FileText, Link2, MoreHorizontal, Pencil, ReceiptText, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/cotacoes/components/ui/alert-dialog";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/cotacoes/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import { formatDate } from "@/modules/cotacoes/lib/formatters";
import { labelFrom, quotationStatusLabels } from "@/modules/cotacoes/lib/labels";
import {
  canFinishQuotation,
  canGenerateQuotationOrders,
  isQuotationClosed,
} from "@/modules/cotacoes/lib/quotation-status";
import {
  getDemoQuotationStorageKey,
  getStoredDemoQuotations,
  saveDemoQuotationToLocalStorage,
  type StoredDemoQuotation,
} from "@/modules/cotacoes/lib/data/demo-repository";
import type { ModuleType, Quotation, QuotationStatus } from "@/modules/cotacoes/lib/types";

type QuotationRow = {
  id: string;
  name: string;
  deadlineAt: string;
  status: QuotationStatus;
  responseCount: number;
  itemCount: number;
  supplierCount: number;
  source: "supabase" | "localStorage";
  local?: StoredDemoQuotation;
};

export function DemoQuotationTable({
  moduleType,
  initialQuotations,
}: {
  moduleType: ModuleType;
  initialQuotations: Quotation[];
}) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState<StoredDemoQuotation[]>(() => {
    return canUseLocalDemo() ? getStoredDemoQuotations(moduleType) : [];
  });
  const [serverRows, setServerRows] = useState(() => initialQuotations);
  const [pendingFinish, setPendingFinish] = useState<QuotationRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuotationRow | null>(null);
  const base = moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes";

  const rows = useMemo<QuotationRow[]>(() => {
    const remoteRows = serverRows.map((quotation) => ({
      id: quotation.id,
      name: quotation.name,
      deadlineAt: quotation.deadlineAt,
      status: quotation.status,
      responseCount: 0,
      itemCount: 0,
      supplierCount: 0,
      source: "supabase" as const,
    }));
    const storedRows = localRows.map((quotation) => ({
      id: quotation.id,
      name: quotation.draft.name,
      deadlineAt: quotation.draft.deadlineAt,
      status: quotation.status,
      responseCount: 0,
      itemCount: quotation.items.length,
      supplierCount: quotation.suppliers.length,
      source: "localStorage" as const,
      local: quotation,
    }));
    return [...storedRows, ...remoteRows];
  }, [localRows, serverRows]);

  async function duplicate(row: QuotationRow) {
    if (row.source === "localStorage" && row.local) {
      const copy: StoredDemoQuotation = {
        ...row.local,
        id: `${row.local.id}-copia-${crypto.randomUUID().slice(0, 8)}`,
        status: "draft",
        draft: {
          ...row.local.draft,
          name: `${row.local.draft.name} (copia)`,
        },
        createdAt: new Date().toISOString(),
      };
      saveDemoQuotationToLocalStorage(moduleType, copy);
      setLocalRows((current) => [copy, ...current]);
      toast.success("Cotação duplicada como rascunho.");
      return;
    }

    const payload = await mutateQuotation("PATCH", { id: row.id, action: "duplicate" });
    if (!payload) return;
    setServerRows((current) => [
      {
        id: payload.id as string,
        tenantId: "",
        moduleType,
        name: `${row.name} (copia)`,
        deadlineAt: row.deadlineAt,
        allowPartialSupply: true,
        allowEquivalent: true,
        considerMinimumOrder: false,
        status: "draft",
        createdBy: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    toast.success("Cotação duplicada como rascunho.");
    router.refresh();
  }

  async function cancel(row: QuotationRow) {
    if (!canFinishQuotation(row.status)) {
      toast.error("Somente cotações abertas, aguardando respostas ou em análise podem ser canceladas.");
      return;
    }
    const reason = window.prompt("Informe o motivo do cancelamento:");
    if (reason === null) return;
    if (!window.confirm("Confirmar cancelamento desta cotação? Os links públicos serão bloqueados.")) return;

    if (row.source === "localStorage") {
      updateLocalRow(row.id, { status: "canceled" });
      toast.success("Cotação cancelada.");
      return;
    }

    const payload = await mutateQuotation("PATCH", { id: row.id, action: "cancel", reason });
    if (!payload) return;
    setServerRows((current) => current.map((quotation) => (
      quotation.id === row.id ? { ...quotation, status: "canceled" } : quotation
    )));
    toast.success("Cotação cancelada.");
    router.refresh();
  }

  async function finishQuotation(row: QuotationRow) {
    if (!canFinish(row.status)) return;
    if (row.source === "localStorage") {
      updateLocalRow(row.id, { status: "finished" });
      toast.success("Cotação finalizada.");
      router.push(`${base}/${row.id}/analise`);
      return;
    }

    const payload = await mutateQuotation("PATCH", { id: row.id, action: "finish" });
    if (!payload) return;
    setServerRows((current) => current.map((quotation) => (
      quotation.id === row.id ? { ...quotation, status: "finished" } : quotation
    )));
    if (payload.warning) toast.warning(String(payload.warning));
    toast.success("Cotação finalizada.");
    router.push(`${base}/${row.id}/analise`);
    router.refresh();
  }

  async function deleteQuotation(row: QuotationRow) {
    if (row.source === "localStorage") {
      const nextRows = localRows.filter((quotation) => quotation.id !== row.id);
      window.localStorage.setItem(getDemoQuotationStorageKey(moduleType), JSON.stringify(nextRows));
      setLocalRows(nextRows);
      toast.success("Cotação excluída com sucesso.");
      return;
    }

    const payload = await mutateQuotation("DELETE", { id: row.id });
    if (!payload) return;
    setServerRows((current) => current.filter((quotation) => quotation.id !== row.id));
    toast.success("Cotação excluída com sucesso.");
    router.refresh();
  }

  async function reopenLinks(row: QuotationRow) {
    if (isQuotationClosed(row.status)) {
      toast.error("Cotação cancelada ou finalizada não permite gerar novos links.");
      return;
    }
    if (row.source === "localStorage") {
      if (row.itemCount === 0 || row.supplierCount === 0) {
        toast.error("Adicione pelo menos 1 item e 1 fornecedor antes de gerar links.");
        return;
      }
      updateLocalRow(row.id, { status: "open" });
      toast.success("Cotação local marcada como aberta. Abra os detalhes para copiar os links.");
      return;
    }

    const payload = await mutateQuotation("PATCH", { id: row.id, action: "reopen_links" });
    if (!payload) return;
    setServerRows((current) => current.map((quotation) => (
      quotation.id === row.id ? { ...quotation, status: "waiting_responses" } : quotation
    )));
    toast.success("Links liberados para reenvio.");
    router.refresh();
  }

  function updateLocalRow(id: string, patch: Partial<StoredDemoQuotation>) {
    const nextRows = localRows.map((quotation) => (
      quotation.id === id ? { ...quotation, ...patch } : quotation
    ));
    window.localStorage.setItem(getDemoQuotationStorageKey(moduleType), JSON.stringify(nextRows));
    setLocalRows(nextRows);
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cotação</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fornecedores</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
              Nenhuma cotação encontrada. Use o botão Nova cotação para criar a primeira.
            </TableCell>
          </TableRow>
        ) : rows.map((quotation) => (
          <TableRow key={`${quotation.source}-${quotation.id}`}>
            <TableCell className="font-medium">{quotation.name}</TableCell>
            <TableCell>{formatDate(quotation.deadlineAt)}</TableCell>
            <TableCell>
              <StatusBadge status={quotation.status} label={labelFrom(quotationStatusLabels, quotation.status)} />
            </TableCell>
            <TableCell>{quotation.supplierCount || quotation.responseCount || "-"} fornecedores</TableCell>
            <TableCell>
              <Badge variant="outline">
                {quotation.source === "localStorage" ? "Demo local salvo" : "Banco Supabase"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Abrir ações da cotação">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href={`${base}/${quotation.id}`}><Eye className="h-4 w-4" />Abrir</Link>
                  </DropdownMenuItem>
                  {!isQuotationClosed(quotation.status) ? (
                    <DropdownMenuItem asChild>
                      <Link href={`${base}/${quotation.id}/editar`}><Pencil className="h-4 w-4" />Editar</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void duplicate(quotation); }}>
                    <Copy className="h-4 w-4" />Duplicar
                  </DropdownMenuItem>
                  {!isQuotationClosed(quotation.status) ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void reopenLinks(quotation); }}>
                      <Link2 className="h-4 w-4" />Gerar links
                    </DropdownMenuItem>
                  ) : null}
                  {quotation.status !== "draft" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`${base}/${quotation.id}/respostas`}><Send className="h-4 w-4" />Ver respostas</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${base}/${quotation.id}/analise`}><FileText className="h-4 w-4" />Ver análise</Link>
                      </DropdownMenuItem>
                      {canGenerateQuotationOrders(quotation.status) ? (
                        <DropdownMenuItem asChild>
                          <Link href={`${base}/${quotation.id}/pedidos`}><ReceiptText className="h-4 w-4" />Gerar pedido</Link>
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  {canFinish(quotation.status) ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPendingFinish(quotation); }}>
                      <CheckCircle2 className="h-4 w-4" />Finalizar Cotação
                    </DropdownMenuItem>
                  ) : null}
                  {canFinish(quotation.status) ? (
                    <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void cancel(quotation); }}>
                      <XCircle className="h-4 w-4" />Cancelar
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onSelect={(event) => { event.preventDefault(); setPendingDelete(quotation); }}
                    className="text-red-700 focus:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <AlertDialog open={Boolean(pendingFinish)} onOpenChange={(open) => !open && setPendingFinish(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar cotação</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja finalizar esta cotação? Após finalizar, fornecedores que ainda não responderam não poderão mais enviar respostas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const row = pendingFinish;
              setPendingFinish(null);
              if (row) void finishQuotation(row);
            }}
          >
            Finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cotação</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir esta cotação? Essa ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              const row = pendingDelete;
              setPendingDelete(null);
              if (row) void deleteQuotation(row);
            }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

async function mutateQuotation(method: "PATCH" | "DELETE", body: Record<string, unknown>) {
  try {
    const response = await fetch("/api/cotacoes/quotations", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a cotação.");
    return payload as Record<string, unknown>;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a cotação.");
    return null;
  }
}

function canUseLocalDemo() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return false;
  }
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function canFinish(status: QuotationStatus) {
  return canFinishQuotation(status);
}
