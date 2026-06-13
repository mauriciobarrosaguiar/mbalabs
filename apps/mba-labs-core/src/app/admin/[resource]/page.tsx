import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AppPermissionFields } from "@/components/AppPermissionFields";
import {
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { deleteAdminResource, saveAdminResource } from "@/lib/actions/admin-actions";
import { firstParam } from "@/lib/form-utils";
import {
  type AdminField,
  type AdminResource,
  getAdminOptions,
  getAdminResource,
  getAdminRows
} from "@/lib/core-data";

export const dynamic = "force-dynamic";

const resources = [
  "categorias-empresas",
  "empresas",
  "usuarios",
  "apps",
  "planos",
  "assinaturas",
  "pagamentos",
  "logs"
];

export default async function AdminResourcePage({
  params,
  searchParams
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resource } = await params;
  const query = await searchParams;
  const config = getAdminResource(resource);

  if (!config) {
    notFound();
  }

  const options = await getAdminOptions();
  const filters = {
    categoria: firstParam(query.categoria),
    status: firstParam(query.status),
    app: firstParam(query.app),
    cidade: firstParam(query.cidade),
    estado: firstParam(query.estado),
    q: firstParam(query.q)
  };
  const { rows, error } = await getAdminRows(resource as AdminResource, filters);
  const editId = firstParam(query.edit);
  const editing = rows.find((row) => row.id === editId);
  const displayRows = formatAdminRows(rows);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Administracao"
          title={config.title}
          description={
            config.readOnly
              ? "Tela de leitura para auditoria dos registros."
              : "Cadastre, edite e inative registros administrativos do portal."
          }
          actions={
            !config.readOnly && editing ? (
              <Link className="button-primary" href={`/admin/${resource}`}>
                Novo
              </Link>
            ) : null
          }
        />

        <div className="flex flex-wrap gap-2">
          {resources.map((item) => (
            <Link
              className={`rounded-[8px] border px-3 py-2 text-sm font-bold ${
                item === resource ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"
              }`}
              href={`/admin/${item}`}
              key={item}
            >
              {item}
            </Link>
          ))}
        </div>

        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? error ?? undefined} />

        {resource === "empresas" ? <EmpresaFilters options={options} filters={filters} /> : null}

        {resource === "usuarios" ? (
          <p className="rounded-[8px] border border-sky-300/30 bg-sky-300/10 p-3 text-sm leading-6 text-sky-100">
            Este formulario cria a conta no Supabase Auth quando uma senha provisoria e informada e grava a permissao do
            app selecionado.
          </p>
        ) : null}

        {!config.readOnly ? (
          <form action={saveAdminResource}>
            <input name="resource" type="hidden" value={resource} />
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? `Editar ${config.title}` : `Novo registro em ${config.title}`}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alteracoes" : "Salvar"}</SubmitButton>
                  {editing ? (
                    <Link className="button-secondary" href={`/admin/${resource}`}>
                      Cancelar
                    </Link>
                  ) : null}
                </>
              }
            >
              {config.fields.map((field) => renderAdminField(resource as AdminResource, field, editing, options))}
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={config.columns}
          rows={displayRows}
          actions={
            config.readOnly
              ? undefined
              : (row) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link className="button-secondary" href={`/admin/${resource}?edit=${row.id}`}>
                      Editar
                    </Link>
                    {resource === "empresas" ? (
                      <Link className="button-secondary" href={`/admin/empresas/${row.id}/apps`}>
                        Apps
                      </Link>
                    ) : null}
                    {resource === "apps" ? (
                      <Link className="button-secondary" href={`/admin/empresas?app=${row.id}`}>
                        Empresas
                      </Link>
                    ) : null}
                    <form action={deleteAdminResource}>
                      <input name="resource" type="hidden" value={resource} />
                      <input name="id" type="hidden" value={String(row.id)} />
                      <DeleteButton>{config.inactiveField ? "Inativar" : "Excluir"}</DeleteButton>
                    </form>
                  </div>
                )
          }
        />
      </section>
    </main>
  );
}

function renderAdminField(
  resource: AdminResource,
  field: AdminField,
  editing: Record<string, unknown> | undefined,
  options: Awaited<ReturnType<typeof getAdminOptions>>
) {
  const value = editing?.[field.name];
  const key = field.name;

  if (resource === "usuarios" && field.name === "app_id") {
    return (
      <AppPermissionFields
        apps={options.apps}
        defaultAppId={String(editing?.app_id ?? "")}
        defaultProfile={String(editing?.perfil_app ?? "")}
        key={key}
      />
    );
  }

  if (resource === "usuarios" && field.name === "perfil_app") {
    return null;
  }

  if (field.type === "select") {
    return (
      <FormSelect
        key={key}
        label={field.label}
        name={field.name}
        defaultValue={String(value ?? "")}
        options={field.options ?? (field.optionSource ? options[field.optionSource] : [])}
        required={field.required}
      />
    );
  }

  if (field.type === "boolean") {
    return <FormCheckbox key={key} label={field.label} name={field.name} defaultChecked={editing ? value !== false : true} />;
  }

  if (field.type === "textarea") {
    return <FormTextarea key={key} label={field.label} name={field.name} defaultValue={String(value ?? "")} />;
  }

  if (field.type === "date") {
    return (
      <FormDateInput
        key={key}
        label={field.label}
        name={field.name}
        defaultValue={value ? String(value).slice(0, 10) : ""}
        required={field.required}
      />
    );
  }

  if (field.type === "number" && field.name.includes("valor")) {
    return (
      <FormMoneyInput
        key={key}
        label={field.label}
        name={field.name}
        defaultValue={String(value ?? "")}
        required={field.required}
      />
    );
  }

  return (
    <FormInput
      key={key}
      label={field.label}
      name={field.name}
      type={field.type === "number" ? "number" : field.type}
      min={field.type === "number" ? "0" : undefined}
      step={field.type === "number" ? "0.01" : undefined}
      defaultValue={String(value ?? "")}
      required={field.required}
    />
  );
}

function EmpresaFilters({
  options,
  filters
}: {
  options: Awaited<ReturnType<typeof getAdminOptions>>;
  filters: Record<string, string | undefined>;
}) {
  return (
    <form className="panel grid gap-4 p-4 md:grid-cols-3" action="/admin/empresas">
      <FormSelect
        label="Categoria"
        name="categoria"
        defaultValue={filters.categoria ?? ""}
        options={options.categorias}
      />
      <FormSelect
        label="Status"
        name="status"
        defaultValue={filters.status ?? ""}
        options={[
          { label: "Ativa", value: "ativa" },
          { label: "Teste", value: "teste" },
          { label: "Bloqueada", value: "bloqueada" },
          { label: "Cancelada", value: "cancelada" }
        ]}
      />
      <FormSelect label="App contratado" name="app" defaultValue={filters.app ?? ""} options={options.apps} />
      <FormInput label="Cidade" name="cidade" defaultValue={filters.cidade ?? ""} />
      <FormInput label="Estado" name="estado" defaultValue={filters.estado ?? ""} />
      <FormInput label="Busca" name="q" defaultValue={filters.q ?? ""} placeholder="Nome, CNPJ ou responsavel" />
      <div className="flex items-end gap-2 md:col-span-3">
        <button className="button-primary" type="submit">
          Filtrar
        </button>
        <Link className="button-secondary" href="/admin/empresas">
          Limpar
        </Link>
      </div>
    </form>
  );
}

function formatAdminRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const formatted = { ...row };
    for (const key of Object.keys(formatted)) {
      if (["created_at", "updated_at", "inicio", "vencimento", "pagamento_em", "data_inicio", "data_vencimento"].includes(key)) {
        formatted[key] = formatDate(formatted[key]);
      }
      if (["valor", "valor_mensal"].includes(key)) {
        formatted[key] = formatMoney(formatted[key]);
      }
    }
    return formatted;
  });
}
