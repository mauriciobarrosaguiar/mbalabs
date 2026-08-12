-- Auditoria MBA Labs: limpeza de acessos e catálogo.
-- Idempotente e sem IDs fixos.

-- Remove o antigo acesso privilegiado do Djair sem excluir o registro histórico.
update public.core_usuarios
set
  tipo = 'funcionario',
  tipo_global = 'funcionario',
  status = 'inativo',
  updated_at = now()
where lower(email) = 'djhanlj@gmail.com'
  and (
    coalesce(tipo_global, tipo) in ('super_admin', 'admin_master')
    or status <> 'inativo'
  );

-- O frontend do ChamaDiarista não está presente no monorepo atual.
-- Mantém vínculos existentes para futura restauração, mas impede nova liberação
-- e remove o app do catálogo ativo enquanto a interface não for validada.
update public.core_apps
set
  status = 'inativo',
  ativo = false,
  updated_at = now()
where slug = 'chama-diarista';
