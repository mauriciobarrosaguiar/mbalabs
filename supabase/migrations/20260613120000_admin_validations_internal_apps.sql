create or replace function public.only_digits(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '');
$$;

update public.core_apps
set
  url_path = case
    when slug in ('mba-cotacoes', 'mbacotacoes') then '/apps/mbacotacoes'
    when slug = 'lavagestor' then '/apps/lavagestor'
    else url_path
  end,
  url_interna = case
    when slug in ('mba-cotacoes', 'mbacotacoes') then '/apps/mbacotacoes'
    when slug = 'lavagestor' then '/apps/lavagestor'
    else coalesce(url_interna, url_path)
  end,
  url_externa = null,
  updated_at = now()
where slug in ('mba-cotacoes', 'mbacotacoes', 'lavagestor');

create or replace function public.validate_core_empresa_cnpj_unique()
returns trigger
language plpgsql
as $$
begin
  new.cnpj := public.only_digits(new.cnpj);

  if new.cnpj is not null and exists (
    select 1
    from public.core_empresas e
    where public.only_digits(e.cnpj) = new.cnpj
      and e.id is distinct from new.id
  ) then
    raise exception 'Ja existe empresa cadastrada com este CNPJ.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_core_empresa_cnpj_unique_trigger on public.core_empresas;
create trigger validate_core_empresa_cnpj_unique_trigger
before insert or update of cnpj on public.core_empresas
for each row execute function public.validate_core_empresa_cnpj_unique();

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_core_empresas_cnpj_digits'
  )
  and not exists (
    select 1
    from (
      select public.only_digits(cnpj) as cnpj_key
      from public.core_empresas
      where public.only_digits(cnpj) is not null
      group by public.only_digits(cnpj)
      having count(*) > 1
    ) duplicated
  ) then
    create unique index ux_core_empresas_cnpj_digits
      on public.core_empresas (public.only_digits(cnpj))
      where public.only_digits(cnpj) is not null;
  end if;
end;
$$;

create or replace function public.validate_core_plan_matches_app()
returns trigger
language plpgsql
as $$
begin
  if new.plano_id is not null and not exists (
    select 1
    from public.core_planos p
    where p.id = new.plano_id
      and p.app_id = new.app_id
  ) then
    raise exception 'O plano selecionado nao pertence ao app escolhido.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_core_empresa_apps_plan_trigger on public.core_empresa_apps;
create trigger validate_core_empresa_apps_plan_trigger
before insert or update of app_id, plano_id on public.core_empresa_apps
for each row execute function public.validate_core_plan_matches_app();

drop trigger if exists validate_core_assinaturas_plan_trigger on public.core_assinaturas;
create trigger validate_core_assinaturas_plan_trigger
before insert or update of app_id, plano_id on public.core_assinaturas
for each row execute function public.validate_core_plan_matches_app();
