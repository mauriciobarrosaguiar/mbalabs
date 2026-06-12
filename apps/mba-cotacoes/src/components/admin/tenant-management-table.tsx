"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Edit, MoreHorizontal, PauseCircle, PlayCircle, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { CustomerTypeSelect } from "@/components/forms/customer-type-select";
import { StatusSelect } from "@/components/forms/status-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  customerTypeLabels,
  labelFrom,
  statusLabels,
} from "@/lib/labels";
import { formatCurrencyBRL, formatDateBR, parseCurrencyInput } from "@/lib/formatters";
import type { SubscriptionPlan, Tenant } from "@/lib/types";

type TenantFormRow = Tenant & { observacoesInternas?: string };

const storageKey = "cotafarma-demo-tenants";

export function TenantManagementTable({
  initialTenants,
  plans,
}: {
  initialTenants: Tenant[];
  plans: SubscriptionPlan[];
}) {
  const [tenants, setTenants] = useState<TenantFormRow[]>(() => {
    if (typeof window === "undefined") return initialTenants;
    if (remoteTenantCrudEnabled()) return initialTenants;
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as TenantFormRow[]) : initialTenants;
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editing, setEditing] = useState<TenantFormRow | null>(null);
  const [open, setOpen] = useState(false);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  const visibleTenants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tenants.filter((tenant) =>
      (statusFilter === "todos" || tenant.status === statusFilter) &&
      (!normalized ||
        [
          tenant.nomeFantasia,
          tenant.razaoSocial,
          tenant.cnpj,
          labelFrom(customerTypeLabels, tenant.tipoCliente),
          tenant.responsavelNome,
          labelFrom(statusLabels, tenant.status),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized)),
    );
  }, [query, statusFilter, tenants]);

  function persistLocal(next: TenantFormRow[]) {
    setTenants(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function create() {
    setEditing({
      id: crypto.randomUUID(),
      nomeFantasia: "",
      razaoSocial: "",
      cnpj: "",
      tipoCliente: "pharmacy",
      responsavelNome: "",
      responsavelEmail: "",
      responsavelWhatsapp: "",
      planoId: plans[0]?.id,
      status: "teste",
      dataInicio: new Date().toISOString().slice(0, 10),
      dataVencimento: new Date().toISOString().slice(0, 10),
      valorMensal: plans[0]?.monthlyPrice ?? 0,
      observacoesInternas: "",
    });
    setOpen(true);
  }

  async function save(formData: FormData) {
    const id = String(formData.get("id"));
    const row: TenantFormRow = {
      id,
      nomeFantasia: String(formData.get("nomeFantasia") ?? ""),
      razaoSocial: String(formData.get("razaoSocial") ?? ""),
      cnpj: maskCnpj(String(formData.get("cnpj") ?? "")),
      tipoCliente: String(formData.get("tipoCliente") ?? "pharmacy") as Tenant["tipoCliente"],
      responsavelNome: String(formData.get("responsavelNome") ?? ""),
      responsavelEmail: String(formData.get("responsavelEmail") ?? ""),
      responsavelWhatsapp: maskWhatsapp(String(formData.get("responsavelWhatsapp") ?? "")),
      planoId: String(formData.get("planoId") ?? ""),
      status: String(formData.get("status") ?? "teste") as Tenant["status"],
      dataInicio: editing?.dataInicio ?? new Date().toISOString().slice(0, 10),
      dataVencimento: String(formData.get("dataVencimento") ?? ""),
      valorMensal: parseCurrencyInput(String(formData.get("valorMensal") ?? "0")),
      observacoesInternas: String(formData.get("observacoesInternas") ?? ""),
    };
    const autoCreatePharmacy = formData.get("autoCreatePharmacy") === "on";

    if (remoteTenantCrudEnabled()) {
      try {
        const exists = tenants.some((tenant) => tenant.id === id);
        const response = await fetch("/api/crud/tenants", {
          method: exists ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, data: { ...row, autoCreatePharmacy } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar no Supabase.");
        const saved = (payload.row ?? row) as TenantFormRow;
        setTenants((current) =>
          exists
            ? current.map((tenant) => (tenant.id === saved.id ? saved : tenant))
            : [saved, ...current],
        );
        setOpen(false);
        toast.success("Empresa salva no Supabase");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao salvar empresa.");
      }
      return;
    }

    const next = tenants.some((tenant) => tenant.id === id)
      ? tenants.map((tenant) => (tenant.id === id ? row : tenant))
      : [row, ...tenants];
    persistLocal(next);
    setOpen(false);
    toast.success("Empresa salva no modo demonstração");
  }

  async function updateStatus(id: string, status: Tenant["status"]) {
    if (remoteTenantCrudEnabled()) {
      try {
        const response = await fetch("/api/crud/tenants", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, data: { status } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar status no Supabase.");
        const saved = (payload.row ?? { id, status }) as TenantFormRow;
        setTenants((current) =>
          current.map((tenant) => (tenant.id === id ? { ...tenant, ...saved } : tenant)),
        );
        toast.success(`Empresa marcada como ${labelFrom(statusLabels, status).toLowerCase()}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao atualizar empresa.");
      }
      return;
    }

    persistLocal(
      tenants.map((tenant) =>
        tenant.id === id
          ? { ...tenant, status }
          : tenant,
      ),
    );
    toast.success(`Empresa marcada como ${labelFrom(statusLabels, status).toLowerCase()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-2xl sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa..."
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="teste">Teste</option>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="cancelado">Cancelado</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <Button onClick={create}>
          <Plus className="h-4 w-4" />
          Nova empresa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome fantasia</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo de cliente</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.nomeFantasia}</TableCell>
                  <TableCell>{tenant.cnpj}</TableCell>
                  <TableCell>{labelFrom(customerTypeLabels, tenant.tipoCliente)}</TableCell>
                  <TableCell>{tenant.responsavelNome}</TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} label={labelFrom(statusLabels, tenant.status)} />
                  </TableCell>
                  <TableCell>{planById.get(tenant.planoId)?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(tenant.valorMensal)}</TableCell>
                  <TableCell>{formatDateBR(tenant.dataVencimento)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label={`Ações de ${tenant.nomeFantasia}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/empresas/${tenant.id}`}>Ver detalhes</Link>
                        </DropdownMenuItem>
                        {(tenant.status === "ativo" || tenant.status === "teste") ? (
                          <DropdownMenuItem onSelect={() => { setEditing(tenant); setOpen(true); }}>
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        ) : null}
                        {tenant.status === "teste" ? (
                          <DropdownMenuItem onSelect={() => updateStatus(tenant.id, "ativo")}>
                            <PlayCircle className="h-4 w-4" />
                            Ativar
                          </DropdownMenuItem>
                        ) : null}
                        {(tenant.status === "ativo" || tenant.status === "teste") ? (
                          <DropdownMenuItem onSelect={() => updateStatus(tenant.id, "suspenso")}>
                            <PauseCircle className="h-4 w-4" />
                            Suspender
                          </DropdownMenuItem>
                        ) : null}
                        {(tenant.status === "suspenso" || tenant.status === "cancelado") ? (
                          <DropdownMenuItem onSelect={() => updateStatus(tenant.id, "ativo")}>
                            <RotateCcw className="h-4 w-4" />
                            Reativar
                          </DropdownMenuItem>
                        ) : null}
                        {tenant.status !== "cancelado" ? (
                          <DropdownMenuItem onSelect={() => updateStatus(tenant.id, "cancelado")}>
                            <Archive className="h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        ) : null}
                        {tenant.status !== "inativo" ? (
                          <DropdownMenuItem onSelect={() => updateStatus(tenant.id, "inativo")}>
                            <Archive className="h-4 w-4" />
                            Inativar
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {visibleTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing?.nomeFantasia ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>
              Dados comerciais, módulo contratado e controle financeiro do cliente.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form action={save} className="space-y-5">
              <input type="hidden" name="id" value={editing.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field name="nomeFantasia" label="Nome fantasia" defaultValue={editing.nomeFantasia} />
                <Field name="razaoSocial" label="Razão social" defaultValue={editing.razaoSocial} />
                <Field name="cnpj" label="CNPJ" defaultValue={editing.cnpj} />
                <CustomerTypeSelect name="tipoCliente" label="Tipo de cliente" defaultValue={editing.tipoCliente} />
                <Field name="responsavelNome" label="Responsável" defaultValue={editing.responsavelNome} />
                <Field
                  name="responsavelEmail"
                  label="E-mail"
                  type="email"
                  defaultValue={editing.responsavelEmail}
                />
                <Field name="responsavelWhatsapp" label="WhatsApp" defaultValue={editing.responsavelWhatsapp} />
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <select
                    name="planoId"
                    defaultValue={editing.planoId}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
                <StatusSelect name="status" label="Status" defaultValue={editing.status} />
                <Field
                  name="valorMensal"
                  label="Valor mensal"
                  defaultValue={formatCurrencyBRL(editing.valorMensal)}
                />
                <Field
                  name="dataVencimento"
                  label="Data de vencimento"
                  type="date"
                  defaultValue={editing.dataVencimento?.slice(0, 10)}
                />
                <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                  <input
                    id="autoCreatePharmacy"
                    name="autoCreatePharmacy"
                    type="checkbox"
                    defaultChecked={!tenants.some((tenant) => tenant.id === editing.id) && editing.tipoCliente === "pharmacy"}
                    className="mt-1"
                  />
                  <Label htmlFor="autoCreatePharmacy" className="text-sm leading-5">
                    Criar farmácia/CNPJ operacional automaticamente com os mesmos dados da empresa.
                  </Label>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Observações internas</Label>
                  <Textarea
                    name="observacoesInternas"
                    defaultValue={editing.observacoesInternas}
                    placeholder="Notas comerciais, suporte, cobrança..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar empresa</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function remoteTenantCrudEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").trim();
  }
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").trim();
}
