import Link from "next/link";
import { AdminDataTable } from "@/components/AdminDataTable";
import { AdminNav } from "@/components/AdminNav";
import { CotacoesAppAccessField } from "@/components/CotacoesAppAccessField";
import {
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
    data_vencimento: formatDate(row.data_vencimento),
    cotacoes_tipo_acesso_label: formatCotacoesAccess(row.cotacoes_tipo_acesso)
  }));

  return (
    <main className="min-h-screen">
      <AdminNav />
      <div className="lg:pl-[280px]">
        <section className="page-shell grid gap-6 py-5 sm:py-8">
          <div className="[&_h1]:text-3xl sm:[&_h1]:text-4xl">
            <PageHeader
              eyebrow="Clientes · Apps contratados"
              title={String(data.empresa.nome_fantasia ?? data.empresa.nome ?? "Empresa")}
              description="Vincule somente os sistemas contratados por esta empresa e defina plano, acesso, situação e vencimento."
              actions={
                <Link className="button-secondary" href="/admin/empresas">
                  Voltar às empresas
                </Link>
              }
            />
          </div>

          <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? data.error ?? undefined} />

          <section className="grid gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Contratações</p>
              <h2 className="mt-1 text-lg font-black text-white">Apps vinculados</h2>
            </div>
            <AdminDataTable
              columns={[
                { key: "app", label: "App" },
                { key: "plano", label: "Plano" },
                { key: "cotacoes_tipo_acesso_label", label: "Acesso MBA Cotações" },
                { key: "status", label: "Status" },
                { key: "data_inicio", label: "Início" },
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
                    <DeleteButton>Cancelar vínculo</DeleteButton>
                  </form>
                </div>
              )}
            />
          </section>

          <form action={saveEmpresaApp}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <input name="empresa_id" type="hidden" value={id} />
            <ResourceForm
              title={editing ? "Editar app contratado" : "Vincular novo app"}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alterações" : "Vincular app"}</SubmitButton>
                  {editing ? (
                    <Link className="button-secondary" href={`/admin/empresas/${id}/apps`}>
                      Cancelar
                    </Link>
                  ) : null}
                </>
              }
            >
              <CotacoesAppAccessField
                apps={data.apps}
                defaultAppId={String(editing?.app_id ?? "")}
                defaultAccess={String(editing?.cotacoes_tipo_acesso ?? "both")}
              />
              <FormSelect label="Plano" name="plano_id" defaultValue={String(editing?.plano_id ?? "")} options={data.planos} />
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
                label="Data de início"
                name="data_inicio"
                defaultValue={editing?.data_inicio ? String(editing.data_inicio).slice(0, 10) : new Date().toISOString().slice(0, 10)}
                required
              />
              <FormDateInput
                label="Data de vencimento"
                name="data_vencimento"
                defaultValue={editing?.data_vencimento ? String(editing.data_vencimento).slice(0, 10) : ""}
              />
              <FormTextarea label="Observações" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
            </ResourceForm>
          </form>
        </section>
      </div>
    </main>
  );
}

function formatCotacoesAccess(value: unknown) {
  if (value === "pharmacy") return "Farmácia";
  if (value === "distributor_bidding") return "Licitação";
  if (value === "both") return "Farmácia + Licitação";
  return "-";
}
