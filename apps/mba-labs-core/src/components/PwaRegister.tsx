"use client";

import { useEffect } from "react";

const FAVORITE_QUEUE_KEY = "elshaday:bible-favorite-queue:v1";

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
          window.localStorage.removeItem(FAVORITE_QUEUE_KEY);

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
