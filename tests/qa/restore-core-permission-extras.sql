-- Aplicado somente ao Supabase QA ulabbmjxdvxxiybhtgnn em 19/10/2026.
-- Registro da migração remota qa_restore_core_permission_extras_contract.
-- O perfil compartilhado já consulta esta coluna; a ausência ativava o fallback
-- legado e bloqueava o comprador de Araguaína apesar do vínculo atual ativo.
-- O array vazio preserva permissões; não concede acesso adicional.
ALTER TABLE public.core_usuario_app_permissoes
  ADD COLUMN IF NOT EXISTS permissoes_extras text[] NOT NULL DEFAULT '{}'::text[];
