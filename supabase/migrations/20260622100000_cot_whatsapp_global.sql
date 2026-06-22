create extension if not exists pgcrypto;

create table if not exists public.cot_whatsapp_global_config (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'evolution_api',
  api_url text,
  api_token text,
  phone_number_id text,
  numero_oficial text,
  nome_exibicao text not null default 'MBA Cotações',
  status_conexao text not null default 'nao_configurado',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cot_whatsapp_global_config_provider_check check (
    provider in ('evolution_api', 'zapi', 'meta_cloud_api', 'outro')
  )
);

create table if not exists public.cot_whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  cotacao_id uuid not null,
  vendedor_id uuid not null,
  telefone text,
  tipo_envio text not null,
  mensagem text,
  link_enviado text,
  status text not null default 'pendente',
  erro text,
  enviado_por text not null default 'mba_cotacoes',
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint cot_whatsapp_envios_tipo_envio_check check (
    tipo_envio in ('link_cotacao', 'resultado_cotacao')
  ),
  constraint cot_whatsapp_envios_status_check check (
    status in ('pendente', 'enviado', 'falhou')
  )
);

create unique index if not exists cot_whatsapp_envios_unico
  on public.cot_whatsapp_envios (empresa_id, cotacao_id, vendedor_id, tipo_envio);

create index if not exists cot_whatsapp_envios_cotacao_idx
  on public.cot_whatsapp_envios (cotacao_id, tipo_envio, status);

create index if not exists cot_whatsapp_envios_empresa_idx
  on public.cot_whatsapp_envios (empresa_id, created_at desc);

alter table public.cot_whatsapp_global_config enable row level security;
alter table public.cot_whatsapp_envios enable row level security;

comment on table public.cot_whatsapp_global_config is 'Configuração global do WhatsApp oficial do MBA Cotações, acessada somente pelo backend/Admin Master.';
comment on table public.cot_whatsapp_envios is 'Histórico multiempresa de envios automáticos de WhatsApp do MBA Cotações.';
