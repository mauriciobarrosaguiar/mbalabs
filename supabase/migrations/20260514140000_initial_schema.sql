create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  monthly_price numeric(12,2) not null default 0,
  max_users integer not null default 1,
  max_quotations_month integer not null default 30,
  modules text not null check (modules in ('pharmacy','distributor_bidding','both')),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text not null,
  cnpj text not null unique,
  tipo_cliente text not null check (tipo_cliente in ('pharmacy','distributor_bidding','both')),
  responsavel_nome text not null,
  responsavel_email text not null,
  responsavel_whatsapp text,
  plano_id uuid references public.subscription_plans(id),
  status text not null default 'teste' check (status in ('teste','ativo','suspenso','cancelado')),
  data_inicio date not null default current_date,
  data_vencimento date,
  valor_mensal numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('SUPER_ADMIN','ADMIN_EMPRESA','COMPRADOR','CONFERENTE','FINANCEIRO')),
  status text not null default 'ativo' check (status in ('ativo','inativo','convidado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_profile_id uuid not null references public.users_profile(id) on delete cascade,
  role text not null check (role in ('ADMIN_EMPRESA','COMPRADOR','CONFERENTE','FINANCEIRO')),
  status text not null default 'ativo' check (status in ('ativo','inativo','convidado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_profile_id)
);

create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome_fantasia text not null,
  razao_social text not null,
  cnpj text not null,
  cidade text,
  uf text,
  responsavel text,
  whatsapp text,
  email text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  empresa text not null,
  whatsapp text,
  email text,
  tipo_fornecedor text not null check (tipo_fornecedor in ('vendedor','distribuidora','laboratorio','marketplace','outro')),
  observacao text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  unidade_cd text,
  uf text,
  pedido_minimo numeric(12,2) not null default 0,
  prazo_medio text,
  portal text,
  observacao text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_distributors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supplier_id, distributor_id)
);

create table if not exists public.laboratories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  cnpj text,
  tipo text not null default 'laboratorio',
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_laboratories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supplier_id, laboratory_id)
);

create table if not exists public.unit_types (
  code text primary key,
  name text not null,
  plural_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  principio_ativo text,
  dosagem text,
  forma text,
  tipo_produto text not null,
  laboratorio_id uuid references public.laboratories(id),
  ean text,
  unidade_base text references public.unit_types(code),
  apresentacao text,
  quantidade_por_embalagem numeric(12,3),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_presentations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_code text references public.unit_types(code),
  package_quantity numeric(12,3) not null default 1,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_type text not null check (module_type in ('pharmacy','bidding')),
  name text not null,
  pharmacy_id uuid references public.pharmacies(id),
  buyer_company_name text,
  destination_client text,
  orgao_destino text,
  process_number text,
  bid_number text,
  quotation_type text,
  judgment_type text check (judgment_type in ('by_item','by_lot','global') or judgment_type is null),
  deadline_at timestamptz,
  allow_partial_supply boolean not null default true,
  allow_equivalent boolean not null default true,
  consider_minimum_order boolean not null default false,
  notes text,
  status text not null default 'draft' check (status in ('draft','open','waiting_responses','analyzing','finished','canceled')),
  created_by uuid references public.users_profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  module_type text not null check (module_type in ('pharmacy','bidding')),
  item_number integer not null default 1,
  product_id uuid references public.products(id),
  product_name text not null,
  active_ingredient text,
  dosage text,
  ean text,
  requested_quantity numeric(14,3) not null,
  requested_unit text references public.unit_types(code),
  requested_laboratory text,
  laboratory_required boolean not null default false,
  product_type text,
  accept_equivalent boolean not null default true,
  allow_partial_supply boolean not null default true,
  minimum_validity date,
  ms_registration_required boolean not null default false,
  max_delivery_days integer,
  lot_group text,
  buyer_observation text,
  last_purchase_price numeric(12,4),
  last_purchase_date date,
  status text not null default 'aguardando_respostas',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  sent_to text,
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quote_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  seller_name text,
  seller_company text,
  seller_whatsapp text,
  seller_email text,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'opened' check (status in ('opened','draft','submitted','expired','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quote_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  session_id uuid not null references public.supplier_quote_sessions(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  seller_name text,
  seller_company text,
  seller_whatsapp text,
  seller_email text,
  billing_company text,
  payment_terms text,
  delivery_terms text,
  general_observation text,
  status text not null default 'draft' check (status in ('opened','draft','submitted','expired','canceled')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quote_response_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id) on delete cascade,
  response_id uuid not null references public.supplier_quote_responses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  offered_product_name text,
  offered_laboratory text,
  offered_unit text references public.unit_types(code),
  package_quantity numeric(14,3),
  package_price numeric(14,4),
  has_full_quantity boolean,
  available_quantity numeric(14,3),
  delivery_days integer,
  seller_observation text,
  unit_price numeric(14,4),
  has_stock boolean,
  distributor_id uuid references public.distributors(id),
  converted_unit_price numeric(14,6),
  required_packages_total numeric(14,3),
  packages_to_buy numeric(14,3),
  quantity_to_buy numeric(14,3),
  quantity_shortage numeric(14,3),
  technical_surplus numeric(14,3),
  total_price_if_full numeric(14,4),
  total_price_available numeric(14,4),
  ranking_position integer,
  award_status text,
  alert_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_analysis (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  module_type text not null check (module_type in ('pharmacy','bidding')),
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id) on delete cascade,
  supplier_response_item_id uuid not null references public.supplier_quote_response_items(id),
  supplier_id uuid references public.suppliers(id),
  supplier_name text not null,
  module_type text not null check (module_type in ('pharmacy','bidding')),
  ranking_position integer,
  awarded_quantity numeric(14,3) not null,
  awarded_packages numeric(14,3),
  unit_price numeric(14,6),
  package_price numeric(14,4),
  total_price numeric(14,4) not null,
  remaining_balance_after numeric(14,3) not null default 0,
  status text not null default 'winner',
  created_at timestamptz not null default now()
);

create table if not exists public.pending_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id) on delete cascade,
  product_name text not null,
  requested_quantity numeric(14,3) not null,
  supplied_quantity numeric(14,3) not null default 0,
  pending_quantity numeric(14,3) not null,
  unit text references public.unit_types(code),
  status text not null default 'pending' check (status in ('pending','new_quotation_created','canceled','resolved')),
  new_quotation_id uuid references public.quotations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  module_type text not null check (module_type in ('pharmacy','bidding')),
  supplier_name text not null,
  supplier_id uuid references public.suppliers(id),
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  total_amount numeric(14,4) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','confirmed','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id),
  product_name text not null,
  offered_product_name text,
  laboratory text,
  unit text references public.unit_types(code),
  quantity_to_buy numeric(14,3) not null,
  packages_to_buy numeric(14,3),
  package_quantity numeric(14,3),
  package_price numeric(14,4),
  unit_price numeric(14,6),
  total_price numeric(14,4) not null,
  observation text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id),
  supplier_id uuid references public.suppliers(id),
  product_name text not null,
  quantity numeric(14,3),
  unit_price numeric(14,4),
  total_price numeric(14,4),
  purchased_at date,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id),
  supplier_id uuid references public.suppliers(id),
  product_name text not null,
  unit_price numeric(14,6),
  package_price numeric(14,4),
  package_quantity numeric(14,3),
  source text,
  captured_at timestamptz not null default now()
);

create table if not exists public.monthly_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  reference_month text not null,
  due_date date not null,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','canceled','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  monthly_subscription_id uuid references public.monthly_subscriptions(id),
  provider text not null default 'efi',
  txid text,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','canceled','refunded')),
  paid_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.efi_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  txid text unique,
  pix_key text,
  copy_paste text,
  qr_code_url text,
  sandbox boolean not null default true,
  status text not null default 'pending',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  owner_id uuid references public.users_profile(id),
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_id uuid references public.files(id),
  import_type text not null,
  status text not null default 'draft',
  column_mapping jsonb not null default '{}'::jsonb,
  preview_rows jsonb not null default '[]'::jsonb,
  error_message text,
  created_by uuid references public.users_profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references public.users_profile(id),
  actor text,
  action text not null,
  entity text,
  severity text not null default 'info' check (severity in ('info','warning','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  encrypted_payload bytea,
  key_hint text,
  status text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  run_type text not null,
  status text not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users_profile where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users_profile where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'SUPER_ADMIN', false);
$$;

create or replace function public.belongs_to_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = target_tenant_id
      and tu.user_profile_id = public.current_user_profile_id()
      and tu.status = 'ativo'
  );
$$;

create or replace function public.get_public_quote_payload(input_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'session', to_jsonb(s),
    'quotation', to_jsonb(q),
    'tenant', to_jsonb(t),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.item_number)
      from public.quotation_items i
      where i.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.supplier_quote_sessions s
  join public.quotations q on q.id = s.quotation_id
  join public.tenants t on t.id = s.tenant_id
  where s.public_token = input_token
    and s.expires_at > now()
    and s.status in ('opened','draft','submitted')
  limit 1;
$$;

revoke all on function public.get_public_quote_payload(text) from public;
grant execute on function public.get_public_quote_payload(text) to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subscription_plans','tenants','users_profile','tenant_users','pharmacies',
    'suppliers','distributors','supplier_distributors','laboratories',
    'supplier_laboratories','unit_types','products','product_presentations',
    'quotations','quotation_items','quotation_invites','supplier_quote_sessions',
    'supplier_quote_responses','supplier_quote_response_items','quotation_analysis',
    'quotation_awards','pending_balances','purchase_orders','purchase_order_items',
    'purchase_history','price_history','monthly_subscriptions','payments',
    'efi_charges','files','import_jobs','audit_logs','integration_credentials',
    'integration_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "subscription_plans_read_authenticated"
on public.subscription_plans for select
to authenticated
using (true);

create policy "subscription_plans_super_admin_all"
on public.subscription_plans for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "tenants_super_admin_all"
on public.tenants for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "tenants_member_select"
on public.tenants for select
to authenticated
using (public.is_super_admin() or public.belongs_to_tenant(id));

create policy "users_profile_self_select"
on public.users_profile for select
to authenticated
using (public.is_super_admin() or auth_user_id = auth.uid());

create policy "users_profile_super_admin_all"
on public.users_profile for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "unit_types_read_all"
on public.unit_types for select
to anon, authenticated
using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenant_users','pharmacies','suppliers','distributors','supplier_distributors',
    'laboratories','supplier_laboratories','products','product_presentations',
    'quotations','quotation_items','quotation_invites','supplier_quote_sessions',
    'supplier_quote_responses','supplier_quote_response_items','quotation_analysis',
    'quotation_awards','pending_balances','purchase_orders','purchase_order_items',
    'purchase_history','price_history','monthly_subscriptions','payments',
    'efi_charges','files','import_jobs','audit_logs','integration_credentials',
    'integration_runs'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_super_admin() or public.belongs_to_tenant(tenant_id)) with check (public.is_super_admin() or public.belongs_to_tenant(tenant_id))',
      table_name || '_tenant_access',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subscription_plans','tenants','users_profile','tenant_users','pharmacies',
    'suppliers','distributors','laboratories','products','product_presentations',
    'quotations','quotation_items','quotation_invites','supplier_quote_sessions',
    'supplier_quote_responses','supplier_quote_response_items','pending_balances',
    'purchase_orders','monthly_subscriptions','payments','efi_charges','import_jobs',
    'integration_credentials'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create index if not exists idx_tenant_users_tenant on public.tenant_users(tenant_id);
create index if not exists idx_quotations_tenant_module on public.quotations(tenant_id, module_type);
create index if not exists idx_quotation_items_quotation on public.quotation_items(quotation_id);
create index if not exists idx_supplier_sessions_token on public.supplier_quote_sessions(public_token);
create index if not exists idx_purchase_orders_token on public.purchase_orders(public_token);
create index if not exists idx_response_items_quotation_item on public.supplier_quote_response_items(quotation_item_id);
