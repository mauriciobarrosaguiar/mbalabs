"use client";

import { useMemo, useState } from "react";

type AppOption = {
  label: string;
  value: string;
  slug?: string | null;
};

const cotacoesAccessOptions = [
  { label: "Somente Farmacia", value: "pharmacy" },
  { label: "Somente Licitacao", value: "distributor_bidding" },
  { label: "Farmacia + Licitacao", value: "both" },
];

export function CotacoesAppAccessField({
  apps,
  defaultAppId = "",
  defaultAccess = "both",
}: {
  apps: AppOption[];
  defaultAppId?: string;
  defaultAccess?: string;
}) {
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId);
  const selectedApp = useMemo(
    () => apps.find((app) => app.value === selectedAppId) ?? null,
    [apps, selectedAppId],
  );
  const isCotacoes = normalizeSlug(selectedApp?.slug) === "mba-cotacoes";

  return (
    <>
      <label className="grid gap-2">
        <span className="text-sm font-bold">App</span>
        <select
          className="input"
          name="app_id"
          value={selectedAppId}
          onChange={(event) => setSelectedAppId(event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {apps.map((app) => (
            <option key={app.value} value={app.value}>
              {app.label}
            </option>
          ))}
        </select>
      </label>

      {isCotacoes ? (
        <label className="grid gap-2">
          <span className="text-sm font-bold">Acesso MBA Cotacoes</span>
          <select className="input" name="cotacoes_tipo_acesso" defaultValue={defaultAccess || "both"} required>
            {cotacoesAccessOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="cotacoes_tipo_acesso" value="" />
      )}
    </>
  );
}

function normalizeSlug(slug?: string | null) {
  if (slug === "mbacotacoes") return "mba-cotacoes";
  return slug ?? "";
}
