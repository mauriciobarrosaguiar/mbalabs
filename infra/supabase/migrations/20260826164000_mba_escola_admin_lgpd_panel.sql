begin;

-- Garante uma política base para todas as escolas já cadastradas.
insert into public.escola_documento_politicas (escola_id, retencao_dias, exclusao_automatica, orfao_grace_horas)
select e.id, null, false, 24
from public.escola_escolas e
on conflict (escola_id) do nothing;

-- Não permite marcar exclusão por retenção sem antes definir um prazo.
alter table public.escola_documento_politicas
  drop constraint if exists escola_documento_politicas_auto_requires_retention;
alter table public.escola_documento_politicas
  add constraint escola_documento_politicas_auto_requires_retention
  check (not exclusao_automatica or retencao_dias is not null);

-- Índices usados pelo painel de Segurança e LGPD.
create index if not exists escola_justificativa_arquivos_escola_criado_idx
  on public.escola_justificativa_arquivos (escola_id, criado_em desc);
create index if not exists escola_justificativa_arquivos_excluido_criado_idx
  on public.escola_justificativa_arquivos (excluido_em, criado_em desc);
create index if not exists escola_auditoria_recurso_criado_idx
  on public.escola_auditoria (recurso, criado_em desc);

-- Mudanças na política de retenção passam a entrar na auditoria append-only.
drop trigger if exists audit_escola_documento_politicas on public.escola_documento_politicas;
create trigger audit_escola_documento_politicas
after insert or update or delete on public.escola_documento_politicas
for each row execute function public.escola_audit_row_change();

commit;
