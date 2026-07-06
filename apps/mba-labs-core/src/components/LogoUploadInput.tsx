"use client";

import { useMemo, useState } from "react";

export function LogoUploadInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [logoUrl, setLogoUrl] = useState(defaultValue);
  const [error, setError] = useState("");

  const hasLogo = useMemo(() => logoUrl.trim().length > 0, [logoUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setError("");

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Envie apenas imagem PNG, JPG, JPEG, WEBP ou SVG.");
      return;
    }

    if (file.size > 450 * 1024) {
      setError("A logo está muito pesada. Use uma imagem de até 450 KB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setLogoUrl(String(reader.result ?? ""));
    };

    reader.onerror = () => {
      setError("Não foi possível carregar a imagem.");
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="logo-upload md:col-span-2">
      <div className="logo-upload-header">
        <div>
          <span className="text-sm font-bold">Logo da plataforma</span>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Envie uma imagem leve. Recomendado: PNG transparente, até 450 KB.
          </p>
        </div>

        {hasLogo ? (
          <button className="button-secondary logo-upload-clear" onClick={() => setLogoUrl("")} type="button">
            Remover logo
          </button>
        ) : null}
      </div>

      <div className="logo-upload-grid">
        <label className="logo-upload-drop">
          <input accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={handleFileChange} type="file" />
          <span className="logo-upload-drop-title">Escolher arquivo</span>
          <span className="logo-upload-drop-text">PNG, JPG, WEBP ou SVG</span>
        </label>

        <div className="logo-upload-preview">
          {hasLogo ? (
            <img alt="Pré-visualização da logo" src={logoUrl} />
          ) : (
            <div className="logo-upload-placeholder">
              <span>MB</span>
              <small>Sem logo enviada</small>
            </div>
          )}
        </div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-bold">URL ou imagem carregada</span>
        <input
          className="input"
          name="logoUrl"
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="Cole uma URL ou envie uma imagem acima"
          value={logoUrl}
        />
      </label>

      {error ? <p className="rounded-[8px] border border-red-500 bg-red-50 p-3 text-sm font-black text-red-950">{error}</p> : null}
    </div>
  );
}