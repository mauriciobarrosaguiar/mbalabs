-- Regressão de segurança MBA Escola: documentos, URLs assinadas e isolamento entre escolas.
-- Cria fixtures efêmeras, simula usuários authenticated e faz ROLLBACK no fim.

begin;

insert into auth.users(id) values
('a1111111-1111-4111-8111-111111111111'),
('b2222222-2222-4222-8222-222222222222'),
('c3333333-3333-4333-8333-333333333333'),
('d4444444-4444-4444-8444-444444444444'),
('e5555555-5555-4555-8555-555555555555');

insert into public.escola_escolas(id,nome,slug,status) values
('aa000000-0000-4000-8000-000000000001','DOC TEST A','doc-test-a','teste'),
('bb000000-0000-4000-8000-000000000002','DOC TEST B','doc-test-b','teste');

insert into public.escola_perfis(id,escola_id,nome,papel,ativo,is_teste) values
('a1111111-1111-4111-8111-111111111111','aa000000-0000-4000-8000-000000000001','Admin A','admin_escola',true,true),
('b2222222-2222-4222-8222-222222222222','bb000000-0000-4000-8000-000000000002','Admin B','admin_escola',true,true),
('c3333333-3333-4333-8333-333333333333','aa000000-0000-4000-8000-000000000001','Resp A','responsavel',true,true),
('d4444444-4444-4444-8444-444444444444','bb000000-0000-4000-8000-000000000002','Resp B','responsavel',true,true),
('e5555555-5555-4555-8555-555555555555','aa000000-0000-4000-8000-000000000001','Professor A','professor',true,true);

insert into public.escola_turmas(id,escola_id,nome,ano_letivo,turno,professor_responsavel_id,ativa) values
('a9000000-0000-4900-8900-000000000001','aa000000-0000-4000-8000-000000000001','Turma A',2026,'matutino','e5555555-5555-4555-8555-555555555555',true);

insert into public.escola_alunos(id,escola_id,turma_id,nome,ativo) values
('a8000000-0000-4800-8800-000000000001','aa000000-0000-4000-8000-000000000001','a9000000-0000-4900-8900-000000000001','Aluno A',true),
('b8000000-0000-4800-8800-000000000002','bb000000-0000-4000-8000-000000000002',null,'Aluno B',true);

insert into public.escola_aluno_responsaveis(escola_id,aluno_id,responsavel_id,parentesco,principal) values
('aa000000-0000-4000-8000-000000000001','a8000000-0000-4800-8800-000000000001','c3333333-3333-4333-8333-333333333333','Responsável',true),
('bb000000-0000-4000-8000-000000000002','b8000000-0000-4800-8800-000000000002','d4444444-4444-4444-8444-444444444444','Responsável',true);

insert into public.escola_frequencias(id,escola_id,turma_id,aluno_id,data_aula,status,registrado_por) values
('af000000-0000-4f00-8f00-000000000001','aa000000-0000-4000-8000-000000000001','a9000000-0000-4900-8900-000000000001','a8000000-0000-4800-8800-000000000001','2026-08-26','falta','a1111111-1111-4111-8111-111111111111'),
('bf000000-0000-4f00-8f00-000000000002','bb000000-0000-4000-8000-000000000002',null,'b8000000-0000-4800-8800-000000000002','2026-08-26','falta','b2222222-2222-4222-8222-222222222222');

insert into public.escola_justificativas_falta(id,escola_id,frequencia_id,aluno_id,responsavel_id,motivo,status) values
('ae000000-0000-4e00-8e00-000000000001','aa000000-0000-4000-8000-000000000001','af000000-0000-4f00-8f00-000000000001','a8000000-0000-4800-8800-000000000001','c3333333-3333-4333-8333-333333333333','Teste','pendente'),
('be000000-0000-4e00-8e00-000000000002','bb000000-0000-4000-8000-000000000002','bf000000-0000-4f00-8f00-000000000002','b8000000-0000-4800-8800-000000000002','d4444444-4444-4444-8444-444444444444','Teste','pendente');

insert into public.escola_justificativa_arquivos(id,escola_id,justificativa_id,aluno_id,responsavel_id,storage_path,nome_arquivo,mime_type,tamanho) values
('ad000000-0000-4d00-8d00-000000000001','aa000000-0000-4000-8000-000000000001','ae000000-0000-4e00-8e00-000000000001','a8000000-0000-4800-8800-000000000001','c3333333-3333-4333-8333-333333333333','aa000000-0000-4000-8000-000000000001/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/atestado-a.pdf','atestado-a.pdf','application/pdf',100),
('bd000000-0000-4d00-8d00-000000000002','bb000000-0000-4000-8000-000000000002','be000000-0000-4e00-8e00-000000000002','b8000000-0000-4800-8800-000000000002','d4444444-4444-4444-8444-444444444444','bb000000-0000-4000-8000-000000000002/b8000000-0000-4800-8800-000000000002/be000000-0000-4e00-8e00-000000000002/atestado-b.pdf','atestado-b.pdf','application/pdf',100);

insert into storage.objects(bucket_id,name,owner) values
('mba-escola-documentos','aa000000-0000-4000-8000-000000000001/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/atestado-a.pdf','c3333333-3333-4333-8333-333333333333'),
('mba-escola-documentos','bb000000-0000-4000-8000-000000000002/b8000000-0000-4800-8800-000000000002/be000000-0000-4e00-8e00-000000000002/atestado-b.pdf','d4444444-4444-4444-8444-444444444444');

-- Caminho divergente deve falhar.
do $$
declare bloqueado boolean := false;
begin
  begin
    insert into public.escola_justificativa_arquivos(escola_id,justificativa_id,aluno_id,responsavel_id,storage_path,nome_arquivo,mime_type,tamanho)
    values('aa000000-0000-4000-8000-000000000001','ae000000-0000-4e00-8e00-000000000001','a8000000-0000-4800-8800-000000000001','c3333333-3333-4333-8333-333333333333','bb000000-0000-4000-8000-000000000002/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/falso.pdf','falso.pdf','application/pdf',10);
  exception when others then bloqueado := true;
  end;
  if not bloqueado then raise exception 'Caminho divergente aceito'; end if;
end $$;

-- Responsável A: só o próprio documento.
set local role authenticated;
select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
do $$ declare n integer; begin
  if not public.escola_document_read_allowed('aa000000-0000-4000-8000-000000000001/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/atestado-a.pdf') then raise exception 'RESP A sem próprio documento'; end if;
  if public.escola_document_read_allowed('bb000000-0000-4000-8000-000000000002/b8000000-0000-4800-8800-000000000002/be000000-0000-4e00-8e00-000000000002/atestado-b.pdf') then raise exception 'RESP A acessou Escola B'; end if;
  select count(*) into n from storage.objects where bucket_id='mba-escola-documentos'; if n <> 1 then raise exception 'RESP A vê % objetos; esperado 1',n; end if;
  update public.escola_justificativa_arquivos set nome_arquivo='alterado.pdf' where id='ad000000-0000-4d00-8d00-000000000001'; get diagnostics n=row_count; if n <> 0 then raise exception 'RESP A alterou metadado'; end if;
  delete from public.escola_justificativa_arquivos where id='ad000000-0000-4d00-8d00-000000000001'; get diagnostics n=row_count; if n <> 0 then raise exception 'RESP A apagou metadado'; end if;
end $$;
reset role;

-- Admin A: documento da própria escola, nunca B.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
do $$ begin
  if not public.escola_document_read_allowed('aa000000-0000-4000-8000-000000000001/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/atestado-a.pdf') then raise exception 'ADMIN A sem documento A'; end if;
  if public.escola_document_read_allowed('bb000000-0000-4000-8000-000000000002/b8000000-0000-4800-8800-000000000002/be000000-0000-4e00-8e00-000000000002/atestado-b.pdf') then raise exception 'ADMIN A acessou documento B'; end if;
end $$;
reset role;

-- Professor A pode acessar aluno/turma, mas não documento médico nem objeto do bucket.
set local role authenticated;
select set_config('request.jwt.claim.sub','e5555555-5555-4555-8555-555555555555',true);
select set_config('request.jwt.claims','{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
do $$ declare n integer; begin
  if public.escola_document_read_allowed('aa000000-0000-4000-8000-000000000001/a8000000-0000-4800-8800-000000000001/ae000000-0000-4e00-8e00-000000000001/atestado-a.pdf') then raise exception 'PROF A acessou documento médico'; end if;
  select count(*) into n from storage.objects where bucket_id='mba-escola-documentos'; if n <> 0 then raise exception 'PROF A vê % objetos; esperado 0',n; end if;
end $$;
reset role;

rollback;
select 'PASS' as mba_escola_document_privacy;
