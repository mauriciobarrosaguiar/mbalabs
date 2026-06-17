-- LexGestor functional upgrade.
-- ATENCAO: aplicar no Supabase antes de usar upload/OAuth em producao.
-- Escopo restrito a tabelas public.lex_*.

create extension if not exists pgcrypto;

alter table if exists public.lex_escritorios
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists lex_escritorios_empresa_unique_idx
  on public.lex_escritorios(empresa_id)
  where empresa_id is not null;

create unique index if not exists lex_advogados_escritorio_usuario_unique_idx
  on public.lex_advogados(escritorio_id, core_usuario_id)
  where core_usuario_id is not null;

create table if not exists public.lex_categorias (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid null references public.lex_escritorios(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  ordem int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lex_subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.lex_categorias(id) on delete cascade,
  escritorio_id uuid null references public.lex_escritorios(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  ordem int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lex_categorias_global_nome_unique_idx
  on public.lex_categorias(nome)
  where escritorio_id is null;

create unique index if not exists lex_subcategorias_categoria_nome_unique_idx
  on public.lex_subcategorias(categoria_id, nome);

alter table if exists public.lex_clientes
  add column if not exists origem text,
  add column if not exists status text not null default 'Ativo',
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.lex_casos
  add column if not exists categoria_id uuid null references public.lex_categorias(id) on delete set null,
  add column if not exists subcategoria_id uuid null references public.lex_subcategorias(id) on delete set null,
  add column if not exists categoria_nome text,
  add column if not exists subcategoria_nome text,
  add column if not exists chave_processo text,
  add column if not exists sistema_judicial text,
  add column if not exists tribunal text,
  add column if not exists uf text,
  add column if not exists classe_processual text,
  add column if not exists assunto text,
  add column if not exists fase_processual text,
  add column if not exists grau text,
  add column if not exists polo_ativo text,
  add column if not exists polo_passivo text,
  add column if not exists advogado_responsavel text,
  add column if not exists valor_causa numeric,
  add column if not exists justica_gratuita boolean not null default false,
  add column if not exists data_distribuicao date,
  add column if not exists proximo_prazo date,
  add column if not exists tipo_prazo text,
  add column if not exists link_processo text,
  add column if not exists observacoes_processo text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.lex_documentos
  add column if not exists categoria_id uuid null references public.lex_categorias(id) on delete set null,
  add column if not exists subcategoria_id uuid null references public.lex_subcategorias(id) on delete set null,
  add column if not exists categoria_nome text,
  add column if not exists subcategoria_nome text,
  add column if not exists origem text,
  add column if not exists observacoes text,
  add column if not exists storage_provider text,
  add column if not exists storage_file_id text,
  add column if not exists storage_folder_id text,
  add column if not exists storage_path text,
  add column if not exists storage_url text,
  add column if not exists pdf_storage_file_id text,
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_storage_url text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.lex_storage_connections (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'dropbox')),
  status text not null default 'nao_conectado',
  account_email text,
  root_folder_id text,
  root_folder_path text not null default '/LexGestor',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lex_storage_connections_provider_unique_idx
  on public.lex_storage_connections(escritorio_id, provider);

create table if not exists public.lex_relatorios (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  tipo text not null,
  filtros jsonb not null default '{}'::jsonb,
  arquivo_url text,
  arquivo_path text,
  gerado_por uuid null,
  created_at timestamptz not null default now()
);

create index if not exists lex_categorias_escritorio_idx on public.lex_categorias(escritorio_id);
create index if not exists lex_subcategorias_categoria_idx on public.lex_subcategorias(categoria_id);
create index if not exists lex_storage_connections_escritorio_idx on public.lex_storage_connections(escritorio_id);
create index if not exists lex_relatorios_escritorio_idx on public.lex_relatorios(escritorio_id);
create index if not exists lex_casos_proximo_prazo_idx on public.lex_casos(proximo_prazo);

alter table public.lex_categorias enable row level security;
alter table public.lex_subcategorias enable row level security;
alter table public.lex_storage_connections enable row level security;
alter table public.lex_relatorios enable row level security;

insert into public.lex_categorias (nome, ordem)
values
  ('Previdenciario', 1),
  ('Criminal', 2),
  ('Familia', 3),
  ('Trabalhista', 4),
  ('Tributario', 5),
  ('Civil', 6),
  ('Consumidor', 7),
  ('Empresarial', 8),
  ('Bancario', 9),
  ('Imobiliario', 10),
  ('Outros', 11)
on conflict do nothing;

with categorias(nome, subcategorias) as (
  values
    ('Previdenciario', array['Auxilio-doenca','Aposentadoria por idade','Aposentadoria por tempo de contribuicao','Aposentadoria rural','BPC/LOAS','Pensao por morte','Revisao de beneficio','Salario-maternidade','Beneficio negado','Acidente de trabalho']),
    ('Criminal', array['Inquerito policial','Prisao em flagrante','Audiencia de custodia','Medida protetiva','Acao penal','Execucao penal','Habeas corpus','Crimes contra a honra','Violencia domestica','Trafico/posse de drogas']),
    ('Familia', array['Divorcio consensual','Divorcio litigioso','Guarda','Pensao alimenticia','Revisao de alimentos','Inventario','Partilha de bens','Uniao estavel','Alienacao parental','Adocao']),
    ('Trabalhista', array['Rescisao indireta','Verbas rescisorias','Horas extras','FGTS','Acidente de trabalho','Vinculo empregaticio','Assedio moral','Adicional de insalubridade','Adicional de periculosidade','Reclamacao trabalhista']),
    ('Tributario', array['Execucao fiscal','CDA','Defesa administrativa','Parcelamento','Divida ativa','Auto de infracao','Revisao tributaria','Exclusao de imposto','Compensacao tributaria','Regularizacao fiscal']),
    ('Civil', array['Cobranca','Indenizacao','Contratos','Responsabilidade civil','Obrigacao de fazer','Obrigacao de nao fazer','Danos morais','Danos materiais','Usucapiao','Acao monitoria']),
    ('Consumidor', array['Produto com defeito','Servico nao prestado','Negativacao indevida','Cobranca indevida','Banco/cartao','Plano de saude','Energia/agua/internet','Golpe/fraude','Compra online','Cancelamento de contrato']),
    ('Empresarial', array['Contrato social','Alteracao contratual','Cobranca empresarial','Recuperacao de credito','Dissolucao societaria','Distrato','Notificacao extrajudicial','Defesa empresarial','Analise contratual','Compliance simples']),
    ('Bancario', array['Emprestimo consignado','Juros abusivos','Cartao de credito','Financiamento','Busca e apreensao','Fraude bancaria','Conta bloqueada','Desconto indevido','Revisional','Superendividamento']),
    ('Imobiliario', array['Compra e venda','Locacao','Despejo','Usucapiao','Condominio','Atraso de obra','Regularizacao de imovel','Contrato de aluguel','Reintegracao de posse','Escritura/registro']),
    ('Outros', array['Atendimento inicial','Consulta avulsa','Notificacao extrajudicial','Analise de documento','Outro tipo de caso'])
)
insert into public.lex_subcategorias (categoria_id, nome, ordem)
select c.id, s.nome, s.ordem
from categorias input
join public.lex_categorias c on c.nome = input.nome and c.escritorio_id is null
cross join lateral unnest(input.subcategorias) with ordinality as s(nome, ordem)
on conflict do nothing;
