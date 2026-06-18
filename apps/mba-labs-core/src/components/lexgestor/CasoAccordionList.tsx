"use client";

import Link from "next/link";
import { ChevronDown, FileText, FolderOpen, Printer, SquareCheckBig } from "lucide-react";
import { useMemo, useState } from "react";
import type { LexCaso } from "@/lib/lexgestor/data";

type CasoAccordionListProps = {
  casos: LexCaso[];
};

export function CasoAccordionList({ casos }: CasoAccordionListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");

  const statuses = Array.from(new Set(casos.map((caso) => caso.status).filter(Boolean)));
  const categorias = Array.from(new Set(casos.map((caso) => caso.categoria).filter(Boolean)));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return casos.filter((caso) => {
      const haystack = [
        caso.cliente,
        caso.categoria,
        caso.subcategoria,
        caso.numeroProcesso,
        caso.status,
        caso.titulo,
      ].join(" ").toLowerCase();

      return (
        (q ? haystack.includes(q) : true) &&
        (status ? caso.status === status : true) &&
        (categoria ? caso.categoria === categoria : true)
      );
    });
  }, [casos, search, status, categoria]);

  return (
    <section className="stack">
      <div className="card">
        <div className="filter-row">
          <label className="field grow">
            Buscar caso
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, categoria, processo ou status"
            />
          </label>
          <label className="field filter-small">
            Categoria
            <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
              <option value="">Todas</option>
              {categorias.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field filter-small">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {statuses.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum caso encontrado</strong>
          <p>Abra um caso ou ajuste os filtros.</p>
          <Link className="button" href="/lexgestor/casos/novo">
            Abrir caso
          </Link>
        </div>
      ) : (
        <div className="accordion-list">
          {filtered.map((caso) => (
            <details className="accordion-card" key={caso.id}>
              <summary>
                <span className="summary-main">{caso.cliente}</span>
                <span>{caso.categoria} / {caso.subcategoria}</span>
                <span>{caso.numeroProcesso || "Sem processo"}</span>
                <span className="status-pill">{caso.status}</span>
                <span>{caso.proximoPrazo || "Sem prazo"}</span>
                <span className="summary-action">
                  Expandir <ChevronDown size={16} aria-hidden />
                </span>
              </summary>
              <div className="accordion-content">
                <div className="detail-grid">
                  <Info label="Dados do cliente" value={`${caso.cliente} - ${caso.clienteContato}`} />
                  <Info label="Relato do cliente" value={caso.relatoInicial || "Relato ainda não informado."} />
                  <Info label="Processo/eproc" value={processoResumo(caso)} />
                  <Info label="Checklist" value={`${caso.checklistConcluido}/${caso.checklistTotal} itens conferidos`} />
                  <Info label="Documentos anexados" value={`${caso.documentosCount} documento(s)`} />
                  <Info label="Historico" value={`Caso aberto em ${caso.criadoEm || "-"}`} />
                </div>
                <div className="button-row">
                  <Link className="button secondary" href={`/lexgestor/casos/${caso.id}`}>
                    <SquareCheckBig size={17} aria-hidden />
                    Editar caso
                  </Link>
                  <Link className="button" href={`/lexgestor/documentos?caso=${caso.id}`}>
                    <FileText size={17} aria-hidden />
                    Anexar documento
                  </Link>
                  <Link className="button secondary" href={`/api/lexgestor/relatorios/pdf?tipo=dossie&caso=${caso.id}`}>
                    <FileText size={17} aria-hidden />
                    Gerar dossiê PDF
                  </Link>
                  <button className="button secondary" type="button" onClick={() => window.print()}>
                    <Printer size={17} aria-hidden />
                    Imprimir relatório
                  </button>
                  <Link className="button secondary" href={`/lexgestor/documentos?caso=${caso.id}`}>
                    <FolderOpen size={17} aria-hidden />
                    Abrir pasta
                  </Link>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function processoResumo(caso: LexCaso) {
  return [
    caso.numeroProcesso ? `Processo ${caso.numeroProcesso}` : "Sem número de processo",
    caso.chaveProcesso ? `Chave ${caso.chaveProcesso}` : "",
    caso.sistemaJudicial,
    caso.tribunal,
    caso.comarca,
    caso.vara,
  ].filter(Boolean).join(" | ");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
