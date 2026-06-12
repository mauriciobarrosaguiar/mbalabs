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
  add column if not exists confirmed_amount numeric(14,4) not null default 0,
  add column if not exists pedido_finalizado boolean not null default false,
  add column if not exists finalizado_em timestamptz,
  add column if not exists conferido_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();

update public.purchase_orders
set
  pedido_finalizado = true,
  finalizado_em = coalesce(finalizado_em, completed_at, updated_at),
  conferido_em = coalesce(conferido_em, completed_at, updated_at)
where status in ('confirmed','finalizado_pelo_vendedor','parcialmente_faturado','nao_faturado')
   or completed_at is not null;

alter table public.purchase_order_items
  add column if not exists fulfillment_status text,
  add column if not exists vendor_observation text,
  add column if not exists status_faturamento text,
  add column if not exists observacao_faturamento text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists original_supplier_id uuid references public.suppliers(id),
  add column if not exists original_supplier_name text;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_fulfillment_status_check;

update public.purchase_order_items
set fulfillment_status = case
  when coalesce(nullif(fulfillment_status, ''), nullif(status_faturamento, '')) in ('faturado','parcial','nao_faturado','pendente')
    then coalesce(nullif(fulfillment_status, ''), nullif(status_faturamento, ''))
  when coalesce(nullif(fulfillment_status, ''), nullif(status_faturamento, '')) = 'a_faturar'
    then 'pendente'
  else 'pendente'
end;

update public.purchase_order_items
set
  status_faturamento = fulfillment_status,
  vendor_observation = coalesce(vendor_observation, observacao_faturamento),
  observacao_faturamento = coalesce(observacao_faturamento, vendor_observation);

alter table public.purchase_order_items
  alter column fulfillment_status set default 'pendente',
  alter column fulfillment_status set not null,
  alter column status_faturamento set default 'pendente',
  alter column status_faturamento set not null;

alter table public.purchase_order_items
  add constraint purchase_order_items_fulfillment_status_check
  check (fulfillment_status in ('faturado','parcial','nao_faturado','pendente'));

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_status_faturamento_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_status_faturamento_check
  check (status_faturamento in ('faturado','parcial','nao_faturado','pendente'));

create or replace function public.set_purchase_order_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_purchase_order_review_updated_at();

drop trigger if exists set_purchase_order_items_updated_at on public.purchase_order_items;
create trigger set_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_purchase_order_review_updated_at();

create index if not exists idx_purchase_orders_public_token
on public.purchase_orders(public_token);

create index if not exists idx_purchase_order_items_purchase_order
on public.purchase_order_items(purchase_order_id);
