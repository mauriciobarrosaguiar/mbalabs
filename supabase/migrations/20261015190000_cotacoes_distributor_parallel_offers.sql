-- Ofertas digitais paralelas às respostas dos representantes.
-- Tabela isolada; não altera convites, respostas nem pedidos anteriores.
create table if not exists public.cot_distributor_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_item_id uuid not null references public.quotation_items(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  source text not null default 'importacao_autorizada'
    check (source in ('importacao_autorizada','api_homologada','edi_homologado')),
  ean text not null,
  unit_price numeric(14,4) not null check (unit_price > 0),
  available_quantity numeric(14,3) not null check (available_quantity >= 0),
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, quotation_id, quotation_item_id, supplier_id)
);
create index if not exists cot_distributor_offers_by_quote
  on public.cot_distributor_offers (tenant_id, quotation_id);
alter table public.cot_distributor_offers enable row level security;
-- Apenas o backend com credencial de serviço poderá acessar esta tabela.
revoke all on public.cot_distributor_offers from anon, authenticated;
comment on table public.cot_distributor_offers is
  'Preços de distribuidoras importados/homologados, separados das propostas por representante e isolados por empresa.';
