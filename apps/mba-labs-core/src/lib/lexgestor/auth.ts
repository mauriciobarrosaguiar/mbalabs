import type { UsuarioLexGestor } from "./permissions";
import { requireAppAccess } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "./data";
import { normalizarPerfilLexGestor, permissoesDoPerfil } from "./permissions";

export async function obterUsuarioLexGestorAtual(nextPath = "/lexgestor"): Promise<UsuarioLexGestor | null> {
  const current = await requireAppAccess("lexgestor", nextPath);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    return null;
  }

  const { data } = await client
    .from("lex_advogados")
    .select("id,perfil_acesso,cargo,ativo,status")
    .eq("escritorio_id", escritorioId)
    .eq("core_usuario_id", current.usuario.id)
    .maybeSingle();

  if (data && (data.ativo === false || String(data.status ?? "ativo") === "inativo")) {
    return null;
  }

  const perfil = normalizarPerfilLexGestor(
    data?.perfil_acesso ??
      current.permissoes.find((permissao) => permissao.appSlug === "lexgestor")?.perfil ??
      current.tipo,
  );

  return {
    id: current.usuario.id,
    escritorioId,
    perfil,
    permissoes: permissoesDoPerfil(perfil),
  };
}

export async function exigirUsuarioLexGestor(nextPath = "/lexgestor") {
  const usuario = await obterUsuarioLexGestorAtual(nextPath);

  if (!usuario) {
    throw new Error("Usuário sem acesso ativo ao LexGestor deste escritório.");
  }

  return usuario;
}
