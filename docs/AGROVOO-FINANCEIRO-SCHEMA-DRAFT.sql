-- RASCUNHO PARA REVISÃO: não executar em produção.
-- Criar migração formal e testar em banco isolado antes de liberar a API.
begin;
create table public.agrovoo_finance_entries (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null check (scope_kind in ('empresa','usuario')),
  scope_id uuid not null,
  created_by uuid not null,
  kind text not null check (kind in ('receita','despesa')),
  description text not null check (length(btrim(description)) between 1 and 180),
  category text not null check (length(btrim(category)) between 1 and 80),
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  due_date date not null,
  competence_date date not null,
  os_id uuid,
  os_label text check (length(os_label) <= 120),
  cost_center text not null default '' check (length(cost_center) <= 120),
  counterparty text not null default '' check (length(counterparty) <= 120),
  status text not null default 'pendente' check (status in ('pendente','liquidado','cancelado')),
  settled_date date,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((status='liquidado' and settled_date is not null) or (status<>'liquidado' and settled_date is null))
);
create index agrovoo_finance_scope_due_idx on public.agrovoo_finance_entries(scope_kind,scope_id,due_date);
create index agrovoo_finance_scope_comp_idx on public.agrovoo_finance_entries(scope_kind,scope_id,competence_date);
create index agrovoo_finance_scope_os_idx on public.agrovoo_finance_entries(scope_kind,scope_id,os_id);
alter table public.agrovoo_finance_entries enable row level security;
revoke all on public.agrovoo_finance_entries from public, anon, authenticated;
grant select,insert,update on public.agrovoo_finance_entries to service_role;
-- Sem políticas permissivas: acesso exclusivamente via API de servidor autorizada.
commit;
