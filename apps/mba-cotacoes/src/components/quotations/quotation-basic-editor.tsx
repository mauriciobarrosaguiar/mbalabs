"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { labelFrom, quotationStatusLabels } from "@/lib/labels";
import { isQuotationClosed } from "@/lib/quotation-status";
import type { ModuleType, Quotation } from "@/lib/types";

export function QuotationBasicEditor({
  quotation,
  moduleType,
}: {
  quotation: Quotation;
  moduleType: ModuleType;
}) {
  const router = useRouter();
  const [name, setName] = useState(quotation.name);
  const [deadlineAt, setDeadlineAt] = useState(toDateInput(quotation.deadlineAt));
  const [notes, setNotes] = useState(quotation.notes ?? "");
  const [saving, setSaving] = useState(false);
  const locked = isQuotationClosed(quotation.status);
  const isDraft = quotation.status === "draft";

  async function save() {
    if (locked) {
      toast.error("Cotação cancelada ou finalizada não permite edição.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quotation.id,
          action: "update_basic",
          name,
          deadlineAt,
          notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar.");
      toast.success("Cotação atualizada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{moduleType === "bidding" ? "Editar licitação" : "Editar cotação farmácia"}</CardTitle>
          <StatusBadge status={quotation.status} label={labelFrom(quotationStatusLabels, quotation.status)} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {!isDraft ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">
            Esta cotação já foi aberta. Por segurança, a edição direta fica limitada à data limite e observações.
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Nome da cotação</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isDraft || locked} />
        </div>
        <div className="space-y-2">
          <Label>Data limite</Label>
          <Input type="date" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} disabled={locked} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={locked} />
        </div>
        <div className="md:col-span-2">
          <Button type="button" onClick={() => void save()} disabled={saving || locked}>
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function toDateInput(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}
