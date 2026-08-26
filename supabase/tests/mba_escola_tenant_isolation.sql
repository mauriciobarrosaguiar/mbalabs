-- Regressão de segurança MBA Escola: Escola A x Escola B.
-- O teste cria fixtures efêmeras dentro de uma transação, simula sessões authenticated
-- e falha com RAISE EXCEPTION se qualquer papel atravessar a fronteira da outra escola.
-- Ao final, ROLLBACK remove todas as fixtures.

begin;

insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333333'),
('44444444-4444-4444-8444-444444444444'),
('55555555-5555-4555-8555-555555555555'),
('66666666-6666-4666-8666-666666666666'),
('77777777-7777-4777-8777-777777777777');

insert into public.escola_escolas(id,nome,slug,status) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','TESTE RLS Escola A','teste-rls-escola-a','teste'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','TESTE RLS Escola B','teste-rls-escola-b','teste');

insert into public.escola_perfis(id,escola_id,nome,papel,ativo,is_teste) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Admin A','admin_escola',true,true),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Admin B','admin_escola',true,true),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Responsável A','responsavel',true,true),
('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Responsável B','responsavel',true,true),
('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Professor A','professor',true,true),
('66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Professor B','professor',true,true),
('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Coordenação A','coordenacao',true,true);

insert into public.escola_turmas(id,escola_id,nome,ano_letivo,turno,ativa) values
('90000000-0000-4900-8900-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Turma A',2026,'matutino',true),
('90000000-0000-4900-8900-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Turma B',2026,'matutino',true);

insert into public.escola_alunos(id,escola_id,turma_id,nome,ativo) values
('80000000-0000-4800-8800-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','90000000-0000-4900-8900-000000000001','Aluno A1',true),
('80000000-0000-4800-8800-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','90000000-0000-4900-8900-000000000001','Aluno A2',true),
('80000000-0000-4800-8800-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','90000000-0000-4900-8900-000000000002','Aluno B1',true);

insert into public.escola_disciplinas(id,escola_id,nome,ativa) values
('70000000-0000-4700-8700-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Disciplina A',true),
('70000000-0000-4700-8700-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Disciplina B',true);

insert into public.escola_professor_alocacoes(escola_id,professor_id,turma_id,disciplina_id,ativo) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','55555555-5555-4555-8555-555555555555','90000000-0000-4900-8900-000000000001','70000000-0000-4700-8700-000000000001',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','66666666-6666-4666-8666-666666666666','90000000-0000-4900-8900-000000000002','70000000-0000-4700-8700-000000000002',true);

insert into public.escola_aluno_responsaveis(escola_id,aluno_id,responsavel_id,parentesco,principal) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','80000000-0000-4800-8800-000000000001','33333333-3333-4333-8333-333333333333','Responsável',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','80000000-0000-4800-8800-000000000003','44444444-4444-4444-8444-444444444444','Responsável',true);

insert into public.escola_frequencias(escola_id,turma_id,aluno_id,data_aula,status,registrado_por) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','90000000-0000-4900-8900-000000000001','80000000-0000-4800-8800-000000000001','2026-08-26','falta','55555555-5555-4555-8555-555555555555'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','90000000-0000-4900-8900-000000000001','80000000-0000-4800-8800-000000000002','2026-08-26','falta','55555555-5555-4555-8555-555555555555'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','90000000-0000-4900-8900-000000000002','80000000-0000-4800-8800-000000000003','2026-08-26','falta','66666666-6666-4666-8666-666666666666');

insert into public.escola_ocorrencias_aluno(escola_id,aluno_id,autor_id,titulo,descricao,visivel_responsavel) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','80000000-0000-4800-8800-000000000001','55555555-5555-4555-8555-555555555555','Visível A1','Teste',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','80000000-0000-4800-8800-000000000001','55555555-5555-4555-8555-555555555555','Oculta A1','Teste',false),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','80000000-0000-4800-8800-000000000002','55555555-5555-4555-8555-555555555555','Visível A2','Teste',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','80000000-0000-4800-8800-000000000003','66666666-6666-4666-8666-666666666666','Visível B1','Teste',true);

-- ADMIN DA ESCOLA A
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
do $$
declare n integer;
begin
  if public.escola_current_school_id() <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid then raise exception 'ADMIN A: escola atual incorreta'; end if;
  if not public.escola_can_admin_school('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then raise exception 'ADMIN A: sem admin na própria escola'; end if;
  if public.escola_can_admin_school('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') then raise exception 'ADMIN A: admin indevido na Escola B'; end if;
  select count(*) into n from public.escola_escolas; if n <> 1 then raise exception 'ADMIN A: escolas visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_perfis; if n <> 4 then raise exception 'ADMIN A: perfis visíveis %, esperado 4', n; end if;
  select count(*) into n from public.escola_alunos; if n <> 2 then raise exception 'ADMIN A: alunos visíveis %, esperado 2', n; end if;
  update public.escola_alunos set nome='Aluno A2 editado' where id='80000000-0000-4800-8800-000000000002'; get diagnostics n = row_count; if n <> 1 then raise exception 'ADMIN A: não editou aluno próprio'; end if;
  update public.escola_alunos set nome='INVASÃO' where id='80000000-0000-4800-8800-000000000003'; get diagnostics n = row_count; if n <> 0 then raise exception 'ADMIN A: editou aluno da Escola B'; end if;
  update public.escola_perfis set telefone='999' where id='22222222-2222-4222-8222-222222222222'; get diagnostics n = row_count; if n <> 0 then raise exception 'ADMIN A: editou perfil da Escola B'; end if;
end $$;
reset role;

-- COORDENAÇÃO A: gestão acadêmica, sem poderes de administração de perfis.
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aal":"aal1"}',true);
do $$
declare n integer;
begin
  if public.escola_can_admin_school('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then raise exception 'COORD A: recebeu privilégio de admin'; end if;
  if not public.escola_can_manage_school('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then raise exception 'COORD A: sem gestão acadêmica própria'; end if;
  if public.escola_can_manage_school('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') then raise exception 'COORD A: gestão indevida da Escola B'; end if;
  select count(*) into n from public.escola_alunos; if n <> 2 then raise exception 'COORD A: alunos visíveis %, esperado 2', n; end if;
  update public.escola_perfis set telefone='888' where id='11111111-1111-4111-8111-111111111111'; get diagnostics n = row_count; if n <> 0 then raise exception 'COORD A: editou perfil administrativo'; end if;
  update public.escola_alunos set nome='Aluno A1 coord' where id='80000000-0000-4800-8800-000000000001'; get diagnostics n = row_count; if n <> 1 then raise exception 'COORD A: operação acadêmica própria bloqueada'; end if;
  update public.escola_alunos set nome='INVASÃO' where id='80000000-0000-4800-8800-000000000003'; get diagnostics n = row_count; if n <> 0 then raise exception 'COORD A: editou aluno da Escola B'; end if;
end $$;
reset role;

-- PROFESSOR A: apenas turma/alunos alocados; sem gestão administrativa.
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
do $$
declare n integer;
begin
  if public.escola_can_manage_school('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then raise exception 'PROF A: recebeu privilégio de gestor'; end if;
  select count(*) into n from public.escola_escolas; if n <> 1 then raise exception 'PROF A: escolas visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_turmas; if n <> 1 then raise exception 'PROF A: turmas visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_alunos; if n <> 2 then raise exception 'PROF A: alunos visíveis %, esperado 2', n; end if;
  select count(*) into n from public.escola_perfis; if n <> 1 then raise exception 'PROF A: perfis visíveis %, esperado 1', n; end if;
  update public.escola_alunos set nome='INVASÃO PROF' where id='80000000-0000-4800-8800-000000000001'; get diagnostics n = row_count; if n <> 0 then raise exception 'PROF A: editou aluno diretamente'; end if;
  if public.escola_can_access_student('80000000-0000-4800-8800-000000000003') then raise exception 'PROF A: acessou aluno da Escola B'; end if;
end $$;
reset role;

-- RESPONSÁVEL A: somente o aluno vinculado, nunca outro aluno da mesma escola ou da Escola B.
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
do $$
declare n integer;
begin
  if not public.escola_can_access_student('80000000-0000-4800-8800-000000000001') then raise exception 'RESP A: não acessou filho vinculado'; end if;
  if public.escola_can_access_student('80000000-0000-4800-8800-000000000002') then raise exception 'RESP A: acessou outro aluno da mesma escola'; end if;
  if public.escola_can_access_student('80000000-0000-4800-8800-000000000003') then raise exception 'RESP A: acessou aluno da Escola B'; end if;
  select count(*) into n from public.escola_escolas; if n <> 1 then raise exception 'RESP A: escolas visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_turmas; if n <> 1 then raise exception 'RESP A: turmas visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_alunos; if n <> 1 then raise exception 'RESP A: alunos visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_perfis; if n <> 1 then raise exception 'RESP A: perfis visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_aluno_responsaveis; if n <> 1 then raise exception 'RESP A: vínculos visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_frequencias; if n <> 1 then raise exception 'RESP A: frequências visíveis %, esperado 1', n; end if;
  select count(*) into n from public.escola_ocorrencias_aluno; if n <> 1 then raise exception 'RESP A: ocorrências visíveis %, esperado 1', n; end if;
  update public.escola_alunos set nome='INVASÃO RESP' where id='80000000-0000-4800-8800-000000000001'; get diagnostics n = row_count; if n <> 0 then raise exception 'RESP A: editou aluno diretamente'; end if;
end $$;
reset role;

-- Privilégios que ignoram ou ampliam a superfície do RLS não devem existir no cliente.
do $$
begin
  if has_table_privilege('authenticated','public.escola_alunos','TRUNCATE') then raise exception 'authenticated possui TRUNCATE em escola_alunos'; end if;
  if has_table_privilege('authenticated','public.escola_perfis','TRIGGER') then raise exception 'authenticated possui TRIGGER em escola_perfis'; end if;
  if has_table_privilege('authenticated','public.escola_escolas','REFERENCES') then raise exception 'authenticated possui REFERENCES em escola_escolas'; end if;
end $$;

rollback;
select 'PASS' as mba_escola_tenant_isolation;
