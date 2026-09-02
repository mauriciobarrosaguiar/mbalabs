drop index if exists public.igreja_carrossel_igreja_evento_idx;

create index if not exists igreja_carrossel_evento_idx
  on public.igreja_carrossel (evento_id)
  where evento_id is not null;
