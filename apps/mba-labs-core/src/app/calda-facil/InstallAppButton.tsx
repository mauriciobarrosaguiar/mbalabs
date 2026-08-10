"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setInstalled(true);
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/calda-facil-sw.js", { scope: "/calda-facil" }).catch(() => undefined);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallPrompt(null);
  }

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="fixed right-3 top-3 z-[80] inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-[#0b5f3c]/90 px-3 py-2 text-[12px] font-extrabold text-white shadow-[0_5px_18px_rgba(0,0,0,0.18)] backdrop-blur transition active:scale-95 sm:right-5 sm:top-5"
        aria-label="Instalar Calda Fácil"
      >
        <Download size={15} strokeWidth={2.4} />
        Instalar
      </button>

      {showHelp && (
        <div className="fixed inset-x-3 top-16 z-[90] mx-auto max-w-sm rounded-[20px] border border-[#dce5da] bg-white p-4 text-[#1d2b21] shadow-[0_14px_38px_rgba(16,37,24,0.2)]">
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[#6d776f] hover:bg-[#f2f5ef]"
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
          <strong className="block pr-9 text-[16px] font-black">Instalar Calda Fácil</strong>
          <p className="mt-2 text-[14px] font-medium leading-6 text-[#667169]">
            No Chrome, toque no menu ⋮ e escolha <b>Adicionar à tela inicial</b> ou <b>Instalar app</b>.
          </p>
        </div>
      )}
    </>
  );
}
