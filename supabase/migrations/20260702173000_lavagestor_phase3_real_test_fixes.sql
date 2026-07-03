alter table public.lava_agendamentos
  add column if not exists adicional_texto text,
  add column if not exists confirmacao_status text not null default 'pendente',
  add column if not exists confirmacao_enviada_em timestamptz,
  add column if not exists confirmacao_erro text;

alter table public.lava_estoque_produtos
  add column if not exists unidade_base text not null default 'un';

update public.lava_estoque_produtos
set unidade_base = coalesce(nullif(unidade_base, ''), nullif(unidade, ''), 'un')
where unidade_base is null or unidade_base = '';

alter table public.lava_estoque_movimentos
  add column if not exists unidade_movimento text not null default 'un',
  add column if not exists custo_total numeric(12,2);

alter table public.lava_servico_insumos
  add column if not exists unidade text not null default 'un';

update public.lava_servico_insumos i
set unidade = coalesce(nullif(i.unidade, ''), nullif(p.unidade_base, ''), nullif(p.unidade, ''), 'un')
from public.lava_estoque_produtos p
where p.id = i.produto_id
  and (i.unidade is null or i.unidade = '');

alter table public.lava_automacao_fila
  add column if not exists agendamento_id uuid references public.lava_agendamentos(id) on delete set null,
  add column if not exists tipo text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.lava_funcionarios
  add column if not exists core_usuario_id uuid references public.core_usuarios(id) on delete set null;

create unique index if not exists lava_funcionarios_core_usuario_uidx
  on public.lava_funcionarios(core_usuario_id)
  where core_usuario_id is not null;

create table if not exists public.lava_whatsapp_integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text not null default 'manual',
  status text not null default 'inativo',
  numero text,
  instancia_id text,
  config jsonb not null default '{}'::jsonb,
  ultimo_erro text,
  ultimo_teste_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  agendamento_id uuid references public.lava_agendamentos(id) on delete set null,
  automacao_id uuid references public.lava_automacoes(id) on delete set null,
  automacao_fila_id uuid references public.lava_automacao_fila(id) on delete set null,
  telefone text,
  mensagem text not null,
  provider text not null default 'manual',
  status text not null default 'pendente' check (status in ('pendente', 'pronto', 'enviado_manual', 'cancelado', 'erro')),
  external_id text,
  erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lava_whatsapp_integracoes_empresa_provider_uidx
  on public.lava_whatsapp_integracoes(empresa_id, provider);

create unique index if not exists lava_whatsapp_envios_agendamento_uidx
  on public.lava_whatsapp_envios(empresa_id, agendamento_id)
  where agendamento_id is not null and status <> 'cancelado';

create index if not exists lava_whatsapp_envios_empresa_status_idx
  on public.lava_whatsapp_envios(empresa_id, status, created_at desc);

create index if not exists lava_whatsapp_envios_fila_idx
  on public.lava_whatsapp_envios(empresa_id, automacao_fila_id)
  where automacao_fila_id is not null;

create unique index if not exists lava_automacao_fila_agendamento_confirmacao_uidx
  on public.lava_automacao_fila(empresa_id, agendamento_id)
  where agendamento_id is not null and coalesce(tipo, '') = 'confirmacao_agendamento' and status <> 'cancelado';

create index if not exists lava_automacao_fila_agendamento_idx
  on public.lava_automacao_fila(empresa_id, agendamento_id);

alter table public.lava_whatsapp_integracoes enable row level security;
alter table public.lava_whatsapp_envios enable row level security;

grant select, insert, update, delete on table public.lava_whatsapp_integracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_whatsapp_envios to authenticated, service_role;

drop policy if exists lava_whatsapp_integracoes_company_access on public.lava_whatsapp_integracoes;
create policy lava_whatsapp_integracoes_company_access on public.lava_whatsapp_integracoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_whatsapp_envios_company_access on public.lava_whatsapp_envios;
create policy lava_whatsapp_envios_company_access on public.lava_whatsapp_envios
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_automacao_fila_updated_at on public.lava_automacao_fila;
create trigger set_lava_automacao_fila_updated_at before update on public.lava_automacao_fila
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_whatsapp_integracoes_updated_at on public.lava_whatsapp_integracoes;
create trigger set_lava_whatsapp_integracoes_updated_at before update on public.lava_whatsapp_integracoes
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_whatsapp_envios_updated_at on public.lava_whatsapp_envios;
create trigger set_lava_whatsapp_envios_updated_at before update on public.lava_whatsapp_envios
  for each row execute function public.set_updated_at();
