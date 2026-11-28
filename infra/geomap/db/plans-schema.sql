-- Stage and test before applying; metadata only, no photographs.
begin;
create table public.geomap_plans (
 project_id uuid primary key references public.geomap_projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=32768 and (plan->>'status') is not distinct from 'draft' and (plan->>'uploaded') is not distinct from 'false' and (plan->>'submitted') is not distinct from 'false' and (plan->>'projectId') is not distinct from project_id::text),
 created_at timestamptz not null default now()
);
alter table public.geomap_plans enable row level security;
revoke all on public.geomap_plans from public,anon,authenticated;
grant select on public.geomap_plans to authenticated;
grant insert(project_id,owner_id,plan) on public.geomap_plans to authenticated;
grant update(plan) on public.geomap_plans to authenticated;
create policy geomap_plan_read on public.geomap_plans for select to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.geomap_projects p where p.id=project_id and p.owner_id=(select auth.uid()))
);
create policy geomap_plan_insert on public.geomap_plans for insert to authenticated with check (
 owner_id=(select auth.uid()) and exists(select 1 from public.geomap_projects p where p.id=project_id and p.owner_id=(select auth.uid()))
);
create policy geomap_plan_update on public.geomap_plans for update to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.geomap_projects p where p.id=project_id and p.owner_id=(select auth.uid()))
) with check (
 owner_id=(select auth.uid()) and exists(select 1 from public.geomap_projects p where p.id=project_id and p.owner_id=(select auth.uid()))
);
commit;
