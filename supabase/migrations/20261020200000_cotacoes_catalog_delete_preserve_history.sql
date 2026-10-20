-- Exclusão visível preservando chaves estrangeiras e históricos de cotações e pedidos.
-- Cadastros com vínculos não são apagados fisicamente: deixam de participar
-- de novas operações. Registros históricos continuam referenciáveis.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS cot_products_available_idx
  ON public.products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cot_suppliers_available_idx
  ON public.suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cot_distributors_available_idx
  ON public.distributors(tenant_id) WHERE deleted_at IS NULL;
