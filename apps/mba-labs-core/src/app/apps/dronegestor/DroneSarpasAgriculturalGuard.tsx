"use client";

import { useEffect } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const INVALID = new Set(["dispensado", "nao_aplicavel"]);

function sanitizeMission() {
  try {
    const mission = JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Record<string, unknown>;
    const status = String(mission?.sarpasSituacao || "");
    if (!INVALID.has(status)) return;
    const next = { ...mission, sarpasSituacao: "", sarpasNumero: "", sarpasConfirmado: false };
    localStorage.setItem(MISSION_KEY, JSON.stringify(next));
    localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
  } catch {
    // Estado inválido será tratado pelo fluxo normal.
  }
}

function cleanSelects() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("select").forEach((select) => {
    const invalidOptions = Array.from(select.options).filter((option) => INVALID.has(option.value));
    if (!invalidOptions.length) return;
    const wasInvalid = INVALID.has(select.value);
    invalidOptions.forEach((option) => option.remove());
    if (wasInvalid) {
      const fallback = Array.from(select.options).some((option) => option.value === "nao_solicitado") ? "nao_solicitado" : "";
      select.value = fallback;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

export function DroneSarpasAgriculturalGuard() {
  useEffect(() => {
    const refresh = () => {
      sanitizeMission();
      cleanSelects();
    };
    refresh();
    const observer = new MutationObserver(cleanSelects);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(refresh, 1200);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
