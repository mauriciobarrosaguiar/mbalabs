-- DroneGestor Agro - persistencia V2 no banco principal MBA Labs
-- Usa o mesmo auth, core_usuarios, core_empresas e isolamento multiempresa do portal.

create or replace function public.drone_current_usuario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.drone_current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.empresa_id
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.drone_current_usuario_tipo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.tipo_global::text, u.tipo::text, 'usuario')
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.drone_is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.drone_current_usuario_tipo() in ('super_admin', 'admin_master'), false);
$$;

create or replace function public.drone_can_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.drone_is_admin_master()
    or coalesce(public.can_access_app('dronegestor'), false);
$$;

grant execute on function public.drone_current_usuario_id() to authenticated;
grant execute on function public.drone_current_empresa_id() to authenticated;
grant execute on function public.drone_current_usuario_tipo() to authenticated;
grant execute on function public.drone_is_admin_master() to authenticated;
grant execute on function public.drone_can_access() to authenticated;

insert into public.core_apps (slug, nome, descricao, url_path, ativo, ordem)
values (
  'dronegestor',
  'DroneGestor Agro',
  'Copiloto de campo para planejamento, calculos, seguranca, execucao e relatorios de operacoes com drones agricolas.',
  '/apps/dronegestor/campo',
  true,
  35
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

create table if not exists public.drone_empresas_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
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
  empresa_id uuid references public.core_empresas(id) on delete cascade,
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
  empresa_id uuid references public.core_empresas(id) on delete cascade,
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
  local_id text,
  empresa_id uuid references public.core_empresas(id) on delete cascade,
  usuario_id uuid not null references public.core_usuarios(id) on delete cascade,
  equipamento_id uuid references public.drone_equipamentos(id) on delete set null,
  protocolo_id uuid references public.drone_protocolos(id) on delete set null,
  cultura text not null default '',
  alvo text not null default '',
  area_ha numeric(12,3) not null default 0,
  volume_l_ha numeric(12,4) not null default 0,
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
  progresso_ha numeric(12,3) not null default 0,
  status text not null default 'rascunho',
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists drone_aplicacoes_usuario_local_uidx
  on public.drone_aplicacoes (usuario_id, local_id)
  where local_id is not null;
create index if not exists drone_aplicacoes_empresa_created_idx on public.drone_aplicacoes (empresa_id, created_at desc);
create index if not exists drone_aplicacoes_usuario_created_idx on public.drone_aplicacoes (usuario_id, created_at desc);
create index if not exists drone_protocolos_empresa_cultura_idx on public.drone_protocolos (empresa_id, cultura, alvo);
create index if not exists drone_regras_regulatorias_uf_idx on public.drone_regras_regulatorias (uf, ativo);

-- Estado corrente do aparelho/usuario. Mantem o uso offline sem perder a sincronizacao entre dispositivos.
create table if not exists public.drone_sessoes_campo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.core_empresas(id) on delete cascade,
  usuario_id uuid not null references public.core_usuarios(id) on delete cascade,
  aplicacao_id uuid references public.drone_aplicacoes(id) on delete set null,
  estado jsonb not null default '{}'::jsonb,
  versao integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id)
);

create index if not exists drone_sessoes_empresa_idx on public.drone_sessoes_campo (empresa_id, updated_at desc);

-- updated_at
for_table: begin
end;

-- O bloco acima e apenas um rotulo invalido em algumas ferramentas; removemos por seguranca abaixo.
-- Triggers explicitos e idempotentes:
drop trigger if exists set_drone_empresas_config_updated_at on public.drone_empresas_config;
create trigger set_drone_empresas_config_updated_at before update on public.drone_empresas_config for each row execute function public.set_updated_at();
drop trigger if exists set_drone_equipamentos_updated_at on public.drone_equipamentos;
create trigger set_drone_equipamentos_updated_at before update on public.drone_equipamentos for each row execute function public.set_updated_at();
drop trigger if exists set_drone_protocolos_updated_at on public.drone_protocolos;
create trigger set_drone_protocolos_updated_at before update on public.drone_protocolos for each row execute function public.set_updated_at();
drop trigger if exists set_drone_regras_regulatorias_updated_at on public.drone_regras_regulatorias;
create trigger set_drone_regras_regulatorias_updated_at before update on public.drone_regras_regulatorias for each row execute function public.set_updated_at();
drop trigger if exists set_drone_aplicacoes_updated_at on public.drone_aplicacoes;
create trigger set_drone_aplicacoes_updated_at before update on public.drone_aplicacoes for each row execute function public.set_updated_at();
drop trigger if exists set_drone_sessoes_campo_updated_at on public.drone_sessoes_campo;
create trigger set_drone_sessoes_campo_updated_at before update on public.drone_sessoes_campo for each row execute function public.set_updated_at();

alter table public.drone_empresas_config enable row level security;
alter table public.drone_equipamentos enable row level security;
alter table public.drone_protocolos enable row level security;
alter table public.drone_regras_regulatorias enable row level security;
alter table public.drone_aplicacoes enable row level security;
alter table public.drone_sessoes_campo enable row level security;

grant select, insert, update, delete on public.drone_empresas_config to authenticated;
grant select, insert, update, delete on public.drone_equipamentos to authenticated;
grant select, insert, update, delete on public.drone_protocolos to authenticated;
grant select, insert, update, delete on public.drone_regras_regulatorias to authenticated;
grant select, insert, update, delete on public.drone_aplicacoes to authenticated;
grant select, insert, update, delete on public.drone_sessoes_campo to authenticated;

-- Configuracoes: todos da empresa leem; somente admin da empresa ou ADMIN MBA alteram.
drop policy if exists drone_empresas_config_select on public.drone_empresas_config;
create policy drone_empresas_config_select on public.drone_empresas_config
  for select to authenticated
  using (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access()));
drop policy if exists drone_empresas_config_manage on public.drone_empresas_config;
create policy drone_empresas_config_manage on public.drone_empresas_config
  for all to authenticated
  using (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_current_usuario_tipo() = 'admin_empresa'))
  with check (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_current_usuario_tipo() = 'admin_empresa'));

-- Equipamentos e protocolos ficam isolados por empresa e pelo acesso ao app.
drop policy if exists drone_equipamentos_company_access on public.drone_equipamentos;
create policy drone_equipamentos_company_access on public.drone_equipamentos
  for all to authenticated
  using (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access()))
  with check (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access()));

drop policy if exists drone_protocolos_company_access on public.drone_protocolos;
create policy drone_protocolos_company_access on public.drone_protocolos
  for all to authenticated
  using (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access()))
  with check (public.drone_is_admin_master() or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access()));

-- Regras regulatorias sao globais para leitura; edicao apenas pelo ADMIN MBA.
drop policy if exists drone_regras_regulatorias_select on public.drone_regras_regulatorias;
create policy drone_regras_regulatorias_select on public.drone_regras_regulatorias
  for select to authenticated
  using (public.drone_can_access());
drop policy if exists drone_regras_regulatorias_manage on public.drone_regras_regulatorias;
create policy drone_regras_regulatorias_manage on public.drone_regras_regulatorias
  for all to authenticated
  using (public.drone_is_admin_master())
  with check (public.drone_is_admin_master());

-- Operacoes: usuario da empresa acessa somente o tenant; ADMIN MBA pode auditar todos.
drop policy if exists drone_aplicacoes_company_access on public.drone_aplicacoes;
create policy drone_aplicacoes_company_access on public.drone_aplicacoes
  for all to authenticated
  using (
    public.drone_is_admin_master()
    or (empresa_id = public.drone_current_empresa_id() and public.drone_can_access())
  )
  with check (
    public.drone_is_admin_master()
    or (empresa_id = public.drone_current_empresa_id() and usuario_id = public.drone_current_usuario_id() and public.drone_can_access())
  );

-- Rascunho sincronizado e privado por usuario. ADMIN MBA pode dar suporte/auditar.
drop policy if exists drone_sessoes_campo_user_access on public.drone_sessoes_campo;
create policy drone_sessoes_campo_user_access on public.drone_sessoes_campo
  for all to authenticated
  using (public.drone_is_admin_master() or usuario_id = public.drone_current_usuario_id())
  with check (
    public.drone_is_admin_master()
    or (
      usuario_id = public.drone_current_usuario_id()
      and (empresa_id is not distinct from public.drone_current_empresa_id())
      and public.drone_can_access()
    )
  );
