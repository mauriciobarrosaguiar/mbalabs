-- MBA Escola: fixa search_path de todas as funções SECURITY DEFINER do domínio escolar.
-- Evita resolução de objetos por um schema mutável.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'escola_%'
      and p.prosecdef
  loop
    execute format('alter function %s set search_path = pg_catalog, public', r.fn);
  end loop;
end
$$;
