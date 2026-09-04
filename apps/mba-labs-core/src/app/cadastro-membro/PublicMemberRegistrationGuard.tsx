"use client";

import { useEffect } from "react";

export function PublicMemberRegistrationGuard() {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="cargo"]');
    if (!input) return;

    input.value = "Membro";
    input.type = "hidden";
    const label = input.closest("label");
    if (label) label.style.display = "none";
  }, []);

  return null;
}
