"use client";

import { Camera, CheckCircle2, ImageUp, Loader2, MapPinned, Send, Trash2, X } from "lucide-react";
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

export function DroneMapEvidence() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSource, setPendingSource] = useState<"camera" | "arquivo">("arquivo");
  const [pendingPreview, setPendingPreview] = useState("");

  async function loadEvidence() {
    setLoading(true);
    const mission = getMission();
    const query = mission.ordemServicoId ? `?osId=${encodeURIComponent(mission.ordemServicoId)}` : "";
    try {
      const response = await fetch(`/api/dronegestor/mapa${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setEvidence(payload?.evidence ?? null);
        if (payload?.evidence) localStorage.setItem(EVIDENCE_KEY, JSON.stringify(payload.evidence));
      }
    } catch {
      const cached = localStorage.getItem(EVIDENCE_KEY);
      if (cached) {
        try { setEvidence(JSON.parse(cached) as Evidence); } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(EVIDENCE_KEY);
    if (cached) {
      try { setEvidence(JSON.parse(cached) as Evidence); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  async function openPanel() {
    setOpen(true);
    setMessage("");
    await loadEvidence();
  }

  function selectFile(file: File | undefined, source: "camera" | "arquivo") {
    if (!file || uploading) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingSource(source);
    setPendingPreview(URL.createObjectURL(file));
    setMessage("Imagem selecionada. Confira a prévia e toque em “Enviar e vincular”.");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function clearPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview("");
    setPendingFile(null);
    setMessage("");
  }

  async function uploadSelected() {
    if (!pendingFile || uploading) return;
    setMessage("");
    setUploading(true);
    const mission = getMission();
    const form = new FormData();
    form.append("foto", pendingFile);
    form.append("source", pendingSource);
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
      localStorage.setItem("dronegestor:syncDirty:v4", "1");
      window.dispatchEvent(new CustomEvent("dronegestor:map-evidence-updated", { detail: payload.evidence }));
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingPreview("");
      setPendingFile(null);
      setMessage("Mapa enviado, salvo e vinculado a esta operação.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao enviar a foto do mapa.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        className="fixed bottom-24 right-4 z-[55] inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-800 shadow-lg shadow-emerald-950/15 active:scale-95 sm:right-6"
        aria-label="Registrar mapa usado no voo"
      >
        <MapPinned size={18} />
        <span>Mapa do voo</span>
        {evidence && <CheckCircle2 size={16} className="text-emerald-600" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:items-center sm:p-4">
          <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-emerald-200 bg-[#f8fbf5] p-4 shadow-2xl sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white"><MapPinned size={22} /></span>
              <div className="min-w-0 flex-1">
                <strong className="block text-base font-black text-emerald-950">Mapa usado no voo</strong>
                <p className="mt-1 text-sm leading-5 text-emerald-900/75">Tire uma foto ou escolha uma imagem. Nada é enviado antes de você conferir e tocar em “Enviar e vincular”.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600" aria-label="Fechar"><X size={18} /></button>
            </div>

            {loading ? (
              <div className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white text-sm font-bold text-emerald-800"><Loader2 className="animate-spin" size={18} /> Carregando mapa...</div>
            ) : pendingPreview ? (
              <div className="mt-4 overflow-hidden rounded-2xl border-2 border-amber-300 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingPreview} alt="Imagem selecionada para envio" className="max-h-72 w-full object-contain" />
                <div className="px-3 py-2 text-xs font-black text-amber-900">Aguardando envio • {pendingFile?.name}</div>
              </div>
            ) : evidence?.url ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidence.url} alt="Mapa usado no voo" className="max-h-72 w-full object-contain" />
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-800"><CheckCircle2 size={16} /><span className="truncate">{evidence.ordemServicoNumero || evidence.talhaoNome || "Imagem do mapa salva"}</span></div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">Nenhuma imagem do mapa registrada nesta operação.</div>
            )}

            <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => selectFile(event.target.files?.[0], "camera")} />
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selectFile(event.target.files?.[0], "arquivo")} />

            <div className="drone-mobile-actions mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white disabled:opacity-50"><Camera size={18} /> Tirar foto</button>
              <button type="button" disabled={uploading} onClick={() => galleryRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black text-emerald-800 disabled:opacity-50"><ImageUp size={18} /> Escolher foto</button>
            </div>

            {pendingFile && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button type="button" disabled={uploading} onClick={() => void uploadSelected()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Enviar e vincular</button>
              <button type="button" disabled={uploading} onClick={clearPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600"><Trash2 size={17} /> Cancelar</button>
            </div>}

            {message && <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${message.startsWith("Mapa enviado") ? "bg-emerald-100 text-emerald-900" : message.startsWith("Imagem selecionada") ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-700"}`}>{message}</p>}

            <p className="mt-3 text-xs leading-5 text-slate-500">A imagem fica privada e vinculada ao usuário/empresa e à OS quando houver uma OS selecionada.</p>
          </section>
        </div>
      )}
    </>
  );
}
