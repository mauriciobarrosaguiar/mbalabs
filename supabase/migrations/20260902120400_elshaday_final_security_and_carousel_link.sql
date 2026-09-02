alter table public.igreja_carrossel
  add column if not exists evento_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'igreja_carrossel_evento_id_fkey'
      and conrelid = 'public.igreja_carrossel'::regclass
  ) then
    alter table public.igreja_carrossel
      add constraint igreja_carrossel_evento_id_fkey
      foreign key (evento_id)
      references public.igreja_eventos(id)
      on delete set null;
  end if;
end
$$;

create index if not exists igreja_carrossel_igreja_evento_idx
  on public.igreja_carrossel (igreja_id, evento_id)
  where evento_id is not null;

with candidatos as (
  select
    carrossel.id as carrossel_id,
    evento.id as evento_id,
    row_number() over (
      partition by carrossel.id
      order by evento.inicio asc, evento.id asc
    ) as prioridade
  from public.igreja_carrossel as carrossel
  join public.igreja_eventos as evento
    on evento.igreja_id = carrossel.igreja_id
   and lower(trim(evento.titulo)) = lower(trim(carrossel.titulo))
  where carrossel.evento_id is null
    and evento.destacar_home = true
    and evento.status = 'agendado'
    and evento.inicio >= now()
)
update public.igreja_carrossel as carrossel
set
  evento_id = candidatos.evento_id,
  updated_at = now()
from candidatos
where candidatos.carrossel_id = carrossel.id
  and candidatos.prioridade = 1;

comment on column public.igreja_carrossel.evento_id is
  'Evento da Agenda associado ao banner legado. Impede o banner de reaparecer isolado após cancelamento ou edição do evento.';

drop policy if exists igreja_perfis_select on public.igreja_perfis;
drop policy if exists igreja_perfis_write on public.igreja_perfis;
drop policy if exists igreja_perfis_insert on public.igreja_perfis;
drop policy if exists igreja_perfis_update on public.igreja_perfis;
drop policy if exists igreja_perfis_delete on public.igreja_perfis;

create policy igreja_perfis_select on public.igreja_perfis
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.igreja_has_role(igreja_id, array['admin'])
);

create policy igreja_perfis_insert on public.igreja_perfis
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin']));

create policy igreja_perfis_update on public.igreja_perfis
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin']))
with check (private.igreja_has_role(igreja_id, array['admin']));

create policy igreja_perfis_delete on public.igreja_perfis
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin']));
