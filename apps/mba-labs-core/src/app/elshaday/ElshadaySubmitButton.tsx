"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ElshadaySubmitButton({
  children,
  pendingLabel = "Enviando...",
  className
}: {
  children: ReactNode;
  pendingLabel?: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-65`}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          {pendingLabel}
        </span>
      ) : children}
    </button>
  );
}
