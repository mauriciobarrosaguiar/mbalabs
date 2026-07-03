alter table if exists public.core_empresa_apps
  add column if not exists cotacoes_tipo_acesso text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'core_empresa_apps_cotacoes_tipo_acesso_check'
  ) then
    alter table public.core_empresa_apps
      add constraint core_empresa_apps_cotacoes_tipo_acesso_check
      check (
        cotacoes_tipo_acesso is null
        or cotacoes_tipo_acesso in ('pharmacy', 'distributor_bidding', 'both')
      );
  end if;
end $$;

update public.core_empresa_apps ea
set cotacoes_tipo_acesso = 'both'
from public.core_apps a
where ea.app_id = a.id
  and a.slug in ('mba-cotacoes', 'mbacotacoes')
  and ea.cotacoes_tipo_acesso is null;

update public.tenants t
set tipo_cliente = ea.cotacoes_tipo_acesso
from public.core_empresa_apps ea
join public.core_apps a on a.id = ea.app_id
where t.core_empresa_id = ea.empresa_id
  and a.slug in ('mba-cotacoes', 'mbacotacoes')
  and ea.status <> 'cancelado'
  and ea.cotacoes_tipo_acesso in ('pharmacy', 'distributor_bidding', 'both');

alter table if exists public.cot_whatsapp_global_config
  add column if not exists last_health_check timestamptz,
  add column if not exists last_error text;

comment on column public.core_empresa_apps.cotacoes_tipo_acesso
  is 'Escopo contratado do MBA Cotacoes: pharmacy, distributor_bidding ou both.';

comment on column public.cot_whatsapp_global_config.last_health_check
  is 'Ultima consulta de health check da instancia WhatsApp.';

comment on column public.cot_whatsapp_global_config.last_error
  is 'Ultimo erro observado no health check ou envio WhatsApp.';
