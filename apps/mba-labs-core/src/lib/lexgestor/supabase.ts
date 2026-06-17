export type SupabaseLexGestorConfig = {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

export function obterSupabaseLexGestorConfig(): SupabaseLexGestorConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function validarAmbienteSupabasePreparado() {
  const config = obterSupabaseLexGestorConfig();
  return Boolean(config.url && config.anonKey);
}

export const tabelasLexGestor = [
  "lex_escritorios",
  "lex_advogados",
  "lex_categorias",
  "lex_subcategorias",
  "lex_clientes",
  "lex_casos",
  "lex_relatos",
  "lex_documentos",
  "lex_checklist_templates",
  "lex_checklist_respostas",
  "lex_storage_connections",
  "lex_relatorios",
  "lex_whatsapp_conversas",
  "lex_whatsapp_mensagens",
  "lex_tarefas",
  "lex_prazos",
  "lex_auditoria",
] as const;
