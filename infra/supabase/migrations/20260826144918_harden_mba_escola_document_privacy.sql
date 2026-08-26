-- MBA Escola: endurecimento de documentos, retenção segura e LGPD.

alter table public.escola_justificativa_arquivos
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_exclusao text;

create unique index if not exists escola_justificativa_arquivos_storage_path_uidx
  on public.escola_justificativa_arquivos(storage_path);

create table if not exists public.escola_documento_politicas (
  escola_id uuid primary key references public.escola_escolas(id) on delete cascade,
  retencao_dias integer null check (retencao_dias is null or retencao_dias between 30 and 3650),
  exclusao_automatica boolean not null default false,
  orfao_grace_horas integer not null default 24 check (orfao_grace_horas between 1 and 168),
  atualizado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

alter table public.escola_documento_politicas enable row level security;

drop policy if exists escola_documento_politicas_select on public.escola_documento_politicas;
create policy escola_documento_politicas_select
on public.escola_documento_politicas for select to authenticated
using (public.escola_is_super_admin() or public.escola_can_admin_school(escola_id));

drop policy if exists escola_documento_politicas_admin_write on public.escola_documento_politicas;
create policy escola_documento_politicas_admin_write
on public.escola_documento_politicas for all to authenticated
using (public.escola_is_super_admin() or public.escola_can_admin_school(escola_id))
with check (public.escola_is_super_admin() or public.escola_can_admin_school(escola_id));

revoke truncate, trigger, references on public.escola_documento_politicas from authenticated;
revoke all on public.escola_documento_politicas from anon;
grant select, insert, update on public.escola_documento_politicas to authenticated;

create or replace function public.escola_validate_justification_file()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ok boolean;
begin
  if new.excluido_em is not null and tg_op = 'INSERT' then
    raise exception 'Documento novo não pode nascer excluído.';
  end if;

  if public.escola_try_uuid(split_part(new.storage_path, '/', 1)) is distinct from new.escola_id
     or public.escola_try_uuid(split_part(new.storage_path, '/', 2)) is distinct from new.aluno_id
     or public.escola_try_uuid(split_part(new.storage_path, '/', 3)) is distinct from new.justificativa_id
     or nullif(split_part(new.storage_path, '/', 4), '') is null
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

  if new.mime_type is not null and new.mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de arquivo não permitido.';
  end if;

  if new.tamanho is not null and (new.tamanho < 0 or new.tamanho > 10485760) then
    raise exception 'Tamanho de arquivo inválido.';
  end if;

  if char_length(new.nome_arquivo) > 255 then
    raise exception 'Nome do arquivo excede 255 caracteres.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_justification_file() from public, anon, authenticated;

drop trigger if exists trg_escola_validate_justification_file on public.escola_justificativa_arquivos;
create trigger trg_escola_validate_justification_file
before insert or update of escola_id, justificativa_id, aluno_id, responsavel_id, storage_path, nome_arquivo, mime_type, tamanho
on public.escola_justificativa_arquivos
for each row execute function public.escola_validate_justification_file();

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
      nullif(split_part(p_path, '/', 4), '') as arquivo
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
      and j.escola_id = p.escola_id
      and j.aluno_id = p.aluno_id
      and j.responsavel_id = auth.uid()
      and j.status in ('pendente','correcao_solicitada','recusada')
  );
$$;

create or replace function public.escola_document_read_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.escola_is_super_admin()
  or exists (
    select 1
    from public.escola_justificativa_arquivos f
    where f.storage_path = p_path
      and f.excluido_em is null
      and (
        public.escola_can_manage_school(f.escola_id)
        or (
          f.responsavel_id = auth.uid()
          and exists (
            select 1
            from public.escola_aluno_responsaveis ar
            where ar.escola_id = f.escola_id
              and ar.aluno_id = f.aluno_id
              and ar.responsavel_id = auth.uid()
          )
        )
      )
  );
$$;

revoke all on function public.escola_document_upload_allowed(text) from public, anon;
revoke all on function public.escola_document_read_allowed(text) from public, anon;
grant execute on function public.escola_document_upload_allowed(text) to authenticated;
grant execute on function public.escola_document_read_allowed(text) to authenticated;

drop policy if exists escola_justarquivo_self_write on public.escola_justificativa_arquivos;
drop policy if exists escola_justarquivo_select on public.escola_justificativa_arquivos;
drop policy if exists escola_justarquivo_self_insert on public.escola_justificativa_arquivos;

create policy escola_justarquivo_select
on public.escola_justificativa_arquivos for select to authenticated
using (
  excluido_em is null
  and (
    public.escola_can_manage_school(escola_id)
    or (
      responsavel_id = auth.uid()
      and exists (
        select 1 from public.escola_aluno_responsaveis ar
        where ar.escola_id = escola_justificativa_arquivos.escola_id
          and ar.aluno_id = escola_justificativa_arquivos.aluno_id
          and ar.responsavel_id = auth.uid()
      )
    )
  )
);

create policy escola_justarquivo_self_insert
on public.escola_justificativa_arquivos for insert to authenticated
with check (
  responsavel_id = auth.uid()
  and excluido_em is null
  and public.escola_document_upload_allowed(storage_path)
);

drop policy if exists mba_escola_documentos_select on storage.objects;
drop policy if exists mba_escola_documentos_insert on storage.objects;
drop policy if exists mba_escola_documentos_update on storage.objects;
drop policy if exists mba_escola_documentos_delete on storage.objects;

create policy mba_escola_documentos_select
on storage.objects for select to authenticated
using (
  bucket_id = 'mba-escola-documentos'
  and public.escola_document_read_allowed(name)
);

create policy mba_escola_documentos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mba-escola-documentos'
  and public.escola_document_upload_allowed(name)
);

create policy mba_escola_documentos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'mba-escola-documentos'
  and owner = auth.uid()
  and public.escola_document_upload_allowed(name)
  and (
    not exists (
      select 1 from public.escola_justificativa_arquivos f where f.storage_path = name
    )
    or exists (
      select 1 from public.escola_justificativa_arquivos f
      where f.storage_path = name and f.responsavel_id = auth.uid() and f.excluido_em is null
    )
  )
);

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
    raise exception 'Acesso restrito ao ADMIN MBA com MFA.';
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
