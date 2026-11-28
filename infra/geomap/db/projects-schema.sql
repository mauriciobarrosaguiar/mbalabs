-- Proposed isolated schema. NOT applied to hosted database.
-- Requires verification of existing core_usuarios RLS and role mappings in staging.
begin;
create table public.geomap_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 180),
 client text not null default '' check(length(client)<=180),
 property text not null default '' check(length(property)<=180),
 city text not null check(length(btrim(city)) between 1 and 120),
 uf text not null check(uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 operator text not null default '' check(length(operator)<=180),
 rt text not null default '' check(length(rt)<=180),
 date text not null default '' check(length(date)<=10),
 purpose text not null default '' check(length(purpose)<=500),
 drone text not null default '' check(length(drone)<=120),
 status text not null default 'draft' check(status='draft'),
 created_at timestamptz not null default now()
);
create index geomap_projects_owner_created_idx on public.geomap_projects(owner_id,created_at desc);
alter table public.geomap_projects enable row level security;
revoke all on public.geomap_projects from public,anon,authenticated;
grant select on public.geomap_projects to authenticated;
grant insert(owner_id,name,client,property,city,uf,operator,rt,date,purpose,drone) on public.geomap_projects to authenticated;
create policy geomap_select_own_admin on public.geomap_projects for select to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.core_usuarios u where u.auth_user_id=(select auth.uid()) and u.status::text='ativo' and coalesce(u.tipo_global::text,u.tipo::text) in ('super_admin','admin_master'))
);
create policy geomap_insert_own_admin on public.geomap_projects for insert to authenticated with check (
 owner_id=(select auth.uid()) and exists(select 1 from public.core_usuarios u where u.auth_user_id=(select auth.uid()) and u.status::text='ativo' and coalesce(u.tipo_global::text,u.tipo::text) in ('super_admin','admin_master'))
);
commit;
