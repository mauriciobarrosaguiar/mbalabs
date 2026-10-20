// In-memory Supabase double. No network calls and no production writes.
export function buildFakeSupabase(state) {
  return { from(table) {
    const filters = [];
    let projection = '*', start = 0, end = Infinity, removing = false;
    const query = {
      select(columns) { projection = columns; return query; },
      in(column, values) { filters.push(row => values.includes(row[column])); return query; },
      eq(column, value) { filters.push(row => row[column] === value); return query; },
      range(from, to) { start = from; end = to + 1; return query; },
      delete() { removing = true; return query; },
      async maybeSingle() { const result = run(); return {data: result.data[0] ?? null, error: result.error}; },
      then(ok, fail) { return Promise.resolve(run()).then(ok, fail); },
    };
    function run() {
      const rows = state.db[table] ?? [];
      const found = rows.filter(row => filters.every(match => match(row))).slice(start,end);
      if (removing) {
        state.deleted.push(...found.map(row => ({table,id:row.id})));
        state.db[table] = rows.filter(row => !found.includes(row));
      }
      const columns = projection.split(',').map(v => v.trim());
      const data = found.map(row => projection === '*' ? {...row} :
        Object.fromEntries(columns.map(column => [column, row[column]])));
      return {data, error:null};
    }
    return query;
  } };
}
