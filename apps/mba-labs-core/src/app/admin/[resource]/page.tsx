import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Filter, Plus } from "lucide-react";
import { AdminDataTable } from "@/components/AdminDataTable";
import { AdminNav } from "@/components/AdminNav";
import { AppPermissionFields } from "@/components/AppPermissionFields";
import { AssinaturaFields } from "@/components/AssinaturaFields";
import {
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

const allowedResources = [
  "categorias-empresas",
  "empresas",
  "usuarios",
  "apps",
  "planos",
  "assinaturas",
  "pagamentos",
  "logs"
];

const resourceMeta: Record<string, { section: string; description: string; singular: string }> = {
  "categorias-empresas": {
    section: "Produtos",
    description: "Organize os tipos de empresas atendidas pelo MBA Labs sem misturar cadastros de clientes.",
    singular: "categoria"
  },
  empresas: {
    section: "Clientes",
    description: "Gerencie empresas, situação de acesso, responsáveis e sistemas contratados em um só lugar.",
    singular: "empresa"
  },
  usuarios: {
    section: "Clientes",
    description: "Gerencie contas, perfis e permissões de acesso aos sistemas contratados.",
    singular: "usuário"
  },
  apps: {
    section: "Produtos",
    description: "Administre os sistemas disponíveis no portal e seus dados de publicação.",
    singular: "app"
  },
  planos: {
    section: "Produtos",
    description: "Configure os planos comerciais disponíveis para cada sistema.",
    singular: "plano"
  },
  assinaturas: {
    section: "Financeiro",
    description: "Acompanhe vínculos comerciais, vencimentos e situação das assinaturas.",
    singular: "assinatura"
  },
  pagamentos: {
    section: "Financeiro",
    description: "Consulte e administre os registros financeiros do portal.",
    singular: "pagamento"
  },
  logs: {
    section: "Sistema",
    description: "Consulte a trilha de auditoria das ações administrativas importantes.",
    singular: "registro"
  }
};

export default async function AdminResourcePage({
  params,
  searchParams
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resource } = await params;
  const query = await searchParams;

  if (!allowedResources.includes(resource)) {
    notFound();
  }

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
  const meta = resourceMeta[resource] ?? {
    section: "Administração",
    description: config.readOnly ? "Tela de leitura para auditoria dos registros." : "Gerencie os registros administrativos do portal.",
    singular: "registro"
  };

  return (
    <main className="min-h-screen">
      <AdminNav />
      <div className="lg:pl-[280px]">
        <section className="page-shell grid gap-5 py-5 sm:gap-6 sm:py-8">
          <div className="[&_h1]:text-3xl sm:[&_h1]:text-4xl">
            <PageHeader
              eyebrow={meta.section}
              title={config.title}
              description={meta.description}
              actions={
                !config.readOnly && editing ? (
                  <Link className="button-secondary" href={`/admin/${resource}`}>
                    Cancelar edição
                  </Link>
                ) : null
              }
            />
          </div>

          <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? error ?? undefined} />

          {resource === "empresas" ? <EmpresaFilters options={options} filters={filters} /> : null}

          {resource === "usuarios" ? (
            <p className="rounded-xl border border-sky-300/20 bg-sky-300/[0.07] p-3 text-sm leading-6 text-sky-100">
              Defina os dados do usuário, uma senha provisória e somente os apps que essa conta poderá acessar.
            </p>
          ) : null}

          {resource === "apps" ? (
            <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm leading-6 text-amber-100">
              A URL interna precisa existir no código antes de ser usada. Esta tela não cria nem altera o código dos sistemas.
            </p>
          ) : null}

          <section className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Registros</p>
                <h2 className="mt-1 text-lg font-black text-white">{config.title} cadastrados</h2>
              </div>
              {!config.readOnly && !editing ? (
                <a className="button-primary inline-flex items-center gap-2" href="#cadastro-admin">
                  <Plus size={16} />
                  Novo {meta.singular}
                </a>
              ) : null}
            </div>

            <AdminDataTable
              columns={config.columns}
              rows={displayRows}
              showToolbar={resource !== "empresas"}
              actions={
                config.readOnly
                  ? undefined
                  : (row) => renderRowActions(resource as AdminResource, row, Boolean(config.inactiveField))
              }
            />
          </section>

          {!config.readOnly ? (
            <details
              className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]"
              id="cadastro-admin"
              open={Boolean(editing)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">Cadastro</p>
                  <h2 className="mt-1 text-base font-black text-white sm:text-lg">
                    {editing ? `Editar ${meta.singular}` : `Adicionar ${meta.singular}`}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {editing ? "Altere somente os campos necessários e salve." : "Abra apenas quando precisar criar um novo registro."}
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition group-open:rotate-180">
                  <ChevronDown size={18} />
                </span>
              </summary>

              <div className="border-t border-white/8 p-3 sm:p-4">
                <form action={saveAdminResource}>
                  <input name="resource" type="hidden" value={resource} />
                  <input name="id" type="hidden" value={String(editing?.id ?? "")} />
                  <ResourceForm
                    title={editing ? `Editar ${config.title}` : `Novo registro em ${config.title}`}
                    actions={
                      <>
                        <SubmitButton>{editing ? "Salvar alterações" : "Salvar"}</SubmitButton>
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
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function renderRowActions(resource: AdminResource, row: Record<string, unknown>, inactiveField: boolean) {
  const editHref = `/admin/${resource}?edit=${row.id}`;

  if (resource === "empresas") {
    return (
      <div className="flex justify-end">
        <div className="hidden flex-wrap justify-end gap-2 xl:flex">
          <Link className="button-secondary" href={editHref}>
            Editar
          </Link>
          <Link className="button-secondary" href={`/admin/empresas/${row.id}/apps`}>
            Apps
          </Link>
          <AdminDeleteForm id={row.id} resource={resource} mode="inactivate" label="Inativar" />
        </div>

        <details className="group/actions w-full xl:hidden">
          <summary className="button-secondary flex min-h-10 w-full cursor-pointer list-none items-center justify-center gap-2 [&::-webkit-details-marker]:hidden">
            Ações
            <ChevronDown className="transition group-open/actions:rotate-180" size={15} />
          </summary>
          <div className="mt-2 grid gap-2 rounded-xl border border-white/8 bg-black/15 p-2 [&_a]:w-full [&_button]:w-full">
            <Link className="button-secondary text-center" href={editHref}>
              Editar dados
            </Link>
            <Link className="button-secondary text-center" href={`/admin/empresas/${row.id}/apps`}>
              Gerenciar apps
            </Link>
            <AdminDeleteForm id={row.id} resource={resource} mode="inactivate" label="Inativar empresa" />
            <div className="mt-1 border-t border-rose-400/15 pt-2">
              <AdminDeleteForm id={row.id} resource={resource} mode="delete" label="Excluir permanentemente" />
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link className="button-secondary" href={editHref}>
        Editar
      </Link>
      {resource === "apps" ? (
        <Link className="button-secondary" href={`/admin/empresas?app=${row.id}`}>
          Empresas
        </Link>
      ) : null}
      <AdminDeleteForm
        id={row.id}
        resource={resource}
        mode="inactivate"
        label={inactiveField ? "Inativar" : "Excluir"}
      />
    </div>
  );
}

function AdminDeleteForm({
  id,
  resource,
  mode,
  label
}: {
  id: unknown;
  resource: AdminResource;
  mode: "inactivate" | "delete";
  label: string;
}) {
  return (
    <form action={deleteAdminResource}>
      <input name="resource" type="hidden" value={resource} />
      <input name="id" type="hidden" value={String(id)} />
      <input name="mode" type="hidden" value={mode} />
      <DeleteButton>{label}</DeleteButton>
    </form>
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

  if (resource === "assinaturas" && field.name === "empresa_id") {
    return (
      <AssinaturaFields
        empresas={options.empresas}
        planos={options.planos}
        empresaApps={options.empresaApps}
        defaultEmpresaId={String(editing?.empresa_id ?? "")}
        defaultAppId={String(editing?.app_id ?? "")}
        defaultPlanoId={String(editing?.plano_id ?? "")}
        key={key}
      />
    );
  }

  if (resource === "assinaturas" && (field.name === "app_id" || field.name === "plano_id")) {
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
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <details className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]" open={activeCount > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-300">
            <Filter size={17} />
          </span>
          <div>
            <h2 className="text-sm font-black text-white">Filtros de empresas</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeCount ? `${activeCount} filtro${activeCount > 1 ? "s" : ""} ativo${activeCount > 1 ? "s" : ""}` : "Abra somente quando precisar refinar a lista"}
            </p>
          </div>
        </div>
        <ChevronDown className="shrink-0 text-slate-400 transition group-open:rotate-180" size={18} />
      </summary>

      <form className="grid gap-3 border-t border-white/8 p-4 md:grid-cols-3" action="/admin/empresas">
        <FormSelect label="Categoria" name="categoria" defaultValue={filters.categoria ?? ""} options={options.categorias} />
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
        <FormInput label="Busca" name="q" defaultValue={filters.q ?? ""} placeholder="Nome, CNPJ ou responsável" />
        <div className="flex items-end gap-2 md:col-span-3">
          <button className="button-primary" type="submit">
            Aplicar filtros
          </button>
          <Link className="button-secondary" href="/admin/empresas">
            Limpar
          </Link>
        </div>
      </form>
    </details>
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
      if (key.toLowerCase().includes("cnpj")) {
        formatted[key] = formatCnpj(formatted[key]);
      }
    }
    return formatted;
  });
}

function formatCnpj(value: unknown) {
  const original = String(value ?? "");
  const digits = original.replace(/\D/g, "");
  if (digits.length !== 14) return original;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
