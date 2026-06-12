insert into public.core_apps (slug, nome, descricao, url_path, ativo, ordem)
values
  (
    'mba-cotacoes',
    'MBA Cotações',
    'Sistema de cotações, vendedores, respostas e pedidos.',
    '/cotacoes',
    true,
    10
  ),
  (
    'lavagestor',
    'LavaGestor',
    'Sistema para gestão de lava-jatos, lavagens, vales e comissões.',
    '/lavagestor',
    true,
    20
  )
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  ativo = excluded.ativo,
  ordem = excluded.ordem;
