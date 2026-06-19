"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Printer } from "lucide-react";
import type { ChecklistTemplate } from "@/data/lexgestor";
import { calcularProgressoChecklist } from "@/lib/lexgestor/checklist";

const statusOptions = [
  "Pendente",
  "Recebido",
  "Não se aplica",
  "Conferido",
  "Solicitar novamente",
];

type ChecklistCasoProps = {
  items: ChecklistTemplate[];
  clienteId?: string;
  casoId?: string;
  categoria?: string;
  subcategoria?: string;
};

export function ChecklistCaso({ items, clienteId = "", casoId = "", categoria = "", subcategoria = "" }: ChecklistCasoProps) {
  const [statuses, setStatuses] = useState<Record<number, string>>({});

  useEffect(() => {
    function handleDocumentoRecebido(event: Event) {
      const detail = (event as CustomEvent<{ area?: string; subarea?: string; ordem?: string }>).detail ?? {};
      const index = items.findIndex(
        (item) =>
          item.area === detail.area &&
          item.subarea === detail.subarea &&
          String(item.ordem) === String(detail.ordem),
      );

      if (index >= 0) {
        setStatuses((current) => ({ ...current, [index]: "Recebido" }));
      }
    }

    window.addEventListener("lexgestor:checklist-documento-recebido", handleDocumentoRecebido);
    return () => window.removeEventListener("lexgestor:checklist-documento-recebido", handleDocumentoRecebido);
  }, [items]);

  const progresso = useMemo(() => {
    const concluidos = items.filter((_, index) =>
      ["Recebido", "Conferido", "Não se aplica"].includes(statuses[index]),
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
          area: item.area,
          subarea: item.subarea,
          ordem: item.ordem,
          titulo: item.titulo,
        },
      }),
    );

    const target = document.getElementById("lexgestor-upload-documento") || document.getElementById("documentos");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (clienteId || casoId) {
      const params = new URLSearchParams();
      if (clienteId) params.set("cliente", clienteId);
      if (casoId) params.set("caso", casoId);
      if (categoria || item.area) params.set("categoria", categoria || item.area);
      if (subcategoria || item.subarea) params.set("subcategoria", subcategoria || item.subarea);
      window.location.href = `/lexgestor/documentos?${params.toString()}#documentos`;
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <strong>Aguardando categoria</strong>
        <p>Selecione categoria e subcategoria para carregar os documentos necessários.</p>
      </div>
    );
  }

  return (
    <section className="stack" aria-label="Checklist do caso">
      <div className="card">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>Progresso do checklist</strong>
            <p>{progresso}% dos itens recebidos, conferidos ou marcados como não se aplica.</p>
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
              Observação
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
