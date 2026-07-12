-- Registra o ChamaDiarista como app interno do MBA Labs.

insert into public.core_apps (slug, nome, descricao, url_path, url_interna, url_externa, logo_icone, status, ativo, ordem)
values (
  'chama-diarista',
  'ChamaDiarista',
  'Marketplace operacional para clientes solicitarem diaristas, agenda, pagamentos e avaliacoes.',
  '/chama-diarista',
  '/chama-diarista',
  null,
  null,
  'ativo',
  true,
  60
)
on conflict (slug) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  status = excluded.status,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Essencial', 'Plano inicial para operar o ChamaDiarista pelo MBA Labs.', 0, 5, 1000, true
from public.core_apps
where slug = 'chama-diarista'
on conflict (app_id, nome) do update
set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Profissional', 'Plano para operacao comercial do ChamaDiarista com equipe e maior volume.', 149.90, 20, 10000, true
from public.core_apps
where slug = 'chama-diarista'
on conflict (app_id, nome) do update
set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;
