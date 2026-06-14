import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormInput,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { deleteCliente, saveCliente } from "@/lib/actions/lavagestor-actions";
import { listLavaClientes } from "@/lib/lavagestor-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listLavaClientes(search);
  const editing = rows.find((row) => row.id === editId);

  return (
    <LavaGestorShell activePath="/lavagestor/clientes">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Clientes"
          description="Cadastre clientes atendidos pelo lava-jato e mantenha WhatsApp, documento e observações em ordem."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome, telefone, email ou documento" />

        <form action={saveCliente}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar cliente" : "Novo Cliente"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar cliente"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/clientes">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormInput label="WhatsApp" name="telefone" defaultValue={String(editing?.telefone ?? "")} required />
            <FormInput label="Email" name="email" type="email" defaultValue={String(editing?.email ?? "")} />
            <FormInput label="Documento" name="documento" defaultValue={String(editing?.documento ?? "")} />
            <FormTextarea label="Observação" name="observacao" defaultValue={String(editing?.observacao ?? "")} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "telefone", label: "Telefone" },
            { key: "email", label: "Email" },
            { key: "documento", label: "Documento" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/lavagestor/clientes?edit=${row.id}`}>
                Editar
              </Link>
              <Link className="button-secondary" href={`/lavagestor/veiculos?q=${encodeURIComponent(String(row.nome ?? ""))}`}>
                Ver veículos
              </Link>
              <Link className="button-primary" href={`/lavagestor/nova-lavagem?cliente=${row.id}`}>
                Nova lavagem
              </Link>
              <form action={deleteCliente}>
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
