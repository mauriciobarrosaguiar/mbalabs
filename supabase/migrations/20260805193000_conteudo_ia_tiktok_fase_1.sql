create extension if not exists pgcrypto;

insert into public.core_apps (
  slug,
  nome,
  descricao,
  url_path,
  url_interna,
  url_externa,
  logo_icone,
  status,
  ativo,
  ordem
)
values (
  'conteudo-ia',
  'MBA Conteúdo IA',
  'Planejamento e criação inteligente de conteúdo para redes sociais, iniciando pelo TikTok.',
  '/conteudo-ia',
  '/conteudo-ia',
  null,
  'IA',
  'ativo',
  true,
  70
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  url_externa = excluded.url_externa,
  logo_icone = excluded.logo_icone,
  status = excluded.status,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  updated_at = now();

insert into public.core_planos (
  app_id,
  nome,
  descricao,
  valor_mensal,
  limite_usuarios,
  limite_registros,
  ativo
)
select
  id,
  'Uso Pessoal',
  'Plano interno para validar a estratégia e a geração de conteúdo antes da abertura comercial.',
  0,
  1,
  5000,
  true
from public.core_apps
where slug = 'conteudo-ia'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (
  app_id,
  nome,
  descricao,
  valor_mensal,
  limite_usuarios,
  limite_registros,
  ativo
)
select
  id,
  'Profissional',
  'Estrutura comercial preparada para múltiplas marcas, usuários, calendários e limites de geração.',
  0,
  5,
  50000,
  false
from public.core_apps
where slug = 'conteudo-ia'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros;

create table if not exists public.conteudo_marcas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  criado_por uuid references public.core_usuarios(id) on delete set null,
  nome text not null,
  nicho text not null,
  subnicho text,
  publico_alvo text not null,
  objetivo text not null,
  tom_voz text not null,
  cidade_regiao text,
  frequencia text not null default 'semanal' check (frequencia in ('diaria', 'semanal')),
  posts_por_periodo integer not null default 5 check (posts_por_periodo between 1 and 14),
  pilares text[] not null default '{}'::text[],
  logo_url text,
  cores text[] not null default '{}'::text[],
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conteudo_perfis_sociais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  marca_id uuid not null references public.conteudo_marcas(id) on delete cascade,
  rede text not null check (rede in ('tiktok', 'instagram', 'kwai')),
  username text not null,
  profile_url text,
  external_user_id text,
  display_name text,
  bio text,
  avatar_url text,
  seguidores integer,
  seguindo integer,
  curtidas_total bigint,
  videos_total integer,
  status_integracao text not null default 'manual' check (
    status_integracao in ('manual', 'aguardando_autorizacao', 'conectado', 'erro')
  ),
  ultima_sincronizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marca_id, rede)
);

create table if not exists public.conteudo_planejamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  marca_id uuid not null references public.conteudo_marcas(id) on delete cascade,
  perfil_social_id uuid references public.conteudo_perfis_sociais(id) on delete set null,
  periodo_inicio date not null,
  frequencia text not null check (frequencia in ('diaria', 'semanal')),
  quantidade_conteudos integer not null default 1 check (quantidade_conteudos between 1 and 31),
  objetivo text not null,
  resumo_estrategico text,
  insight_publico text,
  conteudo_json jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (
    status in ('rascunho', 'gerando', 'gerado', 'aprovado', 'erro')
  ),
  criado_por uuid references public.core_usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conteudo_publicacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  planejamento_id uuid not null references public.conteudo_planejamentos(id) on delete cascade,
  marca_id uuid not null references public.conteudo_marcas(id) on delete cascade,
  perfil_social_id uuid references public.conteudo_perfis_sociais(id) on delete set null,
  rede text not null default 'tiktok' check (rede in ('tiktok', 'instagram', 'kwai')),
  ordem integer not null default 1,
  data_sugerida date,
  objetivo text,
  formato text not null check (formato in ('video_curto', 'carrossel', 'imagem')),
  tema text not null,
  titulo text not null,
  gancho text not null,
  roteiro text not null,
  legenda text not null,
  chamada_acao text not null,
  hashtags text[] not null default '{}'::text[],
  briefing_visual text,
  duracao_segundos integer,
  largura integer not null default 1080,
  altura integer not null default 1920,
  arte_url text,
  video_url text,
  status text not null default 'rascunho' check (
    status in ('rascunho', 'aprovado', 'agendado', 'publicado', 'arquivado')
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conteudo_consumo_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  planejamento_id uuid references public.conteudo_planejamentos(id) on delete set null,
  provedor text not null default 'openai',
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_estimado numeric(12,6),
  requisicao_id text,
  finalidade text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conteudo_marcas_empresa on public.conteudo_marcas (empresa_id, ativo);
create index if not exists idx_conteudo_perfis_empresa on public.conteudo_perfis_sociais (empresa_id, rede);
create index if not exists idx_conteudo_planejamentos_empresa on public.conteudo_planejamentos (empresa_id, created_at desc);
create index if not exists idx_conteudo_publicacoes_planejamento on public.conteudo_publicacoes (planejamento_id, ordem);
create index if not exists idx_conteudo_publicacoes_empresa_data on public.conteudo_publicacoes (empresa_id, data_sugerida);
create index if not exists idx_conteudo_consumo_empresa on public.conteudo_consumo_ia (empresa_id, created_at desc);

drop trigger if exists trg_conteudo_marcas_updated_at on public.conteudo_marcas;
create trigger trg_conteudo_marcas_updated_at
before update on public.conteudo_marcas
for each row execute function public.set_updated_at();

drop trigger if exists trg_conteudo_perfis_updated_at on public.conteudo_perfis_sociais;
create trigger trg_conteudo_perfis_updated_at
before update on public.conteudo_perfis_sociais
for each row execute function public.set_updated_at();

drop trigger if exists trg_conteudo_planejamentos_updated_at on public.conteudo_planejamentos;
create trigger trg_conteudo_planejamentos_updated_at
before update on public.conteudo_planejamentos
for each row execute function public.set_updated_at();

drop trigger if exists trg_conteudo_publicacoes_updated_at on public.conteudo_publicacoes;
create trigger trg_conteudo_publicacoes_updated_at
before update on public.conteudo_publicacoes
for each row execute function public.set_updated_at();

alter table public.conteudo_marcas enable row level security;
alter table public.conteudo_perfis_sociais enable row level security;
alter table public.conteudo_planejamentos enable row level security;
alter table public.conteudo_publicacoes enable row level security;
alter table public.conteudo_consumo_ia enable row level security;

drop policy if exists conteudo_marcas_empresa_access on public.conteudo_marcas;
create policy conteudo_marcas_empresa_access
on public.conteudo_marcas
for all
to authenticated
using (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
)
with check (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
);

drop policy if exists conteudo_perfis_empresa_access on public.conteudo_perfis_sociais;
create policy conteudo_perfis_empresa_access
on public.conteudo_perfis_sociais
for all
to authenticated
using (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
)
with check (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
);

drop policy if exists conteudo_planejamentos_empresa_access on public.conteudo_planejamentos;
create policy conteudo_planejamentos_empresa_access
on public.conteudo_planejamentos
for all
to authenticated
using (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
)
with check (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
);

drop policy if exists conteudo_publicacoes_empresa_access on public.conteudo_publicacoes;
create policy conteudo_publicacoes_empresa_access
on public.conteudo_publicacoes
for all
to authenticated
using (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
)
with check (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
);

drop policy if exists conteudo_consumo_empresa_access on public.conteudo_consumo_ia;
create policy conteudo_consumo_empresa_access
on public.conteudo_consumo_ia
for all
to authenticated
using (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
)
with check (
  public.is_admin_master()
  or (empresa_id = public.current_empresa_id() and public.can_access_app('conteudo-ia'))
);

grant select, insert, update, delete on public.conteudo_marcas to authenticated;
grant select, insert, update, delete on public.conteudo_perfis_sociais to authenticated;
grant select, insert, update, delete on public.conteudo_planejamentos to authenticated;
grant select, insert, update, delete on public.conteudo_publicacoes to authenticated;
grant select, insert, update, delete on public.conteudo_consumo_ia to authenticated;
