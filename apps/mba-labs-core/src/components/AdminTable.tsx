export function AdminTable({
  columns,
  rows
}: {
  columns: readonly string[];
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-white/10">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-white/10 text-xs uppercase text-slate-300">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-bold" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-300" colSpan={columns.length}>
                Nenhum registro encontrado.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr className="border-t border-white/10" key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td className="max-w-[260px] truncate px-4 py-3 text-slate-100" key={column}>
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
