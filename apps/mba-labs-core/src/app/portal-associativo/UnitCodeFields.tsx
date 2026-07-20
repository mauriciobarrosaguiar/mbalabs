"use client";

import { useState } from "react";

const prefixes: Record<string, string> = { chacara: "CH", lote: "LT", casa: "CS", sala: "SL", box: "BX", propriedade: "PR", outro: "OT" };

export function UnitCodeFields({ defaultCode = "", defaultNumber = "", defaultType = "chacara" }: { defaultCode?: string; defaultNumber?: string; defaultType?: string }) {
  const [type, setType] = useState(defaultType);
  const [number, setNumber] = useState(defaultNumber);
  const [code, setCode] = useState(defaultCode);
  const [manual, setManual] = useState(Boolean(defaultCode));
  const suggest = (nextType: string, nextNumber: string) => `${prefixes[nextType] ?? "OT"}-${nextNumber.trim().padStart(3, "0")}`;
  return <>
    <label className="grid gap-1 text-sm font-semibold">Tipo<select className="input" name="tipo_unidade" value={type} onChange={(event) => { const value = event.target.value; setType(value); if (!manual && number) setCode(suggest(value, number)); }} required><option value="chacara">Chácara</option><option value="lote">Lote</option><option value="casa">Casa</option><option value="sala">Sala</option><option value="box">Box</option><option value="propriedade">Propriedade</option><option value="outro">Outro</option></select></label>
    <label className="grid gap-1 text-sm font-semibold">Número/nome da unidade<input className="input" name="numero_unidade" value={number} onChange={(event) => { const value = event.target.value; setNumber(value); if (!manual) setCode(suggest(type, value)); }} required /></label>
    <label className="grid gap-1 text-sm font-semibold">Código da unidade<input className="input" name="codigo_unidade" value={code} onChange={(event) => { setManual(true); setCode(event.target.value.toUpperCase()); }} required /><span className="text-xs font-normal text-muted-foreground">Gerado automaticamente; ajuste somente se necessário.</span></label>
  </>;
}
