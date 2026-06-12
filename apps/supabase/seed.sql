insert into public.unit_types (code, name, plural_name) values
  ('CP','Comprimido','Comprimidos'),
  ('CAP','Cápsula','Cápsulas'),
  ('AMP','Ampola','Ampolas'),
  ('FR','Frasco','Frascos'),
  ('BIS','Bisnaga','Bisnagas'),
  ('SACHE','Sachê','Sachês'),
  ('FLAC','Flaconete','Flaconetes'),
  ('ML','Mililitro','Mililitros'),
  ('G','Grama','Gramas'),
  ('KG','Quilograma','Quilogramas'),
  ('DOSE','Dose','Doses'),
  ('UN','Unidade','Unidades'),
  ('CX','Caixa','Caixas')
on conflict (code) do nothing;

insert into public.subscription_plans (id, name, monthly_price, max_users, max_quotations_month, modules)
values
  ('10000000-0000-0000-0000-000000000001','Profissional',349,8,120,'both'),
  ('10000000-0000-0000-0000-000000000002','Licitações Enterprise',899,25,500,'distributor_bidding')
on conflict (id) do nothing;

insert into public.tenants (
  id, nome_fantasia, razao_social, cnpj, tipo_cliente, responsavel_nome,
  responsavel_email, responsavel_whatsapp, plano_id, status, data_inicio,
  data_vencimento, valor_mensal
) values
  (
    '20000000-0000-0000-0000-000000000001','Farmácia Exemplo','Farmácia Exemplo Ltda',
    '12.345.678/0001-90','pharmacy','Marina Costa','marina@farmaciaexemplo.com.br',
    '(62) 99999-0001','10000000-0000-0000-0000-000000000001','ativo',
    '2026-01-05','2026-06-05',349
  ),
  (
    '20000000-0000-0000-0000-000000000002','Distribuidora Licitação Exemplo',
    'Distribuidora Licitação Exemplo S.A.','98.765.432/0001-10',
    'distributor_bidding','Renato Lima','compras@licitacaoexemplo.com.br',
    '(61) 98888-0101','10000000-0000-0000-0000-000000000002','teste',
    '2026-05-01','2026-06-01',899
  )
on conflict (id) do nothing;

insert into public.pharmacies (
  id, tenant_id, nome_fantasia, razao_social, cnpj, cidade, uf, responsavel, whatsapp, email
) values (
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  'Farmácia Exemplo','Farmácia Exemplo Ltda','12.345.678/0001-90',
  'Goiânia','GO','Marina Costa','(62) 99999-0001','compras@farmaciaexemplo.com.br'
) on conflict (id) do nothing;

insert into public.suppliers (id, tenant_id, nome, empresa, whatsapp, email, tipo_fornecedor)
values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','João Medicamentos','João Medicamentos','(62) 99911-1111','joao@medicamentos.com.br','vendedor'),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Ana Distribuidora','Ana Distribuidora','(61) 99922-2222','ana@distribuidora.com.br','distribuidora'),
  ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Carlos Farma','Carlos Farma','(63) 99933-3333','carlos@farma.com.br','vendedor')
on conflict (id) do nothing;

insert into public.distributors (id, tenant_id, nome, unidade_cd, uf, pedido_minimo, prazo_medio)
values
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Panpharma','GO','GO',50,'1 dia'),
  ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Profarma','DF','DF',200,'2 dias'),
  ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Nazária Imperatriz','Imperatriz','MA',200,'3 dias'),
  ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','Total','TO','TO',300,'4 dias')
on conflict (id) do nothing;

insert into public.laboratories (id, tenant_id, nome, tipo)
values
  ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','EMS','laboratorio'),
  ('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Eurofarma','laboratorio'),
  ('60000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Medley','laboratorio')
on conflict (id) do nothing;

insert into public.products (
  id, tenant_id, nome, principio_ativo, dosagem, forma, tipo_produto, unidade_base, apresentacao, quantidade_por_embalagem
) values
  ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Losartana 50mg c/30','Losartana Potássica','50mg','Comprimido','generico','CP','Caixa com 30 comprimidos',30),
  ('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Dipirona 500mg c/20','Dipirona','500mg','Comprimido','mip','CP','Caixa com 20 comprimidos',20),
  ('70000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Duloxetina 30mg','Cloridrato de Duloxetina','30mg','Cápsula','generico_similar','CAP','Cápsula',30),
  ('70000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','Azitromicina 500mg','Azitromicina','500mg','Comprimido','generico','CP','Comprimido',3),
  ('70000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','Ceftriaxona 1g','Ceftriaxona Sódica','1g','Ampola','hospitalar','AMP','Ampola',1)
on conflict (id) do nothing;

insert into public.quotations (
  id, tenant_id, module_type, name, buyer_company_name, destination_client,
  process_number, bid_number, judgment_type, deadline_at, allow_partial_supply,
  allow_equivalent, notes, status
) values (
  '80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',
  'bidding','Pregão Duloxetina 30mg','Distribuidora Licitação Exemplo',
  'Município de Goiânia','2026.000145','PE 041/2026','by_item',
  '2026-05-21 17:00:00-03',true,true,
  'Responder apenas itens com entrega confirmada. Sistema calcula preço por unidade automaticamente.',
  'analyzing'
) on conflict (id) do nothing;

insert into public.quotation_items (
  id, tenant_id, quotation_id, module_type, item_number, product_id, product_name,
  active_ingredient, dosage, requested_quantity, requested_unit, requested_laboratory,
  laboratory_required, product_type, accept_equivalent, ms_registration_required,
  buyer_observation
) values (
  '81000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',
  '80000000-0000-0000-0000-000000000001','bidding',1,'70000000-0000-0000-0000-000000000003',
  'Duloxetina 30mg','Cloridrato de Duloxetina','30mg',100000,'CAP','QUALQUER',
  false,'generico_similar',true,false,
  'Produto solicitado em cápsulas. Cotar caixa e o sistema converterá para unidade.'
) on conflict (id) do nothing;

insert into public.supplier_quote_sessions (
  id, tenant_id, quotation_id, supplier_id, public_token, seller_name, seller_company,
  seller_whatsapp, seller_email, expires_at, submitted_at, status
) values
  ('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','licitacao-demo-token','João','João Medicamentos','(62) 99911-1111','joao@medicamentos.com.br','2026-05-21 17:00:00-03','2026-05-13 15:00:00-03','submitted'),
  ('90000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','licitacao-ana-token','Ana','Ana Distribuidora','(61) 99922-2222','ana@distribuidora.com.br','2026-05-21 17:00:00-03','2026-05-13 15:10:00-03','submitted'),
  ('90000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','licitacao-carlos-token','Carlos','Carlos Farma','(63) 99933-3333','carlos@farma.com.br','2026-05-21 17:00:00-03','2026-05-13 15:20:00-03','submitted')
on conflict (id) do nothing;

insert into public.supplier_quote_responses (
  id, tenant_id, quotation_id, session_id, supplier_id, seller_name, seller_company,
  seller_whatsapp, seller_email, status, submitted_at
) values
  ('91000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','João','João Medicamentos','(62) 99911-1111','joao@medicamentos.com.br','submitted','2026-05-13 15:00:00-03'),
  ('91000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Ana','Ana Distribuidora','(61) 99922-2222','ana@distribuidora.com.br','submitted','2026-05-13 15:10:00-03'),
  ('91000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','Carlos','Carlos Farma','(63) 99933-3333','carlos@farma.com.br','submitted','2026-05-13 15:20:00-03')
on conflict (id) do nothing;

insert into public.supplier_quote_response_items (
  id, tenant_id, quotation_id, quotation_item_id, response_id, supplier_id,
  offered_product_name, offered_laboratory, offered_unit, package_quantity,
  package_price, has_full_quantity, available_quantity, delivery_days
) values
  ('92000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Duloxetina 30mg c/30','EMS','CAP',30,39.90,false,60000,3),
  ('92000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Duloxetina 30mg c/60','Eurofarma','CAP',60,82.80,false,30000,5),
  ('92000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','Duloxetina 30mg c/30','Medley','CAP',30,43.50,true,50000,7)
on conflict (id) do nothing;
