-- MBA Escola: indices de apoio para os caminhos mais usados no E2E e em producao.
-- Mantem o modelo de dados inalterado; apenas reduz custo de filtros/joins por tenant e ator.

create index if not exists escola_aluno_responsaveis_responsavel_aluno_idx
  on public.escola_aluno_responsaveis(responsavel_id, aluno_id);

create index if not exists escola_agenda_eventos_escola_inicio_idx
  on public.escola_agenda_eventos(escola_id, inicio);

create index if not exists escola_acompanhamentos_escola_aluno_criado_idx
  on public.escola_acompanhamentos(escola_id, aluno_id, criado_em desc);

create index if not exists escola_auditoria_escola_criado_idx
  on public.escola_auditoria(escola_id, criado_em desc);

create index if not exists escola_auditoria_ator_criado_idx
  on public.escola_auditoria(ator_id, criado_em desc);
