import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import {
  DataTable,
  DeleteButton,
  FormDateInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { cancelEmpresaApp, saveEmpresaApp } from "@/lib/actions/admin-actions";
import { firstParam } from "@/lib/form-utils";
import { getEmpresaAppsAdminData } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function EmpresaAppsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getEmpresaAppsAdminData(id);
  const editId = firstParam(query.edit);
  const editing = data.vinculos.find((row) => row.id === editId);
  const rows = data.vinculos.map((row) => ({
    ...row,
    data_inicio: formatDate(row.data_inicio),
    data_vencimento: formatDate(row.data_vencimento)
  }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Empresa x app"
          title={`Apps contratados: ${data.empresa.nome_fantasia ?? data.empresa.nome ?? "Empresa"}`}
          description="Vincule sistemas contratados, defina plano, status e vencimento da assinatura."
          actions={
            <Link className="button-secondary" href="/admin/empresas">
              Voltar
            </Link>
          }
        />

        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? data.error ?? undefined} />

        <form action={saveEmpresaApp}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <input name="empresa_id" type="hidden" value={id} />
          <ResourceForm
            title={editing ? "Editar app contratado" : "Vincular app contratado"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alteracoes" : "Vincular app"}</SubmitButton>
                {editing ? (
                  <Link className="button-secondary" href={`/admin/empresas/${id}/apps`}>
                    Cancelar
                  </Link>
                ) : null}
              </>
            }
          >
            <FormSelect
              label="App"
              name="app_id"
              defaultValue={String(editing?.app_id ?? "")}
              options={data.apps}
              required
            />
            <FormSelect
              label="Plano"
              name="plano_id"
              defaultValue={String(editing?.plano_id ?? "")}
              options={data.planos}
            />
            <FormSelect
              label="Status"
              name="status"
              defaultValue={String(editing?.status ?? "ativo")}
              options={[
                { label: "Ativo", value: "ativo" },
                { label: "Teste", value: "teste" },
                { label: "Vencido", value: "vencido" },
                { label: "Bloqueado", value: "bloqueado" },
                { label: "Cancelado", value: "cancelado" }
              ]}
              required
            />
            <FormDateInput
              label="Data de inicio"
              name="data_inicio"
              defaultValue={editing?.data_inicio ? String(editing.data_inicio).slice(0, 10) : new Date().toISOString().slice(0, 10)}
              required
            />
            <FormDateInput
              label="Data de vencimento"
              name="data_vencimento"
              defaultValue={editing?.data_vencimento ? String(editing.data_vencimento).slice(0, 10) : ""}
            />
            <FormTextarea label="Observacoes" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "app", label: "App" },
            { key: "plano", label: "Plano" },
            { key: "status", label: "Status" },
            { key: "data_inicio", label: "Inicio" },
            { key: "data_vencimento", label: "Vencimento" }
          ]}
          rows={rows}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/admin/empresas/${id}/apps?edit=${row.id}`}>
                Editar
              </Link>
              <form action={cancelEmpresaApp}>
                <input name="id" type="hidden" value={String(row.id)} />
                <input name="empresa_id" type="hidden" value={id} />
                <DeleteButton>Cancelar vinculo</DeleteButton>
              </form>
            </div>
          )}
        />
      </section>
    </main>
  );
}
