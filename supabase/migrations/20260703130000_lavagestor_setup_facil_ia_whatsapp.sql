alter table public.lava_configuracoes
  add column if not exists setup_facil_started_at timestamptz,
  add column if not exists setup_facil_finished_at timestamptz,
  add column if not exists setup_facil_status text not null default 'pendente',
  add column if not exists setup_facil_ultimo_teste_em timestamptz,
  add column if not exists setup_facil_ultimo_erro text;

alter table public.lava_whatsapp_integracoes
  add column if not exists setup_facil boolean not null default false,
  add column if not exists central_manager boolean not null default false,
  add column if not exists qr_status text,
  add column if not exists qr_code text,
  add column if not exists pairing_code text;

create table if not exists public.lava_ai_demo_usage (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usage_date date not null default current_date,
  total integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.lava_configuracoes
    drop constraint if exists lava_configuracoes_setup_facil_status_check;
  alter table public.lava_configuracoes
    add constraint lava_configuracoes_setup_facil_status_check
    check (setup_facil_status in ('pendente', 'em_andamento', 'pronto'));

  alter table public.lava_ai_demo_usage
    drop constraint if exists lava_ai_demo_usage_total_check;
  alter table public.lava_ai_demo_usage
    add constraint lava_ai_demo_usage_total_check
    check (total >= 0);

  alter table public.lava_whatsapp_integracoes
    drop constraint if exists lava_whatsapp_integracoes_qr_status_check;
  alter table public.lava_whatsapp_integracoes
    add constraint lava_whatsapp_integracoes_qr_status_check
    check (qr_status is null or qr_status in ('aguardando_qr', 'conectado', 'erro', 'desconectado'));
end $$;

create unique index if not exists lava_ai_demo_usage_empresa_date_uidx
  on public.lava_ai_demo_usage(empresa_id, usage_date);

create index if not exists lava_ai_demo_usage_empresa_last_idx
  on public.lava_ai_demo_usage(empresa_id, last_used_at desc);

alter table public.lava_ai_demo_usage enable row level security;

grant select, insert, update, delete on table public.lava_ai_demo_usage to authenticated, service_role;
grant select, insert, update, delete on table public.lava_configuracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_whatsapp_integracoes to authenticated, service_role;

drop policy if exists lava_ai_demo_usage_company_access on public.lava_ai_demo_usage;
create policy lava_ai_demo_usage_company_access on public.lava_ai_demo_usage
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_ai_demo_usage_updated_at on public.lava_ai_demo_usage;
create trigger set_lava_ai_demo_usage_updated_at before update on public.lava_ai_demo_usage
  for each row execute function public.set_updated_at();
