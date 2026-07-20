import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormDateInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatMoney,
  formatDate
} from "@/components/ui-kit";
import { savePortalTransferencia } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, getPortalUnidadeDetail, listPortalTransferencias, unitOptionLabel } from "@/lib/portal-associativo-data";

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
  const selectedUnitId = firstParam(params.unidade);
  const selected = selectedUnitId ? await getPortalUnidadeDetail(selectedUnitId) : null;
  const currentOwner = selected?.vinculos.find((row) => row.tipo_vinculo === "proprietario" && row.status_vinculo === "ativo" && !row.data_fim);
  const outstandingCharges = selected ? [...selected.cobrancasAbertas, ...selected.cobrancasVencidas].filter((row, index, rows) => rows.findIndex((item) => item.id === row.id) === index) : [];
  const outstandingTotal = outstandingCharges.reduce((total, row) => total + Number(row.valor_total ?? row.valor_original ?? 0), 0);

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
          <form className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" method="get">
            <h2 className="text-lg font-black">1. Escolha a unidade</h2>
            <p className="mt-1 text-sm text-muted-foreground">Primeiro selecione a chácara ou lote para conferir o dono atual e os débitos.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <FormSelect label="Unidade" name="unidade" options={unitOptions} defaultValue={selectedUnitId} required />
              <button className="button-primary min-h-11" type="submit">Continuar</button>
            </div>
          </form>
        ) : null}

        {canWrite && selected?.unidade ? (
          <form action={savePortalTransferencia} encType="multipart/form-data">
            <input name="unidade_id" type="hidden" value={selectedUnitId} />
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
              <div className="col-span-full grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-3">
                <div><span className="text-xs font-bold uppercase text-muted-foreground">Unidade</span><p className="font-black">{unitOptionLabel(selected.unidade)}</p></div>
                <div><span className="text-xs font-bold uppercase text-muted-foreground">Dono atual</span><p className="font-black">{String(currentOwner?.pessoa ?? "Sem proprietário definido")}</p></div>
                <div><span className="text-xs font-bold uppercase text-muted-foreground">Débitos em aberto</span><p className="font-black text-red-700">{formatMoney(outstandingTotal)} ({outstandingCharges.length})</p></div>
              </div>
              <h3 className="col-span-full mt-2 text-base font-black">2 a 4. Defina os novos responsáveis</h3>
              <FormSelect label="Novo proprietário" name="nova_pessoa_id" options={personOptions} required />
              <FormSelect label="Responsável pelo pagamento" name="responsavel_financeiro_id" options={personOptions} />
              <FormSelect label="Responsável de contato" name="responsavel_contato_id" options={personOptions} />
              <h3 className="col-span-full mt-2 text-base font-black">5 e 6. Decida sobre os débitos</h3>
              <FormDateInput label="Data da transferência" name="data_transferencia" />
              <FormSelect
                label="Débitos anteriores"
                name="responsabilidade_debitos"
                defaultValue="antigo_responsavel"
                options={[
                  { value: "antigo_responsavel", label: "Antigo responsável" },
                  { value: "novo_responsavel", label: "Novo responsável" },
                  { value: "dividido", label: "Dividido" },
                  { value: "quitado", label: "Quitado" }
                  ,{ value: "abonado", label: "Abonado pela associação" }
                ]}
                required
              />
              <p className="col-span-full rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground">Foram encontradas {outstandingCharges.length} cobrança(s) em aberto, totalizando {formatMoney(outstandingTotal)}. Escolha quem ficará responsável por esses débitos.</p>
              <h3 className="col-span-full mt-2 text-base font-black">7. Documento e motivo</h3>
              <label className="grid gap-1 text-sm font-semibold">Documento da transferência (opcional)<input accept="application/pdf,image/jpeg,image/png,image/webp" className="input" name="documento" type="file" /><span className="text-xs font-normal text-muted-foreground">O arquivo será guardado automaticamente no Dropbox ou Google Drive da associação.</span></label>
              <FormTextarea label="Motivo" name="motivo" />
              <FormTextarea label="Observações" name="observacoes" />
            </ResourceForm>
          </form>
        ) : canWrite && selectedUnitId ? <MessageBanner error="Não foi possível carregar esta unidade. Escolha outra e tente novamente." /> : null}

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
