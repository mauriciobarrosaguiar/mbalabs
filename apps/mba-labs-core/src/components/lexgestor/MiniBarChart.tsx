type MiniBarChartProps = {
  title: string;
  rows: Array<{ label: string; value: number }>;
};

export function MiniBarChart({ title, rows }: MiniBarChartProps) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="card stack">
      <div className="section-title">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="muted">Sem dados para este grafico.</p>
      ) : (
        <div className="mini-chart">
          {rows.map((row) => (
            <div className="mini-chart-row" key={row.label}>
              <span>{row.label}</span>
              <div className="mini-chart-track">
                <i style={{ width: `${Math.max((row.value / max) * 100, 6)}%` }} />
              </div>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
