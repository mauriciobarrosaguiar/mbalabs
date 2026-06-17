"use client";

import { useMemo, useState } from "react";
import { Paperclip, Printer } from "lucide-react";
import type { ChecklistTemplate } from "@/data/lexgestor";
import { calcularProgressoChecklist } from "@/lib/lexgestor/checklist";

const statusOptions = [
  "Pendente",
  "Recebido",
  "Nao se aplica",
  "Conferido",
  "Solicitar novamente",
];

type ChecklistCasoProps = {
  items: ChecklistTemplate[];
};

export function ChecklistCaso({ items }: ChecklistCasoProps) {
  const [statuses, setStatuses] = useState<Record<number, string>>({});

  const progresso = useMemo(() => {
    const concluidos = items.filter((_, index) =>
      ["Recebido", "Conferido", "Nao se aplica"].includes(statuses[index]),
    ).length;

    return calcularProgressoChecklist(items.length, concluidos);
  }, [items, statuses]);

  function handleAnexarDocumento(item: ChecklistTemplate) {
    const tipoDocumento = item.documentosNecessarios[0] || item.titulo;

    window.dispatchEvent(
      new CustomEvent("lexgestor:anexar-documento", {
        detail: {
          tipoDocumento,
          observacoes: `Checklist: ${item.titulo}`,
        },
      }),
    );

    const target = document.getElementById("lexgestor-upload-documento") || document.getElementById("documentos");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <strong>Aguardando categoria</strong>
        <p>Selecione categoria e subcategoria para carregar os documentos necessarios.</p>
      </div>
    );
  }

  return (
    <section className="stack" aria-label="Checklist do caso">
      <div className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>Progresso do checklist</strong>
            <p>{progresso}% dos itens recebidos, conferidos ou marcados como nao se aplica.</p>
          </div>
          <button className="button secondary" type="button">
            <Printer size={17} aria-hidden />
            Gerar PDF do checklist
          </button>
        </div>
        <div className="progress" aria-label={`Progresso ${progresso}%`}>
          <span style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {items.map((item, index) => (
        <article className="checklist-item" key={`${item.area}-${item.subarea}-${item.ordem}`}>
          <div className="button-row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{item.titulo}</strong>
              <p>{item.descricao}</p>
            </div>
            <span className="status-pill">{statuses[index] ?? "Pendente"}</span>
          </div>
          <div className="grid">
            {item.documentosNecessarios.map((documento) => (
              <span className="badge" key={documento}>
                {documento}
              </span>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              Status
              <select
                value={statuses[index] ?? "Pendente"}
                onChange={(event) =>
                  setStatuses((current) => ({
                    ...current,
                    [index]: event.target.value,
                  }))
                }
              >
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Observacao
              <input placeholder="Ex.: aguardando documento atualizado" />
            </label>
          </div>
          <button className="button secondary" type="button" onClick={() => handleAnexarDocumento(item)}>
            <Paperclip size={17} aria-hidden />
            Anexar documento neste item
          </button>
        </article>
      ))}
    </section>
  );
}
