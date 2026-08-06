"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // O aplicativo continua funcionando online mesmo se o registro falhar.
      });
    }
  }, []);

  return null;
}
