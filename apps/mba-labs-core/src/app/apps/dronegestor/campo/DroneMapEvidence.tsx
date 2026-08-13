"use client";

import { Camera, CheckCircle2, ImageUp, Loader2, MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Evidence = {
  id: string;
  storagePath: string;
  url: string;
  uploadedAt: string;
  source: string;
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  talhaoNome?: string;
  fazendaNome?: string;
};

type MissionContext = {
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  talhaoNome?: string;
  fazendaNome?: string;
};

const MISSION_KEY = "dronegestor:mission:v2";
const EVIDENCE_KEY = "dronegestor:mapEvidence:v1";

function getMission(): MissionContext {
  try {
    const parsed = JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as MissionContext;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function DroneMapEvidence({ disabled = false }: { disabled?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const mission = getMission();
      const query = mission.ordemServicoId ? `?osId=${encodeURIComponent(mission.ordemServicoId)}` : "";
      try {
        const response = await fetch(`/api/dronegestor/mapa${query}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok) {
          setEvidence(payload?.evidence ?? null);
          if (payload?.evidence) localStorage.setItem(EVIDENCE_KEY, JSON.stringify(payload.evidence));
        }
      } catch {
        // A operação continua funcionando mesmo sem conexão.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function upload(file: File | undefined, source: "camera" | "arquivo") {
    if (!file || disabled || uploading) return;
    setMessage("");
    setUploading(true);
    const mission = getMission();
    const form = new FormData();
    form.append("foto", file);
    form.append("source", source);
    form.append("ordemServicoId", mission.ordemServicoId || "");
    form.append("ordemServicoNumero", mission.ordemServicoNumero || "");
    form.append("talhaoNome", mission.talhaoNome || "");
    form.append("fazendaNome", mission.fazendaNome || "");

    try {
      const response = await fetch("/api/dronegestor/mapa", { method: "POST", body: form, cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.evidence) throw new Error(payload?.error || "Não foi possível salvar a foto.");
      setEvidence(payload.evidence as Evidence);
      localStorage.setItem(EVIDENCE_KEY, JSON.stringify(payload.evidence));
      window.dispatchEvent(new CustomEvent("dronegestor:map-evidence-updated", { detail: payload.evidence }));
      setMessage("Mapa registrado e vinculado a esta operação.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao enviar a foto do mapa.");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
          <MapPinned size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-black text-emerald-950">Mapa usado no voo</strong>
          <p className="mt-1 text-xs leading-5 text-emerald-900/75">
            Fotografe a tela do controle ou carregue a imagem do mapa realmente utilizado nesta aplicação.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex min-h-20 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white text-sm font-bold text-emerald-800">
          <Loader2 className="animate-spin" size={17} /> Carregando mapa...
        </div>
      ) : evidence?.url ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={evidence.url} alt="Mapa usado no voo" className="max-h-72 w-full object-contain" />
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={16} />
            <span className="truncate">
              {evidence.ordemServicoNumero || evidence.talhaoNome || "Imagem do mapa salva"}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-white px-4 py-5 text-center text-xs font-semibold text-slate-500">
          Nenhuma imagem do mapa registrada nesta operação.
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "camera")}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "arquivo")}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white disabled:opacity-50"
        >
          {uploading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
          Tirar foto
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black text-emerald-800 disabled:opacity-50"
        >
          <ImageUp size={18} /> Carregar foto
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-xs font-bold ${message.startsWith("Mapa registrado") ? "text-emerald-800" : "text-red-700"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
