alter table public.lava_lavagens add column if not exists entrega_tipo text default 'retirar';
alter table public.lava_lavagens add column if not exists endereco_entrega text;

update public.lava_lavagens
set entrega_tipo = coalesce(entrega_tipo, 'retirar');
