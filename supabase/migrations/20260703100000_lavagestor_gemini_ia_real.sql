alter table public.lava_configuracoes
  add column if not exists iamob_ativo boolean not null default true,
  add column if not exists iamob_modo text not null default 'regras',
  add column if not exists iamob_provider text not null default 'regras',
  add column if not exists iamob_model text not null default 'gemini-3.1-flash-lite',
  add column if not exists iamob_permitir_analise_foto boolean not null default false,
  add column if not exists iamob_permitir_leitura_placa boolean not null default false;

do $$
begin
  alter table public.lava_configuracoes
    drop constraint if exists lava_configuracoes_iamob_modo_check;
  alter table public.lava_configuracoes
    add constraint lava_configuracoes_iamob_modo_check
    check (iamob_modo in ('regras', 'gemini'));

  alter table public.lava_configuracoes
    drop constraint if exists lava_configuracoes_iamob_provider_check;
  alter table public.lava_configuracoes
    add constraint lava_configuracoes_iamob_provider_check
    check (iamob_provider in ('regras', 'gemini'));
end $$;

create table if not exists public.lava_ai_connections (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text not null default 'gemini',
  status text not null default 'inativo',
  model text default 'gemini-3.1-flash-lite',
  api_key_encrypted text,
  account_hint text,
  ultimo_teste_em timestamptz,
  ultimo_erro text,
  uso_total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.lava_ai_connections
    drop constraint if exists lava_ai_connections_provider_check;
  alter table public.lava_ai_connections
    add constraint lava_ai_connections_provider_check
    check (provider in ('gemini'));

  alter table public.lava_ai_connections
    drop constraint if exists lava_ai_connections_status_check;
  alter table public.lava_ai_connections
    add constraint lava_ai_connections_status_check
    check (status in ('inativo', 'conectado', 'erro'));
end $$;

create unique index if not exists lava_ai_connections_empresa_provider_uidx
  on public.lava_ai_connections(empresa_id, provider);

create index if not exists lava_ai_connections_empresa_status_idx
  on public.lava_ai_connections(empresa_id, provider, status);

alter table public.lava_ai_connections enable row level security;

grant select, insert, update, delete on table public.lava_ai_connections to authenticated, service_role;
grant select, insert, update, delete on table public.lava_configuracoes to authenticated, service_role;

drop policy if exists lava_ai_connections_select on public.lava_ai_connections;
create policy lava_ai_connections_select on public.lava_ai_connections
  for select to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_ai_connections_manage on public.lava_ai_connections;
create policy lava_ai_connections_manage on public.lava_ai_connections
  for all to authenticated
  using (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
      and public.current_usuario_tipo() = 'admin_empresa'
    )
  )
  with check (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
      and public.current_usuario_tipo() = 'admin_empresa'
    )
  );

drop trigger if exists set_lava_ai_connections_updated_at on public.lava_ai_connections;
create trigger set_lava_ai_connections_updated_at before update on public.lava_ai_connections
  for each row execute function public.set_updated_at();
