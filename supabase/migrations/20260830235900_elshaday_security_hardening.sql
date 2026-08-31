-- Hardening do Elshaday Gestão: funções internas, policies e índices.
create schema if not exists private;

create or replace function private.igreja_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.core_usuarios u
    where (u.auth_user_id = auth.uid() or u.id = auth.uid())
      and coalesce(u.tipo_global, u.tipo) in ('super_admin', 'admin_master')
      and u.status = 'ativo'
  );
$$;

create or replace function private.igreja_has_role(p_igreja_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.igreja_is_super_admin()
    or exists (
      select 1
      from public.igreja_perfis p
      where p.igreja_id = p_igreja_id
        and p.user_id = auth.uid()
        and p.ativo = true
        and p.papel = any(p_roles)
    );
$$;

create or replace function private.igreja_can_access(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.igreja_is_super_admin()
    or exists (
      select 1
      from public.igreja_perfis p
      where p.igreja_id = p_igreja_id
        and p.user_id = auth.uid()
        and p.ativo = true
    );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on function private.igreja_is_super_admin() from public, anon;
revoke all on function private.igreja_has_role(uuid, text[]) from public, anon;
revoke all on function private.igreja_can_access(uuid) from public, anon;
grant execute on function private.igreja_is_super_admin() to authenticated, service_role;
grant execute on function private.igreja_has_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.igreja_can_access(uuid) to authenticated, service_role;

drop policy if exists igreja_igrejas_select on public.igreja_igrejas;
create policy igreja_igrejas_select on public.igreja_igrejas
for select to authenticated
using (private.igreja_can_access(id));

drop policy if exists igreja_membros_select on public.igreja_membros;
drop policy if exists igreja_membros_write on public.igreja_membros;
create policy igreja_membros_select on public.igreja_membros
for select to authenticated
using (
  private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider'])
  or user_id = (select auth.uid())
);
create policy igreja_membros_insert on public.igreja_membros
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));
create policy igreja_membros_update on public.igreja_membros
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));
create policy igreja_membros_delete on public.igreja_membros
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

drop policy if exists igreja_perfis_select on public.igreja_perfis;
drop policy if exists igreja_perfis_write on public.igreja_perfis;
create policy igreja_perfis_select on public.igreja_perfis
for select to authenticated
using (
  private.igreja_has_role(igreja_id, array['admin','pastor'])
  or user_id = (select auth.uid())
);
create policy igreja_perfis_insert on public.igreja_perfis
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor']));
create policy igreja_perfis_update on public.igreja_perfis
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor']));
create policy igreja_perfis_delete on public.igreja_perfis
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor']));

drop policy if exists igreja_eventos_select on public.igreja_eventos;
drop policy if exists igreja_eventos_write on public.igreja_eventos;
create policy igreja_eventos_select on public.igreja_eventos
for select to authenticated
using (private.igreja_can_access(igreja_id));
create policy igreja_eventos_insert on public.igreja_eventos
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_eventos_update on public.igreja_eventos
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_eventos_delete on public.igreja_eventos
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_evento_presencas_select on public.igreja_evento_presencas;
drop policy if exists igreja_evento_presencas_write on public.igreja_evento_presencas;
create policy igreja_evento_presencas_select on public.igreja_evento_presencas
for select to authenticated
using (
  private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider'])
  or exists (
    select 1
    from public.igreja_membros m
    where m.id = membro_id
      and m.user_id = (select auth.uid())
  )
);
create policy igreja_evento_presencas_insert on public.igreja_evento_presencas
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_evento_presencas_update on public.igreja_evento_presencas
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_evento_presencas_delete on public.igreja_evento_presencas
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_pregacoes_select on public.igreja_pregacoes;
drop policy if exists igreja_pregacoes_write on public.igreja_pregacoes;
create policy igreja_pregacoes_select on public.igreja_pregacoes
for select to authenticated
using (private.igreja_can_access(igreja_id));
create policy igreja_pregacoes_insert on public.igreja_pregacoes
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_pregacoes_update on public.igreja_pregacoes
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));
create policy igreja_pregacoes_delete on public.igreja_pregacoes
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_financeiro_select on public.igreja_financeiro_entradas;
drop policy if exists igreja_financeiro_write on public.igreja_financeiro_entradas;
create policy igreja_financeiro_select on public.igreja_financeiro_entradas
for select to authenticated
using (private.igreja_has_role(igreja_id, array['admin','tesouraria']));
create policy igreja_financeiro_insert on public.igreja_financeiro_entradas
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));
create policy igreja_financeiro_update on public.igreja_financeiro_entradas
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','tesouraria']))
with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));
create policy igreja_financeiro_delete on public.igreja_financeiro_entradas
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_biblia_favoritos_own on public.igreja_biblia_favoritos;
create policy igreja_biblia_favoritos_own on public.igreja_biblia_favoritos
for all to authenticated
using (user_id = (select auth.uid()) and private.igreja_can_access(igreja_id))
with check (user_id = (select auth.uid()) and private.igreja_can_access(igreja_id));

drop policy if exists igreja_biblia_anotacoes_own on public.igreja_biblia_anotacoes;
create policy igreja_biblia_anotacoes_own on public.igreja_biblia_anotacoes
for all to authenticated
using (user_id = (select auth.uid()) and private.igreja_can_access(igreja_id))
with check (user_id = (select auth.uid()) and private.igreja_can_access(igreja_id));

create index if not exists igreja_membros_user_fk_idx
  on public.igreja_membros(user_id)
  where user_id is not null;
create index if not exists igreja_eventos_created_by_idx
  on public.igreja_eventos(created_by)
  where created_by is not null;
create index if not exists igreja_evento_presencas_igreja_idx
  on public.igreja_evento_presencas(igreja_id);
create index if not exists igreja_evento_presencas_membro_idx
  on public.igreja_evento_presencas(membro_id);
create index if not exists igreja_pregacoes_evento_idx
  on public.igreja_pregacoes(evento_id)
  where evento_id is not null;
create index if not exists igreja_pregacoes_created_by_idx
  on public.igreja_pregacoes(created_by)
  where created_by is not null;
create index if not exists igreja_financeiro_membro_fk_idx
  on public.igreja_financeiro_entradas(membro_id)
  where membro_id is not null;
create index if not exists igreja_financeiro_evento_idx
  on public.igreja_financeiro_entradas(evento_id)
  where evento_id is not null;
create index if not exists igreja_financeiro_created_by_idx
  on public.igreja_financeiro_entradas(created_by)
  where created_by is not null;
create index if not exists igreja_biblia_favoritos_user_fk_idx
  on public.igreja_biblia_favoritos(user_id);
create index if not exists igreja_biblia_anotacoes_user_fk_idx
  on public.igreja_biblia_anotacoes(user_id);

drop function if exists public.igreja_can_access(uuid);
drop function if exists public.igreja_has_role(uuid, text[]);
drop function if exists public.igreja_is_super_admin();
