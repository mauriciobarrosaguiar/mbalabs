create table if not exists public.lava_caixa_fechamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  periodo_tipo text not null default 'dia' check (periodo_tipo in ('dia', 'mes')),
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'fechado' check (status in ('fechado', 'reaberto')),
  total_recebido numeric(12,2) not null default 0,
  total_dinheiro numeric(12,2) not null default 0,
  total_pix numeric(12,2) not null default 0,
  total_cartao numeric(12,2) not null default 0,
  total_outros numeric(12,2) not null default 0,
  total_fiado numeric(12,2) not null default 0,
  total_pendente numeric(12,2) not null default 0,
  total_comissoes_pagas numeric(12,2) not null default 0,
  total_vales_baixados numeric(12,2) not null default 0,
  caixa_real numeric(12,2) not null default 0,
  valor_informado numeric(12,2) not null default 0,
  diferenca numeric(12,2) not null default 0,
  observacoes text,
  fechado_por uuid references public.core_usuarios(id),
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references public.core_usuarios(id),
  reaberto_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lava_caixa_fechamentos_periodo_uidx
  on public.lava_caixa_fechamentos(empresa_id, periodo_tipo, periodo_inicio, periodo_fim);

create index if not exists lava_caixa_fechamentos_empresa_periodo_idx
  on public.lava_caixa_fechamentos(empresa_id, periodo_tipo, periodo_inicio desc);

alter table public.lava_caixa_fechamentos enable row level security;

grant select, insert, update, delete on table public.lava_caixa_fechamentos to authenticated, service_role;

drop policy if exists lava_caixa_fechamentos_company_access on public.lava_caixa_fechamentos;
create policy lava_caixa_fechamentos_company_access on public.lava_caixa_fechamentos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_caixa_fechamentos_updated_at on public.lava_caixa_fechamentos;
create trigger set_lava_caixa_fechamentos_updated_at
  before update on public.lava_caixa_fechamentos
  for each row execute function public.set_updated_at();
