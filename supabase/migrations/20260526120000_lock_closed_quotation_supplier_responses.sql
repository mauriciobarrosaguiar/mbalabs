create or replace function public.guard_supplier_response_write()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
  session_status text;
  session_expires_at timestamptz;
begin
  select q.status, s.status, s.expires_at
    into quotation_status, session_status, session_expires_at
  from public.quotations q
  left join public.supplier_quote_sessions s on s.id = new.session_id
  where q.id = new.quotation_id;

  if quotation_status in ('finished', 'canceled') then
    raise exception 'Cotacao finalizada. Nao e mais possivel enviar ou alterar respostas.';
  end if;

  if session_status = 'canceled' then
    raise exception 'Token revogado. Nao e possivel enviar resposta.';
  end if;

  if session_status = 'expired' or session_expires_at < now() then
    raise exception 'Token vencido. Nao e possivel enviar resposta.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'submitted' then
    raise exception 'Resposta enviada. Nao e possivel alterar resposta finalizada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_response_write on public.supplier_quote_responses;
create trigger trg_guard_supplier_response_write
before insert or update on public.supplier_quote_responses
for each row execute function public.guard_supplier_response_write();

create or replace function public.guard_supplier_response_item_write()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
  session_status text;
  session_expires_at timestamptz;
begin
  select q.status, s.status, s.expires_at
    into quotation_status, session_status, session_expires_at
  from public.supplier_quote_responses r
  join public.quotations q on q.id = r.quotation_id
  left join public.supplier_quote_sessions s on s.id = r.session_id
  where r.id = new.response_id;

  if quotation_status in ('finished', 'canceled') then
    raise exception 'Cotacao finalizada. Nao e mais possivel enviar ou alterar respostas.';
  end if;

  if session_status = 'canceled' then
    raise exception 'Token revogado. Nao e possivel enviar resposta.';
  end if;

  if session_status = 'expired' or session_expires_at < now() then
    raise exception 'Token vencido. Nao e possivel enviar resposta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_response_item_write on public.supplier_quote_response_items;
create trigger trg_guard_supplier_response_item_write
before insert or update on public.supplier_quote_response_items
for each row execute function public.guard_supplier_response_item_write();

create or replace function public.guard_supplier_session_reopen_when_quotation_closed()
returns trigger
language plpgsql
as $$
declare
  quotation_status text;
begin
  select status
    into quotation_status
  from public.quotations
  where id = new.quotation_id;

  if quotation_status in ('finished', 'canceled') and new.status not in ('canceled', 'expired') then
    raise exception 'Cotacao finalizada. Nao e possivel reabrir link de fornecedor.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_session_reopen_when_quotation_closed on public.supplier_quote_sessions;
create trigger trg_guard_supplier_session_reopen_when_quotation_closed
before update on public.supplier_quote_sessions
for each row execute function public.guard_supplier_session_reopen_when_quotation_closed();
