"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, PlusSquare, Share2, Smartphone } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [userAgent, setUserAgent] = useState("");

  useEffect(() => {
    setInstalled(isStandaloneMode());
    setUserAgent(window.navigator.userAgent);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(userAgent), [userAgent]);

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstalled(true);
      }

      setInstallPrompt(null);
      return;
    }

    setShowInstructions((current) => !current);
  }

  if (installed) {
    return (
      <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <p className="font-bold text-white">Aplicativo instalado</p>
            <p className="text-sm leading-5 text-slate-300">Abra a MBA Labs pelo ícone da tela inicial.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-200">
          <Smartphone size={22} />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Aplicativo MBA Labs</p>
          <h2 className="mt-1 text-lg font-black text-white">Acesse seus sistemas pelo celular</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Instale uma única vez e entre no LavaGestor, MBA Cotações, LexGestor e nos demais sistemas liberados para sua conta.
          </p>
        </div>
      </div>

      <button
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        type="button"
        onClick={handleInstall}
      >
        <Download size={18} />
        Baixar aplicativo MBA Labs
      </button>

      {showInstructions ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-200">
          {isIos ? (
            <ol className="grid gap-2">
              <li className="flex gap-2">
                <Share2 className="mt-1 shrink-0 text-cyan-200" size={16} />
                <span>No Safari, toque no botão <strong>Compartilhar</strong>.</span>
              </li>
              <li className="flex gap-2">
                <PlusSquare className="mt-1 shrink-0 text-cyan-200" size={16} />
                <span>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</span>
              </li>
            </ol>
          ) : (
            <p>
              Abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
              No Android, recomendamos usar o Google Chrome.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
