insert into public.core_apps (slug, nome, descricao, url_path, ativo, ordem)
values
  ('mba-cotacoes', 'MBA Cotacoes', 'Sistema de cotacoes, vendedores, respostas e pedidos.', '/cotacoes', true, 10),
  ('lavagestor', 'LavaGestor', 'Sistema para gestao de lava-jatos, lavagens, vales e comissoes.', '/lavagestor', true, 20)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Starter', 'Plano inicial para validacao e primeiras empresas.', 0, 3, 1000, true
from public.core_apps
where slug in ('mba-cotacoes', 'lavagestor')
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Profissional', 'Plano para operacao diaria com equipe maior.', 149.90, 15, 20000, true
from public.core_apps
where slug in ('mba-cotacoes', 'lavagestor')
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;
