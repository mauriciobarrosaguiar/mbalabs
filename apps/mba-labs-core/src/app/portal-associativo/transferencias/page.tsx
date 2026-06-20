import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormDateInput,
  FormInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { savePortalTransferencia } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalTransferencias, unitOptionLabel } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalTransferenciasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await listPortalTransferencias();
  if (!canPortalAccess(data.perfil, "transferencias")) {
    redirect("/portal-associativo/painel-associado");
  }

  const lookups = await getPortalLookups("/portal-associativo/transferencias");
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({ value: String(person.id), label: String(person.nome_completo) }));
  const unitOptions = lookups.unidades.map((unit: Record<string, unknown>) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/transferencias"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Transferências"
          description="Transfira chácaras/lotes mantendo histórico, responsáveis, documento e responsabilidade por débitos."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalTransferencia}>
            <ResourceForm title="Nova transferência" actions={<SubmitButton>Registrar transferência</SubmitButton>}>
              <FormSelect label="Chácara/Lote" name="unidade_id" options={unitOptions} required />
              <FormSelect label="Novo proprietário" name="nova_pessoa_id" options={personOptions} required />
              <FormSelect label="Responsável financeiro" name="responsavel_financeiro_id" options={personOptions} />
              <FormSelect label="Responsável de contato" name="responsavel_contato_id" options={personOptions} />
              <FormDateInput label="Data da transferência" name="data_transferencia" />
              <FormSelect
                label="Débitos anteriores"
                name="responsabilidade_debitos"
                defaultValue="novo"
                options={[
                  { value: "anterior", label: "Responsável anterior" },
                  { value: "novo", label: "Novo responsável" },
                  { value: "dividida", label: "Responsabilidade dividida" },
                  { value: "entidade", label: "Assumido pela entidade" }
                ]}
                required
              />
              <FormInput label="Documento da transferência" name="documento_url" placeholder="Caminho no armazenamento" />
              <FormTextarea label="Motivo" name="motivo" />
              <FormTextarea label="Observações" name="observacoes" />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "data_transferencia", label: "Data" },
            { key: "unidade", label: "Chácara/Lote" },
            { key: "pessoa_anterior", label: "Anterior" },
            { key: "nova_pessoa", label: "Novo responsável" },
            { key: "responsabilidade_debitos", label: "Débitos" },
            { key: "motivo", label: "Motivo" }
          ]}
          rows={data.rows.map((row) => ({ ...row, data_transferencia: formatDate(row.data_transferencia) }))}
        />
      </section>
    </PortalAssociativoShell>
  );
}
