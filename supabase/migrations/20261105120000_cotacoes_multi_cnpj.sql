-- Preserve the original buyer details for newly issued pharmacy quotations.
ALTER TABLE public.quotations
  ADD COLUMN buyer_cnpj text,
  ADD COLUMN buyer_pharmacy_name text,
  ADD COLUMN buyer_pharmacy_legal_name text;

CREATE FUNCTION public.cot_valid_pharmacy_cnpj(document text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = ''
AS $$
DECLARE
  digit_count integer;
  character_index integer;
  total integer;
  remainder integer;
BEGIN
  IF document !~ '^[A-Z0-9]{12}[0-9]{2}$'
    OR document ~ '^([0-9])\1{13}$' THEN
    RETURN false;
  END IF;
  FOR digit_count IN 12..13 LOOP
    total := 0;
    FOR character_index IN 1..digit_count LOOP
      total := total + (ascii(substr(document, character_index, 1)) - 48) *
        (2 + (digit_count - character_index) % 8);
    END LOOP;
    remainder := total % 11;
    IF substr(document, digit_count + 1, 1)::integer <>
      (CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION public.cot_check_pharmacy_registration()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized text := translate(upper(btrim(NEW.cnpj)), './-', '');
  activating boolean := NEW.status = 'ativo';
  changed_document boolean := true;
  unit_limit integer;
  used_units bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'A farmácia deve permanecer na empresa original.' USING ERRCODE = 'P7102';
    END IF;
    activating := activating AND OLD.status IS DISTINCT FROM 'ativo';
    changed_document := NEW.cnpj IS DISTINCT FROM OLD.cnpj;
  END IF;

  IF changed_document OR activating THEN
    IF NOT public.cot_valid_pharmacy_cnpj(normalized) THEN
      RAISE EXCEPTION 'Informe um CNPJ de farmácia válido.' USING ERRCODE = 'P7102';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('mba-cot-pharmacy-cnpj'), hashtext(normalized));
    IF EXISTS (
      SELECT 1 FROM public.pharmacies p
       WHERE translate(upper(btrim(p.cnpj)), './-', '') = normalized
         AND p.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Este CNPJ já está cadastrado como farmácia.' USING ERRCODE = 'P7103';
    END IF;
    NEW.cnpj := normalized;
  END IF;

  IF activating THEN
    PERFORM pg_advisory_xact_lock(hashtext('mba-cot-pharmacy-plan'), hashtext(NEW.tenant_id::text));
    SELECT sp.max_pharmacies INTO unit_limit
      FROM public.tenants t JOIN public.subscription_plans sp ON sp.id = t.plano_id
     WHERE t.id = NEW.tenant_id;
    SELECT count(*) INTO used_units FROM public.pharmacies
     WHERE tenant_id = NEW.tenant_id AND status = 'ativo' AND id <> NEW.id;
    IF unit_limit IS NOT NULL AND used_units >= unit_limit THEN
      RAISE EXCEPTION 'Limite de CNPJs ativos atingido (% de %).', used_units, unit_limit USING ERRCODE = 'P7103';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE INDEX cot_pharmacies_normalized_cnpj_idx
  ON public.pharmacies ((translate(upper(btrim(cnpj)), './-', '')));
CREATE INDEX cot_pharmacies_active_tenant_idx
  ON public.pharmacies (tenant_id) WHERE status = 'ativo';

CREATE TRIGGER cot_pharmacy_registration
BEFORE INSERT OR UPDATE OF tenant_id, status, cnpj ON public.pharmacies
FOR EACH ROW EXECUTE FUNCTION public.cot_check_pharmacy_registration();

CREATE FUNCTION public.cot_set_quotation_buyer()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  unit public.pharmacies%ROWTYPE;
  original public.quotations%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.module_type = 'pharmacy' OR NEW.module_type = 'pharmacy') AND (
      NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id OR
      NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
      NEW.module_type IS DISTINCT FROM OLD.module_type OR
      NEW.buyer_cnpj IS DISTINCT FROM OLD.buyer_cnpj OR
      NEW.buyer_pharmacy_name IS DISTINCT FROM OLD.buyer_pharmacy_name OR
      NEW.buyer_pharmacy_legal_name IS DISTINCT FROM OLD.buyer_pharmacy_legal_name
    ) THEN
      RAISE EXCEPTION 'A farmácia compradora é fixa após a criação da cotação.' USING ERRCODE = 'P7101';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.module_type <> 'pharmacy' THEN RETURN NEW; END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.can_manage_cotacoes_catalog(NEW.tenant_id) THEN
      RAISE EXCEPTION 'Sem permissão para criar cotações desta empresa.' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := public.current_user_profile_id();
  END IF;

  SELECT * INTO unit FROM public.pharmacies
    WHERE id = NEW.pharmacy_id AND tenant_id = NEW.tenant_id AND status = 'ativo'
    FOR SHARE;
  IF NOT FOUND OR NOT public.cot_valid_pharmacy_cnpj(translate(upper(btrim(unit.cnpj)), './-', '')) THEN
    RAISE EXCEPTION 'Selecione uma farmácia ativa com CNPJ válido da sua empresa.' USING ERRCODE = 'P7101';
  END IF;

  NEW.buyer_cnpj := translate(upper(btrim(unit.cnpj)), './-', '');
  NEW.buyer_pharmacy_name := unit.nome_fantasia;
  NEW.buyer_pharmacy_legal_name := unit.razao_social;
  IF NEW.source_quotation_id IS NOT NULL THEN
    SELECT * INTO original FROM public.quotations
      WHERE id = NEW.source_quotation_id AND tenant_id = NEW.tenant_id
        AND module_type = 'pharmacy' AND pharmacy_id = NEW.pharmacy_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A cotação complementar deve usar a farmácia da cotação original.' USING ERRCODE = 'P7101';
    END IF;
    NEW.buyer_cnpj := coalesce(original.buyer_cnpj, NEW.buyer_cnpj);
    NEW.buyer_pharmacy_name := coalesce(original.buyer_pharmacy_name, NEW.buyer_pharmacy_name);
    NEW.buyer_pharmacy_legal_name := coalesce(original.buyer_pharmacy_legal_name, NEW.buyer_pharmacy_legal_name);
  END IF;
  NEW.buyer_company_name := NEW.buyer_pharmacy_name;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cot_quotation_buyer
BEFORE INSERT OR UPDATE OF tenant_id, module_type, pharmacy_id, buyer_cnpj, buyer_pharmacy_name, buyer_pharmacy_legal_name
ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.cot_set_quotation_buyer();

REVOKE ALL ON FUNCTION public.cot_check_pharmacy_registration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cot_set_quotation_buyer() FROM PUBLIC, anon, authenticated;

-- Keep tenant reads available to buyers, with unit management limited to administrators.
CREATE FUNCTION public.cot_can_manage_pharmacies(company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users membership
    JOIN public.tenants tenant ON tenant.id = membership.tenant_id
    WHERE membership.tenant_id = company_id
      AND membership.user_profile_id = public.current_user_profile_id()
      AND membership.status = 'ativo'
      AND membership.role = 'ADMIN_EMPRESA'
      AND tenant.status IN ('ativo', 'teste')
      AND tenant.tipo_cliente IN ('pharmacy', 'both')
  );
$$;

REVOKE ALL ON FUNCTION public.cot_can_manage_pharmacies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cot_can_manage_pharmacies(uuid) TO authenticated;

ALTER POLICY pharmacies_tenant_insert ON public.pharmacies
  WITH CHECK (public.is_super_admin() OR public.cot_can_manage_pharmacies(tenant_id));
ALTER POLICY pharmacies_tenant_update ON public.pharmacies
  USING (public.is_super_admin() OR public.cot_can_manage_pharmacies(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.cot_can_manage_pharmacies(tenant_id));
DROP POLICY pharmacies_tenant_delete ON public.pharmacies;
