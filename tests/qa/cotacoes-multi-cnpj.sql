-- Run with ON_ERROR_STOP on an isolated database with the Cotações migrations applied.
BEGIN;

DO $$
DECLARE
  company uuid := gen_random_uuid();
  foreign_company uuid := gen_random_uuid();
  plan uuid := gen_random_uuid();
  unit_a uuid := gen_random_uuid();
  unit_b uuid := gen_random_uuid();
  unit_c uuid := gen_random_uuid();
  foreign_unit uuid := gen_random_uuid();
  quotation uuid;
  complement uuid;
  order_id uuid;
BEGIN
  INSERT INTO subscription_plans (id, name, modules, max_pharmacies) VALUES (plan, 'QA Multi-CNPJ', 'pharmacy', 3);
  INSERT INTO tenants (id, nome_fantasia, razao_social, cnpj, tipo_cliente, responsavel_nome, responsavel_email, plano_id) VALUES
    (company, 'QA Rede', 'QA Rede', '11222333000181', 'pharmacy', 'QA', 'qa@example.invalid', plan),
    (foreign_company, 'QA Outra', 'QA Outra', '11222333000424', 'pharmacy', 'QA', 'outra@example.invalid', plan);
  INSERT INTO pharmacies (id, tenant_id, nome_fantasia, razao_social, cnpj) VALUES
    (unit_a, company, 'Matriz', 'Matriz QA', '11222333000181'),
    (unit_b, company, 'Filial 1', 'Filial 1 QA', '11222333000262'),
    (unit_c, company, 'Filial 2', 'Filial 2 QA', '11222333000343'),
    (foreign_unit, foreign_company, 'Outra', 'Outra QA', '11222333000424');

  INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id)
    SELECT company, 'pharmacy', nome_fantasia, id FROM pharmacies WHERE tenant_id = company;
  IF (SELECT count(DISTINCT buyer_cnpj) FROM quotations WHERE tenant_id = company) <> 3 THEN
    RAISE EXCEPTION 'Falha ao gravar os três CNPJs';
  END IF;
  SELECT id INTO STRICT quotation FROM quotations WHERE tenant_id = company AND pharmacy_id = unit_b;
  INSERT INTO purchase_orders (tenant_id, quotation_id, module_type, supplier_name)
    VALUES (company, quotation, 'pharmacy', 'Fornecedor QA') RETURNING id INTO order_id;

  UPDATE pharmacies SET nome_fantasia = 'Filial renomeada' WHERE id = unit_b;
  INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id, source_quotation_id)
    VALUES (company, 'pharmacy', 'Complemento', unit_b, quotation) RETURNING id INTO complement;
  IF NOT EXISTS (SELECT 1 FROM quotations WHERE id = complement AND buyer_cnpj = '11222333000262'
      AND buyer_pharmacy_name = 'Filial 1' AND status = 'draft') THEN
    RAISE EXCEPTION 'O complemento perdeu o retrato original';
  END IF;

  UPDATE pharmacies SET cnpj = '11222333000777' WHERE id = unit_b;
  BEGIN
    INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id, source_quotation_id)
      VALUES (company, 'pharmacy', 'CNPJ alterado', unit_b, quotation);
    RAISE EXCEPTION 'Complemento aceitou CNPJ alterado';
  EXCEPTION WHEN SQLSTATE 'P7101' THEN
    IF SQLERRM NOT LIKE 'O CNPJ da unidade mudou.%' THEN RAISE; END IF;
  END;
  UPDATE pharmacies SET status = 'inativo' WHERE id = unit_b;
  BEGIN
    INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id, source_quotation_id)
      VALUES (company, 'pharmacy', 'Inativa', unit_b, quotation);
    RAISE EXCEPTION 'Complemento aceitou unidade inativa';
  EXCEPTION WHEN SQLSTATE 'P7101' THEN
    IF SQLERRM NOT LIKE 'A unidade da cotação original está inativa.%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id)
      VALUES (company, 'pharmacy', 'Inativa', unit_b);
    RAISE EXCEPTION 'Cotação aceitou unidade inativa';
  EXCEPTION WHEN SQLSTATE 'P7101' THEN NULL;
  END;
  BEGIN
    INSERT INTO quotations (tenant_id, module_type, name, pharmacy_id)
      VALUES (company, 'pharmacy', 'Outra empresa', foreign_unit);
    RAISE EXCEPTION 'Cotação aceitou unidade de outro tenant';
  EXCEPTION WHEN SQLSTATE 'P7101' THEN NULL;
  END;
  BEGIN
    UPDATE quotations SET source_quotation_id = NULL WHERE id = complement;
    RAISE EXCEPTION 'Origem do complemento mudou após gravação';
  EXCEPTION WHEN SQLSTATE 'P7101' THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM purchase_orders p JOIN quotations q ON q.id = p.quotation_id
      WHERE p.id = order_id AND q.buyer_cnpj = '11222333000262' AND q.buyer_pharmacy_name = 'Filial 1') THEN
    RAISE EXCEPTION 'O pedido histórico perdeu o retrato original';
  END IF;

  INSERT INTO pharmacies (tenant_id, nome_fantasia, razao_social, cnpj)
    VALUES (company, 'Nova QA', 'Nova QA', '11222333000505');
  BEGIN
    UPDATE pharmacies SET status = 'ativo' WHERE id = unit_b;
    RAISE EXCEPTION 'Reativação ignorou o limite do plano';
  EXCEPTION WHEN SQLSTATE 'P7103' THEN NULL;
  END;
  BEGIN
    INSERT INTO pharmacies (tenant_id, nome_fantasia, razao_social, cnpj)
      VALUES (foreign_company, 'Duplicada', 'Duplicada', '11.222.333/0001-81');
    RAISE EXCEPTION 'Cadastro aceitou CNPJ duplicado';
  EXCEPTION WHEN SQLSTATE 'P7103' THEN NULL;
  END;
END;
$$;

ROLLBACK;
