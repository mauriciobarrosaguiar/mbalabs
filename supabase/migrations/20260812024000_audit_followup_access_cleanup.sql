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

-- Sincroniza o catálogo persistido com os módulos que já existem no Core.
-- Nenhum cliente recebe acesso automaticamente; isso depende dos vínculos por empresa/usuário.
insert into public.core_apps (slug, nome, descricao, url_path, url_interna, status, ativo, ordem)
values
  (
    'dronegestor',
    'Calculadora de Calda',
    'Calculadora para volume de calda, múltiplos produtos, doses, sequência e receita de preparo.',
    '/apps/dronegestor/calculadora',
    '/apps/dronegestor/calculadora',
    'ativo',
    true,
    80
  ),
  (
    'mba-escola',
    'MBA Escola',
    'Comunicação, atividades, reuniões e acompanhamento entre escola e famílias.',
    '/mba-escola',
    '/mba-escola',
    'ativo',
    true,
    90
  ),
  (
    'google-empresas',
    'Google Empresas',
    'Painel privado para cadastrar, autorizar, criar e verificar Perfis da Empresa no Google.',
    '/google-empresas',
    '/google-empresas',
    'ativo',
    true,
    100
  )
on conflict (slug) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  ordem = excluded.ordem,
  updated_at = now();
