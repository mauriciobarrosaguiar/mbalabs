alter table public.lava_whatsapp_integracoes
  add column if not exists numero text,
  add column if not exists nome_exibicao text,
  add column if not exists instancia_id text,
  add column if not exists phone_number_id text,
  add column if not exists business_account_id text,
  add column if not exists access_token_encrypted text,
  add column if not exists api_url text,
  add column if not exists api_key_encrypted text,
  add column if not exists webhook_secret_encrypted text,
  add column if not exists modo_envio text not null default 'manual',
  add column if not exists exigir_aprovacao boolean not null default true,
  add column if not exists enviar_agendamento_auto boolean not null default false,
  add column if not exists enviar_lembrete_auto boolean not null default false,
  add column if not exists enviar_veiculo_recebido_auto boolean not null default false,
  add column if not exists enviar_checklist_auto boolean not null default false,
  add column if not exists enviar_veiculo_pronto_auto boolean not null default false,
  add column if not exists enviar_pagamento_auto boolean not null default false,
  add column if not exists enviar_pos_venda_auto boolean not null default false,
  add column if not exists enviar_cobranca_auto boolean not null default false,
  add column if not exists enviar_promocao_auto boolean not null default false,
  add column if not exists usar_ia_para_mensagens boolean not null default false,
  add column if not exists horario_envio_inicio time not null default '08:00',
  add column if not exists horario_envio_fim time not null default '18:00',
  add column if not exists limite_mensagens_cliente_dia integer not null default 5,
  add column if not exists limite_tentativas integer not null default 3,
  add column if not exists ultimo_teste_em timestamptz,
  add column if not exists ultimo_erro text;

alter table public.lava_whatsapp_envios
  add column if not exists cliente_id uuid references public.lava_clientes(id) on delete set null,
  add column if not exists lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  add column if not exists agendamento_id uuid references public.lava_agendamentos(id) on delete set null,
  add column if not exists automacao_id uuid references public.lava_automacoes(id) on delete set null,
  add column if not exists usuario_id uuid references public.core_usuarios(id) on delete set null,
  add column if not exists evento text,
  add column if not exists mensagem_gerada_por text not null default 'modelo',
  add column if not exists provider text not null default 'manual',
  add column if not exists precisa_aprovacao boolean not null default true,
  add column if not exists aprovado_por uuid references public.core_usuarios(id) on delete set null,
  add column if not exists aprovado_em timestamptz,
  add column if not exists external_id text,
  add column if not exists resposta_provider jsonb not null default '{}'::jsonb,
  add column if not exists erro text,
  add column if not exists tentativas integer not null default 0,
  add column if not exists agendado_para timestamptz,
  add column if not exists enviado_em timestamptz,
  add column if not exists template_name text,
  add column if not exists template_language text,
  add column if not exists template_params jsonb not null default '{}'::jsonb;

create table if not exists public.lava_whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  evento text not null,
  nome text not null,
  mensagem text not null,
  ativo boolean not null default true,
  usar_ia boolean not null default false,
  envio_automatico boolean not null default false,
  exige_aprovacao boolean not null default true,
  horario_min time,
  horario_max time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.lava_whatsapp_integracoes
    drop constraint if exists lava_whatsapp_integracoes_provider_check;
  alter table public.lava_whatsapp_integracoes
    add constraint lava_whatsapp_integracoes_provider_check
    check (provider in ('manual', 'evolution', 'whatsapp_cloud_api'));

  alter table public.lava_whatsapp_integracoes
    drop constraint if exists lava_whatsapp_integracoes_status_check;
  alter table public.lava_whatsapp_integracoes
    add constraint lava_whatsapp_integracoes_status_check
    check (status in ('inativo', 'conectado', 'erro'));

  alter table public.lava_whatsapp_integracoes
    drop constraint if exists lava_whatsapp_integracoes_modo_envio_check;
  alter table public.lava_whatsapp_integracoes
    add constraint lava_whatsapp_integracoes_modo_envio_check
    check (modo_envio in ('manual', 'automatico_com_aprovacao', 'automatico_total'));

  alter table public.lava_whatsapp_envios
    drop constraint if exists lava_whatsapp_envios_status_check;
  alter table public.lava_whatsapp_envios
    add constraint lava_whatsapp_envios_status_check
    check (status in (
      'rascunho',
      'pendente',
      'pronto',
      'aguardando_aprovacao',
      'aprovado',
      'enviando',
      'enviado',
      'enviado_manual',
      'erro',
      'cancelado'
    ));

  alter table public.lava_whatsapp_envios
    drop constraint if exists lava_whatsapp_envios_provider_check;
  alter table public.lava_whatsapp_envios
    add constraint lava_whatsapp_envios_provider_check
    check (provider in ('manual', 'evolution', 'whatsapp_cloud_api'));

  alter table public.lava_whatsapp_envios
    drop constraint if exists lava_whatsapp_envios_mensagem_gerada_por_check;
  alter table public.lava_whatsapp_envios
    add constraint lava_whatsapp_envios_mensagem_gerada_por_check
    check (mensagem_gerada_por in ('modelo', 'ia', 'manual'));

  alter table public.lava_whatsapp_templates
    drop constraint if exists lava_whatsapp_templates_evento_check;
  alter table public.lava_whatsapp_templates
    add constraint lava_whatsapp_templates_evento_check
    check (evento in (
      'confirmacao_agendamento',
      'lembrete_agendamento',
      'lavagem_recebida',
      'checklist_concluido',
      'veiculo_pronto',
      'pagamento_recebido',
      'pos_venda',
      'cobranca_fiado',
      'cliente_sem_retorno',
      'promocao'
    ));
end $$;

drop index if exists public.lava_whatsapp_envios_agendamento_uidx;

create unique index if not exists lava_whatsapp_integracoes_empresa_provider_uidx
  on public.lava_whatsapp_integracoes(empresa_id, provider);

create unique index if not exists lava_whatsapp_templates_empresa_evento_uidx
  on public.lava_whatsapp_templates(empresa_id, evento);

create unique index if not exists lava_whatsapp_envios_evento_target_uidx
  on public.lava_whatsapp_envios(
    empresa_id,
    coalesce(evento, 'manual'),
    coalesce(lavagem_id::text, ''),
    coalesce(agendamento_id::text, ''),
    coalesce(automacao_id::text, ''),
    coalesce(cliente_id::text, '')
  )
  where status <> 'cancelado';

create index if not exists lava_whatsapp_envios_empresa_status_idx
  on public.lava_whatsapp_envios(empresa_id, status, created_at desc);

create index if not exists lava_whatsapp_envios_evento_idx
  on public.lava_whatsapp_envios(empresa_id, evento, status, agendado_para);

create index if not exists lava_whatsapp_envios_cliente_dia_idx
  on public.lava_whatsapp_envios(empresa_id, cliente_id, created_at desc)
  where cliente_id is not null;

alter table public.lava_whatsapp_integracoes enable row level security;
alter table public.lava_whatsapp_envios enable row level security;
alter table public.lava_whatsapp_templates enable row level security;

grant select, insert, update, delete on table public.lava_whatsapp_integracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_whatsapp_envios to authenticated, service_role;
grant select, insert, update, delete on table public.lava_whatsapp_templates to authenticated, service_role;

drop policy if exists lava_whatsapp_integracoes_company_access on public.lava_whatsapp_integracoes;
drop policy if exists lava_whatsapp_integracoes_select on public.lava_whatsapp_integracoes;
create policy lava_whatsapp_integracoes_select on public.lava_whatsapp_integracoes
  for select to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_whatsapp_integracoes_manage on public.lava_whatsapp_integracoes;
create policy lava_whatsapp_integracoes_manage on public.lava_whatsapp_integracoes
  for all to authenticated
  using (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
      and public.current_usuario_tipo() = 'admin_empresa'
    )
  )
  with check (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
      and public.current_usuario_tipo() = 'admin_empresa'
    )
  );

drop policy if exists lava_whatsapp_envios_company_access on public.lava_whatsapp_envios;
create policy lava_whatsapp_envios_company_access on public.lava_whatsapp_envios
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_whatsapp_templates_company_access on public.lava_whatsapp_templates;
create policy lava_whatsapp_templates_company_access on public.lava_whatsapp_templates
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_whatsapp_integracoes_updated_at on public.lava_whatsapp_integracoes;
create trigger set_lava_whatsapp_integracoes_updated_at before update on public.lava_whatsapp_integracoes
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_whatsapp_envios_updated_at on public.lava_whatsapp_envios;
create trigger set_lava_whatsapp_envios_updated_at before update on public.lava_whatsapp_envios
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_whatsapp_templates_updated_at on public.lava_whatsapp_templates;
create trigger set_lava_whatsapp_templates_updated_at before update on public.lava_whatsapp_templates
  for each row execute function public.set_updated_at();
