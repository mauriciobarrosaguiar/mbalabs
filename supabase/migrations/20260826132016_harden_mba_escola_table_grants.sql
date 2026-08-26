-- Remove privilégios de tabela que ignoram ou ampliam desnecessariamente a superfície do RLS.
-- TRUNCATE não é protegido por RLS; TRIGGER e REFERENCES não são necessários para clientes.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'escola\_%' escape '\'
  loop
    execute format(
      'revoke truncate, trigger, references on table %I.%I from anon, authenticated',
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

-- Evita que novas tabelas escolares criadas por migrations recuperem esses privilégios.
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
