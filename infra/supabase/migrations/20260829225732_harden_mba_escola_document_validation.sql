-- MBA Escola: endurece validacao server-side de documentos e remove texto residual de MFA.

create or replace function public.escola_document_upload_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with p as (
    select
      public.escola_try_uuid(split_part(p_path, '/', 1)) as escola_id,
      public.escola_try_uuid(split_part(p_path, '/', 2)) as aluno_id,
      public.escola_try_uuid(split_part(p_path, '/', 3)) as justificativa_id,
      nullif(split_part(p_path, '/', 4), '') as arquivo,
      nullif(split_part(p_path, '/', 5), '') as segmento_extra
  )
  select exists (
    select 1
    from p
    join public.escola_justificativas_falta j on j.id = p.justificativa_id
    join public.escola_alunos a on a.id = p.aluno_id and a.escola_id = p.escola_id
    join public.escola_aluno_responsaveis ar
      on ar.escola_id = p.escola_id
     and ar.aluno_id = p.aluno_id
     and ar.responsavel_id = auth.uid()
    where p.arquivo is not null
      and p.segmento_extra is null
      and p.arquivo ~* '\\.(pdf|jpe?g|png|webp)$'
      and public.escola_same_school(p.escola_id)
      and j.escola_id = p.escola_id
      and j.aluno_id = p.aluno_id
      and j.responsavel_id = auth.uid()
      and j.status in ('pendente','correcao_solicitada','recusada')
  );
$$;

revoke all on function public.escola_document_upload_allowed(text) from public, anon;
grant execute on function public.escola_document_upload_allowed(text) to authenticated;

create or replace function public.escola_validate_justification_file()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ok boolean;
  v_name text := lower(coalesce(new.nome_arquivo, ''));
  v_path_name text := lower(coalesce(split_part(new.storage_path, '/', 4), ''));
begin
  if new.excluido_em is not null and tg_op = 'INSERT' then
    raise exception 'Documento novo não pode nascer excluído.';
  end if;

  if public.escola_try_uuid(split_part(new.storage_path, '/', 1)) is distinct from new.escola_id
     or public.escola_try_uuid(split_part(new.storage_path, '/', 2)) is distinct from new.aluno_id
     or public.escola_try_uuid(split_part(new.storage_path, '/', 3)) is distinct from new.justificativa_id
     or nullif(split_part(new.storage_path, '/', 4), '') is null
     or nullif(split_part(new.storage_path, '/', 5), '') is not null
     or position('//' in new.storage_path) > 0 then
    raise exception 'Caminho do documento não corresponde à escola, aluno e justificativa.';
  end if;

  select exists (
    select 1
    from public.escola_justificativas_falta j
    where j.id = new.justificativa_id
      and j.escola_id = new.escola_id
      and j.aluno_id = new.aluno_id
      and j.responsavel_id = new.responsavel_id
  ) into v_ok;

  if not v_ok then
    raise exception 'Metadados do documento não correspondem à justificativa.';
  end if;

  if nullif(trim(coalesce(new.nome_arquivo, '')), '') is null
     or char_length(new.nome_arquivo) > 255 then
    raise exception 'Nome de arquivo inválido.';
  end if;

  if new.mime_type is null
     or new.mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de arquivo não permitido.';
  end if;

  if new.tamanho is null or new.tamanho <= 0 or new.tamanho > 10485760 then
    raise exception 'Tamanho de arquivo inválido.';
  end if;

  if v_name !~ '\\.(pdf|jpe?g|png|webp)$'
     or v_path_name !~ '\\.(pdf|jpe?g|png|webp)$' then
    raise exception 'Extensão de arquivo não permitida.';
  end if;

  if (new.mime_type = 'application/pdf' and (v_name !~ '\\.pdf$' or v_path_name !~ '\\.pdf$'))
     or (new.mime_type = 'image/jpeg' and (v_name !~ '\\.jpe?g$' or v_path_name !~ '\\.jpe?g$'))
     or (new.mime_type = 'image/png' and (v_name !~ '\\.png$' or v_path_name !~ '\\.png$'))
     or (new.mime_type = 'image/webp' and (v_name !~ '\\.webp$' or v_path_name !~ '\\.webp$')) then
    raise exception 'Extensão do arquivo não corresponde ao tipo informado.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_justification_file() from public, anon, authenticated;

create or replace function public.escola_document_privacy_status()
returns table(
  metadata_ativos bigint,
  metadata_excluidos bigint,
  storage_total bigint,
  storage_orfaos bigint,
  metadata_sem_arquivo bigint,
  exclusoes_pendentes_storage bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, storage
as $$
begin
  if not public.escola_is_super_admin() then
    raise exception 'Acesso restrito ao ADMIN MBA ativo.';
  end if;

  return query
  select
    (select count(*) from public.escola_justificativa_arquivos f where f.excluido_em is null),
    (select count(*) from public.escola_justificativa_arquivos f where f.excluido_em is not null),
    (select count(*) from storage.objects o where o.bucket_id = 'mba-escola-documentos'),
    (select count(*) from storage.objects o where o.bucket_id = 'mba-escola-documentos' and not exists (select 1 from public.escola_justificativa_arquivos f where f.storage_path = o.name)),
    (select count(*) from public.escola_justificativa_arquivos f where f.excluido_em is null and not exists (select 1 from storage.objects o where o.bucket_id='mba-escola-documentos' and o.name=f.storage_path)),
    (select count(*) from public.escola_justificativa_arquivos f where f.excluido_em is not null and exists (select 1 from storage.objects o where o.bucket_id='mba-escola-documentos' and o.name=f.storage_path));
end;
$$;

revoke all on function public.escola_document_privacy_status() from public, anon;
grant execute on function public.escola_document_privacy_status() to authenticated;
