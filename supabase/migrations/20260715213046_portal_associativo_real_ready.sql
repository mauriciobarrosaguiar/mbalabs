create extension if not exists pgcrypto;

alter table public.assoc_configuracoes
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists responsavel_nome text,
  add column if not exists instrucoes_pagamento text,
  add column if not exists instrucoes_pagamento_pix text,
  add column if not exists qr_code_pix_url text,
  add column if not exists usar_pix_manual boolean not null default true,
  add column if not exists cnpj_entidade text;

update public.assoc_configuracoes
set instrucoes_pagamento_pix = coalesce(instrucoes_pagamento_pix, instrucoes_pagamento)
where instrucoes_pagamento_pix is null;

alter table public.assoc_pessoas
  add column if not exists data_nascimento date,
  add column if not exists endereco text;

update public.assoc_pessoas
set endereco = endereco_residencial
where endereco is null
  and endereco_residencial is not null;

alter table public.assoc_pessoas
  drop constraint if exists assoc_pessoas_status_pessoa_check;

alter table public.assoc_pessoas
  add constraint assoc_pessoas_status_pessoa_check
  check (status_pessoa in ('ativa', 'inativa', 'antigo_proprietario', 'bloqueada'));

alter table public.assoc_unidades
  drop constraint if exists assoc_unidades_status_unidade_check;

alter table public.assoc_unidades
  add constraint assoc_unidades_status_unidade_check
  check (status_unidade in ('ativa', 'inativa', 'bloqueada', 'vendida', 'em_transferencia'));

alter table public.assoc_vinculos_unidade_pessoa
  drop constraint if exists assoc_vinculos_unidade_pessoa_tipo_vinculo_check;

alter table public.assoc_vinculos_unidade_pessoa
  add constraint assoc_vinculos_unidade_pessoa_tipo_vinculo_check
  check (tipo_vinculo in ('proprietario', 'responsavel_financeiro', 'responsavel_contato', 'morador', 'ocupante', 'antigo_proprietario', 'autorizado', 'outro'));

alter table public.assoc_transferencias
  add column if not exists documento_file_id text,
  add column if not exists documento_arquivo_id uuid references public.assoc_arquivos(id) on delete set null;

alter table public.assoc_transferencias
  drop constraint if exists assoc_transferencias_responsabilidade_debitos_check;

alter table public.assoc_transferencias
  add constraint assoc_transferencias_responsabilidade_debitos_check
  check (responsabilidade_debitos in ('anterior', 'novo', 'dividida', 'entidade', 'antigo_responsavel', 'novo_responsavel', 'dividido', 'quitado'));

alter table public.assoc_avisos
  drop constraint if exists assoc_avisos_status_check;

alter table public.assoc_avisos
  add constraint assoc_avisos_status_check
  check (status in ('ativo', 'inativo', 'rascunho'));

alter table public.assoc_avisos
  drop constraint if exists assoc_avisos_publico_check;

alter table public.assoc_avisos
  add constraint assoc_avisos_publico_check
  check (publico in ('todos', 'associados', 'inadimplentes', 'diretoria', 'perfil', 'por_perfil', 'unidade', 'por_unidade', 'status_cobranca'));

alter table public.assoc_projetos
  add column if not exists data_inicio date,
  add column if not exists data_fim date;

alter table public.assoc_projetos
  drop constraint if exists assoc_projetos_status_check;

alter table public.assoc_projetos
  add constraint assoc_projetos_status_check
  check (status in ('planejado', 'andamento', 'em_andamento', 'concluido', 'cancelado'));

alter table public.assoc_storage_integracoes
  add column if not exists access_token_criptografado text,
  add column if not exists refresh_token_criptografado text,
  add column if not exists expires_at timestamptz,
  add column if not exists root_folder_id text,
  add column if not exists criado_por uuid references public.core_usuarios(id) on delete set null;

update public.assoc_storage_integracoes
set access_token_criptografado = coalesce(access_token_criptografado, access_token_encrypted),
    refresh_token_criptografado = coalesce(refresh_token_criptografado, refresh_token_encrypted),
    expires_at = coalesce(expires_at, token_expires_at),
    criado_por = coalesce(criado_por, conectado_por)
where access_token_encrypted is not null
   or refresh_token_encrypted is not null
   or token_expires_at is not null
   or conectado_por is not null;

alter table public.assoc_arquivos
  add column if not exists transferencia_id uuid references public.assoc_transferencias(id) on delete set null;

alter table public.assoc_cobrancas
  drop constraint if exists assoc_cobrancas_status_check;

alter table public.assoc_cobrancas
  add constraint assoc_cobrancas_status_check
  check (status in ('aberta', 'aguardando_pagamento', 'aguardando_aprovacao', 'vencida', 'negociada', 'paga', 'recusada', 'cancelada'));

alter table public.assoc_cobrancas
  add column if not exists motivo_recusa text,
  add column if not exists comprovante_pendente_url text,
  add column if not exists comprovante_aprovado_url text,
  add column if not exists aprovado_por uuid references public.core_usuarios(id) on delete set null,
  add column if not exists aprovado_em timestamptz,
  add column if not exists recusado_por uuid references public.core_usuarios(id) on delete set null,
  add column if not exists recusado_em timestamptz;

create table if not exists public.assoc_comprovantes_pagamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cobranca_id uuid not null references public.assoc_cobrancas(id) on delete cascade,
  pessoa_id uuid not null references public.assoc_pessoas(id) on delete cascade,
  unidade_id uuid references public.assoc_unidades(id) on delete set null,
  arquivo_id uuid references public.assoc_arquivos(id) on delete set null,
  comprovante_url text,
  provedor_storage text not null check (provedor_storage in ('dropbox', 'google_drive', 'manual')),
  valor_informado numeric(12,2),
  data_pagamento_informada date,
  observacao_associado text,
  status text not null default 'enviado' check (status in ('enviado', 'aprovado', 'recusado')),
  motivo_recusa text,
  enviado_por uuid not null references public.core_usuarios(id) on delete restrict,
  enviado_em timestamptz not null default now(),
  analisado_por uuid references public.core_usuarios(id) on delete set null,
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_assoc_comprovantes_empresa on public.assoc_comprovantes_pagamento(empresa_id);
create index if not exists idx_assoc_comprovantes_cobranca on public.assoc_comprovantes_pagamento(empresa_id, cobranca_id);
create index if not exists idx_assoc_comprovantes_pessoa on public.assoc_comprovantes_pagamento(empresa_id, pessoa_id);
create index if not exists idx_assoc_comprovantes_status on public.assoc_comprovantes_pagamento(empresa_id, status);
create index if not exists idx_assoc_comprovantes_enviado on public.assoc_comprovantes_pagamento(empresa_id, enviado_em desc);

alter table public.assoc_comprovantes_pagamento enable row level security;

drop policy if exists assoc_comprovantes_pagamento_select on public.assoc_comprovantes_pagamento;
create policy assoc_comprovantes_pagamento_select on public.assoc_comprovantes_pagamento
  for select to authenticated
  using (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('portal-associativo')
      and (
        exists (
          select 1 from public.assoc_perfis_usuarios perfil
          where perfil.empresa_id = assoc_comprovantes_pagamento.empresa_id
            and perfil.core_usuario_id = (select id from public.core_usuarios where auth_user_id = (select auth.uid()) limit 1)
            and perfil.status = 'ativo'
            and perfil.perfil in ('administrador', 'presidente', 'tesoureiro', 'conselho_fiscal')
        )
        or enviado_por = (select id from public.core_usuarios where auth_user_id = (select auth.uid()) limit 1)
      )
    )
  );

drop policy if exists assoc_comprovantes_pagamento_insert on public.assoc_comprovantes_pagamento;
create policy assoc_comprovantes_pagamento_insert on public.assoc_comprovantes_pagamento
  for insert to authenticated
  with check (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('portal-associativo')
      and enviado_por = (select id from public.core_usuarios where auth_user_id = (select auth.uid()) limit 1)
      and exists (
        select 1 from public.assoc_pessoas pessoa
        where pessoa.id = assoc_comprovantes_pagamento.pessoa_id
          and pessoa.empresa_id = assoc_comprovantes_pagamento.empresa_id
          and pessoa.core_usuario_id = assoc_comprovantes_pagamento.enviado_por
      )
    )
  );

drop policy if exists assoc_comprovantes_pagamento_update on public.assoc_comprovantes_pagamento;
create policy assoc_comprovantes_pagamento_update on public.assoc_comprovantes_pagamento
  for update to authenticated
  using (
    public.is_admin_master()
    or exists (
      select 1 from public.assoc_perfis_usuarios perfil
      where perfil.empresa_id = assoc_comprovantes_pagamento.empresa_id
        and perfil.core_usuario_id = (select id from public.core_usuarios where auth_user_id = (select auth.uid()) limit 1)
        and perfil.status = 'ativo'
        and perfil.perfil in ('administrador', 'tesoureiro')
    )
  )
  with check (empresa_id = public.current_empresa_id() or public.is_admin_master());

create table if not exists public.assoc_importacao_erros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  importacao_id uuid references public.assoc_importacoes(id) on delete cascade,
  linha integer,
  campo text,
  mensagem text not null,
  dados_linha jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

drop index if exists public.idx_assoc_unidades_empresa_loteamento_codigo;
drop index if exists public.idx_assoc_unidades_empresa_codigo_sem_loteamento;

create unique index if not exists idx_assoc_unidades_empresa_loteamento_codigo_numero
  on public.assoc_unidades(empresa_id, loteamento_id, codigo_unidade, numero_unidade)
  where loteamento_id is not null
    and codigo_unidade is not null and codigo_unidade <> ''
    and numero_unidade is not null and numero_unidade <> '';

create unique index if not exists idx_assoc_unidades_empresa_codigo_numero_sem_loteamento
  on public.assoc_unidades(empresa_id, codigo_unidade, numero_unidade)
  where loteamento_id is null
    and codigo_unidade is not null and codigo_unidade <> ''
    and numero_unidade is not null and numero_unidade <> '';

create index if not exists idx_assoc_pessoas_empresa_cidade_uf on public.assoc_pessoas(empresa_id, cidade, uf);
create index if not exists idx_assoc_unidades_empresa_criado on public.assoc_unidades(empresa_id, criado_em desc);
create index if not exists idx_assoc_cobrancas_empresa_criado on public.assoc_cobrancas(empresa_id, criado_em desc);
create index if not exists idx_assoc_reunioes_empresa_status on public.assoc_reunioes(empresa_id, status);
create index if not exists idx_assoc_avisos_empresa_publico on public.assoc_avisos(empresa_id, publico);
create index if not exists idx_assoc_projetos_empresa_liberado on public.assoc_projetos(empresa_id, liberado_associado);
create index if not exists idx_assoc_arquivos_transferencia on public.assoc_arquivos(empresa_id, transferencia_id);
create index if not exists idx_assoc_importacao_erros_importacao on public.assoc_importacao_erros(empresa_id, importacao_id);

alter table public.assoc_importacao_erros enable row level security;

drop policy if exists assoc_importacao_erros_empresa_access on public.assoc_importacao_erros;
create policy assoc_importacao_erros_empresa_access on public.assoc_importacao_erros
  for all to authenticated
  using (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.can_access_app('portal-associativo'))
  )
  with check (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.can_access_app('portal-associativo'))
  );
