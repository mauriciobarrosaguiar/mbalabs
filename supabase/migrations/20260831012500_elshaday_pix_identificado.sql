-- Elshaday Gestão: PIX identificado por membro e categoria.

create table if not exists public.igreja_pix_pagadores (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null references public.igreja_membros(id) on delete cascade,
  provider text not null default 'asaas' check (provider in ('asaas')),
  provider_customer_id text not null,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (igreja_id, membro_id, provider),
  unique (provider, provider_customer_id)
);

create table if not exists public.igreja_pix_cobrancas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null references public.igreja_membros(id) on delete restrict,
  tipo text not null check (tipo in ('dizimo','oferta','oferta_especial','campanha','outro')),
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  provider text not null default 'asaas' check (provider in ('asaas')),
  provider_customer_id text,
  provider_payment_id text,
  external_reference text not null unique,
  status text not null default 'aguardando_pagamento'
    check (status in ('criando','aguardando_pagamento','pago','expirado','cancelado','estornado','erro')),
  due_date date,
  qr_payload text,
  qr_image text,
  qr_expiration_at timestamptz,
  provider_payload jsonb,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists igreja_pix_cobrancas_provider_payment_uidx
  on public.igreja_pix_cobrancas(provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists igreja_pix_cobrancas_igreja_status_idx
  on public.igreja_pix_cobrancas(igreja_id, status, created_at desc);

create index if not exists igreja_pix_cobrancas_membro_idx
  on public.igreja_pix_cobrancas(igreja_id, membro_id, created_at desc);

alter table public.igreja_financeiro_entradas
  add column if not exists pix_cobranca_id uuid
  references public.igreja_pix_cobrancas(id) on delete set null;

create unique index if not exists igreja_financeiro_pix_cobranca_uidx
  on public.igreja_financeiro_entradas(pix_cobranca_id)
  where pix_cobranca_id is not null;

alter table public.igreja_pix_pagadores enable row level security;
alter table public.igreja_pix_cobrancas enable row level security;

drop policy if exists igreja_pix_pagadores_select on public.igreja_pix_pagadores;
create policy igreja_pix_pagadores_select
  on public.igreja_pix_pagadores for select
  to authenticated
  using (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_pix_cobrancas_select on public.igreja_pix_cobrancas;
create policy igreja_pix_cobrancas_select
  on public.igreja_pix_cobrancas for select
  to authenticated
  using (
    private.igreja_has_role(igreja_id, array['admin','tesouraria'])
    or exists (
      select 1
      from public.igreja_membros m
      where m.id = igreja_pix_cobrancas.membro_id
        and m.igreja_id = igreja_pix_cobrancas.igreja_id
        and m.user_id = (select auth.uid())
    )
  );

revoke all on table public.igreja_pix_pagadores from anon;
revoke all on table public.igreja_pix_cobrancas from anon;
