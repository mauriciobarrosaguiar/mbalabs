"use client";

import { useEffect } from "react";
import type { ElshadayRole } from "@/lib/elshaday";
import {
  memberFunction,
  memberFunctionRole,
  memberFunctionsForActor
} from "@/lib/elshaday-member-functions";

export function MemberFunctionEnhancer({ actorRole }: { actorRole: ElshadayRole }) {
  useEffect(() => {
    function applyAccessRole(cargoValue: string) {
      const targetRole = memberFunctionRole(cargoValue);

      document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
        const memberId = form.querySelector<HTMLInputElement>('input[name="membro_id"]');
        const name = form.querySelector<HTMLInputElement>('input[name="nome"]');
        const email = form.querySelector<HTMLInputElement>('input[name="email"]');
        const roleField = form.querySelector<HTMLInputElement | HTMLSelectElement>('[name="papel"]');

        // É o formulário de criação do login dentro da ficha do membro.
        if (!memberId || !name || !email || !roleField) return;

        const existingBadge = form.querySelector<HTMLElement>('[data-auto-role-badge="true"]');
        const submit = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');

        if (actorRole === "admin") {
          roleField.value = targetRole;
          roleField.style.display = "none";

          const badge = existingBadge ?? document.createElement("div");
          badge.dataset.autoRoleBadge = "true";
          badge.className = "flex min-h-12 items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-950";
          badge.textContent = `Acesso automático: ${roleLabel(targetRole)}`;

          if (!existingBadge) roleField.insertAdjacentElement("afterend", badge);
          if (submit) submit.disabled = false;
          return;
        }

        if (targetRole !== "membro") {
          const badge = existingBadge ?? document.createElement("div");
          badge.dataset.autoRoleBadge = "true";
          badge.className = "flex min-h-12 items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-950";
          badge.textContent = "Administrador precisa liberar o acesso desta função";
          if (!existingBadge) roleField.insertAdjacentElement("afterend", badge);
          if (submit) submit.disabled = true;
        } else {
          if (existingBadge) existingBadge.remove();
          if (submit) submit.disabled = false;
        }
      });
    }

    function enhanceCargoInputs() {
      document.querySelectorAll<HTMLInputElement>('input[name="cargo"]:not([data-member-function-enhanced])').forEach((input) => {
        const label = input.closest("label");
        if (!label) return;

        const current = memberFunction(input.value);
        const currentIsPrivileged = current.role !== "membro";
        const locked = actorRole !== "admin" && currentIsPrivileged;
        const options = locked ? [current] : memberFunctionsForActor(actorRole);

        input.dataset.memberFunctionEnhanced = "true";
        input.dataset.memberFunctionLocked = locked ? "true" : "false";
        input.type = "hidden";
        input.value = current.value;

        const select = document.createElement("select");
        select.className = input.className || "input";
        select.dataset.memberFunctionSelect = "true";
        select.disabled = locked;

        options.forEach((option) => {
          const element = document.createElement("option");
          element.value = option.value;
          element.textContent = option.label;
          element.selected = option.value === current.value;
          select.appendChild(element);
        });

        select.addEventListener("change", () => {
          input.value = select.value;
          applyAccessRole(select.value);
        });

        input.insertAdjacentElement("afterend", select);
        applyAccessRole(current.value);
      });
    }

    async function handleSubmit(event: Event) {
      const submitEvent = event as SubmitEvent;
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || form.dataset.memberRoleSynced === "true") return;

      const memberId = form.querySelector<HTMLInputElement>('input[name="membro_id"]');
      const cargo = form.querySelector<HTMLInputElement>('input[name="cargo"][data-member-function-enhanced="true"]');
      const situation = form.querySelector<HTMLSelectElement>('select[name="situacao"]');
      const name = form.querySelector<HTMLInputElement>('input[name="nome"]');

      // Só intercepta o formulário de edição da ficha do membro.
      if (!memberId || !cargo || !situation || !name) return;
      if (cargo.dataset.memberFunctionLocked === "true") return;

      event.preventDefault();

      try {
        const response = await fetch("/api/elshaday/membros/sync-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            membroId: memberId.value,
            cargo: cargo.value
          })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          window.alert(String(result?.error ?? "Não foi possível atualizar o cargo e as permissões."));
          return;
        }

        form.dataset.memberRoleSynced = "true";
        const submitter = submitEvent.submitter;
        if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
          form.requestSubmit(submitter);
        } else {
          form.requestSubmit();
        }
      } catch {
        window.alert("Não foi possível atualizar o cargo e as permissões. Tente novamente.");
      }
    }

    enhanceCargoInputs();

    const observer = new MutationObserver(() => enhanceCargoInputs());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [actorRole]);

  return null;
}

function roleLabel(role: ElshadayRole) {
  const labels: Record<ElshadayRole, string> = {
    admin: "Administrador",
    pastor: "Pastor",
    tesouraria: "Tesouraria",
    secretaria: "Secretaria",
    lider: "Líder",
    membro: "Membro"
  };
  return labels[role];
}
