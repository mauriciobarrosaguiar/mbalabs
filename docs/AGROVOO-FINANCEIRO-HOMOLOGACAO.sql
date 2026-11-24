-- Executar exclusivamente no PostgreSQL descartável do CI.
\set ON_ERROR_STOP on
begin;
-- Verificar RLS e privilégios antes de simular operações.
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.agrovoo_finance_entries'::regclass) then raise exception 'RLS não habilitado'; end if;
  if has_table_privilege('anon','public.agrovoo_finance_entries','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.agrovoo_finance_entries','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Permissão indevida'; end if;
  if not has_table_privilege('service_role','public.agrovoo_finance_entries','SELECT') or not has_table_privilege('service_role','public.agrovoo_finance_entries','INSERT') or not has_table_privilege('service_role','public.agrovoo_finance_entries','UPDATE') or has_table_privilege('service_role','public.agrovoo_finance_entries','DELETE') then raise exception 'Permissões de serviço incorretas'; end if;
end $$;
set local role service_role;
insert into public.agrovoo_finance_entries(id,scope_kind,scope_id,created_by,kind,description,category,amount_cents,due_date,competence_date,os_id,cost_center,counterparty) values
('10000000-0000-4000-8000-000000000001','empresa','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','receita','Serviço fictício','Serviços',450000,'2026-11-24','2026-11-01','40000000-0000-4000-8000-000000000001','Pulverização','Cliente fictício'),
('10000000-0000-4000-8000-000000000002','empresa','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','despesa','Despesa fictícia','Operação',65000,'2026-11-24','2026-11-01',null,'',''),
('10000000-0000-4000-8000-000000000003','usuario','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','despesa','Escopo pessoal fictício','Operação',10000,'2026-11-24','2026-11-01',null,'','');
do $$
declare n integer;
begin
  select count(*) into n from public.agrovoo_finance_entries where scope_kind='empresa' and scope_id='20000000-0000-4000-8000-000000000001';
  if n<>1 then raise exception 'Filtro de escopo incorreto'; end if;
  update public.agrovoo_finance_entries set amount_cents=500000,updated_at=clock_timestamp() where id='10000000-0000-4000-8000-000000000001' and scope_kind='empresa' and scope_id='20000000-0000-4000-8000-000000000001' and status='pendente';
  get diagnostics n=row_count;if n<>1 then raise exception 'Edição falhou'; end if;
  update public.agrovoo_finance_entries set status='liquidado',settled_date='2026-11-24' where id='10000000-0000-4000-8000-000000000001' and scope_kind='empresa' and scope_id='20000000-0000-4000-8000-000000000001' and status='pendente';
  get diagnostics n=row_count;if n<>1 then raise exception 'Liquidação falhou'; end if;
  update public.agrovoo_finance_entries set status='cancelado',settled_date=null where id='10000000-0000-4000-8000-000000000001' and scope_kind='empresa' and scope_id='20000000-0000-4000-8000-000000000001' and status='pendente';
  get diagnostics n=row_count;if n<>0 then raise exception 'Lançamento liquidado alterado'; end if;
  update public.agrovoo_finance_entries set amount_cents=999 where id='10000000-0000-4000-8000-000000000002' and scope_kind='empresa' and scope_id='20000000-0000-4000-8000-000000000001';
  get diagnostics n=row_count;if n<>0 then raise exception 'Filtro cruzado incorreto'; end if;
  begin
    update public.agrovoo_finance_entries set amount_cents=-1 where id='10000000-0000-4000-8000-000000000002';
    raise exception 'Valor negativo aceito';
  exception when check_violation then null;end;
  begin
    update public.agrovoo_finance_entries set status='liquidado',settled_date=null where id='10000000-0000-4000-8000-000000000002';
    raise exception 'Liquidação sem data aceita';
  exception when check_violation then null;end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform count(*) from public.agrovoo_finance_entries;
    raise exception 'Leitura direta indevida';
  exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: esquema, RLS, privilégios, escopos, edição, liquidação, restrições e rollback' as resultado;
