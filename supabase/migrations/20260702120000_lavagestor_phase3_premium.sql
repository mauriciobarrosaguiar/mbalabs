alter table public.lava_configuracoes
  add column if not exists iamob_ativo boolean not null default true,
  add column if not exists iamob_provider text not null default 'regras',
  add column if not exists iamob_modo text not null default 'regras',
  add column if not exists iamob_permitir_analise_foto boolean not null default false,
  add column if not exists horario_abertura text not null default '08:00',
  add column if not exists horario_fechamento text not null default '18:00',
  add column if not exists intervalo_agenda_min integer not null default 30,
  add column if not exists permitir_agendamento_online boolean not null default false,
  add column if not exists mensagem_confirmacao_agendamento text,
  add column if not exists mensagem_lembrete_agendamento text,
  add column if not exists placa_reconhecimento_ativo boolean not null default false,
  add column if not exists placa_provider text not null default 'manual',
  add column if not exists placa_exigir_confirmacao boolean not null default true;

create table if not exists public.lava_iamob_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  veiculo_id uuid references public.lava_veiculos(id) on delete set null,
  tipo text not null,
  entrada jsonb not null default '{}'::jsonb,
  saida text,
  provider text not null default 'regras',
  status text not null default 'concluido' check (status in ('concluido', 'erro')),
  erro text,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_agendamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  veiculo_id uuid references public.lava_veiculos(id) on delete set null,
  servico_id uuid references public.lava_servicos(id) on delete set null,
  funcionario_id uuid references public.lava_funcionarios(id) on delete set null,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  titulo text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  duracao_min integer not null default 60,
  status text not null default 'agendado' check (status in ('agendado', 'confirmado', 'aguardando', 'compareceu', 'convertido', 'cancelado', 'nao_compareceu')),
  observacao text,
  origem text not null default 'manual',
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  categoria text,
  unidade text not null default 'un',
  estoque_atual numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  custo_unitario numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  produto_id uuid not null references public.lava_estoque_produtos(id) on delete cascade,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  servico_id uuid references public.lava_servicos(id) on delete set null,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida_manual', 'baixa_servico', 'ajuste', 'perda')),
  quantidade numeric(12,3) not null,
  custo_unitario numeric(12,2),
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_servico_insumos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  servico_id uuid not null references public.lava_servicos(id) on delete cascade,
  produto_id uuid not null references public.lava_estoque_produtos(id) on delete cascade,
  quantidade_por_servico numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_placa_leituras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  veiculo_id uuid references public.lava_veiculos(id) on delete set null,
  storage_path text,
  placa_detectada text,
  placa_confirmada text,
  confianca numeric(5,2),
  provider text not null default 'manual',
  status text not null default 'pendente' check (status in ('pendente', 'detectada', 'confirmada', 'erro', 'manual')),
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_pagamento_integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text not null,
  status text not null default 'inativo',
  ambiente text not null default 'sandbox',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_cobrancas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  provider text not null default 'manual',
  external_id text,
  valor numeric(12,2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'vencido', 'cancelado', 'erro')),
  metodo text,
  qr_code text,
  qr_code_payload text,
  payment_url text,
  vencimento timestamptz,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_nf_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text,
  status text not null default 'inativo',
  cidade text,
  uf text,
  inscricao_municipal text,
  cnae text,
  aliquota_iss numeric(5,2),
  ambiente text not null default 'homologacao',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  numero text,
  serie text,
  status text not null default 'rascunho' check (status in ('rascunho', 'emitida', 'cancelada', 'erro')),
  valor numeric(12,2),
  provider text,
  external_id text,
  pdf_url text,
  xml_url text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_automacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('agradecimento', 'pesquisa_satisfacao', 'lembrete_retorno', 'cobranca_fiado', 'cliente_inativo', 'promocao')),
  ativo boolean not null default true,
  canal text not null default 'whatsapp',
  gatilho text,
  atraso_dias integer not null default 0,
  mensagem text,
  regras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_automacao_fila (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  automacao_id uuid references public.lava_automacoes(id) on delete set null,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  canal text not null default 'whatsapp',
  mensagem text,
  status text not null default 'pendente' check (status in ('pendente', 'pronto', 'enviado_manual', 'cancelado', 'erro')),
  agendado_para timestamptz,
  enviado_em timestamptz,
  erro text,
  created_at timestamptz not null default now()
);

create unique index if not exists lava_servico_insumos_unique_idx
  on public.lava_servico_insumos(empresa_id, servico_id, produto_id);

create unique index if not exists lava_estoque_produtos_nome_uidx
  on public.lava_estoque_produtos(empresa_id, (lower(nome)));

create unique index if not exists lava_pagamento_integracoes_provider_uidx
  on public.lava_pagamento_integracoes(empresa_id, provider);

create unique index if not exists lava_nf_configuracoes_empresa_uidx
  on public.lava_nf_configuracoes(empresa_id);

create index if not exists lava_iamob_logs_empresa_created_idx on public.lava_iamob_logs(empresa_id, created_at desc);
create index if not exists lava_agendamentos_empresa_data_idx on public.lava_agendamentos(empresa_id, data_inicio desc);
create index if not exists lava_agendamentos_empresa_status_idx on public.lava_agendamentos(empresa_id, status, data_inicio);
create index if not exists lava_estoque_produtos_empresa_ativo_idx on public.lava_estoque_produtos(empresa_id, ativo, nome);
create index if not exists lava_estoque_movimentos_empresa_produto_idx on public.lava_estoque_movimentos(empresa_id, produto_id, created_at desc);
create index if not exists lava_placa_leituras_empresa_created_idx on public.lava_placa_leituras(empresa_id, created_at desc);
create index if not exists lava_cobrancas_empresa_status_idx on public.lava_cobrancas(empresa_id, status, created_at desc);
create index if not exists lava_notas_fiscais_empresa_status_idx on public.lava_notas_fiscais(empresa_id, status, created_at desc);
create index if not exists lava_automacoes_empresa_tipo_idx on public.lava_automacoes(empresa_id, tipo, ativo);
create index if not exists lava_automacao_fila_empresa_status_idx on public.lava_automacao_fila(empresa_id, status, agendado_para);

alter table public.lava_iamob_logs enable row level security;
alter table public.lava_agendamentos enable row level security;
alter table public.lava_estoque_produtos enable row level security;
alter table public.lava_estoque_movimentos enable row level security;
alter table public.lava_servico_insumos enable row level security;
alter table public.lava_placa_leituras enable row level security;
alter table public.lava_pagamento_integracoes enable row level security;
alter table public.lava_cobrancas enable row level security;
alter table public.lava_nf_configuracoes enable row level security;
alter table public.lava_notas_fiscais enable row level security;
alter table public.lava_automacoes enable row level security;
alter table public.lava_automacao_fila enable row level security;

grant select, insert, update, delete on table public.lava_iamob_logs to authenticated, service_role;
grant select, insert, update, delete on table public.lava_agendamentos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_estoque_produtos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_estoque_movimentos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_servico_insumos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_placa_leituras to authenticated, service_role;
grant select, insert, update, delete on table public.lava_pagamento_integracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_cobrancas to authenticated, service_role;
grant select, insert, update, delete on table public.lava_nf_configuracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_notas_fiscais to authenticated, service_role;
grant select, insert, update, delete on table public.lava_automacoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_automacao_fila to authenticated, service_role;

drop policy if exists lava_iamob_logs_company_access on public.lava_iamob_logs;
create policy lava_iamob_logs_company_access on public.lava_iamob_logs
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_agendamentos_company_access on public.lava_agendamentos;
create policy lava_agendamentos_company_access on public.lava_agendamentos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_estoque_produtos_company_access on public.lava_estoque_produtos;
create policy lava_estoque_produtos_company_access on public.lava_estoque_produtos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_estoque_movimentos_company_access on public.lava_estoque_movimentos;
create policy lava_estoque_movimentos_company_access on public.lava_estoque_movimentos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_servico_insumos_company_access on public.lava_servico_insumos;
create policy lava_servico_insumos_company_access on public.lava_servico_insumos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_placa_leituras_company_access on public.lava_placa_leituras;
create policy lava_placa_leituras_company_access on public.lava_placa_leituras
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_pagamento_integracoes_company_access on public.lava_pagamento_integracoes;
create policy lava_pagamento_integracoes_company_access on public.lava_pagamento_integracoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_cobrancas_company_access on public.lava_cobrancas;
create policy lava_cobrancas_company_access on public.lava_cobrancas
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_nf_configuracoes_company_access on public.lava_nf_configuracoes;
create policy lava_nf_configuracoes_company_access on public.lava_nf_configuracoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_notas_fiscais_company_access on public.lava_notas_fiscais;
create policy lava_notas_fiscais_company_access on public.lava_notas_fiscais
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_automacoes_company_access on public.lava_automacoes;
create policy lava_automacoes_company_access on public.lava_automacoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_automacao_fila_company_access on public.lava_automacao_fila;
create policy lava_automacao_fila_company_access on public.lava_automacao_fila
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_agendamentos_updated_at on public.lava_agendamentos;
create trigger set_lava_agendamentos_updated_at before update on public.lava_agendamentos
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_estoque_produtos_updated_at on public.lava_estoque_produtos;
create trigger set_lava_estoque_produtos_updated_at before update on public.lava_estoque_produtos
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_placa_leituras_updated_at on public.lava_placa_leituras;
create trigger set_lava_placa_leituras_updated_at before update on public.lava_placa_leituras
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_pagamento_integracoes_updated_at on public.lava_pagamento_integracoes;
create trigger set_lava_pagamento_integracoes_updated_at before update on public.lava_pagamento_integracoes
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_cobrancas_updated_at on public.lava_cobrancas;
create trigger set_lava_cobrancas_updated_at before update on public.lava_cobrancas
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_nf_configuracoes_updated_at on public.lava_nf_configuracoes;
create trigger set_lava_nf_configuracoes_updated_at before update on public.lava_nf_configuracoes
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_notas_fiscais_updated_at on public.lava_notas_fiscais;
create trigger set_lava_notas_fiscais_updated_at before update on public.lava_notas_fiscais
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_automacoes_updated_at on public.lava_automacoes;
create trigger set_lava_automacoes_updated_at before update on public.lava_automacoes
  for each row execute function public.set_updated_at();
