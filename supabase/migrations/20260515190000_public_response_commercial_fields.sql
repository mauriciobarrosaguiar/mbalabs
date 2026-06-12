alter table public.supplier_quote_response_items
  add column if not exists gross_price numeric(14, 4),
  add column if not exists discount_extra numeric(14, 4),
  add column if not exists net_price numeric(14, 4),
  add column if not exists delivery_term_text text;

comment on column public.supplier_quote_response_items.gross_price is
  'Preco bruto informado pelo vendedor na tela publica de resposta.';

comment on column public.supplier_quote_response_items.discount_extra is
  'Desconto extra informado pelo vendedor na tela publica de resposta.';

comment on column public.supplier_quote_response_items.net_price is
  'Preco liquido/final calculado ou informado pelo vendedor.';

comment on column public.supplier_quote_response_items.delivery_term_text is
  'Prazo de entrega textual informado pelo vendedor.';
