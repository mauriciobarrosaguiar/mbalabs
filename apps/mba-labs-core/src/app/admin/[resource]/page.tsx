import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
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

  const { rows, error } = await getAdminRows(resource as AdminResource);
  const options = await getAdminOptions();
  const editId = firstParam(query.edit);
  const editing = rows.find((row) => row.id === editId);
  const displayRows = formatAdminRows(rows);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Administração"
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

        {resource === "usuarios" ? (
          <p className="rounded-[8px] border border-sky-300/30 bg-sky-300/10 p-3 text-sm leading-6 text-sky-100">
            Este formulário cria e edita o perfil do usuário no portal. A criação automática da conta no Supabase Auth
            fica para uma próxima etapa com rota server-side usando service_role.
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
                  <SubmitButton>{editing ? "Salvar alterações" : "Salvar"}</SubmitButton>
                  {editing ? <Link className="button-secondary" href={`/admin/${resource}`}>Cancelar</Link> : null}
                </>
              }
            >
              {config.fields.map((field) => renderAdminField(field, editing, options))}
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
  field: AdminField,
  editing: Record<string, unknown> | undefined,
  options: Awaited<ReturnType<typeof getAdminOptions>>
) {
  const value = editing?.[field.name];
  const key = field.name;

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

function formatAdminRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const formatted = { ...row };
    for (const key of Object.keys(formatted)) {
      if (["created_at", "updated_at", "inicio", "vencimento", "pagamento_em"].includes(key)) {
        formatted[key] = formatDate(formatted[key]);
      }
      if (["valor", "valor_mensal"].includes(key)) {
        formatted[key] = formatMoney(formatted[key]);
      }
    }
    return formatted;
  });
}
