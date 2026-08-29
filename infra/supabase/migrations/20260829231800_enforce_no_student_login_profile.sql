-- MBA Escola: não existe perfil autenticado de aluno.
-- Alunos são registros escolares e o acesso familiar é feito por RESPONSÁVEL.

alter table public.escola_perfis
  drop constraint if exists escola_perfis_papel_autenticado_chk;

alter table public.escola_perfis
  add constraint escola_perfis_papel_autenticado_chk
  check (papel in ('admin_escola','direcao','coordenacao','professor','responsavel'));

alter table public.escola_convites
  drop constraint if exists escola_convites_papel_autenticado_chk;

alter table public.escola_convites
  add constraint escola_convites_papel_autenticado_chk
  check (papel in ('admin_escola','direcao','coordenacao','professor','responsavel'));

alter table public.escola_convites
  drop constraint if exists escola_convites_aluno_somente_responsavel_chk;

alter table public.escola_convites
  add constraint escola_convites_aluno_somente_responsavel_chk
  check (aluno_id is null or papel = 'responsavel');
