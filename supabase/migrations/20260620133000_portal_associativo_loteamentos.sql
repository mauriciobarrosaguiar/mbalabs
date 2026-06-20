create table if not exists public.assoc_loteamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  codigo text,
  endereco text,
  cidade text,
  uf text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  valor_mensalidade_padrao numeric(12,2) not null default 0,
  vencimento_padrao integer not null default 10 check (vencimento_padrao between 1 and 31),
  descricao_mensalidade_padrao text not null default 'Mensalidade',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

alter table public.assoc_unidades
  add column if not exists loteamento_id uuid references public.assoc_loteamentos(id) on delete set null,
  add column if not exists valor_mensalidade numeric(12,2),
  add column if not exists vencimento_dia integer check (vencimento_dia is null or vencimento_dia between 1 and 31),
  add column if not exists isento_mensalidade boolean not null default false;

alter table public.assoc_cobrancas
  add column if not exists loteamento_id uuid references public.assoc_loteamentos(id) on delete set null;

update public.assoc_cobrancas cobranca
set loteamento_id = unidade.loteamento_id
from public.assoc_unidades unidade
where cobranca.unidade_id = unidade.id
  and cobranca.loteamento_id is null
  and unidade.loteamento_id is not null;

alter table public.assoc_unidades
  drop constraint if exists assoc_unidades_empresa_id_codigo_unidade_key;

create index if not exists idx_assoc_loteamentos_empresa_status on public.assoc_loteamentos(empresa_id, status);
create index if not exists idx_assoc_unidades_loteamento on public.assoc_unidades(empresa_id, loteamento_id);
create index if not exists idx_assoc_cobrancas_loteamento on public.assoc_cobrancas(empresa_id, loteamento_id);

create unique index if not exists idx_assoc_unidades_empresa_loteamento_codigo
  on public.assoc_unidades(empresa_id, loteamento_id, codigo_unidade)
  where loteamento_id is not null and codigo_unidade is not null and codigo_unidade <> '';

create unique index if not exists idx_assoc_unidades_empresa_codigo_sem_loteamento
  on public.assoc_unidades(empresa_id, codigo_unidade)
  where loteamento_id is null and codigo_unidade is not null and codigo_unidade <> '';

alter table public.assoc_loteamentos enable row level security;

drop policy if exists assoc_loteamentos_empresa_access on public.assoc_loteamentos;
create policy assoc_loteamentos_empresa_access on public.assoc_loteamentos
  for all to authenticated
  using (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.can_access_app('portal-associativo'))
  )
  with check (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.can_access_app('portal-associativo'))
  );
