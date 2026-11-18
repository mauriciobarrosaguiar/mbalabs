-- MBA AgroDoc: armazenamento externo isolado por empresa/operador.
-- NAO aplicar automaticamente ao banco de producao. Homologar em banco QA.
create table if not exists public.agrodoc_cloud_connections (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('empresa','usuario')),
  owner_id uuid not null,
  provider text not null check (provider in ('google_drive','dropbox')),
  account_email text,
  account_subject text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  root_folder_id text,
  status text not null default 'disconnected' check (status in ('connected','disconnected','error')),
  last_error text,
  last_tested_at timestamptz,
  created_by uuid,
  updated_at timestamptz not null default now(),
  constraint agrodoc_cloud_connection_owner_unique unique (owner_type, owner_id, provider)
);
create table if not exists public.agrodoc_cloud_folders (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('empresa','usuario')),
  owner_id uuid not null,
  provider text not null,
  folder_key text not null,
  provider_folder_id text not null,
  created_at timestamptz not null default now(),
  unique(owner_type, owner_id, provider, folder_key)
);
create table if not exists public.agrodoc_cloud_files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('empresa','usuario')),
  owner_id uuid not null,
  provider text not null default 'google_drive',
  os_id text not null,
  property_id text,
  category text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text,
  client_fingerprint text,
  provider_file_id text,
  provider_md5 text,
  provider_folder_id text,
  upload_session_encrypted text,
  uploaded_by uuid not null,
  status text not null default 'pending' check (status in ('pending','synced','failed')),
  attempts integer not null default 0,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists agrodoc_cloud_files_idempotency
  on public.agrodoc_cloud_files(owner_type, owner_id, os_id, category, sha256)
  where sha256 is not null and status in ('pending','synced');
create unique index if not exists agrodoc_cloud_pending_fingerprint
  on public.agrodoc_cloud_files(owner_type, owner_id, os_id, category, client_fingerprint)
  where client_fingerprint is not null and status = 'pending';
create index if not exists agrodoc_cloud_files_os
  on public.agrodoc_cloud_files(owner_type,owner_id,os_id,created_at desc);
create table if not exists public.agrodoc_cloud_events (
  id bigint generated always as identity primary key,
  file_id uuid references public.agrodoc_cloud_files(id) on delete set null,
  owner_type text not null,
  owner_id uuid not null,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agrodoc_cloud_events_owner on public.agrodoc_cloud_events(owner_type,owner_id,created_at desc);

-- Acesso exclusivo via rotas do servidor com escopo recalculado da sessao.
-- Nenhuma policy de autenticado/anon: RLS nega consultas diretas.
alter table public.agrodoc_cloud_connections enable row level security;
alter table public.agrodoc_cloud_folders enable row level security;
alter table public.agrodoc_cloud_files enable row level security;
alter table public.agrodoc_cloud_events enable row level security;
revoke all on public.agrodoc_cloud_connections from anon, authenticated;
revoke all on public.agrodoc_cloud_folders from anon, authenticated;
revoke all on public.agrodoc_cloud_files from anon, authenticated;
revoke all on public.agrodoc_cloud_events from anon, authenticated;
grant all on public.agrodoc_cloud_connections to service_role;
grant all on public.agrodoc_cloud_folders to service_role;
grant all on public.agrodoc_cloud_files to service_role;
grant all on public.agrodoc_cloud_events to service_role;
grant usage, select on sequence public.agrodoc_cloud_events_id_seq to service_role;
