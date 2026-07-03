create table if not exists public.lava_configuracoes (
  empresa_id uuid primary key references public.core_empresas(id) on delete cascade,
  nome_exibicao text,
  nome_fantasia text,
  documento text,
  whatsapp text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  chave_pix text,
  logo_url text,
  cor_principal text default '#059669',
  percentual_comissao_padrao numeric(5,2) default 35,
  forma_pagamento_padrao text default 'pix',
  permitir_fiado boolean default true,
  permitir_desconto boolean default true,
  bloquear_entrega_sem_pagamento boolean default true,
  mensagem_veiculo_pronto text,
  mensagem_recibo text,
  motivos_cancelamento text[] default array[]::text[],
  tipos_entrega text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lava_configuracoes
  add column if not exists mensagem_pos_venda_agradecimento text,
  add column if not exists mensagem_pesquisa_satisfacao text,
  add column if not exists mensagem_retorno text,
  add column if not exists mensagem_cobranca_fiado text,
  add column if not exists mensagem_promocao text,
  add column if not exists exigir_checklist_antes_finalizar boolean not null default false,
  add column if not exists exigir_checklist_antes_entregar boolean not null default false,
  add column if not exists permitir_recibo_sem_checklist boolean not null default true,
  add column if not exists checklist_itens_padrao text[] default array[]::text[],
  add column if not exists checklist_tipos_foto text[] default array[]::text[],
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.lava_checklists (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id),
  veiculo_id uuid references public.lava_veiculos(id),
  usuario_id uuid references public.core_usuarios(id),
  status text not null default 'rascunho' check (status in ('rascunho', 'concluido', 'cancelado')),
  pintura_ok boolean not null default true,
  riscos boolean not null default false,
  amassados boolean not null default false,
  vidro_trincado boolean not null default false,
  retrovisor_ok boolean not null default true,
  pneus_ok boolean not null default true,
  farois_ok boolean not null default true,
  interior_ok boolean not null default true,
  objetos_cliente boolean not null default false,
  combustivel_nivel text,
  km text,
  observacao_avarias text,
  observacao_geral text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, lavagem_id)
);

create table if not exists public.lava_checklist_servicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  checklist_id uuid not null references public.lava_checklists(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  lavagem_servico_id uuid references public.lava_lavagem_servicos(id) on delete set null,
  descricao text not null,
  conferido boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_checklist_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  checklist_id uuid not null references public.lava_checklists(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  tipo text not null,
  storage_path text not null,
  public_url text,
  legenda text,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_pos_venda_contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id) on delete set null,
  lavagem_id uuid references public.lava_lavagens(id) on delete set null,
  usuario_id uuid references public.core_usuarios(id),
  tipo text not null,
  mensagem text,
  canal text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create table if not exists public.lava_vale_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  vale_id uuid not null references public.lava_vales(id) on delete cascade,
  funcionario_id uuid references public.lava_funcionarios(id) on delete set null,
  valor_descontado numeric(12,2) not null default 0,
  saldo_antes numeric(12,2) not null default 0,
  saldo_depois numeric(12,2) not null default 0,
  tipo text not null default 'desconto',
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lava_checklists_empresa_lavagem on public.lava_checklists(empresa_id, lavagem_id);
create index if not exists idx_lava_checklists_status on public.lava_checklists(empresa_id, status, created_at desc);
create index if not exists idx_lava_checklist_servicos_checklist on public.lava_checklist_servicos(empresa_id, checklist_id);
create index if not exists idx_lava_checklist_fotos_lavagem on public.lava_checklist_fotos(empresa_id, lavagem_id, created_at desc);
create index if not exists idx_lava_pos_venda_empresa_created on public.lava_pos_venda_contatos(empresa_id, created_at desc);
create index if not exists idx_lava_pos_venda_lavagem_tipo on public.lava_pos_venda_contatos(empresa_id, lavagem_id, tipo);
create index if not exists idx_lava_vale_movimentos_empresa_vale on public.lava_vale_movimentos(empresa_id, vale_id, created_at desc);

alter table public.lava_configuracoes enable row level security;
alter table public.lava_checklists enable row level security;
alter table public.lava_checklist_servicos enable row level security;
alter table public.lava_checklist_fotos enable row level security;
alter table public.lava_pos_venda_contatos enable row level security;
alter table public.lava_vale_movimentos enable row level security;

grant select, insert, update, delete on table public.lava_configuracoes to authenticated, service_role;
grant select, insert, update, delete on table public.lava_checklists to authenticated, service_role;
grant select, insert, update, delete on table public.lava_checklist_servicos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_checklist_fotos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_pos_venda_contatos to authenticated, service_role;
grant select, insert, update, delete on table public.lava_vale_movimentos to authenticated, service_role;

drop policy if exists lava_configuracoes_company_access on public.lava_configuracoes;
create policy lava_configuracoes_company_access on public.lava_configuracoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_checklists_company_access on public.lava_checklists;
create policy lava_checklists_company_access on public.lava_checklists
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_checklist_servicos_company_access on public.lava_checklist_servicos;
create policy lava_checklist_servicos_company_access on public.lava_checklist_servicos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_checklist_fotos_company_access on public.lava_checklist_fotos;
create policy lava_checklist_fotos_company_access on public.lava_checklist_fotos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_pos_venda_contatos_company_access on public.lava_pos_venda_contatos;
create policy lava_pos_venda_contatos_company_access on public.lava_pos_venda_contatos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_vale_movimentos_company_access on public.lava_vale_movimentos;
create policy lava_vale_movimentos_company_access on public.lava_vale_movimentos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

insert into storage.buckets (id, name, public)
values ('lava-checklists', 'lava-checklists', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists lava_checklists_storage_select on storage.objects;
create policy lava_checklists_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lava-checklists'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('lavagestor'))
    )
  );

drop policy if exists lava_checklists_storage_insert on storage.objects;
create policy lava_checklists_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lava-checklists'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('lavagestor'))
    )
  );

drop policy if exists lava_checklists_storage_update on storage.objects;
create policy lava_checklists_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lava-checklists'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('lavagestor'))
    )
  )
  with check (
    bucket_id = 'lava-checklists'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('lavagestor'))
    )
  );

drop policy if exists lava_checklists_storage_delete on storage.objects;
create policy lava_checklists_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lava-checklists'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('lavagestor'))
    )
  );
