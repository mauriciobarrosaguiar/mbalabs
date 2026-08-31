-- Elshaday: suporte a identificador de pedido do provedor (PagBank e futuros).

alter table public.igreja_pix_cobrancas
  add column if not exists provider_order_id text;

create unique index if not exists igreja_pix_cobrancas_provider_order_uidx
  on public.igreja_pix_cobrancas(provider, provider_order_id)
  where provider_order_id is not null;

create index if not exists igreja_pix_cobrancas_provider_status_idx
  on public.igreja_pix_cobrancas(igreja_id, provider, status, created_at desc);
