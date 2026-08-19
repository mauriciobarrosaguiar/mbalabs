-- MBA Cotações oficial: Lista de Faltas e exclusão segura de fornecedores.
-- Nenhum dado existente é apagado por esta migration.

create table if not exists public.shortage_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_name text not null,
  ean text,
  requested_quantity numeric(14,3) not null,
  requested_unit text not null default 'UN',
  notes text,
  status text not null default 'pending',
  quotation_id uuid references public.quotations(id) on delete set null,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortage_items_product_name_check check (char_length(btrim(product_name)) between 1 and 240),
  constraint shortage_items_ean_check check (ean is null or char_length(ean) <= 32),
  constraint shortage_items_quantity_check check (requested_quantity > 0),
  constraint shortage_items_unit_check check (char_length(btrim(requested_unit)) between 1 and 16),
  constraint shortage_items_notes_check check (notes is null or char_length(notes) <= 1000),
  constraint shortage_items_status_check check (status in ('pending', 'quoted'))
);

create index if not exists shortage_items_tenant_status_created_idx
  on public.shortage_items (tenant_id, status, created_at);

create index if not exists shortage_items_quotation_idx
  on public.shortage_items (quotation_id)
  where quotation_id is not null;

drop trigger if exists shortage_items_set_updated_at on public.shortage_items;
create trigger shortage_items_set_updated_at
before update on public.shortage_items
for each row execute function public.set_updated_at();

create or replace function public.enforce_shortage_item_quotation_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quotation_id is not null and not exists (
    select 1
    from public.quotations q
    where q.id = new.quotation_id
      and q.tenant_id = new.tenant_id
  ) then
    raise exception 'A cotação informada pertence a outra empresa.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_shortage_item_quotation_tenant() from public, anon, authenticated;

drop trigger if exists shortage_items_validate_quotation_tenant on public.shortage_items;
create trigger shortage_items_validate_quotation_tenant
before insert or update of tenant_id, quotation_id on public.shortage_items
for each row execute function public.enforce_shortage_item_quotation_tenant();

alter table public.shortage_items enable row level security;

revoke all on table public.shortage_items from anon, authenticated;
grant select, insert, update, delete on table public.shortage_items to authenticated;
grant all on table public.shortage_items to service_role;

drop policy if exists shortage_items_tenant_access on public.shortage_items;
create policy shortage_items_tenant_access
on public.shortage_items
for all
to authenticated
using (public.is_super_admin() or public.belongs_to_tenant(tenant_id))
with check (public.is_super_admin() or public.belongs_to_tenant(tenant_id));

-- O cadastro do fornecedor pode ser excluído sem destruir as respostas e pedidos.
-- As tabelas operacionais já mantêm snapshots do nome/empresa/contato.
alter table public.price_history
  drop constraint if exists price_history_supplier_id_fkey,
  add constraint price_history_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.purchase_history
  drop constraint if exists purchase_history_supplier_id_fkey,
  add constraint purchase_history_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_original_supplier_id_fkey,
  add constraint purchase_order_items_original_supplier_id_fkey
    foreign key (original_supplier_id) references public.suppliers(id) on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_supplier_id_fkey,
  add constraint purchase_orders_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.quotation_awards
  drop constraint if exists quotation_awards_supplier_id_fkey,
  add constraint quotation_awards_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.quotation_invites
  drop constraint if exists quotation_invites_supplier_id_fkey,
  add constraint quotation_invites_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.supplier_quote_response_items
  drop constraint if exists supplier_quote_response_items_supplier_id_fkey,
  add constraint supplier_quote_response_items_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.supplier_quote_responses
  drop constraint if exists supplier_quote_responses_supplier_id_fkey,
  add constraint supplier_quote_responses_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.supplier_quote_sessions
  drop constraint if exists supplier_quote_sessions_supplier_id_fkey,
  add constraint supplier_quote_sessions_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

alter table public.winner_order_pending_items
  drop constraint if exists winner_order_pending_items_next_supplier_id_fkey,
  add constraint winner_order_pending_items_next_supplier_id_fkey
    foreign key (next_supplier_id) references public.suppliers(id) on delete set null,
  drop constraint if exists winner_order_pending_items_original_supplier_id_fkey,
  add constraint winner_order_pending_items_original_supplier_id_fkey
    foreign key (original_supplier_id) references public.suppliers(id) on delete set null;

comment on table public.shortage_items is
  'Lista de Faltas por tenant do MBA Cotações oficial; itens pendentes podem originar uma cotação.';
