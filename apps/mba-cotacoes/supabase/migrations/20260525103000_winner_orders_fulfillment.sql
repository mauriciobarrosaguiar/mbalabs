alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in (
    'draft',
    'sent',
    'confirmed',
    'canceled',
    'gerado',
    'enviado',
    'aberto_pelo_vendedor',
    'em_conferencia',
    'finalizado_pelo_vendedor',
    'parcialmente_faturado',
    'nao_faturado',
    'cancelado'
  ));

alter table public.purchase_orders
  add column if not exists supplier_whatsapp text,
  add column if not exists supplier_company text,
  add column if not exists opened_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists confirmed_amount numeric(14,4) not null default 0;

alter table public.purchase_order_items
  add column if not exists fulfillment_status text not null default 'a_faturar',
  add column if not exists vendor_observation text,
  add column if not exists original_supplier_id uuid references public.suppliers(id),
  add column if not exists original_supplier_name text;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_fulfillment_status_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_fulfillment_status_check
  check (fulfillment_status in ('a_faturar','faturado','nao_faturado'));

create table if not exists public.winner_order_pending_items (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id) on delete cascade,
  product_name text not null,
  quantity numeric(14,3) not null,
  unit text references public.unit_types(code),
  original_unit_price numeric(14,6) not null default 0,
  original_total_price numeric(14,4) not null default 0,
  original_supplier_id uuid references public.suppliers(id),
  original_supplier_name text not null,
  reason text,
  next_supplier_id uuid references public.suppliers(id),
  next_supplier_name text,
  next_unit_price numeric(14,6),
  next_order_id uuid references public.purchase_orders(id),
  new_quotation_id uuid references public.quotations(id),
  status text not null default 'pendente'
    check (status in ('pendente','enviado_para_proximo','nova_cotacao_criada','cancelado','resolvido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.winner_order_pending_items enable row level security;

drop policy if exists winner_order_pending_items_tenant_access on public.winner_order_pending_items;
create policy winner_order_pending_items_tenant_access
on public.winner_order_pending_items
for all
to authenticated
using (public.is_super_admin() or public.belongs_to_tenant(tenant_id))
with check (public.is_super_admin() or public.belongs_to_tenant(tenant_id));

drop trigger if exists set_winner_order_pending_items_updated_at on public.winner_order_pending_items;
create trigger set_winner_order_pending_items_updated_at
before update on public.winner_order_pending_items
for each row execute function public.set_updated_at();

create index if not exists idx_winner_pending_quotation
on public.winner_order_pending_items(quotation_id);

create index if not exists idx_winner_pending_status
on public.winner_order_pending_items(status);

create index if not exists idx_purchase_order_items_quotation_item
on public.purchase_order_items(quotation_item_id);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_quotation_awards_pharmacy_one_active_winner'
  ) then
    execute '
      create unique index idx_quotation_awards_pharmacy_one_active_winner
      on public.quotation_awards(quotation_id, quotation_item_id)
      where module_type = ''pharmacy''
        and status in (''winner'', ''tie_manual'')
    ';
  end if;
end $$;
