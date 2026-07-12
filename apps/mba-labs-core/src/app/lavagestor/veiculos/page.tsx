import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { deleteVeiculo, saveVeiculo } from "@/lib/actions/lavagestor-actions";
import { getLavaLookups, listLavaVeiculos } from "@/lib/lavagestor-data";
import { firstParam } from "@/lib/form-utils";
import { requireLavaGestorOwnerAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function VeiculosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorOwnerAccess("/lavagestor/veiculos");
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const [{ rows, error }, lookups] = await Promise.all([listLavaVeiculos(search), getLavaLookups()]);
  const editing = rows.find((row) => row.id === editId);
  const clientes = lookups.clientes.map((cliente) => ({ label: String(cliente.nome), value: String(cliente.id) }));

  return (
    <LavaGestorShell activePath="/lavagestor/veiculos" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Veículos"
          description="Vincule veículos aos clientes para facilitar o atendimento."
          actions={<BackButton href="/lavagestor/operacao" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por placa, modelo, marca ou cliente" />

        <form action={saveVeiculo}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar veículo" : "Novo Veículo"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar veículo"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/veiculos">Cancelar</Link> : null}
              </>
            }
          >
            <FormSelect label="Cliente" name="cliente_id" options={clientes} defaultValue={String(editing?.cliente_id ?? "")} required />
            <FormSelect
              label="Tipo"
              name="tipo"
              options={[
                { label: "Carro", value: "carro" },
                { label: "Moto", value: "moto" },
                { label: "Caminhonete", value: "caminhonete" },
                { label: "Caminhão", value: "caminhao" },
                { label: "Sofá", value: "sofa" },
                { label: "Tapete", value: "tapete" },
                { label: "Máquina", value: "maquina" },
                { label: "Outro", value: "outro" }
              ]}
              defaultValue={String(editing?.tipo ?? "")}
            />
            <FormInput label="Placa" name="placa" defaultValue={String(editing?.placa ?? "")} />
            <FormInput label="Marca" name="marca" defaultValue={String(editing?.marca ?? "")} />
            <FormInput label="Modelo" name="modelo" defaultValue={String(editing?.modelo ?? "")} />
            <FormInput label="Cor" name="cor" defaultValue={String(editing?.cor ?? "")} />
            <FormTextarea label="Observação" name="observacao" defaultValue={String(editing?.observacao ?? "")} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "cliente", label: "Cliente" },
            { key: "placa", label: "Placa" },
            { key: "modelo", label: "Modelo" },
            { key: "marca", label: "Marca" },
            { key: "cor", label: "Cor" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/lavagestor/veiculos?edit=${row.id}`}>
                Editar
              </Link>
              <Link className="button-secondary" href={`/lavagestor/veiculos/${row.id}`}>
                Historico
              </Link>
              <form action={deleteVeiculo}>
                <input name="id" type="hidden" value={String(row.id)} />
                <DeleteButton>Excluir</DeleteButton>
              </form>
            </div>
          )}
        />
      </section>
    </LavaGestorShell>
  );
}
