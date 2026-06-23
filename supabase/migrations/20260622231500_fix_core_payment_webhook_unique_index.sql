-- Corrige compatibilidade do log de webhooks com ON CONFLICT/PostgREST.
-- O índice parcial anterior não atende algumas chamadas de upsert.

drop index if exists public.core_payment_webhook_events_event_id_uidx;

create unique index if not exists core_payment_webhook_events_event_id_uidx
  on public.core_payment_webhook_events (provider, event_id);

comment on index public.core_payment_webhook_events_event_id_uidx
  is 'Garante idempotência de webhooks por provider/event_id sem índice parcial.';
