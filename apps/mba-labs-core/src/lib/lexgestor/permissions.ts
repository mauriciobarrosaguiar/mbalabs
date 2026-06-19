export type PerfilLexGestor =
  | "dono"
  | "administrador"
  | "advogado"
  | "assistente"
  | "financeiro_leitura";

export type PermissaoLexGestor =
  | "lex:clientes:ler"
  | "lex:clientes:editar"
  | "lex:clientes:excluir"
  | "lex:casos:ler"
  | "lex:casos:editar"
  | "lex:casos:excluir"
  | "lex:documentos:ler"
  | "lex:documentos:metadados"
  | "lex:documentos:upload"
  | "lex:documentos:excluir"
  | "lex:documentos:sigilosos"
  | "lex:pdf:gerar"
  | "lex:dossie:gerar"
  | "lex:relatorios:ler"
  | "lex:equipe:gerenciar"
  | "lex:dropbox:conectar"
  | "lex:configuracoes:editar"
  | "lex:auditoria:ler";

export type UsuarioLexGestor = {
  id: string;
  escritorioId: string;
  perfil: PerfilLexGestor;
  permissoes: PermissaoLexGestor[];
};

const PERMISSOES_POR_PERFIL: Record<PerfilLexGestor, PermissaoLexGestor[]> = {
  dono: [
    "lex:clientes:ler",
    "lex:clientes:editar",
    "lex:clientes:excluir",
    "lex:casos:ler",
    "lex:casos:editar",
    "lex:casos:excluir",
    "lex:documentos:ler",
    "lex:documentos:metadados",
    "lex:documentos:upload",
    "lex:documentos:excluir",
    "lex:documentos:sigilosos",
    "lex:pdf:gerar",
    "lex:dossie:gerar",
    "lex:relatorios:ler",
    "lex:equipe:gerenciar",
    "lex:dropbox:conectar",
    "lex:configuracoes:editar",
    "lex:auditoria:ler",
  ],
  administrador: [
    "lex:clientes:ler",
    "lex:clientes:editar",
    "lex:clientes:excluir",
    "lex:casos:ler",
    "lex:casos:editar",
    "lex:documentos:ler",
    "lex:documentos:metadados",
    "lex:documentos:upload",
    "lex:documentos:excluir",
    "lex:documentos:sigilosos",
    "lex:pdf:gerar",
    "lex:dossie:gerar",
    "lex:relatorios:ler",
    "lex:equipe:gerenciar",
    "lex:auditoria:ler",
  ],
  advogado: [
    "lex:clientes:ler",
    "lex:clientes:editar",
    "lex:casos:ler",
    "lex:casos:editar",
    "lex:documentos:ler",
    "lex:documentos:metadados",
    "lex:documentos:upload",
    "lex:documentos:excluir",
    "lex:documentos:sigilosos",
    "lex:pdf:gerar",
    "lex:dossie:gerar",
    "lex:relatorios:ler",
  ],
  assistente: [
    "lex:clientes:ler",
    "lex:clientes:editar",
    "lex:casos:ler",
    "lex:casos:editar",
    "lex:documentos:ler",
    "lex:documentos:metadados",
    "lex:documentos:upload",
  ],
  financeiro_leitura: [
    "lex:clientes:ler",
    "lex:casos:ler",
    "lex:documentos:ler",
    "lex:relatorios:ler",
  ],
};

export const PERFIS_LEXGESTOR: Array<{ value: PerfilLexGestor; label: string; resumo: string }> = [
  {
    value: "dono",
    label: "Dono do escritório",
    resumo: "Acesso total, equipe, armazenamento, relatórios e ajustes.",
  },
  {
    value: "administrador",
    label: "Administrador",
    resumo: "Gerencia clientes, casos, documentos, prazos e equipe.",
  },
  {
    value: "advogado",
    label: "Advogado",
    resumo: "Atua em clientes, casos, documentos, PDFs e dossiês sob responsabilidade.",
  },
  {
    value: "assistente",
    label: "Assistente",
    resumo: "Cadastra clientes, anexa documentos, preenche checklist e relatos.",
  },
  {
    value: "financeiro_leitura",
    label: "Financeiro/leitura",
    resumo: "Consulta relatórios e dados permitidos sem alterar informações sensíveis.",
  },
];

export function normalizarPerfilLexGestor(value: unknown): PerfilLexGestor {
  const perfil = String(value ?? "").trim().toLowerCase();

  if (perfil === "dono" || perfil === "owner" || perfil === "admin_empresa") return "dono";
  if (perfil === "administrador" || perfil === "admin" || perfil === "gerente") return "administrador";
  if (perfil === "advogado" || perfil === "operador") return "advogado";
  if (perfil === "assistente" || perfil === "usuario") return "assistente";
  if (perfil === "financeiro_leitura" || perfil === "financeiro" || perfil === "visualizador") return "financeiro_leitura";

  return "assistente";
}

export function permissoesDoPerfil(perfil: PerfilLexGestor) {
  return PERMISSOES_POR_PERFIL[perfil] ?? PERMISSOES_POR_PERFIL.assistente;
}

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
