alter table public.supplier_quote_response_items
add column if not exists gross_price numeric(14,4),
add column if not exists discount_extra numeric(14,4),
add column if not exists net_price numeric(14,4),
add column if not exists delivery_term_text text;
