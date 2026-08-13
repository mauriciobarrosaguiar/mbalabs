"use client";

import { CheckCircle2, ExternalLink, FileUp, Loader2, MapPinned } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Coordinate = [number, number];
type Geometry = {
  id: string;
  geometryType: "Polygon";
  coordinates: Coordinate[];
  sourceName: string;
  sourceFormat: "geojson" | "kml";
  importedAt: string;
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  talhaoNome?: string;
  fazendaNome?: string;
  areaHa: number;
  pointCount: number;
  bbox: { west: number; south: number; east: number; north: number };
  center: { longitude: number; latitude: number };
};
type Mission = { ordemServicoId?: string; ordemServicoNumero?: string; talhaoNome?: string; fazendaNome?: string };

const MISSION_KEY = "dronegestor:mission:v2";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function getMission(): Mission {
  try { return JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Mission; } catch { return {}; }
}
function cacheKey(osId?: string) { return `dronegestor:mapGeometry:v1:${osId || "manual"}`; }
function toPair(value: unknown): Coordinate {
  if (!Array.isArray(value) || value.length < 2) throw new Error("Coordenada inválida no arquivo.");
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new Error("Coordenada fora do intervalo válido.");
  return [lon, lat];
}
function polygonFromGeoJson(value: any): Coordinate[] {
  let geometry = value;
  if (value?.type === "Feature") geometry = value.geometry;
  if (value?.type === "FeatureCollection") {
    const feature = Array.isArray(value.features) ? value.features.find((item: any) => item?.geometry?.type === "Polygon") : null;
    geometry = feature?.geometry;
  }
  if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates?.[0])) {
    if (geometry?.type === "MultiPolygon") throw new Error("MultiPolygon ainda não é suportado. Exporte apenas o talhão desejado como Polygon.");
    throw new Error("O GeoJSON precisa conter um Polygon do talhão.");
  }
  return geometry.coordinates[0].map(toPair);
}
function polygonFromKml(text: string): Coordinate[] {
  const documentXml = new DOMParser().parseFromString(text, "application/xml");
  if (documentXml.querySelector("parsererror")) throw new Error("KML inválido ou corrompido.");
  const polygon = documentXml.querySelector("Polygon");
  if (!polygon) throw new Error("O KML precisa conter um Polygon do talhão.");
  const coordinatesNode = polygon.querySelector("outerBoundaryIs LinearRing coordinates") || polygon.querySelector("LinearRing coordinates") || polygon.querySelector("coordinates");
  const raw = coordinatesNode?.textContent?.trim();
  if (!raw) throw new Error("O polígono KML não possui coordenadas.");
  return raw.split(/\s+/).filter(Boolean).map((entry) => {
    const parts = entry.split(",");
    return toPair([parts[0], parts[1]]);
  });
}
async function parseFile(file: File) {
  if (file.size <= 0) throw new Error("O arquivo está vazio.");
  if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo é muito grande. Use KML/GeoJSON de até 5 MB.");
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const text = await file.text();
  if (extension === "kml") return { format: "kml" as const, coordinates: polygonFromKml(text) };
  if (extension === "geojson" || extension === "json") {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error("GeoJSON inválido ou corrompido."); }
    return { format: "geojson" as const, coordinates: polygonFromGeoJson(parsed) };
  }
  if (extension === "kmz") throw new Error("KMZ ainda não foi liberado. Precisamos validar um arquivo real exportado pelo equipamento antes de aceitar esse formato.");
  throw new Error("Formato não suportado. Use KML ou GeoJSON.");
}

export function DroneGeoMapEvidence() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const mission = getMission();
    setLoading(true);
    setMessage("");
    try {
      const query = mission.ordemServicoId ? `?osId=${encodeURIComponent(mission.ordemServicoId)}` : "";
      const response = await fetch(`/api/dronegestor/mapa-geometria${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o polígono.");
      const next = (payload?.geometry ?? null) as Geometry | null;
      setGeometry(next);
      if (next) localStorage.setItem(cacheKey(mission.ordemServicoId), JSON.stringify(next));
      else localStorage.removeItem(cacheKey(mission.ordemServicoId));
    } catch (error) {
      try {
        const cached = localStorage.getItem(cacheKey(mission.ordemServicoId));
        if (cached) setGeometry(JSON.parse(cached) as Geometry);
      } catch { /* ignore */ }
      setMessage(error instanceof Error ? `${error.message} Se houver cópia local, ela foi mantida.` : "Falha ao carregar o polígono.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setMessage("");
    try {
      const parsed = await parseFile(file);
      const mission = getMission();
      const response = await fetch("/api/dronegestor/mapa-geometria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          coordinates: parsed.coordinates,
          sourceFormat: parsed.format,
          sourceName: file.name,
          ordemServicoId: mission.ordemServicoId || "",
          ordemServicoNumero: mission.ordemServicoNumero || "",
          talhaoNome: mission.talhaoNome || "",
          fazendaNome: mission.fazendaNome || ""
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.geometry) throw new Error(payload?.error || "Não foi possível salvar o polígono.");
      const next = payload.geometry as Geometry;
      setGeometry(next);
      localStorage.setItem(cacheKey(mission.ordemServicoId), JSON.stringify(next));
      localStorage.setItem("dronegestor:syncDirty:v4", "1");
      window.dispatchEvent(new CustomEvent("dronegestor:map-geometry-updated", { detail: next }));
      setMessage(`Polígono registrado: ${next.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha calculados pelo arquivo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao importar o arquivo geográfico.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const osmUrl = geometry ? `https://www.openstreetmap.org/?mlat=${geometry.center.latitude}&mlon=${geometry.center.longitude}#map=16/${geometry.center.latitude}/${geometry.center.longitude}` : "";

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><MapPinned size={20}/></span>
        <div className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-950">Polígono do talhão</strong><p className="mt-1 text-xs leading-5 text-slate-600">Opcional nesta fase. Importe KML ou GeoJSON para guardar o contorno geográfico realmente utilizado.</p></div>
      </div>

      {loading ? <div className="mt-3 flex min-h-20 items-center justify-center gap-2 rounded-xl bg-slate-50 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17}/> Carregando polígono...</div> : geometry ? <>
        <PolygonPreview geometry={geometry}/>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Data label="Área calculada" value={`${geometry.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`}/>
          <Data label="Pontos" value={String(geometry.pointCount)}/>
          <Data label="Formato" value={geometry.sourceFormat.toUpperCase()}/>
          <Data label="Arquivo" value={geometry.sourceName}/>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"><CheckCircle2 size={16}/> Polígono vinculado {geometry.ordemServicoNumero ? `à ${geometry.ordemServicoNumero}` : "à missão atual"}.</div>
        {osmUrl && <a href={osmUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 no-underline"><ExternalLink size={15}/> Abrir centro no mapa</a>}
      </> : <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-500">Nenhum polígono geográfico registrado para esta operação.</div>}

      <input ref={inputRef} type="file" accept=".kml,.geojson,.json,application/geo+json,application/json,application/vnd.google-earth.kml+xml" className="hidden" onChange={(event) => void importFile(event)}/>
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 className="animate-spin" size={18}/> : <FileUp size={18}/>} {geometry ? "Substituir KML / GeoJSON" : "Carregar KML / GeoJSON"}</button>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">KMZ e arquivos específicos DJI AGRAS serão liberados somente depois de validar amostras reais exportadas pelo equipamento.</p>
      {message && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${message.startsWith("Polígono registrado") ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>{message}</p>}
    </section>
  );
}

function PolygonPreview({ geometry }: { geometry: Geometry }) {
  const points = useMemo(() => {
    const { west, east, south, north } = geometry.bbox;
    const width = Math.max(1e-9, east - west);
    const height = Math.max(1e-9, north - south);
    return geometry.coordinates.map(([lon, lat]) => {
      const x = 12 + (lon - west) / width * 296;
      const y = 188 - (lat - south) / height * 176;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [geometry]);
  return <div className="mt-3 overflow-hidden rounded-xl border border-sky-100 bg-[linear-gradient(#f8fafc_1px,transparent_1px),linear-gradient(90deg,#f8fafc_1px,transparent_1px)] bg-[size:20px_20px] p-2"><svg viewBox="0 0 320 200" className="h-44 w-full text-sky-700" role="img" aria-label="Prévia do polígono importado"><polygon points={points} fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg></div>;
}
function Data({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2"><span className="block text-slate-400">{label}</span><strong className="mt-0.5 block truncate text-slate-700" title={value}>{value}</strong></div>;
}
