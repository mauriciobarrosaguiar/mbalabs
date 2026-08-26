-- Garante que CNPJs digitados com ou sem pontuação sejam tratados como o mesmo documento.
-- Ex.: 12.345.678/0001-90 e 12345678000190 ficam armazenados como 12345678000190.

update public.escola_escolas
set cnpj = nullif(regexp_replace(cnpj, '\D', '', 'g'), '')
where cnpj is not null;

create or replace function public.escola_normalize_cnpj_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.cnpj is not null then
    new.cnpj := nullif(regexp_replace(new.cnpj, '\D', '', 'g'), '');
  end if;

  if new.cnpj is not null and length(new.cnpj) <> 14 then
    raise exception 'CNPJ deve conter 14 dígitos';
  end if;

  return new;
end;
$$;

revoke execute on function public.escola_normalize_cnpj_before_write() from public, anon, authenticated;

drop trigger if exists escola_escolas_normalize_cnpj_trg on public.escola_escolas;
create trigger escola_escolas_normalize_cnpj_trg
before insert or update of cnpj on public.escola_escolas
for each row
execute function public.escola_normalize_cnpj_before_write();

-- Mantém a proteção contra duplicidade considerando apenas os dígitos.
drop index if exists public.escola_escolas_cnpj_unique;
create unique index escola_escolas_cnpj_unique
  on public.escola_escolas ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null and btrim(cnpj) <> '';
