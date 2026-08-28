begin;

-- Completa a trilha LGPD para interações autenticadas do responsável.
-- Algumas tabelas usam chave composta e não carregam escola_id; nesses casos
-- a escola e o recurso são derivados do registro escolar relacionado.
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
      v_escola := nullif(v_row->>'id', '')::uuid;
    elsif tg_table_name = 'escola_ocorrencia_ciencias' then
      v_recurso_id := nullif(v_row->>'ocorrencia_id', '')::uuid;
      select o.escola_id
        into v_escola
        from public.escola_ocorrencias_aluno o
       where o.id = v_recurso_id;
    elsif tg_table_name = 'escola_comunicado_leituras' then
      v_recurso_id := nullif(v_row->>'comunicado_id', '')::uuid;
      select c.escola_id
        into v_escola
        from public.escola_comunicados c
       where c.id = v_recurso_id;
    else
      v_escola := nullif(v_row->>'escola_id', '')::uuid;
    end if;
  exception when others then
    v_escola := null;
  end;

  if v_recurso_id is null then
    begin
      v_recurso_id := nullif(v_row->>'id', '')::uuid;
    exception when others then
      v_recurso_id := null;
    end;
  end if;

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

drop trigger if exists audit_escola_ocorrencia_ciencias on public.escola_ocorrencia_ciencias;
create trigger audit_escola_ocorrencia_ciencias
after insert or update or delete on public.escola_ocorrencia_ciencias
for each row execute function public.escola_audit_row_change();

drop trigger if exists audit_escola_comunicado_leituras on public.escola_comunicado_leituras;
create trigger audit_escola_comunicado_leituras
after insert or update or delete on public.escola_comunicado_leituras
for each row execute function public.escola_audit_row_change();

drop trigger if exists audit_escola_justificativas_falta on public.escola_justificativas_falta;
create trigger audit_escola_justificativas_falta
after insert or update or delete on public.escola_justificativas_falta
for each row execute function public.escola_audit_row_change();

drop trigger if exists audit_escola_justificativa_arquivos on public.escola_justificativa_arquivos;
create trigger audit_escola_justificativa_arquivos
after insert or update or delete on public.escola_justificativa_arquivos
for each row execute function public.escola_audit_row_change();

commit;
