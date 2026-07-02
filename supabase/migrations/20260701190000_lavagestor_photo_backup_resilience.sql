alter table public.lava_checklist_fotos
  add column if not exists momento text default 'entrada';

alter table public.lava_checklist_fotos
  drop constraint if exists lava_checklist_fotos_momento_check;

alter table public.lava_checklist_fotos
  add constraint lava_checklist_fotos_momento_check
  check (momento in ('entrada', 'checkout'));

create table if not exists public.lava_file_sync (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid references public.lava_lavagens(id) on delete cascade,
  checklist_id uuid references public.lava_checklists(id) on delete cascade,
  foto_id uuid not null references public.lava_checklist_fotos(id) on delete cascade,
  provider text not null,
  status text not null default 'pendente',
  local_storage_path text,
  remote_file_id text,
  remote_folder_id text,
  remote_path text,
  remote_url text,
  erro text,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lava_file_sync
  add column if not exists empresa_id uuid references public.core_empresas(id) on delete cascade,
  add column if not exists lavagem_id uuid references public.lava_lavagens(id) on delete cascade,
  add column if not exists checklist_id uuid references public.lava_checklists(id) on delete cascade,
  add column if not exists foto_id uuid references public.lava_checklist_fotos(id) on delete cascade,
  add column if not exists provider text,
  add column if not exists status text not null default 'pendente',
  add column if not exists local_storage_path text,
  add column if not exists remote_file_id text,
  add column if not exists remote_folder_id text,
  add column if not exists remote_path text,
  add column if not exists remote_url text,
  add column if not exists erro text,
  add column if not exists tentativas integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.lava_file_sync
  drop constraint if exists lava_file_sync_provider_check;

alter table public.lava_file_sync
  add constraint lava_file_sync_provider_check
  check (provider in ('google_drive', 'dropbox'));

alter table public.lava_file_sync
  drop constraint if exists lava_file_sync_status_check;

alter table public.lava_file_sync
  add constraint lava_file_sync_status_check
  check (status in ('pendente', 'sincronizado', 'erro'));

create unique index if not exists lava_file_sync_foto_provider_unique_idx
  on public.lava_file_sync(foto_id, provider);

create index if not exists idx_lava_file_sync_status
  on public.lava_file_sync(empresa_id, status, created_at desc);

create index if not exists idx_lava_file_sync_lavagem
  on public.lava_file_sync(empresa_id, lavagem_id, provider);

alter table public.lava_storage_connections
  add column if not exists last_error text,
  add column if not exists last_test_at timestamptz;

alter table public.lava_storage_connections
  drop constraint if exists lava_storage_connections_status_check;

alter table public.lava_storage_connections
  add constraint lava_storage_connections_status_check
  check (status in ('conectado', 'nao_conectado', 'erro'));

alter table public.lava_checklist_fotos enable row level security;
alter table public.lava_file_sync enable row level security;
alter table public.lava_storage_connections enable row level security;

grant select, insert, update, delete on table public.lava_checklist_fotos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_file_sync to authenticated, service_role;
grant select, insert, update, delete on table public.lava_storage_connections to authenticated, service_role;

drop policy if exists lava_file_sync_company_access on public.lava_file_sync;
create policy lava_file_sync_company_access on public.lava_file_sync
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_storage_connections_company_access on public.lava_storage_connections;
create policy lava_storage_connections_company_access on public.lava_storage_connections
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop trigger if exists set_lava_file_sync_updated_at on public.lava_file_sync;
create trigger set_lava_file_sync_updated_at
  before update on public.lava_file_sync
  for each row execute function public.set_updated_at();

drop trigger if exists set_lava_storage_connections_updated_at on public.lava_storage_connections;
create trigger set_lava_storage_connections_updated_at
  before update on public.lava_storage_connections
  for each row execute function public.set_updated_at();
