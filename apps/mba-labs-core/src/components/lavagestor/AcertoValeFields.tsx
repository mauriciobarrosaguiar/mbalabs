"use client";

import { useState } from "react";

export function AcertoValeFields() {
  const [modo, setModo] = useState("nao");

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-black">
        Vale pendente
        <select className="input" name="modo_desconto" value={modo} onChange={(event) => setModo(event.target.value)}>
          <option value="nao">Não descontar agora</option>
          <option value="parcial">Descontar vale agora</option>
        </select>
      </label>

      {modo === "parcial" ? (
        <label className="grid gap-2 text-sm font-black">
          Valor a descontar
          <input className="input" name="valor_desconto_vale" inputMode="decimal" placeholder="Ex.: 50,00" />
        </label>
      ) : null}
    </div>
  );
}
