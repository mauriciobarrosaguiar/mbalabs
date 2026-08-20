import type { ReactNode } from "react";
import type { DataColumn } from "@/components/ui-kit";

export function AdminDataTable({
  columns,
  rows,
  emptyMessage = "Nenhum registro encontrado.",
  actions,
  showToolbar = true
}: {
  columns: DataColumn[];
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  actions?: (row: Record<string, unknown>) => ReactNode;
  showToolbar?: boolean;
}) {
  const tableId = `mba-admin-table-${columns.map((column) => column.key).join("-").replace(/[^a-z0-9_-]/gi, "-")}-${rows.length}`;
  const systemOptions = getSystemOptions(rows, columns);

  return (
    <div className="grid gap-3">
      {showToolbar ? (
        <div className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            className="input min-h-11"
            data-admin-table-search={tableId}
            placeholder="Pesquisar registros..."
            type="search"
          />
          {systemOptions.length ? (
            <select className="input min-h-11" data-admin-table-system={tableId} defaultValue="">
              <option value="">Todos os sistemas</option>
              {systemOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span className="hidden md:block" />
          )}
          <button className="button-secondary min-h-11" data-admin-table-export={tableId} type="button">
            Extrair Excel
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]" data-admin-table="" id={tableId}>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-white/8 bg-white/[0.035] text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th className="px-4 py-3" key={column.key}>
                    {column.label}
                  </th>
                ))}
                {actions ? <th className="w-[230px] px-4 py-3 text-right">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-400" colSpan={columns.length + (actions ? 1 : 0)}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    className="border-t border-white/[0.055] transition hover:bg-white/[0.035]"
                    data-admin-row="true"
                    data-search={getSearchText(row)}
                    data-system={getSystemValue(row, columns)}
                    key={`desktop-${String(row.id ?? index)}`}
                  >
                    {columns.map((column) => (
                      <td className="max-w-[260px] px-4 py-3 font-semibold leading-5 text-slate-200" key={column.key}>
                        <div className="break-words">{renderTableValue(column, row[column.key])}</div>
                      </td>
                    ))}
                    {actions ? <td className="px-4 py-3 text-right align-middle">{actions(row)}</td> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 p-2.5 xl:hidden">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 text-center text-sm font-bold text-slate-400">
              {emptyMessage}
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                data-admin-row="true"
                data-search={getSearchText(row)}
                data-system={getSystemValue(row, columns)}
                key={`mobile-${String(row.id ?? index)}`}
              >
                <AdminMobileCard actions={actions} columns={columns} index={index} row={row} />
              </div>
            ))
          )}
        </div>

        <div className="hidden p-7 text-center text-sm font-bold text-slate-400" data-admin-empty-filter="true">
          Nenhum registro encontrado com esses filtros.
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: enhancerScript }} />
    </div>
  );
}

function AdminMobileCard({
  row,
  columns,
  actions,
  index
}: {
  row: Record<string, unknown>;
  columns: DataColumn[];
  actions?: (row: Record<string, unknown>) => ReactNode;
  index: number;
}) {
  const titleColumn = getTitleColumn(row, columns);
  const badgeColumn = getBadgeColumn(row, columns);
  const hidden = new Set([titleColumn?.key, badgeColumn?.key].filter(Boolean));
  const details = columns
    .map((column) => ({ column, value: formatValue(row[column.key]) }))
    .filter(({ column, value }) => !hidden.has(column.key) && value !== "-")
    .slice(0, 7);

  return (
    <article className="rounded-2xl border border-white/8 bg-[#0e1422] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Registro {index + 1}</p>
          <h3 className="mt-1.5 break-words text-lg font-black leading-6 text-white">
            {titleColumn?.value ?? "Registro"}
          </h3>
        </div>
        {badgeColumn ? <span className={badgeClassName(badgeColumn.value)}>{badgeColumn.value}</span> : null}
      </div>

      {details.length ? (
        <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-white/8 pt-4 sm:grid-cols-2">
          {details.map(({ column, value }) => (
            <div className="min-w-0" key={column.key}>
              <dt className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{column.label}</dt>
              <dd className="mt-1 break-words text-sm font-bold leading-5 text-slate-200">
                {renderCompactValue(column, value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-4 border-t border-white/8 pt-3">{actions(row)}</div> : null}
    </article>
  );
}

function getTitleColumn(row: Record<string, unknown>, columns: DataColumn[]) {
  const candidates = ["nome", "razao_social", "nome_fantasia", "email", "descricao", "label", "titulo"];
  for (const key of candidates) {
    const column = columns.find((item) => item.key === key);
    const value = formatValue(row[key]);
    if (column && value !== "-") return { ...column, value };
  }
  const first = columns.find((column) => formatValue(row[column.key]) !== "-");
  return first ? { ...first, value: formatValue(row[first.key]) } : null;
}

function getBadgeColumn(row: Record<string, unknown>, columns: DataColumn[]) {
  const candidates = ["status_label", "status", "ativo", "situacao", "categoria_label"];
  for (const key of candidates) {
    const column = columns.find((item) => item.key === key);
    const value = formatValue(row[key]);
    if (column && value !== "-") return { ...column, value };
  }
  return null;
}

function badgeClassName(value: string) {
  const normalized = normalize(value);
  const base = "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]";
  if (["ativo", "ativa", "pago", "aprovado", "aprovada"].some((item) => normalized.includes(item))) {
    return `${base} border-emerald-400/25 bg-emerald-400/10 text-emerald-300`;
  }
  if (["teste", "pendente", "aguardando"].some((item) => normalized.includes(item))) {
    return `${base} border-amber-400/25 bg-amber-400/10 text-amber-200`;
  }
  if (["inativo", "inativa", "bloqueado", "cancelado", "vencido"].some((item) => normalized.includes(item))) {
    return `${base} border-rose-400/25 bg-rose-400/10 text-rose-200`;
  }
  return `${base} border-white/10 bg-white/[0.04] text-slate-300`;
}

function renderCompactValue(column: DataColumn, value: string) {
  const key = `${column.key} ${column.label}`.toLowerCase();
  if ((key.includes("app") || key.includes("sistema")) && value !== "-") {
    const items = value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return (
      <span className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span className="rounded-lg border border-violet-400/20 bg-violet-400/8 px-2 py-1 text-xs text-violet-200" key={item}>
            {item}
          </span>
        ))}
      </span>
    );
  }
  return value;
}

function renderTableValue(column: DataColumn, value: unknown) {
  const formatted = formatValue(value);
  const key = `${column.key} ${column.label}`.toLowerCase();
  if ((key.includes("status") || key === "ativo") && formatted !== "-") {
    return <span className={badgeClassName(formatted)}>{formatted}</span>;
  }
  return formatted;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).filter((item) => item !== "-").join(", ") || "-";
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const preferred = object.nome ?? object.label ?? object.titulo ?? object.descricao;
    if (preferred !== undefined) return formatValue(preferred);
    return Object.values(object).map((item) => formatValue(item)).filter((item) => item !== "-").join(", ") || "-";
  }
  return String(value);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSearchText(row: Record<string, unknown>) {
  const values: string[] = [];
  collectValues(row, values);
  return values.join(" ");
}

function getSystemValue(row: Record<string, unknown>, columns: DataColumn[]) {
  const values: string[] = [];
  const keys = new Set(["app", "apps", "apps_permitidos", "app_nome", "nome_app", "sistema", "sistemas"]);
  columns.forEach((column) => {
    const token = `${column.key} ${column.label}`.toLowerCase();
    if (token.includes("app") || token.includes("sistema")) keys.add(column.key);
  });
  keys.forEach((key) => {
    if (row[key] !== undefined) collectValues(row[key], values);
  });
  return values.join(" ");
}

function getSystemOptions(rows: Array<Record<string, unknown>>, columns: DataColumn[]) {
  const options = new Map<string, string>();
  rows.forEach((row) => {
    getSystemValue(row, columns)
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const cleaned = item.replace(/\s+\((ativo|inativo)\)$/i, "").trim();
        if (cleaned && cleaned.length <= 48) options.set(normalize(cleaned), cleaned);
      });
  });
  return Array.from(options.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function collectValues(value: unknown, values: string[]) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectValues(item, values));
    return;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectValues(item, values));
    return;
  }
  values.push(String(value));
}

const enhancerScript = `
(function () {
  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  }
  function setup(table) {
    if (!table || table.dataset.adminEnhanced === "true") return;
    table.dataset.adminEnhanced = "true";
    var id = table.id;
    var search = document.querySelector('[data-admin-table-search="' + id + '"]');
    var system = document.querySelector('[data-admin-table-system="' + id + '"]');
    var exportButton = document.querySelector('[data-admin-table-export="' + id + '"]');
    var empty = table.querySelector('[data-admin-empty-filter="true"]');

    function apply() {
      var query = normalize(search ? search.value : "");
      var systemValue = normalize(system ? system.value : "");
      var matches = 0;
      Array.prototype.slice.call(table.querySelectorAll('[data-admin-row="true"]')).forEach(function (row) {
        var okSearch = !query || normalize(row.getAttribute("data-search")).indexOf(query) >= 0;
        var okSystem = !systemValue || normalize(row.getAttribute("data-system")).indexOf(systemValue) >= 0;
        var show = okSearch && okSystem;
        row.style.display = show ? "" : "none";
        if (show) matches += 1;
      });
      if (empty) empty.classList.toggle("hidden", matches !== 0 || table.querySelectorAll('[data-admin-row="true"]').length === 0);
    }

    function exportExcel() {
      var tableElement = table.querySelector("table");
      if (!tableElement) return;
      var rows = Array.prototype.slice.call(tableElement.querySelectorAll('tbody tr[data-admin-row="true"]')).filter(function (row) {
        return row.style.display !== "none";
      });
      if (!rows.length) {
        alert("Nenhum registro para exportar.");
        return;
      }
      var headers = Array.prototype.slice.call(tableElement.querySelectorAll("thead th"));
      var html = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
      headers.forEach(function (cell) { html += "<th>" + cell.innerText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</th>"; });
      html += "</tr></thead><tbody>";
      rows.forEach(function (row) {
        html += "<tr>";
        Array.prototype.slice.call(row.children).forEach(function (cell) {
          html += "<td>" + cell.innerText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</td>";
        });
        html += "</tr>";
      });
      html += "</tbody></table></body></html>";
      var blob = new Blob(["\\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "mba-labs-admin-" + new Date().toISOString().slice(0, 10) + ".xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    if (search) search.addEventListener("input", apply);
    if (system) system.addEventListener("change", apply);
    if (exportButton) exportButton.addEventListener("click", exportExcel);
    apply();
  }
  function boot() { document.querySelectorAll('[data-admin-table]').forEach(setup); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
`;
