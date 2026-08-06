"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  Images,
  Mic2,
  Music2,
  Sparkles,
  UserRound,
  Video
} from "lucide-react";

type VideoMode = "narrado" | "gravacao" | "visual";
type VoiceStyle = "feminina" | "masculina" | "neutra";
type DurationStyle = "curto" | "medio" | "longo";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const modes: Array<{
  id: VideoMode;
  title: string;
  description: string;
  delivery: string;
  icon: typeof Mic2;
}> = [
  {
    id: "narrado",
    title: "Vídeo narrado",
    description: "A voz conta a história enquanto aparecem fotos e vídeos da sua rotina.",
    delivery: "Narração, cenas, legendas, transições e música de fundo.",
    icon: Mic2
  },
  {
    id: "gravacao",
    title: "Roteiro para eu gravar",
    description: "Você aparece ou mostra o local e recebe exatamente o que falar e filmar.",
    delivery: "Falas prontas, ordem das cenas, enquadramento e texto na tela.",
    icon: UserRound
  },
  {
    id: "visual",
    title: "Vídeo visual automático",
    description: "Conteúdo interessante sem precisar aparecer ou fazer narração contínua.",
    delivery: "Clipes ou imagens, textos animados, cortes, efeitos e música.",
    icon: Images
  }
];

export function ConteudoIaModeSelector() {
  const [mode, setMode] = useState<VideoMode>("gravacao");
  const [voice, setVoice] = useState<VoiceStyle>("neutra");
  const [duration, setDuration] = useState<DurationStyle>("medio");
  const [useRealMedia, setUseRealMedia] = useState(true);

  useEffect(() => {
    const storedMode = readCookie("mba_conteudo_modo");
    const storedVoice = readCookie("mba_conteudo_voz");
    const storedDuration = readCookie("mba_conteudo_duracao");
    const storedRealMedia = readCookie("mba_conteudo_midia_real");

    if (storedMode === "narrado" || storedMode === "gravacao" || storedMode === "visual") {
      setMode(storedMode);
    } else {
      writeCookie("mba_conteudo_modo", "gravacao");
    }

    if (storedVoice === "feminina" || storedVoice === "masculina" || storedVoice === "neutra") {
      setVoice(storedVoice);
    } else {
      writeCookie("mba_conteudo_voz", "neutra");
    }

    if (storedDuration === "curto" || storedDuration === "medio" || storedDuration === "longo") {
      setDuration(storedDuration);
    } else {
      writeCookie("mba_conteudo_duracao", "medio");
    }

    if (storedRealMedia === "nao") {
      setUseRealMedia(false);
    } else {
      writeCookie("mba_conteudo_midia_real", "sim");
    }
  }, []);

  function selectMode(nextMode: VideoMode) {
    setMode(nextMode);
    writeCookie("mba_conteudo_modo", nextMode);
  }

  function selectVoice(nextVoice: VoiceStyle) {
    setVoice(nextVoice);
    writeCookie("mba_conteudo_voz", nextVoice);
  }

  function selectDuration(nextDuration: DurationStyle) {
    setDuration(nextDuration);
    writeCookie("mba_conteudo_duracao", nextDuration);
  }

  function toggleRealMedia() {
    const nextValue = !useRealMedia;
    setUseRealMedia(nextValue);
    writeCookie("mba_conteudo_midia_real", nextValue ? "sim" : "nao");
  }

  const selectedMode = modes.find((item) => item.id === mode) ?? modes[1];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_90%_10%,rgba(217,70,239,0.18),transparent_26%),linear-gradient(150deg,rgba(12,16,43,0.97),rgba(30,14,63,0.93))]">
      <div className="border-b border-white/10 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
              <Video size={15} />
              Formato do conteúdo
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
              Como você quer produzir este vídeo?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
              Escolha uma opção antes de gerar. A IA adaptará as falas, a narração, as cenas e o briefing visual.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100">
            <Check size={15} />
            {selectedMode.title}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3 md:p-7">
        {modes.map((item) => {
          const Icon = item.icon;
          const selected = item.id === mode;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectMode(item.id)}
              aria-pressed={selected}
              className={`group min-h-[220px] rounded-[1.5rem] border p-5 text-left transition ${
                selected
                  ? "border-fuchsia-300/55 bg-fuchsia-400/12 shadow-[0_0_35px_rgba(217,70,239,0.14)]"
                  : "border-white/10 bg-black/15 hover:border-fuchsia-300/30 hover:bg-white/[0.045]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`grid size-12 place-items-center rounded-2xl border ${selected ? "border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
                  <Icon size={24} />
                </span>
                <span className={`grid size-8 place-items-center rounded-full border ${selected ? "border-fuchsia-300/45 bg-fuchsia-500 text-white" : "border-white/15 text-transparent"}`}>
                  <Check size={17} />
                </span>
              </div>
              <h3 className="mt-5 text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs font-bold leading-5 text-fuchsia-200">
                {item.delivery}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 border-t border-white/10 bg-black/10 p-5 md:grid-cols-3 md:p-7">
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          <span className="flex items-center gap-2">
            <Clock3 className="text-fuchsia-300" size={17} />
            Duração desejada
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 text-white outline-none focus:border-fuchsia-400/70"
            value={duration}
            onChange={(event) => selectDuration(event.target.value as DurationStyle)}
          >
            <option value="curto">Curto — 15 a 30 segundos</option>
            <option value="medio">Médio — 30 a 60 segundos</option>
            <option value="longo">Longo — 60 a 90 segundos</option>
          </select>
        </label>

        <label className={`grid gap-2 text-sm font-bold text-slate-200 ${mode === "narrado" ? "" : "opacity-55"}`}>
          <span className="flex items-center gap-2">
            <Mic2 className="text-fuchsia-300" size={17} />
            Voz da narração
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 text-white outline-none focus:border-fuchsia-400/70 disabled:cursor-not-allowed"
            value={voice}
            disabled={mode !== "narrado"}
            onChange={(event) => selectVoice(event.target.value as VoiceStyle)}
          >
            <option value="neutra">Natural e neutra</option>
            <option value="feminina">Voz feminina</option>
            <option value="masculina">Voz masculina</option>
          </select>
        </label>

        <button
          type="button"
          onClick={toggleRealMedia}
          aria-pressed={useRealMedia}
          className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-left transition hover:border-fuchsia-300/30"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Music2 className="text-fuchsia-300" size={17} />
              Usar mídia real
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Planejar com suas fotos e vídeos.
            </span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${useRealMedia ? "bg-fuchsia-500" : "bg-white/10"}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white transition ${useRealMedia ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </div>

      <div className="flex gap-3 border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-500 md:px-7">
        <Sparkles className="mt-0.5 shrink-0 text-fuchsia-300" size={16} />
        Nesta etapa, a escolha altera o roteiro e o plano de produção. A geração e montagem automática do arquivo MP4 será ativada na fase de vídeo.
      </div>
    </section>
  );
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}
