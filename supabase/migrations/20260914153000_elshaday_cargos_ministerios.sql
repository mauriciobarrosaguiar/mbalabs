-- Estrutura profissional de cargos, histórico e ministérios do Elshaday.
-- Mantém igreja_membros.cargo e igreja_membros.ministerio para compatibilidade durante a transição.

create table if not exists public.igreja_cargos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 100 check (ordem >= 0 and ordem <= 9999),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, igreja_id)
);

create unique index if not exists igreja_cargos_igreja_nome_uidx
  on public.igreja_cargos(igreja_id, lower(btrim(nome)));
create index if not exists igreja_cargos_igreja_ordem_idx
  on public.igreja_cargos(igreja_id, ordem, nome);

alter table public.igreja_membros
  add column if not exists cargo_id uuid,
  add column if not exists data_nomeacao date,
  add column if not exists sexo text,
  add column if not exists estado_civil text;

create unique index if not exists igreja_membros_id_igreja_uidx
  on public.igreja_membros(id, igreja_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'igreja_membros_cargo_tenant_fk'
  ) then
    alter table public.igreja_membros
      add constraint igreja_membros_cargo_tenant_fk
      foreign key (cargo_id, igreja_id)
      references public.igreja_cargos(id, igreja_id)
      on delete restrict;
  end if;
end $$;

create index if not exists igreja_membros_cargo_idx
  on public.igreja_membros(igreja_id, cargo_id);
create index if not exists igreja_membros_situacao_idx
  on public.igreja_membros(igreja_id, situacao);
create index if not exists igreja_membros_nascimento_idx
  on public.igreja_membros(igreja_id, data_nascimento);

create table if not exists public.igreja_membro_cargos_historico (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null,
  cargo_id uuid not null,
  data_inicio date not null,
  data_fim date,
  observacao text,
  alterado_por uuid references auth.users(id) on delete set null,
  alterado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio),
  foreign key (membro_id, igreja_id)
    references public.igreja_membros(id, igreja_id) on delete cascade,
  foreign key (cargo_id, igreja_id)
    references public.igreja_cargos(id, igreja_id) on delete restrict
);

create unique index if not exists igreja_membro_cargo_atual_uidx
  on public.igreja_membro_cargos_historico(igreja_id, membro_id)
  where data_fim is null;
create index if not exists igreja_membro_cargos_linha_tempo_idx
  on public.igreja_membro_cargos_historico(igreja_id, membro_id, data_inicio desc);

create table if not exists public.igreja_ministerios (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, igreja_id)
);

create unique index if not exists igreja_ministerios_igreja_nome_uidx
  on public.igreja_ministerios(igreja_id, lower(btrim(nome)));

create table if not exists public.igreja_membro_ministerios (
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null,
  ministerio_id uuid not null,
  data_inicio date not null default current_date,
  observacao text,
  adicionado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (igreja_id, membro_id, ministerio_id),
  foreign key (membro_id, igreja_id)
    references public.igreja_membros(id, igreja_id) on delete cascade,
  foreign key (ministerio_id, igreja_id)
    references public.igreja_ministerios(id, igreja_id) on delete restrict
);

create index if not exists igreja_membro_ministerios_ministerio_idx
  on public.igreja_membro_ministerios(igreja_id, ministerio_id, membro_id);

create table if not exists public.igreja_cargo_auditoria (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null,
  cargo_anterior_id uuid,
  novo_cargo_id uuid not null,
  usuario_responsavel uuid references auth.users(id) on delete set null,
  observacao text,
  created_at timestamptz not null default now(),
  foreign key (membro_id, igreja_id)
    references public.igreja_membros(id, igreja_id) on delete cascade,
  foreign key (novo_cargo_id, igreja_id)
    references public.igreja_cargos(id, igreja_id) on delete restrict,
  foreign key (cargo_anterior_id, igreja_id)
    references public.igreja_cargos(id, igreja_id) on delete restrict
);

create index if not exists igreja_cargo_auditoria_membro_idx
  on public.igreja_cargo_auditoria(igreja_id, membro_id, created_at desc);

-- Cargos iniciais: cada igreja mantém sua própria lista e pode personalizá-la.
insert into public.igreja_cargos (igreja_id, nome, ordem)
select i.id, seed.nome, seed.ordem
from public.igreja_igrejas i
cross join (values
  ('Pastor Presidente', 10),
  ('Pastor', 20),
  ('Evangelista', 30),
  ('Presbítero', 40),
  ('Missionário', 50),
  ('Missionária', 51),
  ('Diácono', 60),
  ('Diaconisa', 61),
  ('Cooperador', 70),
  ('Cooperadora', 71),
  ('Obreiro', 80),
  ('Obreira', 81),
  ('Líder', 90),
  ('Membro', 100)
) as seed(nome, ordem)
on conflict do nothing;

-- Preserva qualquer cargo textual já usado, mesmo que personalizado.
insert into public.igreja_cargos (igreja_id, nome, ordem)
select distinct m.igreja_id, btrim(m.cargo), 500
from public.igreja_membros m
where nullif(btrim(coalesce(m.cargo, '')), '') is not null
on conflict do nothing;

update public.igreja_membros m
set cargo_id = c.id,
    cargo = c.nome,
    data_nomeacao = coalesce(m.data_nomeacao, m.data_entrada, current_date)
from public.igreja_cargos c
where c.igreja_id = m.igreja_id
  and lower(btrim(c.nome)) = lower(btrim(coalesce(m.cargo, 'Membro')))
  and m.cargo_id is null;

update public.igreja_membros m
set cargo_id = c.id,
    cargo = c.nome,
    data_nomeacao = coalesce(m.data_nomeacao, m.data_entrada, current_date)
from public.igreja_cargos c
where c.igreja_id = m.igreja_id
  and lower(c.nome) = 'membro'
  and m.cargo_id is null;

insert into public.igreja_membro_cargos_historico (
  igreja_id, membro_id, cargo_id, data_inicio, observacao
)
select m.igreja_id, m.id, m.cargo_id,
       coalesce(m.data_nomeacao, m.data_entrada, current_date),
       'Cargo atual migrado da ficha existente.'
from public.igreja_membros m
where m.cargo_id is not null
  and not exists (
    select 1 from public.igreja_membro_cargos_historico h
    where h.igreja_id = m.igreja_id
      and h.membro_id = m.id
      and h.data_fim is null
  );

insert into public.igreja_ministerios (igreja_id, nome)
select i.id, seed.nome
from public.igreja_igrejas i
cross join (values
  ('Louvor'), ('Jovens'), ('Infantil'), ('Intercessão'), ('Missões'),
  ('Mulheres'), ('Homens'), ('Escola Bíblica'), ('Mídia'), ('Recepção')
) as seed(nome)
on conflict do nothing;

-- Converte texto legado em um ou mais ministérios, aceitando vírgula, ponto e vírgula ou barra.
insert into public.igreja_ministerios (igreja_id, nome)
select distinct m.igreja_id, btrim(parts.nome)
from public.igreja_membros m
cross join lateral regexp_split_to_table(coalesce(m.ministerio, ''), '[,;/]') as parts(nome)
where nullif(btrim(parts.nome), '') is not null
on conflict do nothing;

insert into public.igreja_membro_ministerios (igreja_id, membro_id, ministerio_id, data_inicio)
select distinct m.igreja_id, m.id, min.id, coalesce(m.data_entrada, current_date)
from public.igreja_membros m
cross join lateral regexp_split_to_table(coalesce(m.ministerio, ''), '[,;/]') as parts(nome)
join public.igreja_ministerios min
  on min.igreja_id = m.igreja_id
 and lower(btrim(min.nome)) = lower(btrim(parts.nome))
where nullif(btrim(parts.nome), '') is not null
on conflict do nothing;

alter table public.igreja_cargos enable row level security;
alter table public.igreja_membro_cargos_historico enable row level security;
alter table public.igreja_ministerios enable row level security;
alter table public.igreja_membro_ministerios enable row level security;
alter table public.igreja_cargo_auditoria enable row level security;

drop policy if exists igreja_cargos_select on public.igreja_cargos;
create policy igreja_cargos_select on public.igreja_cargos
for select to authenticated using (private.igreja_can_access(igreja_id));
drop policy if exists igreja_cargos_write on public.igreja_cargos;
create policy igreja_cargos_write on public.igreja_cargos
for all to authenticated
using (private.igreja_has_role(igreja_id, array['admin']))
with check (private.igreja_has_role(igreja_id, array['admin']));

drop policy if exists igreja_cargo_hist_select on public.igreja_membro_cargos_historico;
create policy igreja_cargo_hist_select on public.igreja_membro_cargos_historico
for select to authenticated
using (
  private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria','secretaria','lider'])
  or exists (
    select 1 from public.igreja_membros m
    where m.id = membro_id and m.user_id = auth.uid()
  )
);
drop policy if exists igreja_cargo_hist_write on public.igreja_membro_cargos_historico;
create policy igreja_cargo_hist_write on public.igreja_membro_cargos_historico
for all to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria']));

drop policy if exists igreja_ministerios_select on public.igreja_ministerios;
create policy igreja_ministerios_select on public.igreja_ministerios
for select to authenticated using (private.igreja_can_access(igreja_id));
drop policy if exists igreja_ministerios_write on public.igreja_ministerios;
create policy igreja_ministerios_write on public.igreja_ministerios
for all to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

drop policy if exists igreja_membro_min_select on public.igreja_membro_ministerios;
create policy igreja_membro_min_select on public.igreja_membro_ministerios
for select to authenticated
using (
  private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria','secretaria','lider'])
  or exists (
    select 1 from public.igreja_membros m
    where m.id = membro_id and m.user_id = auth.uid()
  )
);
drop policy if exists igreja_membro_min_write on public.igreja_membro_ministerios;
create policy igreja_membro_min_write on public.igreja_membro_ministerios
for all to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria','secretaria']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria','secretaria']));

drop policy if exists igreja_cargo_audit_select on public.igreja_cargo_auditoria;
create policy igreja_cargo_audit_select on public.igreja_cargo_auditoria
for select to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria']));
drop policy if exists igreja_cargo_audit_insert on public.igreja_cargo_auditoria;
create policy igreja_cargo_audit_insert on public.igreja_cargo_auditoria
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','tesouraria']));

grant select, insert, update, delete on
  public.igreja_cargos,
  public.igreja_membro_cargos_historico,
  public.igreja_ministerios,
  public.igreja_membro_ministerios,
  public.igreja_cargo_auditoria
to authenticated;

revoke all on
  public.igreja_cargos,
  public.igreja_membro_cargos_historico,
  public.igreja_ministerios,
  public.igreja_membro_ministerios,
  public.igreja_cargo_auditoria
from anon;


-- Alteração de cargo atômica: atualiza ficha, encerra histórico anterior e audita sem tocar no perfil de acesso.
create or replace function public.elshaday_set_member_cargo(
  p_igreja_id uuid,
  p_membro_id uuid,
  p_cargo_id uuid,
  p_data_inicio date,
  p_observacao text,
  p_usuario_responsavel uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo_anterior_id uuid;
  v_novo_cargo_nome text;
  v_data_inicio date := coalesce(p_data_inicio, current_date);
begin
  select m.cargo_id
    into v_cargo_anterior_id
  from public.igreja_membros m
  where m.id = p_membro_id and m.igreja_id = p_igreja_id
  for update;

  if not found then
    raise exception 'Membro não pertence a esta igreja.';
  end if;

  select c.nome
    into v_novo_cargo_nome
  from public.igreja_cargos c
  where c.id = p_cargo_id and c.igreja_id = p_igreja_id and c.ativo = true;

  if not found then
    raise exception 'Cargo inválido ou inativo.';
  end if;

  update public.igreja_membro_cargos_historico
     set data_fim = greatest(v_data_inicio - 1, data_inicio)
   where igreja_id = p_igreja_id
     and membro_id = p_membro_id
     and data_fim is null;

  insert into public.igreja_membro_cargos_historico (
    igreja_id, membro_id, cargo_id, data_inicio, observacao, alterado_por
  ) values (
    p_igreja_id, p_membro_id, p_cargo_id, v_data_inicio,
    nullif(btrim(coalesce(p_observacao, '')), ''), p_usuario_responsavel
  );

  update public.igreja_membros
     set cargo_id = p_cargo_id,
         cargo = v_novo_cargo_nome,
         data_nomeacao = v_data_inicio,
         updated_at = now()
   where id = p_membro_id and igreja_id = p_igreja_id;

  insert into public.igreja_cargo_auditoria (
    igreja_id, membro_id, cargo_anterior_id, novo_cargo_id,
    usuario_responsavel, observacao
  ) values (
    p_igreja_id, p_membro_id, v_cargo_anterior_id, p_cargo_id,
    p_usuario_responsavel, nullif(btrim(coalesce(p_observacao, '')), '')
  );
end;
$$;

revoke all on function public.elshaday_set_member_cargo(uuid, uuid, uuid, date, text, uuid)
  from public, anon, authenticated;
grant execute on function public.elshaday_set_member_cargo(uuid, uuid, uuid, date, text, uuid)
  to service_role;

create or replace function public.elshaday_sync_member_ministries(
  p_igreja_id uuid,
  p_membro_id uuid,
  p_ministerio_ids uuid[],
  p_usuario_responsavel uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_legacy_text text;
begin
  if not exists (
    select 1 from public.igreja_membros
    where id = p_membro_id and igreja_id = p_igreja_id
  ) then
    raise exception 'Membro não pertence a esta igreja.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_ministerio_ids, '{}'::uuid[])) wanted(id)
    left join public.igreja_ministerios mi
      on mi.id = wanted.id
     and mi.igreja_id = p_igreja_id
     and mi.ativo = true
    where mi.id is null
  ) then
    raise exception 'Há ministério inválido ou inativo.';
  end if;

  delete from public.igreja_membro_ministerios
   where igreja_id = p_igreja_id
     and membro_id = p_membro_id
     and not (ministerio_id = any(coalesce(p_ministerio_ids, '{}'::uuid[])));

  insert into public.igreja_membro_ministerios (
    igreja_id, membro_id, ministerio_id, adicionado_por
  )
  select p_igreja_id, p_membro_id, wanted.id, p_usuario_responsavel
  from unnest(coalesce(p_ministerio_ids, '{}'::uuid[])) wanted(id)
  on conflict do nothing;

  select string_agg(mi.nome, ', ' order by mi.nome)
    into v_legacy_text
  from public.igreja_membro_ministerios mm
  join public.igreja_ministerios mi
    on mi.id = mm.ministerio_id and mi.igreja_id = mm.igreja_id
  where mm.igreja_id = p_igreja_id and mm.membro_id = p_membro_id;

  update public.igreja_membros
     set ministerio = v_legacy_text,
         updated_at = now()
   where id = p_membro_id and igreja_id = p_igreja_id;
end;
$$;

revoke all on function public.elshaday_sync_member_ministries(uuid, uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.elshaday_sync_member_ministries(uuid, uuid, uuid[], uuid)
  to service_role;


create or replace function public.elshaday_sync_ministry_members(
  p_igreja_id uuid,
  p_ministerio_id uuid,
  p_membro_ids uuid[],
  p_usuario_responsavel uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affected uuid[];
begin
  if not exists (
    select 1 from public.igreja_ministerios
    where id = p_ministerio_id and igreja_id = p_igreja_id
  ) then
    raise exception 'Ministério não pertence a esta igreja.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_membro_ids, '{}'::uuid[])) wanted(id)
    left join public.igreja_membros m
      on m.id = wanted.id and m.igreja_id = p_igreja_id
    where m.id is null
  ) then
    raise exception 'Há membro inválido na seleção.';
  end if;

  select array_agg(distinct id)
    into v_affected
  from (
    select membro_id as id
    from public.igreja_membro_ministerios
    where igreja_id = p_igreja_id and ministerio_id = p_ministerio_id
    union
    select unnest(coalesce(p_membro_ids, '{}'::uuid[]))
  ) affected;

  delete from public.igreja_membro_ministerios
   where igreja_id = p_igreja_id
     and ministerio_id = p_ministerio_id
     and not (membro_id = any(coalesce(p_membro_ids, '{}'::uuid[])));

  insert into public.igreja_membro_ministerios (
    igreja_id, membro_id, ministerio_id, adicionado_por
  )
  select p_igreja_id, wanted.id, p_ministerio_id, p_usuario_responsavel
  from unnest(coalesce(p_membro_ids, '{}'::uuid[])) wanted(id)
  on conflict do nothing;

  update public.igreja_membros m
     set ministerio = (
       select string_agg(mi.nome, ', ' order by mi.nome)
       from public.igreja_membro_ministerios mm
       join public.igreja_ministerios mi
         on mi.id = mm.ministerio_id and mi.igreja_id = mm.igreja_id
       where mm.igreja_id = p_igreja_id and mm.membro_id = m.id
     ),
     updated_at = now()
   where m.igreja_id = p_igreja_id
     and m.id = any(coalesce(v_affected, '{}'::uuid[]));
end;
$$;

revoke all on function public.elshaday_sync_ministry_members(uuid, uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.elshaday_sync_ministry_members(uuid, uuid, uuid[], uuid)
  to service_role;
