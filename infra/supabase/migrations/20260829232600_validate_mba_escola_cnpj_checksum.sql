-- MBA Escola: valida CNPJ completo (dígitos verificadores), além da normalização.

create or replace function public.escola_cnpj_valido(p_cnpj text)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  v text := regexp_replace(p_cnpj, '\D', '', 'g');
  s integer;
  r integer;
  d1 integer;
  d2 integer;
begin
  if length(v) <> 14 then return false; end if;
  if v ~ '^(\d)\1{13}$' then return false; end if;

  s :=
    substr(v,1,1)::int * 5 +
    substr(v,2,1)::int * 4 +
    substr(v,3,1)::int * 3 +
    substr(v,4,1)::int * 2 +
    substr(v,5,1)::int * 9 +
    substr(v,6,1)::int * 8 +
    substr(v,7,1)::int * 7 +
    substr(v,8,1)::int * 6 +
    substr(v,9,1)::int * 5 +
    substr(v,10,1)::int * 4 +
    substr(v,11,1)::int * 3 +
    substr(v,12,1)::int * 2;
  r := s % 11;
  d1 := case when r < 2 then 0 else 11-r end;

  s :=
    substr(v,1,1)::int * 6 +
    substr(v,2,1)::int * 5 +
    substr(v,3,1)::int * 4 +
    substr(v,4,1)::int * 3 +
    substr(v,5,1)::int * 2 +
    substr(v,6,1)::int * 9 +
    substr(v,7,1)::int * 8 +
    substr(v,8,1)::int * 7 +
    substr(v,9,1)::int * 6 +
    substr(v,10,1)::int * 5 +
    substr(v,11,1)::int * 4 +
    substr(v,12,1)::int * 3 +
    d1 * 2;
  r := s % 11;
  d2 := case when r < 2 then 0 else 11-r end;

  return substr(v,13,1)::int = d1 and substr(v,14,1)::int = d2;
end;
$$;

revoke all on function public.escola_cnpj_valido(text) from public, anon, authenticated;

create or replace function public.escola_normalize_cnpj_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cnpj is not null then
    new.cnpj := nullif(regexp_replace(new.cnpj, '\D', '', 'g'), '');
  end if;

  if new.cnpj is not null and not public.escola_cnpj_valido(new.cnpj) then
    raise exception 'CNPJ inválido';
  end if;

  return new;
end;
$$;

alter table public.escola_escolas
  drop constraint if exists escola_escolas_cnpj_valido_chk;

alter table public.escola_escolas
  add constraint escola_escolas_cnpj_valido_chk
  check (cnpj is null or public.escola_cnpj_valido(cnpj));
