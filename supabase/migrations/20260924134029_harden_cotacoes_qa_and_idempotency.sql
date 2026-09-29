-- MBA Cotações: invariantes de idempotência e índices para isolamento/consulta.
-- Pré-condição verificada em 2026-09-24: não havia grupos duplicados nas
-- chaves abaixo no banco principal. A migration é aditiva e não apaga dados.

alter table public.quotations
  add column if not exists buyer_document text;

update public.quotations q
set buyer_document = regexp_replace(coalesce(ce.cnpj, t.cnpj, ''), '[^0-9]', '', 'g')
from public.tenants t
left join public.core_empresas ce on ce.id = t.core_empresa_id
where q.tenant_id = t.id
  and q.buyer_document is null
  and char_length(regexp_replace(coalesce(ce.cnpj, t.cnpj, ''), '[^0-9]', '', 'g')) = 14;

alter table public.quotations
  drop constraint if exists quotations_buyer_document_check,
  add constraint quotations_buyer_document_check
    check (buyer_document is null or buyer_document ~ '^[0-9]{14}$') not valid;

alter table public.quotations
  validate constraint quotations_buyer_document_check;

-- Corrige somente referências históricas cross-tenant. Os snapshots de nome,
-- empresa e contato permanecem nas tabelas operacionais; nenhum registro é apagado.
update public.supplier_quote_sessions child
set supplier_id = null
from public.suppliers parent
where child.supplier_id = parent.id
  and child.tenant_id <> parent.tenant_id;

update public.supplier_quote_responses child
set supplier_id = null
from public.suppliers parent
where child.supplier_id = parent.id
  and child.tenant_id <> parent.tenant_id;

update public.supplier_quote_response_items child
set supplier_id = null
from public.suppliers parent
where child.supplier_id = parent.id
  and child.tenant_id <> parent.tenant_id;

update public.purchase_orders child
set supplier_id = null
from public.suppliers parent
where child.supplier_id = parent.id
  and child.tenant_id <> parent.tenant_id;

-- Índices únicos compostos tornam o tenant parte da própria integridade
-- referencial, mesmo quando uma operação backend usa service_role.
create unique index if not exists uq_pharmacies_id_tenant
  on public.pharmacies (id, tenant_id);
create unique index if not exists uq_suppliers_id_tenant
  on public.suppliers (id, tenant_id);
create unique index if not exists uq_distributors_id_tenant
  on public.distributors (id, tenant_id);
create unique index if not exists uq_quotations_id_tenant
  on public.quotations (id, tenant_id);
create unique index if not exists uq_quotation_items_id_tenant
  on public.quotation_items (id, tenant_id);
create unique index if not exists uq_supplier_quote_sessions_id_tenant
  on public.supplier_quote_sessions (id, tenant_id);
create unique index if not exists uq_supplier_quote_responses_id_tenant
  on public.supplier_quote_responses (id, tenant_id);
create unique index if not exists uq_purchase_orders_id_tenant
  on public.purchase_orders (id, tenant_id);

alter table public.quotations
  drop constraint if exists quotations_pharmacy_tenant_fkey,
  add constraint quotations_pharmacy_tenant_fkey
    foreign key (pharmacy_id, tenant_id)
    references public.pharmacies (id, tenant_id) not valid;
alter table public.quotation_items
  drop constraint if exists quotation_items_quotation_tenant_fkey,
  add constraint quotation_items_quotation_tenant_fkey
    foreign key (quotation_id, tenant_id)
    references public.quotations (id, tenant_id) not valid;
alter table public.supplier_quote_sessions
  drop constraint if exists supplier_sessions_quotation_tenant_fkey,
  add constraint supplier_sessions_quotation_tenant_fkey
    foreign key (quotation_id, tenant_id)
    references public.quotations (id, tenant_id) not valid,
  drop constraint if exists supplier_sessions_supplier_tenant_fkey,
  add constraint supplier_sessions_supplier_tenant_fkey
    foreign key (supplier_id, tenant_id)
    references public.suppliers (id, tenant_id) not valid;
alter table public.supplier_quote_responses
  drop constraint if exists supplier_responses_quotation_tenant_fkey,
  add constraint supplier_responses_quotation_tenant_fkey
    foreign key (quotation_id, tenant_id)
    references public.quotations (id, tenant_id) not valid,
  drop constraint if exists supplier_responses_session_tenant_fkey,
  add constraint supplier_responses_session_tenant_fkey
    foreign key (session_id, tenant_id)
    references public.supplier_quote_sessions (id, tenant_id) not valid,
  drop constraint if exists supplier_responses_supplier_tenant_fkey,
  add constraint supplier_responses_supplier_tenant_fkey
    foreign key (supplier_id, tenant_id)
    references public.suppliers (id, tenant_id) not valid;
alter table public.supplier_quote_response_items
  drop constraint if exists supplier_response_items_quotation_tenant_fkey,
  add constraint supplier_response_items_quotation_tenant_fkey
    foreign key (quotation_id, tenant_id)
    references public.quotations (id, tenant_id) not valid,
  drop constraint if exists supplier_response_items_item_tenant_fkey,
  add constraint supplier_response_items_item_tenant_fkey
    foreign key (quotation_item_id, tenant_id)
    references public.quotation_items (id, tenant_id) not valid,
  drop constraint if exists supplier_response_items_response_tenant_fkey,
  add constraint supplier_response_items_response_tenant_fkey
    foreign key (response_id, tenant_id)
    references public.supplier_quote_responses (id, tenant_id) not valid,
  drop constraint if exists supplier_response_items_supplier_tenant_fkey,
  add constraint supplier_response_items_supplier_tenant_fkey
    foreign key (supplier_id, tenant_id)
    references public.suppliers (id, tenant_id) not valid,
  drop constraint if exists supplier_response_items_distributor_tenant_fkey,
  add constraint supplier_response_items_distributor_tenant_fkey
    foreign key (distributor_id, tenant_id)
    references public.distributors (id, tenant_id) not valid;
alter table public.purchase_orders
  drop constraint if exists purchase_orders_quotation_tenant_fkey,
  add constraint purchase_orders_quotation_tenant_fkey
    foreign key (quotation_id, tenant_id)
    references public.quotations (id, tenant_id) not valid,
  drop constraint if exists purchase_orders_supplier_tenant_fkey,
  add constraint purchase_orders_supplier_tenant_fkey
    foreign key (supplier_id, tenant_id)
    references public.suppliers (id, tenant_id) not valid;
alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_order_tenant_fkey,
  add constraint purchase_order_items_order_tenant_fkey
    foreign key (purchase_order_id, tenant_id)
    references public.purchase_orders (id, tenant_id) not valid,
  drop constraint if exists purchase_order_items_item_tenant_fkey,
  add constraint purchase_order_items_item_tenant_fkey
    foreign key (quotation_item_id, tenant_id)
    references public.quotation_items (id, tenant_id) not valid;

alter table public.quotations validate constraint quotations_pharmacy_tenant_fkey;
alter table public.quotation_items validate constraint quotation_items_quotation_tenant_fkey;
alter table public.supplier_quote_sessions validate constraint supplier_sessions_quotation_tenant_fkey;
alter table public.supplier_quote_sessions validate constraint supplier_sessions_supplier_tenant_fkey;
alter table public.supplier_quote_responses validate constraint supplier_responses_quotation_tenant_fkey;
alter table public.supplier_quote_responses validate constraint supplier_responses_session_tenant_fkey;
alter table public.supplier_quote_responses validate constraint supplier_responses_supplier_tenant_fkey;
alter table public.supplier_quote_response_items validate constraint supplier_response_items_quotation_tenant_fkey;
alter table public.supplier_quote_response_items validate constraint supplier_response_items_item_tenant_fkey;
alter table public.supplier_quote_response_items validate constraint supplier_response_items_response_tenant_fkey;
alter table public.supplier_quote_response_items validate constraint supplier_response_items_supplier_tenant_fkey;
alter table public.supplier_quote_response_items validate constraint supplier_response_items_distributor_tenant_fkey;
alter table public.purchase_orders validate constraint purchase_orders_quotation_tenant_fkey;
alter table public.purchase_orders validate constraint purchase_orders_supplier_tenant_fkey;
alter table public.purchase_order_items validate constraint purchase_order_items_order_tenant_fkey;
alter table public.purchase_order_items validate constraint purchase_order_items_item_tenant_fkey;

create unique index if not exists uq_supplier_quote_sessions_quotation_supplier
  on public.supplier_quote_sessions (quotation_id, supplier_id)
  where supplier_id is not null;

create unique index if not exists uq_supplier_quote_responses_session
  on public.supplier_quote_responses (session_id);

create unique index if not exists uq_supplier_quote_response_items_response_item
  on public.supplier_quote_response_items (response_id, quotation_item_id);

create unique index if not exists uq_purchase_orders_quotation_supplier
  on public.purchase_orders (quotation_id, supplier_id)
  where supplier_id is not null;

create unique index if not exists uq_purchase_orders_quotation_supplier_name
  on public.purchase_orders (quotation_id, supplier_name)
  where supplier_id is null;

create unique index if not exists uq_purchase_order_items_order_quotation_item
  on public.purchase_order_items (purchase_order_id, quotation_item_id);

create unique index if not exists cot_whatsapp_envios_unico
  on public.cot_whatsapp_envios (empresa_id, cotacao_id, vendedor_id, tipo_envio);

create index if not exists idx_pharmacies_tenant_id
  on public.pharmacies (tenant_id);
create index if not exists idx_suppliers_tenant_id
  on public.suppliers (tenant_id);
create index if not exists idx_products_tenant_id
  on public.products (tenant_id);
create index if not exists idx_supplier_quote_sessions_tenant_id
  on public.supplier_quote_sessions (tenant_id);
create index if not exists idx_supplier_quote_sessions_quotation_id
  on public.supplier_quote_sessions (quotation_id);
create index if not exists idx_supplier_quote_sessions_supplier_id
  on public.supplier_quote_sessions (supplier_id);
create index if not exists idx_supplier_quote_responses_tenant_id
  on public.supplier_quote_responses (tenant_id);
create index if not exists idx_supplier_quote_responses_quotation_id
  on public.supplier_quote_responses (quotation_id);
create index if not exists idx_supplier_quote_responses_supplier_id
  on public.supplier_quote_responses (supplier_id);
create index if not exists idx_supplier_quote_response_items_tenant_id
  on public.supplier_quote_response_items (tenant_id);
create index if not exists idx_supplier_quote_response_items_quotation_id
  on public.supplier_quote_response_items (quotation_id);
create index if not exists idx_supplier_quote_response_items_response_id
  on public.supplier_quote_response_items (response_id);
create index if not exists idx_supplier_quote_response_items_supplier_id
  on public.supplier_quote_response_items (supplier_id);
create index if not exists idx_purchase_orders_tenant_id
  on public.purchase_orders (tenant_id);
create index if not exists idx_purchase_orders_quotation_id
  on public.purchase_orders (quotation_id);
create index if not exists idx_purchase_orders_supplier_id
  on public.purchase_orders (supplier_id);
create index if not exists idx_purchase_order_items_tenant_id
  on public.purchase_order_items (tenant_id);

-- Estas tabelas são deliberadamente backend-only. RLS sem policy já bloqueia
-- clientes, e os REVOKE deixam a intenção explícita mesmo em futuros grants.
revoke all on table public.cot_whatsapp_global_config from anon, authenticated;
revoke all on table public.cot_whatsapp_envios from anon, authenticated;
grant all on table public.cot_whatsapp_global_config to service_role;
grant all on table public.cot_whatsapp_envios to service_role;
