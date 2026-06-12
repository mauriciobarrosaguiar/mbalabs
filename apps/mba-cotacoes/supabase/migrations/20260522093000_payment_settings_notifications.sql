create extension if not exists pgcrypto;

alter table if exists public.subscription_plans
  add column if not exists max_pharmacies integer not null default 1,
  add column if not exists observation text;

alter table if exists public.monthly_subscriptions
  add column if not exists plan_id uuid references public.subscription_plans(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_amount numeric(12,2),
  add column if not exists manual_payment_note text,
  add column if not exists txid text,
  add column if not exists efi_status text;

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique default 'efi',
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  pix_key text,
  client_id text,
  client_secret text,
  certificate_reference text,
  webhook_url text,
  receiver_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_settings enable row level security;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_profile_id uuid references public.users_profile(id) on delete cascade,
  scope text not null default 'tenant' check (scope in ('admin', 'tenant', 'user')),
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index if not exists notifications_tenant_idx on public.notifications (tenant_id, read_at, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_profile_id, read_at, created_at desc);
