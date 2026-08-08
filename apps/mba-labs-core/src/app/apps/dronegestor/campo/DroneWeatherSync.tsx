"use client";

import { CloudSun, Droplets, LocateFixed, MapPin, RefreshCcw, Wind, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./drone-weather.module.css";

type WeatherSnapshot = {
  latitude: number;
  longitude: number;
  capturedAt: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  precipitation: number;
  weatherCode: number | null;
};

const WEATHER_KEY = "dronegestor:weather";

function cardinal(degrees: number) {
  const points = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function driftDirection(degrees: number) {
  const from = cardinal(degrees);
  const to = cardinal((degrees + 180) % 360);
  return `${from} → ${to}`;
}

function format(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function readCachedWeather(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    return raw ? (JSON.parse(raw) as WeatherSnapshot) : null;
  } catch {
    return null;
  }
}

export function DroneWeatherSync() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => setWeather(readCachedWeather()), []);

  const note = useMemo(() => {
    if (!weather) return "Use o GPS para consultar o modelo meteorológico do ponto.";
    if (weather.precipitation > 0) return "O modelo indica precipitação no ponto. Compare com a medição local e o protocolo antes de decidir.";
    return "Dados do modelo atualizados. Compare com a medição real feita no talhão antes da operação.";
  }, [weather]);

  async function syncWeather() {
    if (!navigator.geolocation) {
      setMessage("GPS não disponível neste dispositivo.");
      setOpen(true);
      return;
    }

    setLoading(true);
    setMessage("Obtendo localização do ponto...");
    setOpen(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = Number(position.coords.latitude.toFixed(7));
          const longitude = Number(position.coords.longitude.toFixed(7));
          setMessage("Consultando modelo meteorológico do ponto...");

          const params = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: [
              "temperature_2m",
              "relative_humidity_2m",
              "precipitation",
              "weather_code",
              "wind_speed_10m",
              "wind_direction_10m",
              "wind_gusts_10m"
            ].join(","),
            wind_speed_unit: "kmh",
            timezone: "auto"
          });

          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: "no-store" });
          if (!response.ok) throw new Error("Falha ao consultar o modelo meteorológico.");

          const payload = (await response.json()) as {
            current?: {
              temperature_2m?: number;
              relative_humidity_2m?: number;
              precipitation?: number;
              weather_code?: number;
              wind_speed_10m?: number;
              wind_direction_10m?: number;
              wind_gusts_10m?: number;
            };
          };

          const current = payload.current;
          if (!current) throw new Error("Condições atuais não retornadas.");

          const snapshot: WeatherSnapshot = {
            latitude,
            longitude,
            capturedAt: new Date().toISOString(),
            temperature: Number(current.temperature_2m ?? 0),
            humidity: Number(current.relative_humidity_2m ?? 0),
            windSpeed: Number(current.wind_speed_10m ?? 0),
            windDirection: Number(current.wind_direction_10m ?? 0),
            windGust: Number(current.wind_gusts_10m ?? 0),
            precipitation: Number(current.precipitation ?? 0),
            weatherCode: current.weather_code ?? null
          };

          localStorage.setItem(WEATHER_KEY, JSON.stringify(snapshot));
          setWeather(snapshot);
          setMessage("Modelo meteorológico e GPS atualizados. Esses valores NÃO foram gravados como medição de campo.");
          setLoading(false);
          window.setTimeout(() => window.location.reload(), 900);
        } catch (error) {
          setLoading(false);
          setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o modelo meteorológico.");
        }
      },
      (error) => {
        setLoading(false);
        if (error.code === error.PERMISSION_DENIED) setMessage("Autorize a localização do navegador para usar GPS e modelo meteorológico.");
        else if (error.code === error.TIMEOUT) setMessage("O GPS demorou para responder. Tente novamente em área aberta.");
        else setMessage("Não foi possível obter a posição atual.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  }

  const mapHref = weather
    ? `https://www.openstreetmap.org/?mlat=${weather.latitude}&mlon=${weather.longitude}#map=17/${weather.latitude}/${weather.longitude}`
    : null;

  return (
    <div className={styles.wrapper}>
      {open && (
        <section className={styles.panel} aria-live="polite">
          <div className={styles.head}>
            <div><span>GPS + modelo meteorológico</span><strong>Ponto da operação</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar clima"><X size={18} /></button>
          </div>

          {weather ? (
            <>
              <div className={styles.metrics}>
                <div><CloudSun size={18} /><span><strong>{format(weather.temperature, 1)}°C</strong><small>Modelo • 2 m</small></span></div>
                <div><Droplets size={18} /><span><strong>{format(weather.humidity)}%</strong><small>Umidade modelo</small></span></div>
                <div><Wind size={18} /><span><strong>{format(weather.windSpeed, 1)} km/h</strong><small>Vento a 10 m • {driftDirection(weather.windDirection)}</small></span></div>
                <div><RefreshCcw size={18} /><span><strong>{format(weather.windGust, 1)} km/h</strong><small>Rajada do modelo</small></span></div>
              </div>

              <div className={styles.alert}>{note}</div>

              <div className={styles.location}>
                <MapPin size={17} />
                <span>{weather.latitude.toFixed(5)}, {weather.longitude.toFixed(5)}</span>
                <small>Precipitação do modelo: {format(weather.precipitation, 1)} mm</small>
              </div>

              {mapHref && <a className={styles.mapButton} href={mapHref} target="_blank" rel="noreferrer"><MapPin size={17} /> Abrir mapa real</a>}
            </>
          ) : (
            <p className={styles.empty}>O GPS serve para localizar a operação e consultar o modelo meteorológico. A medição de campo continua sendo preenchida separadamente.</p>
          )}

          {message && <p className={styles.message}>{message}</p>}

          <button className={styles.syncButton} type="button" onClick={syncWeather} disabled={loading}>
            {loading ? <RefreshCcw className={styles.spin} size={18} /> : <LocateFixed size={18} />}
            {loading ? "Atualizando..." : weather ? "Atualizar GPS e modelo" : "Usar GPS e consultar modelo"}
          </button>

          <small className={styles.source}>Fonte: Open-Meteo. O vento exibido é do modelo a 10 m; não substitui anemômetro, medição local, bula, receituário ou RT.</small>
        </section>
      )}

      {!open && <button className={styles.fab} type="button" onClick={() => setOpen(true)} aria-label="Abrir GPS e modelo meteorológico"><CloudSun size={22} />{weather && <span />}</button>}
    </div>
  );
}
