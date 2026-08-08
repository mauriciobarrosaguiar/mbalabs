-- DroneGestor Agro - estrutura inicial de persistência
-- Preparada para o Supabase principal do MBA Labs.

create table if not exists public.drone_empresas_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  distancia_preventiva_m numeric(10,2) not null default 90,
  bloquear_sem_insights boolean not null default true,
  exigir_confirmacao_piloto boolean not null default true,
  velocidade_padrao_kmh numeric(10,2) not null default 18,
  altura_padrao_m numeric(10,2) not null default 4,
  faixa_padrao_m numeric(10,2) not null default 7,
  volume_padrao_l_ha numeric(10,2) not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id)
);

create table if not exists public.drone_equipamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text not null,
  fabricante text,
  modelo text not null,
  capacidade_tanque_l numeric(10,2) not null,
  faixa_min_m numeric(10,2),
  faixa_max_m numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drone_protocolos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text not null,
  cultura text not null,
  alvo text not null,
  volume_l_ha numeric(10,2),
  velocidade_kmh numeric(10,2),
  altura_m numeric(10,2),
  faixa_m numeric(10,2),
  tipo_gota text,
  ordem_aplicacao text,
  observacoes text,
  obrigatorio boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drone_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid,
  equipamento_id uuid references public.drone_equipamentos(id) on delete set null,
  protocolo_id uuid references public.drone_protocolos(id) on delete set null,
  cultura text not null,
  alvo text not null,
  produto text,
  area_ha numeric(12,3) not null,
  dose_produto_l_ha numeric(12,4),
  volume_l_ha numeric(12,4) not null,
  calda_total_l numeric(14,3) not null,
  produto_total_l numeric(14,3),
  tanques_total integer,
  ultimo_tanque_l numeric(12,3),
  velocidade_kmh numeric(10,2),
  altura_m numeric(10,2),
  faixa_m numeric(10,2),
  vazao_l_min numeric(12,3),
  capacidade_ha_h numeric(12,3),
  tempo_estimado_min numeric(12,2),
  latitude numeric(10,7),
  longitude numeric(10,7),
  temperatura_c numeric(8,2),
  umidade_percent numeric(8,2),
  vento_kmh numeric(8,2),
  direcao_vento_graus numeric(8,2),
  rajada_kmh numeric(8,2),
  precipitacao_mm numeric(10,3),
  risco_deriva text,
  insights_confirmados boolean not null default false,
  status text not null default 'planejada',
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drone_aplicacoes_empresa_created_idx
  on public.drone_aplicacoes (empresa_id, created_at desc);

create index if not exists drone_protocolos_empresa_cultura_idx
  on public.drone_protocolos (empresa_id, cultura, alvo);

alter table public.drone_empresas_config enable row level security;
alter table public.drone_equipamentos enable row level security;
alter table public.drone_protocolos enable row level security;
alter table public.drone_aplicacoes enable row level security;

-- As políticas devem seguir o modelo de vínculo empresa/usuário do banco principal
-- antes da aplicação desta migration em produção.