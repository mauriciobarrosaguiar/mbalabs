"use client";

import { useEffect, useState } from "react";
import { BRAZIL_UF_OPTIONS, ibgeCitiesUrl } from "@/lib/brazil-location-options";

export function BrazilLocationFields({
  defaultUf = "",
  defaultCity = "",
  cityName = "cidade",
  ufName = "uf",
  cityLabel = "Cidade",
  ufLabel = "UF"
}: {
  defaultUf?: string;
  defaultCity?: string;
  cityName?: string;
  ufName?: string;
  cityLabel?: string;
  ufLabel?: string;
}) {
  const [uf, setUf] = useState(defaultUf);
  const [city, setCity] = useState(defaultCity);
  const [cities, setCities] = useState<string[]>(defaultCity ? [defaultCity] : []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uf) { setCities([]); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(ibgeCitiesUrl(uf), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Falha ao carregar cidades")))
      .then((rows: Array<{ nome?: string }>) => setCities(Array.from(new Set([defaultCity, ...rows.map((row) => row.nome ?? "")].filter(Boolean)))))
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setCities(defaultCity ? [defaultCity] : []); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [uf, defaultCity]);

  return <>
    <label className="grid gap-1 text-sm font-semibold">{ufLabel}
      <select className="input" name={ufName} value={uf} onChange={(event) => { setUf(event.target.value); setCity(""); }}>
        <option value="">Selecione</option>
        {BRAZIL_UF_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value} - {option.label}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">{cityLabel}
      <select className="input" name={cityName} value={city} onChange={(event) => setCity(event.target.value)} disabled={!uf || loading}>
        <option value="">{loading ? "Carregando cidades..." : "Selecione"}</option>
        {cities.map((city) => <option key={city} value={city}>{city}</option>)}
      </select>
    </label>
  </>;
}
