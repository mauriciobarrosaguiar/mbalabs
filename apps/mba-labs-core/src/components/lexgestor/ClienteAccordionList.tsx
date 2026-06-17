"use client";

import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, FileText, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { LexCliente } from "@/lib/lexgestor/data";
import { BotaoWhatsAppCliente } from "./BotaoWhatsAppCliente";

type ClienteAccordionListProps = {
  clientes: LexCliente[];
};

export function ClienteAccordionList({ clientes }: ClienteAccordionListProps) {
  const [search, setSearch] = useState("");
  const [origem, setOrigem] = useState("");
  const [status, setStatus] = useState("");
  const [casos, setCasos] = useState("");

  const origens = Array.from(new Set(clientes.map((cliente) => cliente.origem).filter(Boolean)));
  const statuses = Array.from(new Set(clientes.map((cliente) => cliente.status).filter(Boolean)));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientes.filter((cliente) => {
      const haystack = [
        cliente.nome,
        cliente.cpfCnpj,
        cliente.telefone,
        cliente.whatsapp,
        cliente.email,
      ].join(" ").toLowerCase();
      const matchesSearch = q ? haystack.includes(q) : true;
      const matchesOrigem = origem ? cliente.origem === origem : true;
      const matchesStatus = status ? cliente.status === status : true;
      const matchesCases =
        casos === "sem-casos"
          ? cliente.casosCount === 0
          : casos === "com-casos"
            ? cliente.casosCount > 0
            : true;

      return matchesSearch && matchesOrigem && matchesStatus && matchesCases;
    });
  }, [clientes, search, origem, status, casos]);

  return (
    <section className="stack">
      <div className="card">
        <div className="filter-row">
          <label className="field grow">
            Buscar cliente
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, CPF/CNPJ, telefone ou WhatsApp"
            />
          </label>
          <label className="field filter-small">
            Origem
            <select value={origem} onChange={(event) => setOrigem(event.target.value)}>
              <option value="">Todas</option>
              {origens.map((item) => (
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
          <label className="field filter-small">
            Casos
            <select value={casos} onChange={(event) => setCasos(event.target.value)}>
              <option value="">Todos</option>
              <option value="com-casos">Com casos</option>
              <option value="sem-casos">Sem casos</option>
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum cliente encontrado</strong>
          <p>Cadastre um cliente ou ajuste os filtros para ver a lista.</p>
          <Link className="button" href="/lexgestor/clientes/novo">
            Novo cliente
          </Link>
        </div>
      ) : (
        <div className="accordion-list">
          {filtered.map((cliente) => (
            <details className="accordion-card" key={cliente.id}>
              <summary>
                <span className="summary-main">{cliente.nome}</span>
                <span>{cliente.cpfCnpj}</span>
                <span>{cliente.whatsapp || cliente.telefone}</span>
                <span className="status-pill">{cliente.status}</span>
                <span className="summary-action">
                  Expandir <ChevronDown size={16} aria-hidden />
                </span>
              </summary>
              <div className="accordion-content">
                <div className="detail-grid">
                  <Info label="Dados pessoais" value={`${cliente.cpfCnpj} - ${cliente.email}`} />
                  <Info label="Endereco" value={cliente.endereco} />
                  <Info label="Contatos" value={`Telefone: ${cliente.telefone} | WhatsApp: ${cliente.whatsapp}`} />
                  <Info label="Observacoes" value={cliente.observacoes || "Sem observacoes."} />
                  <Info label="Casos vinculados" value={`${cliente.casosCount} caso(s)`} />
                  <Info label="Documentos vinculados" value={`${cliente.documentosCount} documento(s)`} />
                </div>
                <div className="button-row">
                  <Link className="button secondary" href={`/lexgestor/clientes/${cliente.id}`}>
                    <Pencil size={17} aria-hidden />
                    Editar cliente
                  </Link>
                  <Link className="button" href={`/lexgestor/casos/novo?cliente=${cliente.id}`}>
                    <BriefcaseBusiness size={17} aria-hidden />
                    Novo caso
                  </Link>
                  <Link className="button secondary" href={`/lexgestor/documentos?cliente=${cliente.id}`}>
                    <FileText size={17} aria-hidden />
                    Ver documentos
                  </Link>
                  <BotaoWhatsAppCliente telefone={cliente.whatsapp || cliente.telefone} />
                  <button className="button secondary danger-text" type="button">
                    <Trash2 size={17} aria-hidden />
                    Excluir cliente
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
