-- QA fixture IDs only. Executes authenticated RLS scenarios; all changes ROLLBACK.
begin;
create temporary table qa_e2e_results(id text,expected text,actual text,status text) on commit drop;
grant select,insert on qa_e2e_results to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"5b8ee521-7145-4754-ae51-f804d4a5f175","role":"authenticated"}',true);
insert into qa_e2e_results select 'RLS-01','ler produtos próprios',count(*)::text,case when count(*)>0 then 'APROVADO' else 'FALHOU' end from products where tenant_id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
insert into qa_e2e_results select 'RLS-02','0 produtos da outra farmácia',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from products where tenant_id='6c73896b-6835-4bce-86ea-6f2138ea56ea';
with changed as(update products set nome=nome where tenant_id='6c73896b-6835-4bce-86ea-6f2138ea56ea' returning id) insert into qa_e2e_results select 'RLS-03','0 alterações em outra farmácia',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from changed;
do $$ begin
begin
insert into products(tenant_id,nome,status) values('6c73896b-6835-4bce-86ea-6f2138ea56ea','TESTE_QA RLS cruzado','ativo');
insert into qa_e2e_results values('RLS-04','inserção cruzada bloqueada','inserção aceita','FALHOU');
exception when insufficient_privilege then insert into qa_e2e_results values('RLS-04','inserção cruzada bloqueada','permission denied / RLS','APROVADO');end;
begin
perform public.cot_review_winner_orders_batch('6e6f802c-2524-4ac1-9fdc-150c734b8866',gen_random_uuid(),'TESTE_QA','[]'::jsonb,false,'[]'::jsonb);
insert into qa_e2e_results values('RLS-10','authenticated sem EXECUTE na RPC','execução aceita','FALHOU');
exception when insufficient_privilege then insert into qa_e2e_results values('RLS-10','authenticated sem EXECUTE na RPC','permission denied','APROVADO');end;
end $$;
reset role;
update users_profile set status='inativo' where id='ab548559-2394-4a70-a3ec-8a324208a457';
set local role authenticated;
insert into qa_e2e_results select 'RLS-05','usuário inativo: 0 produtos',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from products where tenant_id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
reset role;
update users_profile set status='ativo' where id='ab548559-2394-4a70-a3ec-8a324208a457';
update tenant_users set status='inativo' where user_profile_id='ab548559-2394-4a70-a3ec-8a324208a457';
set local role authenticated;
insert into qa_e2e_results select 'RLS-06','vínculo inativo: 0 produtos',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from products where tenant_id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
reset role;
update tenant_users set status='ativo' where user_profile_id='ab548559-2394-4a70-a3ec-8a324208a457';
update tenants set status='suspenso' where id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
set local role authenticated;
insert into qa_e2e_results select 'RLS-07','empresa suspensa: 0 produtos',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from products where tenant_id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
reset role;
update tenants set status='teste' where id='6e6f802c-2524-4ac1-9fdc-150c734b8866';
update tenant_users set role='FINANCEIRO' where user_profile_id='ab548559-2394-4a70-a3ec-8a324208a457';
set local role authenticated;
with changed as(update products set nome=nome where id='aa35e0d1-875f-4991-aa5e-6dc8765b9c1d' returning id) insert into qa_e2e_results select 'RLS-08','financeiro: 0 alterações de catálogo',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from changed;
reset role;
update tenant_users set role='CONFERENTE' where user_profile_id='ab548559-2394-4a70-a3ec-8a324208a457';
set local role authenticated;
with changed as(update products set nome=nome where id='aa35e0d1-875f-4991-aa5e-6dc8765b9c1d' returning id) insert into qa_e2e_results select 'RLS-09','conferente: 0 alterações de catálogo',count(*)::text,case when count(*)=0 then 'APROVADO' else 'FALHOU' end from changed;
reset role;
select * from qa_e2e_results order by id;
rollback;