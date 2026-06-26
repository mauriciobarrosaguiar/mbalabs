import Link from "next/link";

export type DataColumn = {
  key: string;
  label: string;
};

export type ActionCardItem = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="grid gap-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-4xl font-black tracking-tight">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ModuleDashboard({ items }: { items: ActionCardItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ActionCard key={item.href} {...item} />
      ))}
    </div>
  );
}

export function ActionCard({ title, description, href, badge }: ActionCardItem) {
  return (
    <Link className="panel grid min-h-44 gap-5 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/60" href={href}>
      <div>
        {badge ? (
          <span className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
            {badge}
          </span>
        ) : null}
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      </div>
      <span className="button-secondary w-fit">Abrir</span>
    </Link>
  );
}

export function StatCard({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="panel p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase text-slate-400">{label}</div>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage = "Nenhum registro encontrado.",
  actions
}: {
  columns: DataColumn[];
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  actions?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-white/10">
      <table className="hidden w-full table-fixed border-collapse text-left text-sm lg:table">
        <thead className="bg-white/10 text-xs uppercase text-slate-300">
          <tr>
            {columns.map((column) => (
              <th className="px-3 py-3 font-bold" key={column.key}>
                {column.label}
              </th>
            ))}
            {actions ? <th className="w-[220px] px-3 py-3 text-right font-bold">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-300" colSpan={columns.length + (actions ? 1 : 0)}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr className="border-t border-white/10" key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td className="truncate px-3 py-3 text-slate-100" key={column.key} title={formatValue(row[column.key])}>
                    {formatValue(row[column.key])}
                  </td>
                ))}
                {actions ? <td className="px-3 py-3 text-right">{actions(row)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 lg:hidden">
        {rows.length === 0 ? (
          <p className="px-2 py-5 text-center text-sm text-slate-300">{emptyMessage}</p>
        ) : (
          rows.map((row, index) => (
            <article className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3" key={String(row.id ?? index)}>
              <div className="grid gap-2">
                {columns.map((column) => (
                  <div className="grid gap-1" key={column.key}>
                    <span className="text-xs font-bold uppercase text-slate-400">{column.label}</span>
                    <strong className="break-words text-sm text-slate-100">{formatValue(row[column.key])}</strong>
                  </div>
                ))}
              </div>
              {actions ? <div className="flex flex-wrap justify-end gap-2">{actions(row)}</div> : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel grid gap-2 p-6 text-center">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return <div className="panel p-5 text-sm text-slate-300">{label}</div>;
}

export function MessageBanner({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) {
    return null;
  }

  return (
    <p
      className={`rounded-[8px] border p-3 text-sm font-black leading-6 opacity-100 shadow-sm ${
        error ? "border-red-500 bg-red-50 text-red-950" : "border-emerald-500 bg-emerald-50 text-emerald-950"
      }`}
    >
      {error ?? ok}
    </p>
  );
}

export function FormInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
  placeholder,
  min,
  step
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
      />
    </label>
  );
}

export function FormMoneyInput(props: Omit<Parameters<typeof FormInput>[0], "type" | "placeholder">) {
  return <FormInput {...props} min="0" placeholder="0,00" step="0.01" type="number" />;
}

export function FormDateInput(props: Omit<Parameters<typeof FormInput>[0], "type">) {
  return <FormInput {...props} type="date" />;
}

export function FormTextarea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <label className="grid gap-2 md:col-span-2">
      <span className="text-sm font-bold">{label}</span>
      <textarea className="input min-h-24 resize-y" name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export function FormSelect({
  name,
  label,
  defaultValue,
  options,
  required = false
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ""} required={required}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormCheckbox({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} value="true" />
      {label}
    </label>
  );
}

export function SubmitButton({ children = "Salvar" }: { children?: React.ReactNode }) {
  return (
    <button className="button-primary" type="submit">
      {children}
    </button>
  );
}

export function DeleteButton({ children = "Excluir" }: { children?: React.ReactNode }) {
  return (
    <button className="button-danger" type="submit">
      {children}
    </button>
  );
}

export function ConfirmDialog({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-red-300/20 bg-red-300/10 p-4">
      <h3 className="font-black text-red-100">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-red-100/80">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function AccessDenied({ appName = "este sistema", backHref = "/dashboard" }: { appName?: string; backHref?: string }) {
  return (
    <div className="panel mx-auto grid max-w-xl gap-4 p-6 text-center">
      <p className="eyebrow">Acesso bloqueado</p>
      <h1 className="text-3xl font-black">Você não tem acesso a {appName}</h1>
      <p className="text-sm leading-6 text-slate-300">Verifique a assinatura da empresa ou peça para um administrador liberar sua permissão.</p>
      <Link className="button-primary mx-auto" href={backHref}>
        Voltar ao dashboard
      </Link>
    </div>
  );
}

export function BackButton({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link className="button-secondary" href={href}>
      {label}
    </Link>
  );
}

export function ResourceForm({ title, children, actions }: { title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="panel grid gap-4 p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function SearchBox({ placeholder, defaultValue }: { placeholder: string; defaultValue?: string }) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" action="">
      <input className="input sm:max-w-md" name="q" defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      <button className="button-secondary" type="submit">
        Buscar
      </button>
    </form>
  );
}

export function formatMoney(value: unknown) {
  const number = Number(value ?? 0);
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: unknown) {
  if (!value) {
    return "-";
  }
  return new Date(String(value)).toLocaleDateString("pt-BR");
}

export function formatDateTime(value: unknown) {
  if (!value) {
    return "-";
  }
  return new Date(String(value)).toLocaleString("pt-BR");
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
