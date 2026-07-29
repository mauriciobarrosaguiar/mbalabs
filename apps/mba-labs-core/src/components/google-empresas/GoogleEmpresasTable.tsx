"use client";

import Link from "next/link";
import { ArrowRight, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type GoogleEmpresasTableRow = {
  id: string;
  nome: string;
  categoria: string;
  cidade_uf: string;
  status: string;
  status_codigo: string;
  google: string;
  atualizado: string;
};

export function GoogleEmpresasTable({ rows }: { rows: GoogleEmpresasTableRow[] }) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return rows;

    return rows.filter((row) => normalize(Object.values(row).join(" ")).includes(normalized));
  }, [query, rows]);

  function exportRows() {
    const headers = ["Empresa", "Categoria", "Cidade/UF", "Status", "Google", "Atualizado"];
    const csvRows = filteredRows.map((row) => [row.nome, row.categoria, row.cidade_uf, row.status, row.google, row.atualizado]);
    const content = [headers, ...csvRows]
      .map((values) => values.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `google-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="google-table-toolbar" aria-label="Ferramentas da lista de empresas">
        <label className="google-search-wrap">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Pesquisar empresas</span>
          <input
            className="google-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por nome, CNPJ, categoria, cidade ou status..."
            type="search"
            value={query}
          />
        </label>
        <button className="google-export-button" onClick={exportRows} type="button">
          <Download size={17} />
          Extrair Excel
        </button>
      </section>

      <section className="google-table-card">
        <div className="google-table-head">
          <div>
            <h3>Empresas cadastradas</h3>
            <p>Registros reais e status do fluxo Google</p>
          </div>
          <span className="google-recent-badge">{filteredRows.length} {filteredRows.length === 1 ? "empresa" : "empresas"}</span>
        </div>

        {filteredRows.length ? (
          <>
            <div className="google-table-desktop">
              <table className="google-table-grid">
                <thead>
                  <tr>
                    <th style={{ width: "25%" }}>Empresa</th>
                    <th style={{ width: "18%" }}>Categoria</th>
                    <th style={{ width: "14%" }}>Localização</th>
                    <th style={{ width: "15%" }}>Status</th>
                    <th style={{ width: "14%" }}>Google</th>
                    <th style={{ width: "9%" }}>Atualizado</th>
                    <th style={{ width: "5%" }}><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const tone = statusTone(row.status_codigo);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="google-company-cell">
                            <span className="google-company-avatar">{initials(row.nome)}</span>
                            <Link className="google-company-name" href={`/google-empresas/${row.id}`}>
                              {row.nome}
                            </Link>
                          </div>
                        </td>
                        <td>{row.categoria}</td>
                        <td>{row.cidade_uf}</td>
                        <td>
                          <span className="google-status-badge" style={{ "--google-status-color": tone } as React.CSSProperties}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.google}</td>
                        <td>{row.atualizado}</td>
                        <td>
                          <Link className="google-manage-link" href={`/google-empresas/${row.id}`} aria-label={`Gerenciar ${row.nome}`}>
                            <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="google-mobile-company-list">
              {filteredRows.map((row) => {
                const tone = statusTone(row.status_codigo);
                return (
                  <article className="google-mobile-company-card" key={`mobile-${row.id}`}>
                    <div className="google-company-cell">
                      <span className="google-company-avatar">{initials(row.nome)}</span>
                      <div>
                        <Link className="google-company-name" href={`/google-empresas/${row.id}`}>
                          {row.nome}
                        </Link>
                        <p className="mt-1 text-xs text-slate-400">{row.categoria}</p>
                      </div>
                    </div>
                    <div className="google-mobile-company-meta">
                      <span>{row.cidade_uf}</span>
                      <span>{row.google}</span>
                      <span>Atualizado em {row.atualizado}</span>
                    </div>
                    <div className="google-mobile-company-footer">
                      <span className="google-status-badge" style={{ "--google-status-color": tone } as React.CSSProperties}>
                        {row.status}
                      </span>
                      <Link className="google-manage-link" href={`/google-empresas/${row.id}`}>
                        Gerenciar <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="google-empty-state">
            {rows.length ? "Nenhuma empresa encontrada com essa pesquisa." : "Nenhuma empresa cadastrada neste painel."}
          </div>
        )}
      </section>
    </>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GE";
}

function statusTone(status: string) {
  const tones: Record<string, string> = {
    verificado: "#20d7a0",
    aguardando_verificacao: "#24c8d8",
    aguardando_cliente: "#f3b942",
    autorizado: "#8b7cf6",
    erro: "#fb7185",
    suspenso: "#fb7185",
    rascunho: "#94a3b8"
  };
  return tones[status] ?? "#c084fc";
}
