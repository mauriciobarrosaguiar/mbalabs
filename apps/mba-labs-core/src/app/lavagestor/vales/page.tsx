import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormDateInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { saveVale, updateValeStatus } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaLookups, listLavaVales } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ValesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const [{ rows, error }, lookups] = await Promise.all([listLavaVales(search), getLavaLookups()]);
  const funcionarios = lookups.funcionarios.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <LavaGestorShell activePath="/lavagestor/vales">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Vales"
          description="Registre adiantamentos de funcionários e marque quando forem descontados."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por funcionário, descrição ou status" />

        <form action={saveVale}>
          <ResourceForm title="Novo Vale" actions={<SubmitButton>Salvar vale</SubmitButton>}>
            <FormSelect label="Funcionário" name="funcionario_id" options={funcionarios} required />
            <FormMoneyInput label="Valor" name="valor" required />
            <FormDateInput label="Data do vale" name="data_vale" defaultValue={today} required />
            <FormTextarea label="Descrição" name="descricao" />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "funcionario", label: "Funcionário" },
            { key: "valor", label: "Valor" },
            { key: "descricao", label: "Descrição" },
            { key: "data_vale", label: "Data" },
            { key: "status", label: "Status" }
          ]}
          rows={rows.map((row) => ({ ...row, valor: formatMoney(row.valor), data_vale: formatDate(row.data_vale) }))}
          actions={(row) =>
            row.status === "aberto" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <form action={updateValeStatus}>
                  <input name="id" type="hidden" value={String(row.id)} />
                  <input name="status" type="hidden" value="descontado" />
                  <SubmitButton>Marcar descontado</SubmitButton>
                </form>
                <form action={updateValeStatus}>
                  <input name="id" type="hidden" value={String(row.id)} />
                  <input name="status" type="hidden" value="cancelado" />
                  <DeleteButton>Cancelar</DeleteButton>
                </form>
              </div>
            ) : null
          }
        />
      </section>
    </LavaGestorShell>
  );
}
