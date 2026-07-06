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

type SmartColumn = DataColumn & {
  value: string;
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
  const tableId = `mba-data-table-${columns.map((column) => column.key).join("-").replace(/[^a-z0-9_-]/gi, "-")}-${rows.length}`;
  const systemOptions = getDataTableSystemOptions(rows, columns);

  return (
    <div className="grid gap-3">
      <div className="mba-data-table-toolbar">
        <input
          className="input mba-data-table-search"
          data-mba-table-search={tableId}
          placeholder="Pesquisar por nome, CPF/CNPJ, email, empresa..."
          type="search"
        />

        {systemOptions.length ? (
          <select className="input mba-data-table-system-filter" data-mba-table-system={tableId} defaultValue="">
            <option value="">Todos os sistemas</option>
            {systemOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : null}

        <button className="button-secondary mba-data-table-export" data-mba-table-export={tableId} type="button">
          Extrair Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-[22px] border border-white/10 bg-white/[0.02] shadow-sm" data-mba-table="" id={tableId}>
        <table className="hidden min-w-[1280px] w-full table-auto border-collapse text-left text-sm lg:table">
          <thead className="bg-white/10 text-xs uppercase text-slate-300">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-4 align-middle font-black tracking-wide whitespace-nowrap uppercase" key={column.key}>
                  {column.label}
                </th>
              ))}
              {actions ? <th className="w-[220px] px-4 py-4 text-right align-middle font-black tracking-wide whitespace-nowrap uppercase">AÇÕES</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-300" colSpan={columns.length + (actions ? 1 : 0)}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  className="border-t border-white/10 transition hover:bg-white/[0.035]"
                  data-mba-row="true"
                  data-search={getDataTableSearchText(row)}
                  data-system={getDataTableSystemValue(row, columns)}
                  key={String(row.id ?? index)}
                >
                  {columns.map((column) => (
                    <td className="px-4 py-4 align-middle font-semibold text-slate-100 whitespace-normal break-words uppercase leading-5" key={column.key} title={formatValue(row[column.key])}>
                      {formatValue(row[column.key])}
                    </td>
                  ))}
                  {actions ? <td className="px-4 py-4 align-middle text-right whitespace-nowrap">{actions(row)}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="grid gap-4 p-3 lg:hidden">
          {rows.length === 0 ? (
            <div className="rounded-[18px] border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-700">
              {emptyMessage}
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                data-mba-row="true"
                data-search={getDataTableSearchText(row)}
                data-system={getDataTableSystemValue(row, columns)}
                key={String(row.id ?? index)}
              >
                <SmartMobileCard actions={actions} columns={columns} index={index} row={row} />
              </div>
            ))
          )}
        </div>

        <div className="hidden p-5 text-center text-sm font-black text-slate-300" data-mba-empty-filter="true">
          Nenhum registro encontrado com esse filtro.
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: dataTableEnhancerScript }} />
    </div>
  );
}

const dataTableEnhancerScript = `
(function () {
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "");
  }

  function safeFileName(value) {
    return String(value || "mba-labs")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mba-labs";
  }

  function setupTable(table) {
    if (!table || table.dataset.mbaEnhanced === "true") return;
    table.dataset.mbaEnhanced = "true";

    var id = table.id;
    var search = document.querySelector('[data-mba-table-search="' + id + '"]');
    var system = document.querySelector('[data-mba-table-system="' + id + '"]');
    var exportButton = document.querySelector('[data-mba-table-export="' + id + '"]');
    var emptyFilter = table.querySelector('[data-mba-empty-filter="true"]');

    function rows() {
      return Array.prototype.slice.call(table.querySelectorAll('[data-mba-row="true"]'));
    }

    function applyFilters() {
      var query = normalize(search ? search.value : "");
      var systemValue = normalize(system ? system.value : "");
      var visibleCount = 0;

      rows().forEach(function (row) {
        var rowSearch = normalize(row.getAttribute("data-search"));
        var rowSystem = normalize(row.getAttribute("data-system"));
        var matchesSearch = !query || rowSearch.indexOf(query) >= 0;
        var matchesSystem = !systemValue || rowSystem.indexOf(systemValue) >= 0;
        var show = matchesSearch && matchesSystem;

        row.style.display = show ? "" : "none";

        if (show && row.tagName.toLowerCase() === "tr") {
          visibleCount += 1;
        }
      });

      if (emptyFilter) {
        emptyFilter.classList.toggle("hidden", visibleCount !== 0 || table.querySelectorAll("tbody tr[data-mba-row]").length === 0);
      }
    }

    function exportExcel() {
      var headerCells = Array.prototype.slice.call(table.querySelectorAll("table thead th"));
      var dataRows = Array.prototype.slice.call(table.querySelectorAll("table tbody tr[data-mba-row]"))
        .filter(function (row) {
          return row.style.display !== "none";
        });

      if (!dataRows.length) {
        alert("Nenhum registro para exportar.");
        return;
      }

      var html = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';

      headerCells.forEach(function (cell) {
        html += "<th>" + cell.innerText.toUpperCase().replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</th>";
      });

      html += "</tr></thead><tbody>";

      dataRows.forEach(function (row) {
        html += "<tr>";
        Array.prototype.slice.call(row.children).forEach(function (cell) {
          html += "<td>" + cell.innerText.toUpperCase().replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</td>";
        });
        html += "</tr>";
      });

      html += "</tbody></table></body></html>";

      var blob = new Blob(["\\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = safeFileName(document.title || "mba-labs") + "-" + new Date().toISOString().slice(0, 10) + ".xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    if (search) search.addEventListener("input", applyFilters);
    if (system) system.addEventListener("change", applyFilters);
    if (exportButton) exportButton.addEventListener("click", exportExcel);

    applyFilters();
  }

  function boot() {
    document.querySelectorAll('[data-mba-table]').forEach(setupTable);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;

function getDataTableSearchText(row: Record<string, unknown>) {
  const values: string[] = [];
  collectDataTableValues(row, values);
  return values.join(" ");
}

function getDataTableSystemValue(row: Record<string, unknown>, columns: DataColumn[]) {
  const values: string[] = [];
  const keys = new Set<string>([
    "app",
    "apps",
    "apps_permitidos",
    "app_nome",
    "nome_app",
    "sistema",
    "sistemas",
    "url",
    "urlPath"
  ]);

  columns.forEach((column) => {
    const key = `${column.key} ${column.label}`.toLowerCase();

    if (key.includes("app") || key.includes("sistema") || key.includes("permitido")) {
      keys.add(column.key);
    }
  });

  keys.forEach((key) => {
    if (row[key] !== undefined) {
      collectDataTableValues(row[key], values);
    }
  });

  return values.join(" ");
}

function getDataTableSystemOptions(rows: Array<Record<string, unknown>>, columns: DataColumn[]) {
  const options = new Map<string, string>();

  rows.forEach((row) => {
    const value = getDataTableSystemValue(row, columns);

    value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const cleaned = cleanSystemOption(item);

        if (cleaned) {
          options.set(cleaned.toLowerCase(), cleaned);
        }
      });
  });

  return Array.from(options.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function cleanSystemOption(value: string) {
  const cleaned = value
    .replace(/\s+\(ativo\)$/i, "")
    .replace(/\s+\(inativo\)$/i, "")
    .split(/\s+-\s+/)[0]
    .trim();

  if (!cleaned || cleaned === "-") {
    return "";
  }

  if (cleaned.length > 42) {
    return "";
  }

  return cleaned;
}

function collectDataTableValues(value: unknown, values: string[]) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectDataTableValues(item, values));
    return;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectDataTableValues(item, values));
    return;
  }

  values.push(String(value));
}
function SmartMobileCard({
  row,
  columns,
  actions,
  index
}: {
  row: Record<string, unknown>;
  columns: DataColumn[];
  actions?: (row: Record<string, unknown>) => React.ReactNode;
  index: number;
}) {
  const title = getCardTitle(row, columns);
  const subtitle = getCardSubtitle(row, columns, title?.key);
  const badge = getCardBadge(row, columns);
  const highlights = getHighlightColumns(row, columns, [title?.key, subtitle?.key]);
  const hiddenKeys = new Set([title?.key, subtitle?.key, badge?.key, ...highlights.map((item) => item.key)].filter(Boolean));
  const details = columns
    .map((column) => ({ ...column, value: formatValue(row[column.key]) }))
    .filter((column) => !hiddenKeys.has(column.key) && column.value !== "-");

  return (
    <article className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_1px_8px_rgba(15,81,50,0.08)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Registro #{index + 1}</p>
          <h3 className="mt-2 break-words text-2xl font-black leading-tight text-slate-900">{title?.value ?? "Registro"}</h3>
          {subtitle ? <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-600">{subtitle.value}</p> : null}
        </div>
        {badge ? <span className={badgeClassName(badge.value)}>{badge.value}</span> : null}
      </div>

      {highlights.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {highlights.map((item) => (
            <div className="rounded-[16px] border border-emerald-100 bg-emerald-50 p-3" key={item.key}>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</span>
              <strong className="mt-1 block break-words text-xl font-black text-slate-900">{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {details.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {details.map((column) => (
            <div className="rounded-[16px] border border-slate-100 bg-slate-50 p-3" key={column.key}>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{column.label}</span>
              <strong className="mt-1 block break-words text-base font-black text-slate-900">{column.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 border-t border-slate-200 pt-4 [&>div]:grid [&>div]:grid-cols-2 [&>div]:gap-2 [&>div]:justify-stretch [&_a]:w-full [&_button]:w-full [&_form]:contents">
          {actions(row)}
        </div>
      ) : null}
    </article>
  );
}

function getCardTitle(row: Record<string, unknown>, columns: DataColumn[]): SmartColumn | null {
  const placa = formatValue(row.placa);
  const marca = formatValue(row.marca);
  const modelo = formatValue(row.modelo);
  const veiculo = formatValue(row.veiculo);

  if (placa !== "-" || modelo !== "-" || marca !== "-") {
    const value = [placa, marca, modelo].filter((item) => item !== "-").join(" - ");
    return { key: placa !== "-" ? "placa" : modelo !== "-" ? "modelo" : "marca", label: "VeÃƒÂ­culo", value };
  }

  if (row.nome !== undefined) {
    return { key: "nome", label: "Nome", value: formatValue(row.nome) };
  }

  if (row.cliente !== undefined && veiculo !== "-") {
    return { key: "cliente", label: "Cliente", value: formatValue(row.cliente) };
  }

  const first = columns.find((column) => formatValue(row[column.key]) !== "-");
  return first ? { ...first, value: formatValue(row[first.key]) } : null;
}

function getCardSubtitle(row: Record<string, unknown>, columns: DataColumn[], titleKey?: string): SmartColumn | null {
  const candidates = ["telefone", "whatsapp", "cliente", "veiculo", "servico", "aplicacao_label", "categoria_label", "email", "documento"];
  for (const key of candidates) {
    if (key === titleKey) continue;
    const column = columns.find((item) => item.key === key);
    const value = formatValue(row[key]);
    if (column && value !== "-") {
      return { ...column, value };
    }
  }
  const fallback = columns.find((column) => column.key !== titleKey && formatValue(row[column.key]) !== "-");
  return fallback ? { ...fallback, value: formatValue(row[fallback.key]) } : null;
}

function getCardBadge(row: Record<string, unknown>, columns: DataColumn[]): SmartColumn | null {
  const candidates = ["status_label", "status", "status_pagamento_label", "status_pagamento", "ativo", "categoria_label"];
  for (const key of candidates) {
    const column = columns.find((item) => item.key === key);
    const value = formatValue(row[key]);
    if (column && value !== "-") {
      return { ...column, value };
    }
  }
  return null;
}

function getHighlightColumns(row: Record<string, unknown>, columns: DataColumn[], ignoredKeys: Array<string | undefined>) {
  const ignored = new Set(ignoredKeys.filter(Boolean));
  return columns
    .map((column) => ({ ...column, value: formatValue(row[column.key]) }))
    .filter((column) => !ignored.has(column.key) && column.value !== "-" && isMetricColumn(column))
    .slice(0, 4);
}

function isMetricColumn(column: SmartColumn) {
  const key = column.key.toLowerCase();
  const label = column.label.toLowerCase();
  return ["valor", "preco", "preÃƒÂ§o", "comissao", "comissÃƒÂ£o", "vales", "saldo", "pendentes", "recebido", "total"].some(
    (term) => key.includes(term) || label.includes(term)
  );
}

function badgeClassName(value: string) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("pago") || normalized.includes("sim") || normalized.includes("ativo") || normalized.includes("finalizado")
    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
    : normalized.includes("aberto") || normalized.includes("pendente") || normalized.includes("fiado") || normalized.includes("parcial")
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : normalized.includes("nÃƒÂ£o") || normalized.includes("nao") || normalized.includes("cancel") || normalized.includes("inativo")
        ? "bg-red-100 text-red-900 border-red-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return `shrink-0 rounded-full border px-3 py-1 text-xs font-black ${tone}`;
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
      <h1 className="text-3xl font-black">VocÃƒÂª nÃƒÂ£o tem acesso a {appName}</h1>
      <p className="text-sm leading-6 text-slate-300">Verifique a assinatura da empresa ou peÃƒÂ§a para um administrador liberar sua permissÃƒÂ£o.</p>
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
    return value ? "Sim" : "NÃƒÂ£o";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

