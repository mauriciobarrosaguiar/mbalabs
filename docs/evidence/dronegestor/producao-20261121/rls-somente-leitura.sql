-- Somente leitura; não altera políticas, perfis ou permissões.
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'core_logs';

select c.relrowsecurity, c.relforcerowsecurity,
  has_table_privilege('authenticated','public.core_logs','SELECT') as authenticated_select,
  has_table_privilege('authenticated','public.core_logs','INSERT') as authenticated_insert
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='core_logs';
