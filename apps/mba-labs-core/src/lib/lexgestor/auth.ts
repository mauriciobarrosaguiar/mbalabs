import type { UsuarioLexGestor } from "./permissions";

export async function obterUsuarioLexGestorAtual(): Promise<UsuarioLexGestor | null> {
  // Preparado para futura integracao com core_usuarios do MBA Labs.
  return {
    id: "mock-usuario",
    escritorioId: "mock-escritorio",
    permissoes: [
      "lex:clientes:ler",
      "lex:clientes:editar",
      "lex:casos:ler",
      "lex:casos:editar",
      "lex:documentos:metadados",
      "lex:dropbox:conectar",
      "lex:configuracoes:editar",
    ],
  };
}

export async function exigirUsuarioLexGestor() {
  const usuario = await obterUsuarioLexGestorAtual();

  if (!usuario) {
    throw new Error("Usuario LexGestor nao autenticado.");
  }

  return usuario;
}
