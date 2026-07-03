"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingActionButtonProps = {
  children: ReactNode;
  pendingText?: string;
  className?: string;
};

export function PendingActionButton({
  children,
  pendingText = "Aguarde...",
  className = "button-secondary w-full"
}: PendingActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`${className} ${pending ? "opacity-70 cursor-wait" : ""}`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingText : children}
    </button>
  );
}
