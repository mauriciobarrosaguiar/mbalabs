"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CloudOff, Download, RefreshCw, Wifi } from "lucide-react";

const CACHE_NAME = "elshaday-bible-v1";
const WANTED_KEY = "elshaday:bible-offline-wanted:v1";
const UPDATED_KEY = "elshaday:bible-offline-updated:v1";

const BOOK_CHAPTERS: Record<string, number> = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36,
  EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
  ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
  MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, "1CO": 16,
  "2CO": 13, GAL: 6, EPH: 6, PHP: 4, COL: 4, "1TH": 5, "2TH": 3, "1TI": 6,
  "2TI": 4, TIT: 3, PHM: 1, HEB: 13, JAS: 5, "1PE": 5, "2PE": 3,
  "1JN": 5, "2JN": 1, "3JN": 1, JUD: 1, REV: 22
};

const CHAPTER_URLS = Object.entries(BOOK_CHAPTERS).flatMap(([book, total]) =>
  Array.from({ length: total }, (_, index) =>
    `/api/elshaday/biblia?book=${encodeURIComponent(book)}&chapter=${index + 1}`
  )
);
const TOTAL_CHAPTERS = CHAPTER_URLS.length;

type OfflineState = "idle" | "preparing" | "ready" | "paused" | "unsupported";

export function BibleOfflineManager() {
  const [online, setOnline] = useState(true);
  const [cachedCount, setCachedCount] = useState(0);
  const [state, setState] = useState<OfflineState>("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const runningRef = useRef(false);
  const stoppedRef = useRef(false);

  const percent = useMemo(
    () => Math.min(100, Math.round((cachedCount / TOTAL_CHAPTERS) * 100)),
    [cachedCount]
  );

  const postToWorker = useCallback((type: string) => {
    const worker = navigator.serviceWorker?.controller;
    if (worker) worker.postMessage({ type });
  }, []);

  const readCacheCount = useCallback(async () => {
    if (!("caches" in window)) return 0;
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const count = keys.filter((request) => {
        const url = new URL(request.url);
        return url.pathname === "/api/elshaday/biblia";
      }).length;
      setCachedCount(count);
      if (count >= TOTAL_CHAPTERS) setState("ready");
      return count;
    } catch {
      return 0;
    }
  }, []);

  const waitForController = useCallback(async () => {
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        navigator.serviceWorker.removeEventListener("controllerchange", done);
        resolve();
      };
      navigator.serviceWorker.addEventListener("controllerchange", done);
      window.setTimeout(done, 2500);
    });
  }, []);

  const prepareOffline = useCallback(async (automatic = false) => {
    if (runningRef.current) return;
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      setState("unsupported");
      return;
    }
    if (!navigator.onLine) {
      setOnline(false);
      setState("paused");
      return;
    }

    runningRef.current = true;
    stoppedRef.current = false;
    setState("preparing");
    window.localStorage.setItem(WANTED_KEY, "1");

    try {
      await navigator.serviceWorker.ready;
      await waitForController();
      postToWorker("CACHE_SHELL");
      postToWorker("FLUSH_OUTBOX");

      const cache = await caches.open(CACHE_NAME);
      const existing = new Set(
        (await cache.keys())
          .map((request) => new URL(request.url))
          .filter((url) => url.pathname === "/api/elshaday/biblia")
          .map((url) => url.pathname + url.search)
      );
      const pending = CHAPTER_URLS.filter((url) => !existing.has(url));
      let completed = TOTAL_CHAPTERS - pending.length;
      setCachedCount(completed);

      let cursor = 0;
      const worker = async () => {
        while (cursor < pending.length && !stoppedRef.current && navigator.onLine) {
          const url = pending[cursor++];
          try {
            const response = await fetch(url, {
              credentials: "include",
              headers: { "x-elshaday-offline": "download" }
            });
            if (response.ok) {
              completed += 1;
              if (completed % 5 === 0 || completed === TOTAL_CHAPTERS) {
                setCachedCount(completed);
              }
            }
          } catch {
            stoppedRef.current = true;
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 25));
        }
      };

      await Promise.all([worker(), worker(), worker()]);
      const finalCount = await readCacheCount();

      if (finalCount >= TOTAL_CHAPTERS) {
        const stamp = new Date().toISOString();
        window.localStorage.setItem(UPDATED_KEY, stamp);
        setUpdatedAt(stamp);
        setState("ready");
      } else if (!navigator.onLine || stoppedRef.current) {
        setState("paused");
      } else {
        setState(automatic ? "paused" : "idle");
      }
    } finally {
      runningRef.current = false;
    }
  }, [postToWorker, readCacheCount, waitForController]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      setState("unsupported");
      return;
    }

    let cancelled = false;
    setOnline(navigator.onLine);
    setUpdatedAt(window.localStorage.getItem(UPDATED_KEY));

    navigator.serviceWorker
      .register("/elshaday-sw.js", { scope: "/elshaday/" })
      .then(async (registration) => {
        if (cancelled) return;
        await registration.update().catch(() => undefined);
        await navigator.serviceWorker.ready;
        await waitForController();
        postToWorker("CACHE_SHELL");
        if (navigator.onLine) postToWorker("FLUSH_OUTBOX");
        const count = await readCacheCount();
        const wanted = window.localStorage.getItem(WANTED_KEY) === "1";
        if (wanted && count < TOTAL_CHAPTERS && navigator.onLine) {
          window.setTimeout(() => void prepareOffline(true), 800);
        }
      })
      .catch(() => {
        if (!cancelled) setState("unsupported");
      });

    const onOnline = () => {
      setOnline(true);
      postToWorker("CACHE_SHELL");
      postToWorker("FLUSH_OUTBOX");
      const wanted = window.localStorage.getItem(WANTED_KEY) === "1";
      if (wanted) window.setTimeout(() => void prepareOffline(true), 500);
    };
    const onOffline = () => {
      stoppedRef.current = true;
      setOnline(false);
      setState((current) => current === "ready" ? "ready" : "paused");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [postToWorker, prepareOffline, readCacheCount, waitForController]);

  if (state === "unsupported") {
    return null;
  }

  const ready = cachedCount >= TOTAL_CHAPTERS || state === "ready";
  const partial = cachedCount > 0 && !ready;

  return (
    <section className="rounded-[24px] border border-emerald-950/10 bg-[#f7f8f4] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={
          "grid size-11 shrink-0 place-items-center rounded-[14px] " +
          (ready ? "bg-emerald-100 text-emerald-800" : online ? "bg-white text-[#176445]" : "bg-amber-100 text-amber-800")
        }>
          {ready ? <CheckCircle2 size={22} /> : online ? <Wifi size={22} /> : <CloudOff size={22} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-black text-slate-950">Bíblia offline</h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                {ready
                  ? online
                    ? "Disponível sem internet. Alterações pendentes são sincronizadas automaticamente."
                    : "Sem internet · usando a Bíblia salva neste aparelho."
                  : state === "preparing"
                    ? `Preparando ${cachedCount} de ${TOTAL_CHAPTERS} capítulos...`
                    : partial
                      ? `${cachedCount} de ${TOTAL_CHAPTERS} capítulos salvos. O download continua quando a internet voltar.`
                      : "Baixe uma vez para ler mesmo quando não houver sinal."}
              </p>
            </div>

            {!ready ? (
              <button
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#123d2d] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!online || state === "preparing"}
                onClick={() => void prepareOffline(false)}
                type="button"
              >
                {state === "preparing" ? <RefreshCw className="animate-spin" size={15} /> : <Download size={15} />}
                {partial ? "Continuar" : "Preparar offline"}
              </button>
            ) : null}
          </div>

          {(state === "preparing" || partial) ? (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#176445] transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-bold text-slate-500">{percent}% concluído</p>
            </div>
          ) : null}

          {ready && updatedAt ? (
            <p className="mt-2 text-[11px] font-bold text-slate-500">
              Preparada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(updatedAt))}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
