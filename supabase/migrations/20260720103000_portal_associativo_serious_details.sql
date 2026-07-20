-- Portal Associativo: responsáveis institucionais, público de avisos e transferências abonadas.
-- Alterações aditivas; nenhum dado existente é apagado.

alter table public.assoc_configuracoes
  add column if not exists responsavel_pessoa_id uuid references public.assoc_pessoas(id) on delete set null,
  add column if not exists assinatura_tipo text not null default 'entidade',
  add column if not exists assinatura_pessoa_id uuid references public.assoc_pessoas(id) on delete set null,
  add column if not exists logo_arquivo_id uuid references public.assoc_arquivos(id) on delete set null,
  add column if not exists recebedor_uf text;

alter table public.assoc_configuracoes
  alter column valor_mensalidade_padrao set default 20.00;

alter table public.assoc_configuracoes
  drop constraint if exists assoc_configuracoes_assinatura_tipo_check;

alter table public.assoc_configuracoes
  add constraint assoc_configuracoes_assinatura_tipo_check
  check (assinatura_tipo in ('entidade', 'responsavel', 'presidente', 'tesoureiro', 'secretario', 'pessoa'));

alter table public.assoc_avisos
  add column if not exists pessoa_id uuid references public.assoc_pessoas(id) on delete set null;

alter table public.assoc_avisos
  drop constraint if exists assoc_avisos_publico_check;

alter table public.assoc_avisos
  add constraint assoc_avisos_publico_check
  check (publico in ('todos', 'associados', 'adimplentes', 'inadimplentes', 'pessoa', 'diretoria', 'perfil', 'por_perfil', 'unidade', 'por_unidade', 'status_cobranca'));

alter table public.assoc_transferencias
  drop constraint if exists assoc_transferencias_responsabilidade_debitos_check;

alter table public.assoc_transferencias
  add constraint assoc_transferencias_responsabilidade_debitos_check
  check (responsabilidade_debitos in ('anterior', 'novo', 'dividida', 'entidade', 'antigo_responsavel', 'novo_responsavel', 'dividido', 'quitado', 'abonado'));

create index if not exists idx_assoc_configuracoes_responsavel on public.assoc_configuracoes(empresa_id, responsavel_pessoa_id);
create index if not exists idx_assoc_avisos_empresa_pessoa on public.assoc_avisos(empresa_id, pessoa_id);

alter table public.assoc_loteamentos
  add column if not exists tipo_loteamento text not null default 'outro';
