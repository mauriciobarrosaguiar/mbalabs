-- Registra o LexGestor como app interno do MBA Labs.
-- ATENCAO: arquivo preparado para revisao/aplicacao controlada. Nao foi aplicado automaticamente.

insert into public.core_apps (slug, nome, descricao, url_path, url_interna, status, ativo, ordem)
values (
  'lexgestor',
  'LexGestor',
  'Gestao juridica inteligente para escritorios de advocacia.',
  '/lexgestor',
  '/lexgestor',
  'ativo',
  true,
  40
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  status = excluded.status,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Starter', 'Plano inicial para validacao e primeiras empresas.', 0, 3, 1000, true
from public.core_apps
where slug = 'lexgestor'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Profissional', 'Plano para operacao diaria com equipe maior.', 149.90, 15, 20000, true
from public.core_apps
where slug = 'lexgestor'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;
