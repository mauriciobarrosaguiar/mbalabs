"use client";

import { areasJuridicas } from "@/data/lexgestor";

type AreaSelectorProps = {
  selectedArea?: string;
  onSelect?: (area: string) => void;
};

export function AreaSelector({ selectedArea, onSelect }: AreaSelectorProps) {
  return (
    <div className="grid-wide" role="list" aria-label="Areas juridicas">
      {areasJuridicas.map((area) => (
        <button
          type="button"
          key={area.nome}
          className={`area-card${selectedArea === area.nome ? " selected" : ""}`}
          onClick={() => onSelect?.(area.nome)}
        >
          <strong>{area.nome}</strong>
          <span className="muted">{area.resumo}</span>
          <small className="badge">{area.subareas.length} subareas</small>
        </button>
      ))}
    </div>
  );
}
