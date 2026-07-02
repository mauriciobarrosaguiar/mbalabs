"use client";

import { useFormStatus } from "react-dom";

export function PhotoUploadSubmitButton({ idleLabel }: { idleLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button-primary min-h-12 self-end" disabled={pending} type="submit">
      {pending ? "Enviando foto..." : idleLabel}
    </button>
  );
}
