"use client";

import { useState } from "react";

const options = [{ value: "chacara", label: "Chácaras", code: "CH" }, { value: "lotes", label: "Loteamento de lotes", code: "LT" }, { value: "condominio", label: "Condomínio", code: "CD" }, { value: "associacao", label: "Associação", code: "AS" }, { value: "outro", label: "Outro", code: "OT" }];

export function LoteamentoCodeFields({ defaultType = "outro", defaultCode = "" }: { defaultType?: string; defaultCode?: string }) {
  const [type, setType] = useState(defaultType);
  const [code, setCode] = useState(defaultCode || options.find((item) => item.value === defaultType)?.code || "OT");
  return <>
    <label className="grid gap-1 text-sm font-semibold">Tipo<select className="input" name="tipo_loteamento" value={type} onChange={(event) => { const value = event.target.value; setType(value); setCode(options.find((item) => item.value === value)?.code ?? "OT"); }}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-semibold">Código interno<input className="input" name="codigo" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /><span className="text-xs font-normal text-muted-foreground">Sugerido automaticamente conforme o tipo.</span></label>
  </>;
}
