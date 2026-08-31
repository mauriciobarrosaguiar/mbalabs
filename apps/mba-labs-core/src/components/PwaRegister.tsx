"use client";

import { useEffect } from "react";


export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        void registration.update().catch(() => undefined);

        if (window.location.pathname === "/login" && navigator.onLine) {
          const target =
            navigator.serviceWorker.controller ??
            registration.active ??
            registration.waiting;

          target?.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
        }
      } catch {
        // A aplicação continua funcionando normalmente mesmo se o registro falhar.
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
