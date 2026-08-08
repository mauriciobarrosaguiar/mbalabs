-- DroneGestor Agro - estrutura de persistência V2
-- ATENÇÃO: preparada para o Supabase principal do MBA Labs, mas não deve ser aplicada
-- até as políticas RLS serem adaptadas ao vínculo real core_empresas/core_usuarios.

create table if not exists public.drone_empresas_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  distancia_preventiva_m numeric(10,2) not null default 90,
  bloquear_sem_insights boolean not null default true,
  exigir_confirmacao_piloto boolean not null default true,
  protocolo_bordadura_cigarrinha boolean not null default false,
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
  capacidade_tanque_l numeric(10,2),
  vazao_max_l_min numeric(10,2),
  faixa_min_m numeric(10,2),
  faixa_max_m numeric(10,2),
  velocidade_min_kmh numeric(10,2),
  velocidade_max_kmh numeric(10,2),
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
  produto_referencia text,
  tipo_gota text,
  faixa_m numeric(10,2),
  velocidade_kmh numeric(10,2),
  altura_m numeric(10,2),
  volume_l_ha numeric(10,2),
  ordem_aplicacao text,
  observacoes text,
  fonte_tecnica text,
  versao text,
  aprovado_por text,
  aprovado_em date,
  obrigatorio boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drone_regras_regulatorias (
  id uuid primary key default gen_random_uuid(),
  uf char(2) not null,
  tipo_operacao text,
  titulo text not null,
  descricao text not null,
  distancia_minima_m numeric(10,2),
  fonte_url text not null,
  fonte_orgao text not null,
  vigente_desde date,
  vigente_ate date,
  versao text,
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
  area_ha numeric(12,3) not null,
  volume_l_ha numeric(12,4) not null,
  capacidade_tanque_l numeric(12,3),
  produtos jsonb not null default '[]'::jsonb,
  calda_total_l numeric(14,3),
  tanques_total integer,
  ultimo_tanque_l numeric(12,3),
  velocidade_kmh numeric(10,2),
  altura_m numeric(10,2),
  faixa_m numeric(10,2),
  vazao_l_min numeric(12,3),
  capacidade_teorica_ha_h numeric(12,3),
  tempo_pulverizacao_min numeric(12,2),
  tempo_abastecimento_min numeric(10,2),
  tempo_troca_bateria_min numeric(10,2),
  tanques_por_bateria numeric(10,2),
  tempo_deslocamento_min numeric(10,2),
  tempo_bordadura_min numeric(10,2),
  tempo_estimado_total_min numeric(12,2),
  latitude numeric(10,7),
  longitude numeric(10,7),
  modelo_meteorologico jsonb,
  vento_campo_kmh numeric(8,2),
  direcao_vento_campo text,
  temperatura_campo_c numeric(8,2),
  umidade_campo_percent numeric(8,2),
  distancia_area_sensivel_m numeric(10,2),
  margem_preventiva_empresa_m numeric(10,2),
  regra_regulatoria_id uuid references public.drone_regras_regulatorias(id) on delete set null,
  risco_confirmado boolean not null default false,
  insights_confirmados boolean not null default false,
  calibracao jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  sarpas_referencia text,
  sarpas_confirmado boolean not null default false,
  ocorrencias jsonb not null default '[]'::jsonb,
  status text not null default 'planejada',
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drone_aplicacoes_empresa_created_idx on public.drone_aplicacoes (empresa_id, created_at desc);
create index if not exists drone_protocolos_empresa_cultura_idx on public.drone_protocolos (empresa_id, cultura, alvo);
create index if not exists drone_regras_regulatorias_uf_idx on public.drone_regras_regulatorias (uf, ativo);

alter table public.drone_empresas_config enable row level security;
alter table public.drone_equipamentos enable row level security;
alter table public.drone_protocolos enable row level security;
alter table public.drone_regras_regulatorias enable row level security;
alter table public.drone_aplicacoes enable row level security;

-- Não criar políticas genéricas aqui. Antes da aplicação em produção, mapear:
-- 1) como core_usuarios se vincula a core_empresas;
-- 2) regra do ADMIN MBA/superadmin;
-- 3) papéis Piloto, Gestor Operacional, RT e Financeiro;
-- 4) isolamento multiempresa por empresa_id.
