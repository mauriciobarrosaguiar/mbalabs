"use client";

import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deletePendingElshadayMember } from "../../actions";

export function DeletePendingMemberForm({
  memberId,
  memberName
}: {
  memberId: string;
  memberName: string;
}) {
  function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    const confirmation = window.prompt(
      `Excluir permanentemente o cadastro de ${memberName} e o convite pendente? Digite EXCLUIR para confirmar.`
    );

    if (confirmation !== "EXCLUIR") event.preventDefault();
  }

  return (
    <form action={deletePendingElshadayMember} onSubmit={confirmDeletion}>
      <input name="membro_id" type="hidden" value={memberId} />
      <input name="return_to" type="hidden" value={`/elshaday/membros/${memberId}`} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      <Trash2 aria-hidden size={17} />
      {pending ? "Excluindo..." : "Excluir cadastro e convite"}
    </button>
  );
}
