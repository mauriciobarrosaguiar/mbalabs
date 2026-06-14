"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile);
  const selectedApp = useMemo(
    () => apps.find((app) => app.value === selectedAppId) ?? null,
    [apps, selectedAppId]
  );
  const selectedSlug = normalizeRegistrySlug(selectedApp?.slug ?? "");
  const profileOptions = getProfileOptionsForAppSlug(selectedSlug);

  useEffect(() => {
    if (!selectedAppId) {
      setSelectedProfile("");
      return;
    }

    const profileIsValid = profileOptions.some((option) => option.value === selectedProfile);
    if (!profileIsValid) {
      setSelectedProfile(profileOptions[0]?.value ?? "");
    }
  }, [profileOptions, selectedAppId, selectedProfile]);

  return (
    <>
      <label className="grid gap-2">
        <span className="text-sm font-bold">App permitido</span>
        <select
          className="input"
          name="app_id"
          value={selectedAppId}
          onChange={(event) => {
            setSelectedAppId(event.target.value);
            setSelectedProfile("");
          }}
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
          value={selectedProfile}
          onChange={(event) => setSelectedProfile(event.target.value)}
          disabled={!selectedAppId || profileOptions.length === 0}
          required={Boolean(selectedAppId && profileOptions.length > 0)}
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
