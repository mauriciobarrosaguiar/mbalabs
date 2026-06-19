create table if not exists public.bike_clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  whatsapp text not null,
  cpf text,
  email text,
  endereco text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bike_bicicletas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid not null references public.bike_clientes(id) on delete cascade,
  marca text not null,
  modelo text not null,
  cor text,
  aro text,
  numero_serie text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bike_mecanicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  nome text not null,
  whatsapp text,
  tipo_comissao text not null default 'Sem comissão',
  percentual_padrao numeric(5,2) not null default 0,
  valor_fixo_padrao numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bike_servicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  valor_padrao numeric(12,2) not null default 0,
  tipo_comissao text not null default 'Sem comissão',
  percentual_comissao numeric(5,2) not null default 0,
  valor_comissao_fixa numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bike_comandas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  numero int not null,
  cliente_id uuid not null references public.bike_clientes(id),
  bicicleta_id uuid not null references public.bike_bicicletas(id),
  mecanico_id uuid references public.bike_mecanicos(id),
  status text not null default 'Aberta',
  status_pagamento text not null default 'Aberto',
  forma_pagamento text,
  data_entrada timestamptz not null default now(),
  data_previsao timestamptz,
  data_saida timestamptz,
  observacoes text,
  valor_total_servicos numeric(12,2) not null default 0,
  valor_total_produtos numeric(12,2) not null default 0,
  valor_total_final numeric(12,2) not null default 0,
  valor_recebido numeric(12,2) not null default 0,
  valor_pendente numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists public.bike_pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  comanda_id uuid not null references public.bike_comandas(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  forma_pagamento text not null,
  data_pagamento timestamptz not null default now(),
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bike_clientes_empresa on public.bike_clientes(empresa_id);
create index if not exists idx_bike_bicicletas_empresa on public.bike_bicicletas(empresa_id);
create index if not exists idx_bike_mecanicos_empresa on public.bike_mecanicos(empresa_id);
create index if not exists idx_bike_servicos_empresa on public.bike_servicos(empresa_id);
create index if not exists idx_bike_comandas_empresa on public.bike_comandas(empresa_id, status, data_entrada desc);
create index if not exists idx_bike_pagamentos_empresa on public.bike_pagamentos(empresa_id);
