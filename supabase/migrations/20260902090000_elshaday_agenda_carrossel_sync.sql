-- Elshaday: integra Agenda e carrossel da Home.
-- A Agenda passa a controlar quais cultos/eventos aparecem como destaque na Home.

alter table public.igreja_eventos
  add column if not exists destacar_home boolean not null default false,
  add column if not exists ordem_home integer not null default 10;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.igreja_eventos'::regclass
      and conname = 'igreja_eventos_ordem_home_check'
  ) then
    alter table public.igreja_eventos
      add constraint igreja_eventos_ordem_home_check
      check (ordem_home >= 0 and ordem_home <= 9999);
  end if;
end $$;

create index if not exists igreja_eventos_home_idx
  on public.igreja_eventos(igreja_id, destacar_home, status, inicio, ordem_home);

comment on column public.igreja_eventos.destacar_home is
  'Quando true, a próxima ocorrência elegível aparece no carrossel da Home.';

comment on column public.igreja_eventos.ordem_home is
  'Prioridade de exibição do evento no carrossel da Home. Menor número aparece primeiro.';
