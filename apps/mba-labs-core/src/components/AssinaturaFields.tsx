"use client";

import { useEffect, useMemo, useState } from "react";

type Option = {
  label: string;
  value: string;
};

type PlanOption = Option & {
  appId?: string | null;
};

type EmpresaAppOption = {
  empresaId: string;
  appId: string;
  planoId?: string | null;
  label: string;
  status: string;
};

export function AssinaturaFields({
  empresas,
  planos,
  empresaApps,
  defaultEmpresaId = "",
  defaultAppId = "",
  defaultPlanoId = ""
}: {
  empresas: Option[];
  planos: PlanOption[];
  empresaApps: EmpresaAppOption[];
  defaultEmpresaId?: string;
  defaultAppId?: string;
  defaultPlanoId?: string;
}) {
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(defaultEmpresaId);
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId);
  const [selectedPlanoId, setSelectedPlanoId] = useState(defaultPlanoId);

  const linkedApps = useMemo(
    () => empresaApps.filter((item) => item.empresaId === selectedEmpresaId),
    [empresaApps, selectedEmpresaId]
  );

  const planOptions = useMemo(
    () => planos.filter((plano) => plano.appId === selectedAppId),
    [planos, selectedAppId]
  );

  useEffect(() => {
    if (!selectedEmpresaId) {
      setSelectedAppId("");
      setSelectedPlanoId("");
      return;
    }

    const selectedLink = linkedApps.find((item) => item.appId === selectedAppId);
    if (!selectedLink) {
      const firstLink = linkedApps[0];
      setSelectedAppId(firstLink?.appId ?? "");
      setSelectedPlanoId(firstLink?.planoId ?? "");
    }
  }, [linkedApps, selectedAppId, selectedEmpresaId]);

  useEffect(() => {
    if (selectedPlanoId && !planOptions.some((option) => option.value === selectedPlanoId)) {
      setSelectedPlanoId("");
    }
  }, [planOptions, selectedPlanoId]);

  function handleAppChange(appId: string) {
    setSelectedAppId(appId);
    setSelectedPlanoId(linkedApps.find((item) => item.appId === appId)?.planoId ?? "");
  }

  return (
    <>
      <label className="grid gap-2">
        <span className="text-sm font-bold">Empresa</span>
        <select
          className="input"
          name="empresa_id"
          value={selectedEmpresaId}
          onChange={(event) => {
            setSelectedEmpresaId(event.target.value);
            setSelectedAppId("");
            setSelectedPlanoId("");
          }}
          required
        >
          <option value="">Selecione</option>
          {empresas.map((empresa) => (
            <option key={empresa.value} value={empresa.value}>
              {empresa.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-bold">App</span>
        <select
          className="input"
          name="app_id"
          value={selectedAppId}
          onChange={(event) => handleAppChange(event.target.value)}
          disabled={!selectedEmpresaId || linkedApps.length === 0}
          required
        >
          <option value="">{selectedEmpresaId && linkedApps.length === 0 ? "Nenhum app cadastrado" : "Selecione"}</option>
          {linkedApps.map((app) => (
            <option key={app.appId} value={app.appId}>
              {app.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-bold">Plano</span>
        <select
          className="input"
          name="plano_id"
          value={selectedPlanoId}
          onChange={(event) => setSelectedPlanoId(event.target.value)}
          disabled={!selectedAppId}
        >
          <option value="">{selectedAppId && planOptions.length === 0 ? "Nenhum plano para este app" : "Selecione"}</option>
          {planOptions.map((plano) => (
            <option key={plano.value} value={plano.value}>
              {plano.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
