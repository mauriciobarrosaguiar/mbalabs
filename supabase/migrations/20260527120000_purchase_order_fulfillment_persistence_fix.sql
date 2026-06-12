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
  add column if not exists fulfillment_status text,
  add column if not exists vendor_observation text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists original_supplier_id uuid references public.suppliers(id),
  add column if not exists original_supplier_name text;

update public.purchase_order_items
set fulfillment_status = 'a_faturar'
where fulfillment_status is null;

alter table public.purchase_order_items
  alter column fulfillment_status set default 'a_faturar',
  alter column fulfillment_status set not null;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_fulfillment_status_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_fulfillment_status_check
  check (fulfillment_status in ('a_faturar','faturado','nao_faturado'));

drop trigger if exists set_purchase_order_items_updated_at on public.purchase_order_items;
create trigger set_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();
