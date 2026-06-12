alter table public.quotations
  add column if not exists deleted_at timestamptz;

alter table public.quotations
  add column if not exists source_quotation_id uuid references public.quotations(id),
  add column if not exists source_purchase_order_id uuid references public.purchase_orders(id);

alter table public.quotation_items
  add column if not exists source_quotation_item_id uuid references public.quotation_items(id),
  add column if not exists source_purchase_order_id uuid references public.purchase_orders(id),
  add column if not exists source_purchase_order_item_id uuid references public.purchase_order_items(id);

alter table public.quotations
  drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in (
    'draft',
    'open',
    'waiting_responses',
    'analyzing',
    'finished',
    'gerado',
    'generated',
    'pedido_gerado',
    'canceled',
    'excluida'
  ));

create index if not exists idx_quotations_active_module
on public.quotations(module_type, created_at desc)
where status <> 'excluida' and deleted_at is null;

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
    'enviado_ao_vendedor',
    'aberto_pelo_vendedor',
    'em_conferencia',
    'finalizado_pelo_vendedor',
    'parcialmente_faturado',
    'nao_faturado',
    'cancelado'
  ));

alter table public.purchase_order_items
  add column if not exists billed_quantity numeric(14,3),
  add column if not exists missing_quantity numeric(14,3);

update public.purchase_order_items
set
  billed_quantity = case
    when fulfillment_status = 'faturado' then quantity_to_buy
    when fulfillment_status = 'nao_faturado' then 0
    else coalesce(billed_quantity, quantity_to_buy)
  end,
  missing_quantity = case
    when fulfillment_status = 'faturado' then 0
    when fulfillment_status = 'nao_faturado' then quantity_to_buy
    else greatest(quantity_to_buy - coalesce(billed_quantity, quantity_to_buy), 0)
  end
where billed_quantity is null or missing_quantity is null;

alter table public.winner_order_pending_items
  add column if not exists requested_quantity numeric(14,3),
  add column if not exists billed_quantity numeric(14,3);

update public.winner_order_pending_items
set
  requested_quantity = coalesce(requested_quantity, quantity),
  billed_quantity = coalesce(billed_quantity, 0)
where requested_quantity is null or billed_quantity is null;

create or replace function public.guard_supplier_response_write()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
  session_status text;
  session_expires_at timestamptz;
begin
  select q.status, s.status, s.expires_at
    into quotation_status, session_status, session_expires_at
  from public.quotations q
  left join public.supplier_quote_sessions s on s.id = new.session_id
  where q.id = new.quotation_id;

  if quotation_status in ('finished', 'gerado', 'generated', 'pedido_gerado', 'canceled', 'excluida') then
    raise exception 'Cotacao finalizada. Nao e mais possivel enviar ou alterar respostas.';
  end if;

  if session_status = 'canceled' then
    raise exception 'Token revogado. Nao e possivel enviar resposta.';
  end if;

  if session_status = 'expired' or session_expires_at < now() then
    raise exception 'Token vencido. Nao e possivel enviar resposta.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'submitted' then
    raise exception 'Resposta enviada. Nao e possivel alterar resposta finalizada.';
  end if;

  return new;
end;
$$;

create or replace function public.guard_supplier_response_item_write()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
  session_status text;
  session_expires_at timestamptz;
begin
  select q.status, s.status, s.expires_at
    into quotation_status, session_status, session_expires_at
  from public.supplier_quote_responses r
  join public.quotations q on q.id = r.quotation_id
  left join public.supplier_quote_sessions s on s.id = r.session_id
  where r.id = new.response_id;

  if quotation_status in ('finished', 'gerado', 'generated', 'pedido_gerado', 'canceled', 'excluida') then
    raise exception 'Cotacao finalizada. Nao e mais possivel enviar ou alterar respostas.';
  end if;

  if session_status = 'canceled' then
    raise exception 'Token revogado. Nao e possivel enviar resposta.';
  end if;

  if session_status = 'expired' or session_expires_at < now() then
    raise exception 'Token vencido. Nao e possivel enviar resposta.';
  end if;

  return new;
end;
$$;

create or replace function public.guard_supplier_session_reopen_when_quotation_closed()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
begin
  select status
    into quotation_status
  from public.quotations
  where id = new.quotation_id;

  if quotation_status in ('finished', 'gerado', 'generated', 'pedido_gerado', 'canceled', 'excluida') and new.status not in ('canceled', 'expired') then
    raise exception 'Cotacao finalizada. Nao e possivel reabrir link de fornecedor.';
  end if;

  return new;
end;
$$;
