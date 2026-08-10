"use client";

import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type VersionPayload = { version?: string };

type WindowWithInstallPrompt = Window & {
  __caldaInstallPrompt?: InstallPromptEvent;
};

const VERSION_KEY = "calda-facil-pwa-version";
const VERSION_URL = "/api/dronegestor/calculadora/version";

export function PwaInstallAndUpdate() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = useCallback(async (firstCheck = false) => {
    try {
      const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) return;

      const payload = (await response.json()) as VersionPayload;
      const version = payload.version;
      if (!version) return;

      const previous = localStorage.getItem(VERSION_KEY);
      if (!previous || firstCheck) {
        localStorage.setItem(VERSION_KEY, version);
        return;
      }

      if (previous !== version) setUpdateAvailable(true);
    } catch {
      // Sem internet: mantém a calculadora aberta normalmente.
    }
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const cachedPrompt = (window as WindowWithInstallPrompt).__caldaInstallPrompt;
    if (cachedPrompt) setInstallPrompt(cachedPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/drone-calculadora-sw.js", {
          scope: "/apps/dronegestor/calculadora",
          updateViaCache: "none"
        })
        .then(async (registration) => {
          await registration.update();
          await navigator.serviceWorker.ready;
        })
        .catch(() => undefined);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as InstallPromptEvent;
      (window as WindowWithInstallPrompt).__caldaInstallPrompt = promptEvent;
      setInstallPrompt(promptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      delete (window as WindowWithInstallPrompt).__caldaInstallPrompt;
    };

    const handleFocus = () => void checkVersion(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    void checkVersion(true);
    const interval = window.setInterval(() => void checkVersion(false), 2 * 60 * 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [checkVersion]);

  async function install() {
    const promptEvent = installPrompt || (window as WindowWithInstallPrompt).__caldaInstallPrompt;

    // O navegador só permite abrir o instalador nativo quando o evento de
    // instalação está disponível. Não mostramos mais instruções manuais.
    if (!promptEvent) return;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setInstallPrompt(null);
    delete (window as WindowWithInstallPrompt).__caldaInstallPrompt;
  }

  async function applyUpdate() {
    try {
      const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as VersionPayload;
      if (payload.version) localStorage.setItem(VERSION_KEY, payload.version);
    } catch {
      // O reload abaixo ainda tentará buscar a versão mais recente.
    }
    window.location.reload();
  }

  return (
    <>
      {!installed && (
        <button
          type="button"
          onClick={install}
          className="fixed right-4 top-4 z-[80] grid size-10 place-items-center rounded-full border border-white/20 bg-[#0b5f3c]/92 text-white shadow-[0_5px_18px_rgba(0,0,0,0.18)] backdrop-blur transition active:scale-95 sm:right-6 sm:top-6"
          aria-label="Instalar Calda Fácil"
          title="Instalar aplicativo"
        >
          <Download size={19} strokeWidth={2.5} />
        </button>
      )}

      {updateAvailable && (
        <div className="fixed bottom-4 left-1/2 z-[95] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-[18px] border border-[#d7e5d7] bg-white px-4 py-3 text-[#1d2b21] shadow-[0_14px_38px_rgba(16,37,24,0.22)]">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eaf4df] text-[#17603a]">
            <RefreshCw size={18} strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[14px] font-black">Nova atualização disponível</strong>
            <span className="text-[12px] font-medium text-[#68736b]">Toque em atualizar para usar a nova versão.</span>
          </div>
          <button
            type="button"
            onClick={applyUpdate}
            className="shrink-0 rounded-full bg-[#0b6a3e] px-3 py-2 text-[12px] font-extrabold text-white active:scale-95"
          >
            Atualizar
          </button>
        </div>
      )}
    </>
  );
}
