export type PermissaoLexGestor =
  | "lex:clientes:ler"
  | "lex:clientes:editar"
  | "lex:casos:ler"
  | "lex:casos:editar"
  | "lex:documentos:metadados"
  | "lex:dropbox:conectar"
  | "lex:configuracoes:editar";

export type UsuarioLexGestor = {
  id: string;
  escritorioId: string;
  permissoes: PermissaoLexGestor[];
};

export function possuiPermissao(
  usuario: UsuarioLexGestor | null,
  permissao: PermissaoLexGestor,
) {
  return Boolean(usuario?.permissoes.includes(permissao));
}

export function pertenceAoMesmoEscritorio(
  usuario: UsuarioLexGestor | null,
  escritorioId: string,
) {
  return Boolean(usuario && usuario.escritorioId === escritorioId);
}
