begin;

-- Exclusão física de escola não é permitida em sessão autenticada comum.
revoke delete on table public.escola_escolas from authenticated;

-- A auditoria sobrevive a eventual exclusão definitiva executada server-side.
alter table public.escola_auditoria
  drop constraint if exists escola_auditoria_escola_id_fkey;
alter table public.escola_auditoria
  add constraint escola_auditoria_escola_id_fkey
  foreign key (escola_id) references public.escola_escolas(id) on delete set null;

-- Auditoria append-only para a aplicação.
drop policy if exists escola_super_admin_all on public.escola_auditoria;
drop policy if exists escola_auditoria_super_admin_select on public.escola_auditoria;
create policy escola_auditoria_super_admin_select
on public.escola_auditoria
for select
to authenticated
using (public.escola_is_super_admin());

revoke insert, update, delete on table public.escola_auditoria from authenticated;
grant select on table public.escola_auditoria to authenticated;

create or replace function public.escola_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_escola uuid;
  v_recurso_id uuid;
  v_ator_tipo text;
  v_acao text;
begin
  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
    v_row := v_after;
    v_acao := 'criado';
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_row := v_after;
    v_acao := 'alterado';
  else
    v_before := to_jsonb(old);
    v_after := null;
    v_row := v_before;
    v_acao := 'excluido';
  end if;

  begin
    if tg_table_name = 'escola_escolas' then
      v_escola := nullif(v_row->>'id','')::uuid;
    else
      v_escola := nullif(v_row->>'escola_id','')::uuid;
    end if;
  exception when others then
    v_escola := null;
  end;

  begin
    v_recurso_id := nullif(v_row->>'id','')::uuid;
  exception when others then
    v_recurso_id := null;
  end;

  v_ator_tipo := case
    when public.escola_is_super_admin() then 'admin_mba'
    else public.escola_current_role()
  end;

  insert into public.escola_auditoria(
    escola_id, ator_id, ator_tipo, acao, recurso, recurso_id, detalhes
  ) values (
    v_escola,
    auth.uid(),
    coalesce(v_ator_tipo, 'sistema'),
    v_acao,
    tg_table_name,
    v_recurso_id,
    jsonb_build_object('antes', v_before, 'depois', v_after)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.escola_audit_row_change() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'escola_escolas',
    'escola_perfis',
    'escola_convites',
    'escola_alunos',
    'escola_aluno_responsaveis',
    'escola_turmas',
    'escola_professor_alocacoes',
    'escola_frequencias',
    'escola_ocorrencias_aluno',
    'escola_autorizacoes',
    'escola_autorizacao_respostas',
    'escola_pessoas_autorizadas',
    'escola_retiradas_aluno',
    'escola_pagamentos',
    'escola_planos'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || v_table, v_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.escola_audit_row_change()',
      'audit_' || v_table,
      v_table
    );
  end loop;
end $$;

commit;
