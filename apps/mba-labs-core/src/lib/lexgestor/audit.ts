import type { CurrentUserProfile } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "./data";

export async function registrarAuditoriaLexGestor({
  current,
  acao,
  entidade,
  entidadeId,
  detalhes,
}: {
  current: CurrentUserProfile;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const client = await getLexSupabaseClient();
    const escritorio = await ensureLexEscritorio(client, current);
    const escritorioId = String(escritorio?.id ?? "");
    if (!escritorioId) return;

    await client.from("lex_auditoria").insert({
      escritorio_id: escritorioId,
      usuario_id: current.usuario.id,
      acao,
      entidade,
      entidade_id: entidadeId || null,
      detalhes: detalhes ?? null,
    });
  } catch {
    // Auditoria nunca deve impedir a ação principal.
  }
}
