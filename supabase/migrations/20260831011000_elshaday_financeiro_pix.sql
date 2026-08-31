-- Elshaday Gestão: infraestrutura PIX automática com Asaas.

alter table public.igreja_financeiro_entradas
  add column if not exists origem text not null default 'manual',
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_event_id text,
  add column if not exists provider_payload jsonb,
  add column if not exists recebido_em timestamptz,
  add column if not exists status text not null default 'confirmado';

alter table public.igreja_financeiro_entradas
  drop constraint if exists igreja_financeiro_entradas_origem_check,
  add constraint igreja_financeiro_entradas_origem_check
    check (origem in ('manual','automatico_pix','sincronizacao_pix')),
  drop constraint if exists igreja_financeiro_entradas_status_check,
  add constraint igreja_financeiro_entradas_status_check
    check (status in ('confirmado','pendente','estornado'));

create unique index if not exists igreja_financeiro_provider_payment_unique_idx
  on public.igreja_financeiro_entradas(provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create index if not exists igreja_financeiro_igreja_status_data_idx
  on public.igreja_financeiro_entradas(igreja_id, status, data_entrada desc);

create table if not exists public.igreja_pix_configuracoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null unique references public.igreja_igrejas(id) on delete cascade,
  provider text not null default 'asaas' check (provider in ('asaas')),
  ambiente text not null default 'sandbox' check (ambiente in ('sandbox','production')),
  ativo boolean not null default false,
  pix_address_key text,
  static_qr_id text unique,
  static_qr_payload text,
  static_qr_image text,
  static_qr_provider_payload jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.igreja_pix_eventos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid references public.igreja_igrejas(id) on delete cascade,
  provider text not null default 'asaas',
  event_id text not null,
  event_type text,
  provider_payment_id text,
  pix_qr_code_id text,
  external_reference text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, event_id)
);

create index if not exists igreja_pix_eventos_igreja_received_idx
  on public.igreja_pix_eventos(igreja_id, received_at desc);

create index if not exists igreja_pix_eventos_payment_idx
  on public.igreja_pix_eventos(provider, provider_payment_id);

alter table public.igreja_pix_configuracoes enable row level security;
alter table public.igreja_pix_eventos enable row level security;

drop policy if exists igreja_pix_config_select on public.igreja_pix_configuracoes;
create policy igreja_pix_config_select
  on public.igreja_pix_configuracoes for select
  to authenticated
  using (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_pix_config_insert on public.igreja_pix_configuracoes;
create policy igreja_pix_config_insert
  on public.igreja_pix_configuracoes for insert
  to authenticated
  with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_pix_config_update on public.igreja_pix_configuracoes;
create policy igreja_pix_config_update
  on public.igreja_pix_configuracoes for update
  to authenticated
  using (private.igreja_has_role(igreja_id, array['admin','tesouraria']))
  with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_pix_eventos_select on public.igreja_pix_eventos;
create policy igreja_pix_eventos_select
  on public.igreja_pix_eventos for select
  to authenticated
  using (
    igreja_id is not null
    and private.igreja_has_role(igreja_id, array['admin','tesouraria'])
  );

revoke all on table public.igreja_pix_configuracoes from anon;
revoke all on table public.igreja_pix_eventos from anon;
