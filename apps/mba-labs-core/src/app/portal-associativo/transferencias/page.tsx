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
          title="Transferir unidade"
          description="Use esta tela quando uma chácara ou lote trocar de dono. O histórico será mantido."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalTransferencia}>
            <ResourceForm
              title="Troca de dono passo a passo"
              actions={
                <details className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <summary className="cursor-pointer text-sm font-black text-amber-900">8. Revisar e confirmar</summary>
                  <p className="my-2 max-w-md text-sm text-amber-900">Confira a unidade, o novo dono e quem ficará responsável pelos débitos. Esta ação encerra os vínculos atuais e mantém o histórico.</p>
                  <SubmitButton>Confirmar transferência</SubmitButton>
                </details>
              }
            >
              <h3 className="col-span-full text-base font-black">1. Escolha a unidade</h3>
              <FormSelect label="Unidade" name="unidade_id" options={unitOptions} required />
              <h3 className="col-span-full mt-2 text-base font-black">2 a 4. Defina os novos responsáveis</h3>
              <FormSelect label="Novo proprietário" name="nova_pessoa_id" options={personOptions} required />
              <FormSelect label="Responsável pelo pagamento" name="responsavel_financeiro_id" options={personOptions} />
              <FormSelect label="Responsável de contato" name="responsavel_contato_id" options={personOptions} />
              <h3 className="col-span-full mt-2 text-base font-black">5 e 6. Decida sobre os débitos</h3>
              <FormDateInput label="Data da transferência" name="data_transferencia" />
              <FormSelect
                label="Débitos anteriores"
                name="responsabilidade_debitos"
                defaultValue="novo_responsavel"
                options={[
                  { value: "antigo_responsavel", label: "Antigo responsável" },
                  { value: "novo_responsavel", label: "Novo responsável" },
                  { value: "dividido", label: "Dividido" },
                  { value: "quitado", label: "Quitado" }
                ]}
                required
              />
              <p className="col-span-full rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground">Antes de confirmar, abra a ficha da unidade em outra aba para conferir as cobranças abertas e vencidas.</p>
              <h3 className="col-span-full mt-2 text-base font-black">7. Documento e motivo</h3>
              <FormInput label="Documento da transferência" name="documento_url" placeholder="Link ou caminho no armazenamento" />
              <FormTextarea label="Motivo" name="motivo" />
              <FormTextarea label="Observações" name="observacoes" />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "data_transferencia", label: "Data" },
            { key: "unidade", label: "Unidade" },
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
