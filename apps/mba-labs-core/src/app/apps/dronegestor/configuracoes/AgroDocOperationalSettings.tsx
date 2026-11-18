"use client";
import { useEffect, useState } from "react";
import { AgroDocCard, AgroDocError, agroGet } from "../AgroDocUi";
import { Save, Settings } from "lucide-react";
type SettingsData = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  bloquearMargemPreventiva: boolean;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
};
const labels = {
  insightsObrigatorios: "Exigir leitura dos insights operacionais",
  bloquearMargemPreventiva: "Bloquear margem preventiva insuficiente",
  exigirConfirmacao: "Exigir confirmação pré-voo",
  protocoloBordaduraCigarrinha:
    "Aplicar protocolo de bordadura para cigarrinha",
};
export function AgroDocOperationalSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null),
    [allowed, setAllowed] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    agroGet<{ settings: SettingsData; canManage: boolean }>(
      "/api/dronegestor/config",
    )
      .then((p) => {
        if (active) {
          setSettings(p.settings);
          setAllowed(p.canManage);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    if (!settings || !allowed) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/dronegestor/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || "Não foi possível salvar.");
      setSettings(p.settings);
      setMessage("Configurações operacionais salvas no histórico da empresa.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AgroDocCard title="Controles operacionais existentes" icon={Settings}>
      <AgroDocError error={error} />
      {settings ? (
        <>
          <div className="agro-form">
            <label>
              Margem preventiva (m)
              <input
                type="number"
                min={0}
                max={5000}
                disabled={!allowed || busy}
                value={settings.margemPreventiva}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    margemPreventiva: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          {Object.entries(labels).map(([key, label]) => (
            <label key={key} className="agro-setting-toggle">
              <span>{label}</span>
              <input
                type="checkbox"
                role="switch"
                checked={settings[key as keyof typeof labels]}
                disabled={!allowed || busy}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.checked })
                }
              />
            </label>
          ))}
          <button
            className="agro-button agro-button-primary"
            onClick={() => void save()}
            disabled={!allowed || busy}
          >
            <Save size={19} />
            {busy ? "Salvando..." : "Salvar configurações"}
          </button>
        </>
      ) : (
        !error && <p>Consultando configurações...</p>
      )}
      {message && (
        <p role="status" className="agro-form-note">
          {message}
        </p>
      )}
    </AgroDocCard>
  );
}
