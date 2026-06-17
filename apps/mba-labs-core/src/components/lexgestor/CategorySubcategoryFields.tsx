"use client";

import { useMemo, useState } from "react";
import type { CategoriaJuridica } from "@/data/lexgestor/areas";

type CategorySubcategoryFieldsProps = {
  categorias: CategoriaJuridica[];
  defaultCategoria?: string;
  defaultSubcategoria?: string;
  compact?: boolean;
};

export function CategorySubcategoryFields({
  categorias,
  defaultCategoria = "",
  defaultSubcategoria = "",
  compact,
}: CategorySubcategoryFieldsProps) {
  const [categoria, setCategoria] = useState(defaultCategoria);
  const [subcategoria, setSubcategoria] = useState(defaultSubcategoria);
  const selected = useMemo(
    () => categorias.find((item) => item.nome === categoria),
    [categorias, categoria],
  );

  const subcategorias = selected?.subcategorias ?? [];

  return (
    <>
      <label className={compact ? "field" : "field"}>
        Categoria
        <select
          name="categoria"
          required
          value={categoria}
          onChange={(event) => {
            setCategoria(event.target.value);
            setSubcategoria("");
          }}
        >
          <option value="">Escolha a categoria</option>
          {categorias.map((item) => (
            <option value={item.nome} key={item.nome}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
      <label className={compact ? "field" : "field"}>
        Subcategoria
        <select
          name="subcategoria"
          required
          value={subcategorias.some((item) => item.nome === subcategoria) ? subcategoria : ""}
          onChange={(event) => setSubcategoria(event.target.value)}
          disabled={!categoria}
        >
          <option value="">
            {categoria ? "Escolha a subcategoria" : "Escolha a categoria primeiro"}
          </option>
          {subcategorias.map((item) => (
            <option value={item.nome} key={item.nome}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
