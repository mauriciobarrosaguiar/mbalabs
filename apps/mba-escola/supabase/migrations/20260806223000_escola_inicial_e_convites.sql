-- MBA Escola: escola inicial, dono do sistema e primeiro acesso por convite.

create extension if not exists citext;

create table if not exists public.escola_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_convites (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid references public.escola_escolas(id) on delete cascade,
  email citext not null,
  nome text not null,
  papel text not null check (papel in ('dono_sistema', 'direcao', 'coordenacao', 'professor', 'responsavel')),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'revogado', 'expirado')),
  token uuid not null default gen_random_uuid(),
  expira_em timestamptz not null default (now() + interval '30 days'),
  aceito_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint escola_convite_vinculo_check check (
    (papel = 'dono_sistema' and escola_id is null)
    or (papel <> 'dono_sistema' and escola_id is not null)
  )
);

create unique index if not exists escola_convites_email_pendente_idx
  on public.escola_convites (email)
  where status = 'pendente';

create or replace function public.escola_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_super_admins
    where user_id = auth.uid()
      and ativo = true
  );
$$;

grant execute on function public.escola_is_super_admin() to authenticated;

create or replace function public.escola_aplicar_convite_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  convite public.escola_convites%rowtype;
begin
  select *
    into convite
  from public.escola_convites
  where lower(email::text) = lower(new.email)
    and status = 'pendente'
    and expira_em > now()
  order by criado_em desc
  limit 1;

  if not found then
    return new;
  end if;

  if convite.papel = 'dono_sistema' then
    insert into public.escola_super_admins (user_id, email, nome, ativo)
    values (new.id, new.email, convite.nome, true)
    on conflict (user_id) do update set
      email = excluded.email,
      nome = excluded.nome,
      ativo = true,
      atualizado_em = now();
  else
    insert into public.escola_perfis (id, escola_id, nome, papel, ativo)
    values (new.id, convite.escola_id, convite.nome, convite.papel, true)
    on conflict (id) do update set
      escola_id = excluded.escola_id,
      nome = excluded.nome,
      papel = excluded.papel,
      ativo = true,
      atualizado_em = now();
  end if;

  update public.escola_convites
  set status = 'aceito',
      aceito_em = now(),
      atualizado_em = now()
  where id = convite.id;

  return new;
end;
$$;

drop trigger if exists escola_auth_user_convite on auth.users;
create trigger escola_auth_user_convite
after insert or update of email on auth.users
for each row execute function public.escola_aplicar_convite_usuario();

alter table public.escola_super_admins enable row level security;
alter table public.escola_convites enable row level security;

create policy escola_super_admin_proprio_select
on public.escola_super_admins
for select to authenticated
using (user_id = auth.uid());

create policy escola_convites_super_admin_all
on public.escola_convites
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_escolas_super_admin_all
on public.escola_escolas
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_perfis_super_admin_all
on public.escola_perfis
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_turmas_super_admin_all
on public.escola_turmas
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_alunos_super_admin_all
on public.escola_alunos
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_vinculos_super_admin_all
on public.escola_aluno_responsaveis
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_comunicados_super_admin_all
on public.escola_comunicados
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_leituras_super_admin_all
on public.escola_comunicado_leituras
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_aulas_super_admin_all
on public.escola_aulas
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_atividades_super_admin_all
on public.escola_atividades
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_entregas_super_admin_all
on public.escola_atividade_entregas
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_reunioes_super_admin_all
on public.escola_reunioes
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create policy escola_acompanhamentos_super_admin_all
on public.escola_acompanhamentos
for all to authenticated
using (public.escola_is_super_admin())
with check (public.escola_is_super_admin());

create trigger escola_super_admins_updated_at
before update on public.escola_super_admins
for each row execute function public.escola_set_updated_at();

create trigger escola_convites_updated_at
before update on public.escola_convites
for each row execute function public.escola_set_updated_at();

insert into public.escola_escolas (nome, slug, status)
values (
  'Escola Municipal Pedro Pedro Pereira Piajem',
  'escola-municipal-pedro-pedro-pereira-piajem',
  'teste'
)
on conflict (slug) do update set
  nome = excluded.nome,
  status = excluded.status,
  atualizado_em = now();

insert into public.escola_convites (escola_id, email, nome, papel)
select
  escola.id,
  'adelaile.vieira@gmail.com',
  'Adelaile Vieira',
  'direcao'
from public.escola_escolas escola
where escola.slug = 'escola-municipal-pedro-pedro-pereira-piajem'
  and not exists (
    select 1
    from public.escola_convites convite
    where convite.email = 'adelaile.vieira@gmail.com'
      and convite.status = 'pendente'
  );

insert into public.escola_convites (escola_id, email, nome, papel)
select
  null,
  'mauriciobarrosaguiar@gmail.com',
  'Maurício Barros de Aguiar',
  'dono_sistema'
where not exists (
  select 1
  from public.escola_convites convite
  where convite.email = 'mauriciobarrosaguiar@gmail.com'
    and convite.status = 'pendente'
);

-- Se os usuários já existirem no Auth, aplica os convites imediatamente.
insert into public.escola_super_admins (user_id, email, nome, ativo)
select usuario.id, usuario.email, convite.nome, true
from auth.users usuario
join public.escola_convites convite
  on lower(convite.email::text) = lower(usuario.email)
where convite.papel = 'dono_sistema'
  and convite.status = 'pendente'
  and convite.expira_em > now()
on conflict (user_id) do update set
  email = excluded.email,
  nome = excluded.nome,
  ativo = true,
  atualizado_em = now();

insert into public.escola_perfis (id, escola_id, nome, papel, ativo)
select usuario.id, convite.escola_id, convite.nome, convite.papel, true
from auth.users usuario
join public.escola_convites convite
  on lower(convite.email::text) = lower(usuario.email)
where convite.papel <> 'dono_sistema'
  and convite.status = 'pendente'
  and convite.expira_em > now()
on conflict (id) do update set
  escola_id = excluded.escola_id,
  nome = excluded.nome,
  papel = excluded.papel,
  ativo = true,
  atualizado_em = now();

update public.escola_convites convite
set status = 'aceito',
    aceito_em = now(),
    atualizado_em = now()
where convite.status = 'pendente'
  and exists (
    select 1
    from auth.users usuario
    where lower(usuario.email) = lower(convite.email::text)
  );
