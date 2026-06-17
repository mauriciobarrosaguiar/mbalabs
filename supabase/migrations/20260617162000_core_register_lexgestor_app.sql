insert into public.core_empresa_categorias (nome, slug, descricao, status)
values
  ('Advocacia', 'advocacia', 'EscritÃ³rios de advocacia e gestÃ£o jurÃ­dica.', 'ativa')
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status = excluded.status,
  updated_at = now();

insert into public.core_apps (slug, nome, descricao, url_path, url_interna, url_externa, logo_icone, status, ativo, ordem)
values (
  'lexgestor',
  'LexGestor',
  'GestÃ£o jurÃ­dica inteligente para escritÃ³rios de advocacia.',
  '/apps/lexgestor',
  '/apps/lexgestor',
  null,
  'Lex',
  'ativo',
  true,
  40
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  url_externa = excluded.url_externa,
  logo_icone = excluded.logo_icone,
  status = excluded.status,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  updated_at = now();

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Starter', 'Plano inicial para escritÃ³rios validarem o LexGestor.', 0, 3, 1000, true
from public.core_apps
where slug = 'lexgestor'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Profissional', 'Plano para escritÃ³rios com equipe, documentos e gestÃ£o jurÃ­dica.', 149.90, 15, 20000, true
from public.core_apps
where slug = 'lexgestor'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;
