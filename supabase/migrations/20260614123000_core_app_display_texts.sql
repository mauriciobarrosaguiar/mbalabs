update public.core_apps
set
  nome = 'MBA Cotações',
  descricao = 'Sistema para cotações, vendedores, respostas e pedidos.',
  url_path = '/apps/mbacotacoes',
  url_interna = '/apps/mbacotacoes',
  url_externa = null,
  updated_at = now()
where slug in ('mba-cotacoes', 'mbacotacoes');

update public.core_apps
set
  nome = 'LavaGestor',
  descricao = 'Sistema para lava-jatos controlarem lavagens, clientes, funcionários, pagamentos e comissões.',
  url_path = '/apps/lavagestor',
  url_interna = '/apps/lavagestor',
  url_externa = null,
  updated_at = now()
where slug = 'lavagestor';

update public.core_apps
set
  nome = 'BikeComanda',
  descricao = 'Sistema de comandas para bicicletarias, serviços, pagamentos e comissões.',
  url_path = '/apps/bikecomanda',
  url_interna = '/apps/bikecomanda',
  url_externa = null,
  status = 'ativo',
  ativo = true,
  updated_at = now()
where slug = 'bikecomanda';
