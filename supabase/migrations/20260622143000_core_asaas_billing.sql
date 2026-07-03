-- Centraliza a integração Asaas no core do MBA Labs.
-- Esta migration é segura para rodar em um banco que já possui core_empresas, core_assinaturas e core_pagamentos.

alter table if exists public.core_empresas
  add column if not exists asaas_customer_id text,
  add column if not exists billing_email text,
  add column if not exists billing_whatsapp text;

alter table if exists public.core_pagamentos
  add column if not exists provider text default 'manual',
  add column if not exists billing_type text,
  add column if not exists payment_url text,
  add column if not exists invoice_url text,
  add column if not exists bank_slip_url text,
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_status text,
  add column if not exists asaas_payload jsonb,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists core_empresas_asaas_customer_id_uidx
  on public.core_empresas (asaas_customer_id)
  where asaas_customer_id is not null;

create unique index if not exists core_pagamentos_asaas_payment_id_uidx
  on public.core_pagamentos (asaas_payment_id)
  where asaas_payment_id is not null;

create index if not exists core_pagamentos_provider_status_idx
  on public.core_pagamentos (provider, status);

create table if not exists public.core_payment_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  environment text not null default 'sandbox',
  api_url text,
  api_key text,
  webhook_token text,
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint core_payment_settings_provider_chk check (provider in ('asaas')),
  constraint core_payment_settings_environment_chk check (environment in ('sandbox', 'production'))
);

create unique index if not exists core_payment_settings_provider_uidx
  on public.core_payment_settings (provider);

create table if not exists public.core_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  event_id text,
  event_type text,
  payment_id text,
  external_reference text,
  payload jsonb not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists core_payment_webhook_events_event_id_uidx
  on public.core_payment_webhook_events (provider, event_id)
  where event_id is not null;

create index if not exists core_payment_webhook_events_payment_idx
  on public.core_payment_webhook_events (provider, payment_id, event_type);

alter table public.core_payment_settings enable row level security;
alter table public.core_payment_webhook_events enable row level security;

comment on table public.core_payment_settings is 'Configuração central de provedores de pagamento do MBA Labs. Use env vars em produção quando possível.';
comment on table public.core_payment_webhook_events is 'Log idempotente de webhooks de pagamento recebidos do Asaas.';
