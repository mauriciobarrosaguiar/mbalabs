-- Mantém os registros de acompanhamento escolar na mesma trilha de auditoria
-- das demais ações operacionais do MBA Escola.

drop trigger if exists audit_escola_acompanhamentos
on public.escola_acompanhamentos;

create trigger audit_escola_acompanhamentos
after insert or update or delete on public.escola_acompanhamentos
for each row execute function public.escola_audit_row_change();
