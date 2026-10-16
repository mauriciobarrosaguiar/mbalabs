-- Catálogo administrado pelo MBA Cotações e disponibilizado SOMENTE mediante aceite da farmácia.
ALTER TABLE public.products ALTER COLUMN tipo_produto DROP NOT NULL;
CREATE TABLE IF NOT EXISTS public.cot_product_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ean text NOT NULL,
 produto text NOT NULL,
 laboratorio text NOT NULL,
 tipo_produto text NULL,
 ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT cot_product_catalog_ean_laboratorio_key UNIQUE (ean,laboratorio)
);
CREATE TABLE IF NOT EXISTS public.cot_catalog_preferences (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
 accepted boolean NOT NULL DEFAULT false,
 accepted_at timestamptz,
 accepted_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cot_product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cot_catalog_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cot_product_catalog FROM anon,authenticated;
REVOKE ALL ON public.cot_catalog_preferences FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cot_product_catalog TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cot_catalog_preferences TO service_role;
CREATE INDEX IF NOT EXISTS cot_product_catalog_ean_idx ON public.cot_product_catalog(ean);
COMMENT ON TABLE public.cot_catalog_preferences IS 'Adesão explícita do cliente ao catálogo compartilhado; sem compartilhamento dos seus produtos privados.';
