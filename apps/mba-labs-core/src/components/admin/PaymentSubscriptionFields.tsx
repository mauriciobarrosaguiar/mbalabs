"use client";

import { useMemo, useState } from "react";

type Option = {
  label: string;
  value: string;
};

type SubscriptionOption = Option & {
  empresaId?: string | null;
};

export function PaymentSubscriptionFields({
  empresas,
  assinaturas,
  defaultEmpresaId = "",
  defaultAssinaturaId = ""
}: {
  empresas: Option[];
  assinaturas: SubscriptionOption[];
  defaultEmpresaId?: string;
  defaultAssinaturaId?: string;
}) {
  const [empresaId, setEmpresaId] = useState(defaultEmpresaId);
  const [assinaturaId, setAssinaturaId] = useState(defaultAssinaturaId);

  const assinaturasFiltradas = useMemo(() => {
    if (!empresaId) return [];
    return assinaturas.filter((assinatura) => String(assinatura.empresaId ?? "") === empresaId);
  }, [assinaturas, empresaId]);

  return (
    <>
      <label className="grid gap-2">
        <span className="text-sm font-bold">Empresa</span>
        <select
          className="input"
          name="empresa_id"
          value={empresaId}
          required
          onChange={(event) => {
            setEmpresaId(event.target.value);
            setAssinaturaId("");
          }}
        >
          <option value="">Selecione</option>
          {empresas.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-bold">Assinatura</span>
        <select
          className="input"
          name="assinatura_id"
          value={assinaturaId}
          required
          disabled={!empresaId}
          onChange={(event) => setAssinaturaId(event.target.value)}
        >
          <option value="">
            {empresaId ? "Selecione" : "Selecione a empresa primeiro"}
          </option>
          {assinaturasFiltradas.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
