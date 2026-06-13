"use client";

import { useMemo, useState } from "react";
import { getProfileOptionsForAppSlug, normalizeRegistrySlug } from "@/lib/app-registry";

type AppOption = {
  label: string;
  value: string;
  slug?: string | null;
};

export function AppPermissionFields({
  apps,
  defaultAppId = "",
  defaultProfile = ""
}: {
  apps: AppOption[];
  defaultAppId?: string;
  defaultProfile?: string;
}) {
  const [selectedAppId, setSelectedAppId] = useState(defaultAppId);
  const selectedApp = useMemo(
    () => apps.find((app) => app.value === selectedAppId) ?? null,
    [apps, selectedAppId]
  );
  const selectedSlug = normalizeRegistrySlug(selectedApp?.slug ?? "");
  const profileOptions = getProfileOptionsForAppSlug(selectedSlug);
  const defaultProfileIsValid = profileOptions.some((option) => option.value === defaultProfile);

  return (
    <>
      <label className="grid gap-2">
        <span className="text-sm font-bold">App permitido</span>
        <select
          className="input"
          name="app_id"
          value={selectedAppId}
          onChange={(event) => setSelectedAppId(event.target.value)}
        >
          <option value="">Selecione</option>
          {apps.map((app) => (
            <option key={app.value} value={app.value}>
              {app.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-bold">Perfil dentro do app</span>
        <select
          className="input"
          name="perfil_app"
          defaultValue={defaultProfileIsValid ? defaultProfile : ""}
          disabled={!selectedAppId}
          required={Boolean(selectedAppId)}
          key={selectedSlug}
        >
          <option value="">Selecione</option>
          {profileOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
