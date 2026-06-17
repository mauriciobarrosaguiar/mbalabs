"use client";

import { encontrarArea } from "@/data/lexgestor/areas";

type SubareaSelectorProps = {
  area?: string;
  selectedSubarea?: string;
  onSelect?: (subarea: string) => void;
};

export function SubareaSelector({
  area,
  selectedSubarea,
  onSelect,
}: SubareaSelectorProps) {
  const subareas = area ? encontrarArea(area)?.subareas ?? [] : [];

  if (!area) {
    return <p className="muted">Selecione uma area juridica para ver as subareas.</p>;
  }

  return (
    <div className="subarea-list" aria-label={`Subareas de ${area}`}>
      {subareas.map((subarea) => (
        <button
          key={subarea}
          type="button"
          className={`subarea-chip${selectedSubarea === subarea ? " selected" : ""}`}
          onClick={() => onSelect?.(subarea)}
        >
          {subarea}
        </button>
      ))}
    </div>
  );
}
