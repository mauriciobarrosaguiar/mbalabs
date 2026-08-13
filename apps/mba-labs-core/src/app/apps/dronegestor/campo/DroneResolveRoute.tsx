"use client";

import { useLayoutEffect } from "react";

const ALLOWED = new Set(["nova", "calda", "seguranca", "calibracao", "checklist", "sarpas", "execucao", "relatorios"]);

export function DroneResolveRoute() {
  useLayoutEffect(() => {
    const step = new URLSearchParams(window.location.search).get("resolver") || "";
    if (!ALLOWED.has(step)) return;
    let target = step;
    if (step === "execucao") {
      try {
        const started = JSON.parse(localStorage.getItem("dronegestor:started:v3") || "false") === true;
        if (!started) target = "sarpas";
      } catch {
        target = "sarpas";
      }
    }
    localStorage.setItem("dronegestor:view:v3", target);
  }, []);
  return null;
}
