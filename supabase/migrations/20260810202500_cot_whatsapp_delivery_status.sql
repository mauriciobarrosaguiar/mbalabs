alter table if exists public.cot_whatsapp_envios
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text,
  add column if not exists entregue_em timestamptz,
  add column if not exists lido_em timestamptz,
  add column if not exists status_atualizado_em timestamptz;

create index if not exists cot_whatsapp_envios_provider_message_id_idx
  on public.cot_whatsapp_envios(provider_message_id)
  where provider_message_id is not null;

alter table if exists public.cot_whatsapp_global_config
  add column if not exists webhook_secret text,
  add column if not exists webhook_url text,
  add column if not exists webhook_enabled boolean not null default false,
  add column if not exists webhook_updated_at timestamptz,
  add column if not exists webhook_last_error text;
