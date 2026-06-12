alter table public.quotations
  add column if not exists deleted_at timestamptz;

alter table public.quotations
  drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (
    status in (
      'draft',
      'open',
      'waiting_responses',
      'analyzing',
      'finished',
      'generated',
      'gerado',
      'pedido_gerado',
      'canceled',
      'excluida',
      'deleted'
    )
  );
