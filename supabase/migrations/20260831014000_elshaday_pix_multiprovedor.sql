-- Elshaday Gestão: arquitetura PIX multi-provedor.

alter table public.igreja_pix_configuracoes
  drop constraint if exists igreja_pix_configuracoes_provider_check,
  add constraint igreja_pix_configuracoes_provider_check
    check (provider in ('asaas','mercado_pago','pagbank','efi','inter'));

alter table public.igreja_pix_pagadores
  drop constraint if exists igreja_pix_pagadores_provider_check,
  add constraint igreja_pix_pagadores_provider_check
    check (provider in ('asaas','mercado_pago','pagbank','efi','inter'));

alter table public.igreja_pix_cobrancas
  drop constraint if exists igreja_pix_cobrancas_provider_check,
  add constraint igreja_pix_cobrancas_provider_check
    check (provider in ('asaas','mercado_pago','pagbank','efi','inter'));

alter table public.igreja_pix_configuracoes
  add column if not exists principal boolean not null default false,
  add column if not exists apelido text,
  add column if not exists config_publica jsonb not null default '{}'::jsonb,
  add column if not exists ultimo_teste_em timestamptz,
  add column if not exists ultimo_teste_status text
    check (ultimo_teste_status is null or ultimo_teste_status in ('ok','erro','pendente')),
  add column if not exists ultimo_teste_mensagem text;

alter table public.igreja_pix_configuracoes
  drop constraint if exists igreja_pix_configuracoes_igreja_id_key;

drop index if exists public.igreja_pix_configuracoes_igreja_id_key;

create unique index if not exists igreja_pix_configuracoes_igreja_provider_uidx
  on public.igreja_pix_configuracoes(igreja_id, provider);

create unique index if not exists igreja_pix_configuracoes_principal_uidx
  on public.igreja_pix_configuracoes(igreja_id)
  where principal = true;

update public.igreja_pix_configuracoes
set principal = true
where provider = 'asaas'
  and not exists (
    select 1
    from public.igreja_pix_configuracoes x
    where x.igreja_id = igreja_pix_configuracoes.igreja_id
      and x.principal = true
  );

create index if not exists igreja_pix_configuracoes_igreja_ativo_idx
  on public.igreja_pix_configuracoes(igreja_id, ativo, provider);

comment on column public.igreja_pix_configuracoes.principal is
  'Define o provedor usado por padrão para novos PIX da igreja.';

comment on column public.igreja_pix_configuracoes.config_publica is
  'Metadados não secretos específicos do provedor. Segredos permanecem fora do banco, em ambiente seguro.';
