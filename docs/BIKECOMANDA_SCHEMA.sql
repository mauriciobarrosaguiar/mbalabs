create extension if not exists pgcrypto;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  perfil text not null check (perfil in ('Admin', 'Atendente', 'Mecânico')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists configuracoes_loja (
  id uuid primary key default gen_random_uuid(),
  nome_loja text not null default 'BikeComanda',
  whatsapp_loja text,
  endereco_loja text,
  limite_desconto_atendente numeric(10, 2) not null default 10,
  comissao_sobre_valor_com_desconto boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  cpf text,
  endereco text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists bicicletas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null default 'Bicicleta',
  marca text not null,
  modelo text not null,
  cor text,
  aro text,
  numero_serie text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists mecanicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  tipo_comissao text not null default 'Sem comissão' check (tipo_comissao in ('Sem comissão', 'Percentual', 'Valor fixo')),
  percentual_padrao numeric(10, 2) not null default 0,
  valor_fixo_padrao numeric(10, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  valor_padrao numeric(10, 2) not null default 0,
  tempo_estimado text,
  tipo_comissao text not null default 'Sem comissão' check (tipo_comissao in ('Sem comissão', 'Percentual', 'Valor fixo')),
  percentual_comissao numeric(10, 2) not null default 0,
  valor_comissao_fixa numeric(10, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  valor_venda numeric(10, 2) not null default 0,
  estoque numeric(10, 2),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists comandas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  cliente_id uuid not null references clientes(id),
  bicicleta_id uuid not null references bicicletas(id),
  mecanico_id uuid references mecanicos(id),
  status text not null default 'Entrada realizada',
  data_entrada timestamptz not null default now(),
  data_previsao timestamptz,
  data_saida timestamptz,
  observacoes text,
  fotos jsonb not null default '[]'::jsonb,
  valor_total_servicos numeric(10, 2) not null default 0,
  valor_total_produtos numeric(10, 2) not null default 0,
  valor_total_bruto numeric(10, 2) not null default 0,
  tipo_desconto text not null default 'Valor fixo' check (tipo_desconto in ('Valor fixo', 'Percentual')),
  valor_desconto numeric(10, 2) not null default 0,
  motivo_desconto text,
  valor_total_final numeric(10, 2) not null default 0,
  desconto_aplicado_por uuid references usuarios(id),
  desconto_aplicado_em timestamptz,
  status_pagamento text not null default 'Aberto' check (status_pagamento in ('Aberto', 'Pago', 'Parcial')),
  forma_pagamento text check (forma_pagamento in ('Dinheiro', 'Pix', 'Cartão', 'Fiado')),
  valor_recebido numeric(10, 2) not null default 0,
  valor_pendente numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists comanda_servicos (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  servico_id uuid references servicos(id),
  mecanico_id uuid references mecanicos(id),
  descricao text not null,
  valor numeric(10, 2) not null default 0,
  tipo_comissao text not null default 'Sem comissão' check (tipo_comissao in ('Sem comissão', 'Percentual', 'Valor fixo')),
  percentual_comissao numeric(10, 2) not null default 0,
  valor_comissao numeric(10, 2) not null default 0,
  status text not null default 'Pendente',
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists comanda_produtos (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  produto_id uuid references produtos(id),
  descricao text not null,
  quantidade numeric(10, 2) not null default 1,
  valor_unitario numeric(10, 2) not null default 0,
  valor_total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pagamentos (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  valor numeric(10, 2) not null,
  forma_pagamento text not null check (forma_pagamento in ('Dinheiro', 'Pix', 'Cartão', 'Fiado')),
  data_pagamento timestamptz not null default now(),
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  mecanico_id uuid not null references mecanicos(id),
  servico_id uuid references servicos(id),
  valor_servico numeric(10, 2) not null default 0,
  percentual numeric(10, 2) not null default 0,
  valor_comissao numeric(10, 2) not null default 0,
  status_pagamento_comissao text not null default 'Pendente' check (status_pagamento_comissao in ('Pendente', 'Paga')),
  created_at timestamptz not null default now()
);

create table if not exists historico_comandas (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  acao text not null,
  status_anterior text,
  status_novo text,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bicicletas_cliente on bicicletas(cliente_id);
create index if not exists idx_comandas_cliente on comandas(cliente_id);
create index if not exists idx_comandas_bicicleta on comandas(bicicleta_id);
create index if not exists idx_comandas_mecanico on comandas(mecanico_id);
create index if not exists idx_comandas_status on comandas(status);
create index if not exists idx_comanda_servicos_comanda on comanda_servicos(comanda_id);
create index if not exists idx_comanda_produtos_comanda on comanda_produtos(comanda_id);
create index if not exists idx_pagamentos_comanda on pagamentos(comanda_id);
create index if not exists idx_comissoes_mecanico on comissoes(mecanico_id);
create index if not exists idx_historico_comanda on historico_comandas(comanda_id);
