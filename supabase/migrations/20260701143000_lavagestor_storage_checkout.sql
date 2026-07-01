alter table public.lava_configuracoes
  add column if not exists exigir_foto_entrada boolean not null default true,
  add column if not exists fotos_entrada_obrigatorias text[] default array[]::text[],
  add column if not exists permitir_concluir_checklist_sem_foto boolean not null default false,
  add column if not exists exigir_foto_checkout_antes_entrega boolean not null default false;

alter table public.lava_checklist_fotos
  add column if not exists momento text not null default 'entrada';

alter table public.lava_checklist_fotos
  drop constraint if exists lava_checklist_fotos_momento_check;

alter table public.lava_checklist_fotos
  add constraint lava_checklist_fotos_momento_check
  check (momento in ('entrada', 'checkout'));

create index if not exists idx_lava_checklist_fotos_momento
  on public.lava_checklist_fotos(empresa_id, lavagem_id, momento, created_at desc);

create table if not exists public.lava_storage_connections (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'dropbox')),
  status text not null default 'nao_conectado',
  account_email text,
  account_id text,
  root_folder_id text,
  root_folder_path text not null default '/MBA Labs/LavaGestor',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lava_storage_connections_provider_unique_idx
  on public.lava_storage_connections(empresa_id, provider);

create index if not exists idx_lava_storage_connections_empresa
  on public.lava_storage_connections(empresa_id, status);

create table if not exists public.lava_file_sync (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid references public.lava_lavagens(id) on delete cascade,
  checklist_id uuid references public.lava_checklists(id) on delete cascade,
  foto_id uuid not null references public.lava_checklist_fotos(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'dropbox')),
  status text not null default 'pendente' check (status in ('pendente', 'sincronizado', 'erro')),
  local_storage_path text,
  remote_file_id text,
  remote_folder_id text,
  remote_path text,
  remote_url text,
  erro text,
  tentativas integer not null default 0,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lava_file_sync_foto_provider_unique_idx
  on public.lava_file_sync(foto_id, provider);

create index if not exists idx_lava_file_sync_status
  on public.lava_file_sync(empresa_id, status, created_at desc);

create index if not exists idx_lava_file_sync_lavagem
  on public.lava_file_sync(empresa_id, lavagem_id, provider);

alter table public.lava_storage_connections enable row level security;
alter table public.lava_file_sync enable row level security;

grant select, insert, update, delete on table public.lava_configuracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_checklist_fotos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_storage_connections to authenticated, service_role;
grant select, insert, update, delete on table public.lava_file_sync to authenticated, service_role;

drop policy if exists lava_storage_connections_company_access on public.lava_storage_connections;
create policy lava_storage_connections_company_access on public.lava_storage_connections
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_file_sync_company_access on public.lava_file_sync;
create policy lava_file_sync_company_access on public.lava_file_sync
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_storage_connections_updated_at on public.lava_storage_connections;
create trigger set_lava_storage_connections_updated_at
  before update on public.lava_storage_connections
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_file_sync_updated_at on public.lava_file_sync;
create trigger set_lava_file_sync_updated_at
  before update on public.lava_file_sync
  for each row execute function public.set_updated_at();
