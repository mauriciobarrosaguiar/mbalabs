"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function EventSubmitButton({
  label,
  pendingLabel,
  className
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className={
        className +
        " disabled:cursor-not-allowed disabled:opacity-60"
      }
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="animate-spin" size={17} />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
