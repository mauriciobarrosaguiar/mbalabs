-- Documentos registrados são imutáveis no cliente. Exclusão física só via fluxo administrativo seguro/service role.

drop policy if exists mba_escola_documentos_delete on storage.objects;
create policy mba_escola_documentos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'mba-escola-documentos'
  and owner = auth.uid()
  and public.escola_document_upload_allowed(name)
  and not exists (
    select 1
    from public.escola_justificativa_arquivos f
    where f.storage_path = name
  )
);

-- ADMIN MBA pode consultar metadados, mas não apagar/editar diretamente pela API cliente.
drop policy if exists escola_super_admin_all on public.escola_justificativa_arquivos;
drop policy if exists escola_justarquivo_super_admin_select on public.escola_justificativa_arquivos;
create policy escola_justarquivo_super_admin_select
on public.escola_justificativa_arquivos for select to authenticated
using (public.escola_is_super_admin());
