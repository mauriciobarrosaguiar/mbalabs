"use client";

import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { resetElshadayMemberAccess } from "../../actions";

export function ResetMemberAccessForm({
  memberId,
  memberName,
  email
}: {
  memberId: string;
  memberName: string;
  email?: string | null;
}) {
  function confirmReset(event: FormEvent<HTMLFormElement>) {
    const destination = email ? ` para ${email}` : "";
    const confirmed = window.confirm(
      `Enviar um link de redefinição de acesso${destination}? A ficha e o histórico de ${memberName} serão preservados.`
    );

    if (!confirmed) event.preventDefault();
  }

  return (
    <form action={resetElshadayMemberAccess} onSubmit={confirmReset}>
      <input name="membro_id" type="hidden" value={memberId} />
      <input name="return_to" type="hidden" value={`/elshaday/membros/${memberId}`} />
      <ResetButton />
    </form>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-900 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      disabled={pending}
      type="submit"
    >
      <KeyRound aria-hidden size={17} />
      {pending ? "Enviando link..." : "Redefinir acesso do membro"}
    </button>
  );
}
