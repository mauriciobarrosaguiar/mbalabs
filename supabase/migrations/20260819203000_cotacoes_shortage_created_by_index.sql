-- MBA Cotações oficial: índice para a auditoria da Lista de Faltas.
-- Nenhum dado existente é alterado ou apagado.

create index if not exists shortage_items_created_by_idx
  on public.shortage_items (created_by)
  where created_by is not null;
