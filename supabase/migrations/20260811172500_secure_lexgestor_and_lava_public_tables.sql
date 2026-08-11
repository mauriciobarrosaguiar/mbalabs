-- P0 containment: block direct PostgREST access to sensitive tenant data.
-- Server-side service_role continues to bypass RLS; authenticated browser access is denied
-- until explicit tenant-scoped policies are introduced.

alter table if exists public.lex_escritorios enable row level security;
alter table if exists public.lex_advogados enable row level security;
alter table if exists public.lex_clientes enable row level security;
alter table if exists public.lex_casos enable row level security;
alter table if exists public.lex_relatos enable row level security;
alter table if exists public.lex_documentos enable row level security;
alter table if exists public.lex_checklist_templates enable row level security;
alter table if exists public.lex_checklist_respostas enable row level security;
alter table if exists public.lex_dropbox_conexoes enable row level security;
alter table if exists public.lex_whatsapp_conversas enable row level security;
alter table if exists public.lex_whatsapp_mensagens enable row level security;
alter table if exists public.lex_tarefas enable row level security;
alter table if exists public.lex_prazos enable row level security;
alter table if exists public.lex_auditoria enable row level security;
alter table if exists public.lex_categorias enable row level security;
alter table if exists public.lex_subcategorias enable row level security;
alter table if exists public.lex_processos enable row level security;
alter table if exists public.lex_movimentacoes enable row level security;
alter table if exists public.lex_relatorios enable row level security;
alter table if exists public.lex_storage_connections enable row level security;
alter table if exists public.lex_logs_integracao enable row level security;

-- Close the only other table reported by the Supabase security advisor
-- as public with RLS disabled in this audit.
alter table if exists public.lava_convenios enable row level security;
