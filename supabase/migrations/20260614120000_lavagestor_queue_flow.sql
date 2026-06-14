alter table public.lava_clientes
  add column if not exists whatsapp text;

update public.lava_clientes
set whatsapp = telefone
where whatsapp is null
  and telefone is not null;

alter table public.lava_lavagens
  add column if not exists status_pagamento text not null default 'aberto',
  add column if not exists forma_pagamento text,
  add column if not exists valor_total numeric(12,2) not null default 0,
  add column if not exists valor_desconto numeric(12,2) not null default 0,
  add column if not exists valor_final numeric(12,2) not null default 0,
  add column if not exists valor_recebido numeric(12,2) not null default 0,
  add column if not exists valor_pendente numeric(12,2) not null default 0,
  add column if not exists data_entrada timestamptz,
  add column if not exists data_inicio timestamptz,
  add column if not exists data_finalizacao timestamptz,
  add column if not exists data_cliente_avisado timestamptz,
  add column if not exists data_pagamento timestamptz,
  add column if not exists data_entrega timestamptz,
  add column if not exists motivo_cancelamento text,
  add column if not exists observacoes text;

alter table public.lava_lavagens
  drop constraint if exists lava_lavagens_status_check;

update public.lava_lavagens
set
  status = case status
    when 'finalizada' then 'finalizado'
    when 'em_andamento' then 'em_lavagem'
    when 'aberta' then 'na_fila'
    when 'cancelada' then 'cancelado'
    else status
  end,
  valor_total = case when coalesce(valor_total, 0) = 0 then valor else valor_total end,
  valor_final = case when coalesce(valor_final, 0) = 0 then valor else valor_final end,
  valor_pendente = case
    when coalesce(valor_pendente, 0) = 0 then greatest(coalesce(valor, 0) - coalesce(valor_recebido, 0), 0)
    else valor_pendente
  end,
  data_entrada = coalesce(data_entrada, data_lavagem)
where status in ('finalizada', 'em_andamento', 'aberta', 'cancelada')
   or coalesce(valor_total, 0) = 0
   or coalesce(valor_final, 0) = 0
   or data_entrada is null;

alter table public.lava_lavagens
  add constraint lava_lavagens_status_check
  check (status in (
    'na_fila',
    'em_lavagem',
    'aguardando_finalizacao',
    'finalizado',
    'cliente_avisado',
    'pago',
    'entregue',
    'cancelado'
  ));

alter table public.lava_lavagens
  drop constraint if exists lava_lavagens_status_pagamento_check;

alter table public.lava_lavagens
  add constraint lava_lavagens_status_pagamento_check
  check (status_pagamento in ('aberto', 'parcial', 'pago', 'fiado'));

alter table public.lava_lavagens
  alter column status set default 'na_fila';

create table if not exists public.lava_lavagem_servicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  servico_id uuid references public.lava_servicos(id),
  funcionario_id uuid references public.lava_funcionarios(id),
  descricao text not null,
  valor numeric(12,2) not null default 0,
  tipo_comissao text not null default 'sem_comissao'
    check (tipo_comissao in ('sem_comissao', 'fixa', 'percentual')),
  percentual_comissao numeric(5,2),
  valor_comissao numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  forma_pagamento text,
  data_pagamento timestamptz not null default now(),
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id),
  acao text not null,
  status_anterior text,
  status_novo text,
  observacao text,
  created_at timestamptz not null default now()
);

insert into public.lava_lavagem_servicos (
  empresa_id,
  lavagem_id,
  servico_id,
  funcionario_id,
  descricao,
  valor,
  tipo_comissao,
  percentual_comissao,
  valor_comissao,
  created_at
)
select
  l.empresa_id,
  l.id,
  l.servico_id,
  l.funcionario_id,
  coalesce(s.nome, l.descricao_extra, 'Serviço'),
  coalesce(l.valor_final, l.valor, 0),
  case when coalesce(l.comissao, 0) > 0 and coalesce(l.valor_final, l.valor, 0) > 0 then 'percentual' else 'sem_comissao' end,
  case
    when coalesce(l.comissao, 0) > 0 and coalesce(l.valor_final, l.valor, 0) > 0
      then round((l.comissao / nullif(coalesce(l.valor_final, l.valor, 0), 0)) * 100, 2)
    else null
  end,
  coalesce(l.comissao, 0),
  l.created_at
from public.lava_lavagens l
left join public.lava_servicos s on s.id = l.servico_id
where not exists (
  select 1
  from public.lava_lavagem_servicos ls
  where ls.lavagem_id = l.id
);

create index if not exists idx_lava_lavagem_servicos_empresa on public.lava_lavagem_servicos(empresa_id);
create index if not exists idx_lava_lavagem_servicos_lavagem on public.lava_lavagem_servicos(lavagem_id);
create index if not exists idx_lava_pagamentos_empresa on public.lava_pagamentos(empresa_id);
create index if not exists idx_lava_pagamentos_lavagem on public.lava_pagamentos(lavagem_id);
create index if not exists idx_lava_historico_empresa on public.lava_historico(empresa_id);
create index if not exists idx_lava_historico_lavagem on public.lava_historico(lavagem_id);
create index if not exists idx_lava_lavagens_status on public.lava_lavagens(empresa_id, status, data_entrada desc);

alter table public.lava_lavagem_servicos enable row level security;
alter table public.lava_pagamentos enable row level security;
alter table public.lava_historico enable row level security;

drop policy if exists lava_lavagem_servicos_company_access on public.lava_lavagem_servicos;
create policy lava_lavagem_servicos_company_access on public.lava_lavagem_servicos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_pagamentos_company_access on public.lava_pagamentos;
create policy lava_pagamentos_company_access on public.lava_pagamentos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_historico_company_access on public.lava_historico;
create policy lava_historico_company_access on public.lava_historico
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));
