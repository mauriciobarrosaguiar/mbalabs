"use client";

import { useActionState } from "react";
import { createUserAccessAction, type CreateUserAccessState } from "@/modules/cotacoes/lib/actions/users";
import type { TenantOption } from "@/modules/cotacoes/lib/auth/users";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/modules/cotacoes/components/ui/select";
import { customerTypeLabels, labelFrom, userRoleLabels } from "@/modules/cotacoes/lib/labels";

const initialState: CreateUserAccessState = { error: null };

export function UserInviteForm({ tenants = [] }: { tenants?: TenantOption[] }) {
  const [state, formAction, pending] = useActionState(createUserAccessAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {state.error && (
        <p role="alert" aria-live="polite" className="col-span-full rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-user-name">Nome</Label>
        <Input id="new-user-name" name="fullName" required autoComplete="name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-user-email">E-mail</Label>
        <Input id="new-user-email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="space-y-2">
        <Label>Perfil</Label>
        <Select name="role" defaultValue="COMPRADOR">
          <SelectTrigger aria-label="Perfil"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN_EMPRESA">{userRoleLabels.ADMIN_EMPRESA}</SelectItem>
            <SelectItem value="COMPRADOR">{userRoleLabels.COMPRADOR}</SelectItem>
            <SelectItem value="CONFERENTE">{userRoleLabels.CONFERENTE}</SelectItem>
            <SelectItem value="FINANCEIRO">{userRoleLabels.FINANCEIRO}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Empresa</Label>
        <Select name="tenantId" defaultValue={tenants[0]?.id ?? "none"}>
          <SelectTrigger aria-label="Empresa"><SelectValue placeholder="Selecione a farmácia" /></SelectTrigger>
          <SelectContent>
            {tenants.length === 0 && <SelectItem value="none">Cadastre uma farmácia primeiro</SelectItem>}
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} · {labelFrom(customerTypeLabels, tenant.type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue="ativo">
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="convidado">Convidado</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-user-password">Senha provisória exclusiva (10+ caracteres)</Label>
        <Input
          id="new-user-password"
          name="temporaryPassword"
          type="password"
          minLength={10}
          pattern="(?!Alterar@123$).{10,}"
          title="Use uma senha exclusiva com pelo menos 10 caracteres. A senha padrão não é permitida."
          autoComplete="new-password"
          required
        />
      </div>

      <p className="col-span-full text-xs text-slate-600">
        Se o e-mail já estiver cadastrado no MBA Labs, será vinculado ao MBA Cotações sem alterar a senha atual.
        Para usuários novos, a senha temporária escolhida será utilizada no primeiro acesso.
      </p>
      <input type="hidden" name="mustChangePassword" value="true" />
      <div className="flex items-end">
        <Button className="w-full" type="submit" disabled={pending || tenants.length === 0}>
          {pending ? "Criando acesso..." : "Criar acesso"}
        </Button>
      </div>
    </form>
  );
}
