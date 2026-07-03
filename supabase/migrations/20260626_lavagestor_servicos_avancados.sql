alter table public.lava_servicos add column if not exists tipo text default 'lavagem';
alter table public.lava_servicos add column if not exists aplicacao text default 'carro';
alter table public.lava_servicos add column if not exists categoria text default 'principal';
alter table public.lava_servicos add column if not exists adicional boolean default false;
alter table public.lava_servicos add column if not exists tempo_estimado_min integer;
alter table public.lava_servicos add column if not exists ordem integer default 0;

update public.lava_servicos
set
  tipo = coalesce(tipo, 'lavagem'),
  aplicacao = coalesce(aplicacao, 'carro'),
  categoria = coalesce(categoria, 'principal'),
  adicional = coalesce(adicional, false),
  ordem = coalesce(ordem, 0);
