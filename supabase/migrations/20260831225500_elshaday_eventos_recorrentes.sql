alter table public.igreja_eventos
  add column if not exists serie_id uuid,
  add column if not exists recorrencia_tipo text not null default 'nenhuma',
  add column if not exists recorrencia_ate date,
  add column if not exists recorrencia_ordem integer,
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'igreja_eventos_recorrencia_tipo_chk'
      and conrelid = 'public.igreja_eventos'::regclass
  ) then
    alter table public.igreja_eventos
      add constraint igreja_eventos_recorrencia_tipo_chk
      check (recorrencia_tipo in ('nenhuma','diaria','semanal','quinzenal','mensal'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'igreja_eventos_recorrencia_ordem_chk'
      and conrelid = 'public.igreja_eventos'::regclass
  ) then
    alter table public.igreja_eventos
      add constraint igreja_eventos_recorrencia_ordem_chk
      check (recorrencia_ordem is null or recorrencia_ordem > 0);
  end if;
end $$;

create index if not exists igreja_eventos_serie_inicio_idx
  on public.igreja_eventos (igreja_id, serie_id, inicio)
  where serie_id is not null;

create unique index if not exists igreja_eventos_idempotency_uidx
  on public.igreja_eventos (igreja_id, idempotency_key)
  where idempotency_key is not null;
