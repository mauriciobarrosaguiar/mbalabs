create table if not exists public.distributor_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  provider_key text not null,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'homologation', 'active', 'error')),
  connection_mode text not null default 'to_define'
    check (connection_mode in ('to_define', 'api', 'edi_van', 'communicator', 'portal', 'local_bridge', 'ftp')),
  customer_cnpj text not null,
  customer_code text,
  unit_name text,
  auto_quote_enabled boolean not null default false,
  auto_order_enabled boolean not null default false,
  secret_ref text,
  public_config jsonb not null default '{}'::jsonb,
  last_health_check_at timestamptz,
  last_health_check_ok boolean,
  last_health_check_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, distributor_id)
);

comment on table public.distributor_integrations is
  'Configuração técnica por tenant para integrações do MBA Cotações com distribuidoras.';

comment on column public.distributor_integrations.secret_ref is
  'Referência para segredo armazenado fora da tabela. Nunca gravar senha/token bruto neste campo.';

comment on column public.distributor_integrations.public_config is
  'Configuração não sensível, como unidade/CD, caminhos locais e opções do conector.';

create index if not exists distributor_integrations_tenant_idx
  on public.distributor_integrations (tenant_id);

create index if not exists distributor_integrations_provider_idx
  on public.distributor_integrations (provider_key);

alter table public.distributor_integrations enable row level security;

drop policy if exists distributor_integrations_tenant_access
  on public.distributor_integrations;

create policy distributor_integrations_tenant_access
  on public.distributor_integrations
  for all
  to authenticated
  using (is_super_admin() or belongs_to_tenant(tenant_id))
  with check (is_super_admin() or belongs_to_tenant(tenant_id));

drop trigger if exists distributor_integrations_set_updated_at
  on public.distributor_integrations;

create trigger distributor_integrations_set_updated_at
before update on public.distributor_integrations
for each row execute function public.set_updated_at();
