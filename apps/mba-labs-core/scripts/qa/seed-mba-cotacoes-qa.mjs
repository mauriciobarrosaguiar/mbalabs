import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { QA_TENANTS, requireQaEnvironment } from "./qa-safety.mjs";

const { url, serviceRoleKey, projectRef } = requireQaEnvironment();
const password = String(process.env.MBA_COTACOES_QA_PASSWORD ?? "");
if (password.length < 12) throw new Error("MBA_COTACOES_QA_PASSWORD deve ter ao menos 12 caracteres.");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const productCatalog = [
  ["Dapagliflozina 10 mg c/30", "7890000000001"],
  ["Losartana 50 mg c/30", "7890000000002"],
  ["Rosuvastatina 20 mg c/30", "7890000000003"],
  ["Paracetamol 750 mg c/20", "7890000000004"],
  ["Omeprazol 20 mg c/28", "7890000000005"],
  ["Amoxicilina 500 mg c/21", "7890000000006"],
  ["Dipirona 500 mg c/20", "7890000000007"],
  ["Metformina 850 mg c/30", "7890000000008"],
  ["Atenolol 25 mg c/30", "7890000000009"],
  ["Sinvastatina 20 mg c/30", "7890000000010"],
  ["Azitromicina 500 mg c/5", "7890000000011"],
  ["Cetirizina 10 mg c/12", "7890000000012"],
];

const supplierNames = [
  ["Representante QA Nazaria", "Nazaria"],
  ["Representante QA Panpharma", "Panpharma"],
  ["Representante QA Profarma", "Profarma"],
  ["Representante QA Total", "Total"],
  ["Representante QA Medcentro", "Medcentro"],
  ["Representante QA Distribuidora X", "Distribuidora X"],
];

await upsertUnits();
for (let tenantIndex = 0; tenantIndex < QA_TENANTS.length; tenantIndex += 1) {
  await seedTenant(QA_TENANTS[tenantIndex], tenantIndex);
}

console.log(`Seed MBA Cotações QA concluído no projeto ${projectRef}: ${QA_TENANTS.length} tenants, 180 produtos e fluxos operacionais.`);

async function seedTenant(definition, tenantIndex) {
  const { data: category, error: categoryError } = await supabase
    .from("core_empresa_categorias")
    .select("id")
    .eq("slug", "farmacia")
    .single();
  if (categoryError) throw categoryError;

  const coreCompany = await upsertOne("core_empresas", {
    nome: definition.legalName,
    nome_fantasia: definition.name,
    razao_social: definition.legalName,
    cnpj: definition.cnpj,
    categoria_id: category.id,
    email: `empresa.qa.${tenantIndex + 1}@example.invalid`,
    cidade: definition.city,
    estado: definition.state,
    status: "teste",
    observacoes: "REGISTRO EXCLUSIVO DE QA",
  }, "cnpj");

  const { data: cotacoesApp, error: appError } = await supabase
    .from("core_apps")
    .select("id")
    .in("slug", ["mba-cotacoes", "mbacotacoes"])
    .limit(1)
    .single();
  if (appError) throw appError;

  await upsertOne("core_empresa_apps", {
    empresa_id: coreCompany.id,
    app_id: cotacoesApp.id,
    status: "teste",
    cotacoes_tipo_acesso: "pharmacy",
    observacoes: "ACESSO EXCLUSIVO DE QA",
  }, "empresa_id,app_id");

  const tenant = await upsertOne("tenants", {
    core_empresa_id: coreCompany.id,
    nome_fantasia: definition.name,
    razao_social: definition.legalName,
    cnpj: definition.cnpj,
    tipo_cliente: "pharmacy",
    responsavel_nome: `Admin MBA QA ${tenantIndex + 1}`,
    responsavel_email: `admin.qa.${tenantIndex + 1}@example.invalid`,
    responsavel_whatsapp: null,
    status: "teste",
    valor_mensal: 0,
  }, "cnpj");

  const pharmacy = await upsertOne("pharmacies", {
    tenant_id: tenant.id,
    nome_fantasia: definition.name,
    razao_social: definition.legalName,
    cnpj: definition.cnpj,
    cidade: definition.city,
    uf: definition.state,
    responsavel: `Admin MBA QA ${tenantIndex + 1}`,
    whatsapp: null,
    email: `farmacia.qa.${tenantIndex + 1}@example.invalid`,
    status: "ativo",
  }, "tenant_id,cnpj");

  const users = [
    [`Admin MBA QA ${tenantIndex + 1}`, `admin.qa.${tenantIndex + 1}@example.invalid`, "ADMIN_EMPRESA"],
    [`Comprador Farmácia ${String.fromCharCode(65 + tenantIndex)}`, `comprador.qa.${tenantIndex + 1}@example.invalid`, "COMPRADOR"],
    [`Consultor QA ${String(tenantIndex + 1).padStart(2, "0")}`, `consultor.qa.${tenantIndex + 1}@example.invalid`, "CONFERENTE"],
  ];
  const profiles = [];
  for (const [fullName, email, role] of users) {
    profiles.push(await ensureUser(tenant.id, coreCompany.id, cotacoesApp.id, fullName, email, role));
  }

  const distributors = [];
  for (const [, company] of supplierNames) {
    distributors.push(await upsertOne("distributors", {
      tenant_id: tenant.id,
      nome: company,
      unidade_cd: "QA",
      uf: definition.state,
      pedido_minimo: 0,
      prazo_medio: "48 horas",
      observacao: "REGISTRO EXCLUSIVO DE QA",
      status: "ativo",
    }, "tenant_id,nome"));
  }

  const suppliers = [];
  for (let index = 0; index < supplierNames.length; index += 1) {
    const [name, company] = supplierNames[index];
    const supplier = await upsertOne("suppliers", {
      tenant_id: tenant.id,
      nome: name,
      empresa: company,
      whatsapp: null,
      email: `representante.${tenantIndex + 1}.${index + 1}@example.invalid`,
      tipo_fornecedor: "vendedor",
      observacao: index === 5 ? "QA: representante sem WhatsApp" : "REGISTRO EXCLUSIVO DE QA",
      status: index === 4 ? "inativo" : "ativo",
    }, "tenant_id,email");
    suppliers.push(supplier);
    await upsertOne("supplier_distributors", {
      tenant_id: tenant.id,
      supplier_id: supplier.id,
      distributor_id: distributors[index].id,
    }, "supplier_id,distributor_id");
  }

  const products = [];
  for (let index = 0; index < 60; index += 1) {
    const [baseName, baseEan] = productCatalog[index % productCatalog.length];
    const variant = Math.floor(index / productCatalog.length) + 1;
    products.push(await upsertOne("products", {
      tenant_id: tenant.id,
      nome: `${baseName} - Lote QA ${variant}`,
      principio_ativo: baseName.split(" ")[0],
      dosagem: baseName.match(/\d+\s?mg/i)?.[0] ?? null,
      forma: "Comprimido",
      tipo_produto: index % 7 === 0 ? "similar" : "generico",
      ean: index % 10 === 0 ? null : `${baseEan.slice(0, -2)}${String(index).padStart(2, "0")}`,
      unidade_base: "UN",
      apresentacao: baseName,
      quantidade_por_embalagem: index % 9 === 0 ? 1 : 30,
      status: "ativo",
    }, "tenant_id,nome"));
  }

  const shortageRows = products.slice(0, 12).map((product, index) => ({
    tenant_id: tenant.id,
    product_name: product.nome,
    ean: product.ean,
    requested_quantity: index === 11 ? 1000 : index + 1,
    requested_unit: "UN",
    notes: "Lista de faltas QA",
    status: "pending",
    created_by: profiles[1].id,
  }));
  const { error: shortageCleanupError } = await supabase
    .from("shortage_items")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("notes", "Lista de faltas QA");
  if (shortageCleanupError) throw shortageCleanupError;
  await insertMany("shortage_items", shortageRows);

  const quotation = await upsertOne("quotations", {
    tenant_id: tenant.id,
    module_type: "pharmacy",
    name: `Cotação Golden Path QA - ${definition.name}`,
    pharmacy_id: pharmacy.id,
    buyer_document: definition.cnpj,
    buyer_company_name: definition.name,
    deadline_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    allow_partial_supply: true,
    allow_equivalent: true,
    consider_minimum_order: false,
    notes: "COTAÇÃO EXCLUSIVA DE QA - NÃO ENVIAR",
    status: "analyzing",
    created_by: profiles[1].id,
  }, "tenant_id,name");

  const quoteItems = [];
  for (let index = 0; index < 10; index += 1) {
    quoteItems.push(await upsertOne("quotation_items", {
      tenant_id: tenant.id,
      quotation_id: quotation.id,
      module_type: "pharmacy",
      item_number: index + 1,
      product_id: products[index].id,
      product_name: products[index].nome,
      ean: products[index].ean,
      requested_quantity: index === 9 ? 100 : index + 1,
      requested_unit: "UN",
      laboratory_required: false,
      product_type: products[index].tipo_produto,
      accept_equivalent: true,
      allow_partial_supply: true,
      ms_registration_required: false,
      status: "aguardando_respostas",
    }, "quotation_id,item_number"));
  }

  for (let supplierIndex = 0; supplierIndex < 3; supplierIndex += 1) {
    const supplier = suppliers[supplierIndex];
    const session = await upsertOne("supplier_quote_sessions", {
      tenant_id: tenant.id,
      quotation_id: quotation.id,
      supplier_id: supplier.id,
      public_token: randomUUID().replaceAll("-", ""),
      seller_name: supplier.nome,
      seller_company: supplier.empresa,
      seller_whatsapp: null,
      seller_email: supplier.email,
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      submitted_at: supplierIndex < 2 ? new Date().toISOString() : null,
      status: supplierIndex < 2 ? "submitted" : "opened",
    }, "quotation_id,supplier_id");

    if (supplierIndex === 2) {
      await resetPendingSupplierResponse(session.id);
      continue;
    }
    const quoteResponse = await upsertOne("supplier_quote_responses", {
      tenant_id: tenant.id,
      quotation_id: quotation.id,
      session_id: session.id,
      supplier_id: supplier.id,
      seller_name: supplier.nome,
      seller_company: supplier.empresa,
      seller_whatsapp: null,
      seller_email: supplier.email,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }, "session_id");

    const responseItemRows = quoteItems.map((quoteItem, index) => ({
      tenant_id: tenant.id,
      quotation_id: quotation.id,
      quotation_item_id: quoteItem.id,
      response_id: quoteResponse.id,
      supplier_id: supplier.id,
      offered_product_name: quoteItem.product_name,
      unit_price: Number((10 + supplierIndex * 0.5 + index * 0.1).toFixed(2)),
      net_price: Number((10 + supplierIndex * 0.5 + index * 0.1).toFixed(2)),
      has_stock: !(supplierIndex === 0 && index === 8),
      available_quantity: supplierIndex === 0 && index === 8 ? 0 : quoteItem.requested_quantity,
    }));
    const { error: responseItemsError } = await supabase
      .from("supplier_quote_response_items")
      .upsert(responseItemRows, { onConflict: "response_id,quotation_item_id" });
    if (responseItemsError) throw responseItemsError;
  }

  await resetQaPurchaseOrders(quotation.id);
  const purchaseOrder = await upsertOne("purchase_orders", {
    tenant_id: tenant.id,
    quotation_id: quotation.id,
    module_type: "pharmacy",
    supplier_name: suppliers[0].nome,
    supplier_id: suppliers[0].id,
    public_token: `pedido-pharmacy-${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`,
    supplier_company: suppliers[0].empresa,
    supplier_whatsapp: null,
    total_amount: 10,
    confirmed_amount: 0,
    status: "gerado",
  }, "quotation_id,supplier_id");
  await upsertOne("purchase_order_items", {
    tenant_id: tenant.id,
    purchase_order_id: purchaseOrder.id,
    quotation_item_id: quoteItems[0].id,
    product_name: quoteItems[0].product_name,
    offered_product_name: quoteItems[0].product_name,
    unit: "UN",
    quantity_to_buy: 1,
    billed_quantity: 0,
    missing_quantity: 1,
    unit_price: 10,
    total_price: 10,
    fulfillment_status: "pendente",
    original_supplier_id: suppliers[0].id,
    original_supplier_name: suppliers[0].nome,
  }, "purchase_order_id,quotation_item_id");
}

async function resetPendingSupplierResponse(sessionId) {
  const { data: responseRows, error: responseLookupError } = await supabase
    .from("supplier_quote_responses")
    .select("id")
    .eq("session_id", sessionId);
  if (responseLookupError) throw responseLookupError;
  const responseIds = (responseRows ?? []).map((row) => row.id);
  if (responseIds.length === 0) return;

  const { error: itemDeleteError } = await supabase
    .from("supplier_quote_response_items")
    .delete()
    .in("response_id", responseIds);
  if (itemDeleteError) throw itemDeleteError;
  const { error: responseDeleteError } = await supabase
    .from("supplier_quote_responses")
    .delete()
    .in("id", responseIds);
  if (responseDeleteError) throw responseDeleteError;
}

async function resetQaPurchaseOrders(quotationId) {
  const { data: orderRows, error: orderLookupError } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("quotation_id", quotationId);
  if (orderLookupError) throw orderLookupError;
  const orderIds = (orderRows ?? []).map((row) => row.id);
  if (orderIds.length === 0) return;

  const { error: itemDeleteError } = await supabase
    .from("purchase_order_items")
    .delete()
    .in("purchase_order_id", orderIds);
  if (itemDeleteError) throw itemDeleteError;
  const { error: orderDeleteError } = await supabase
    .from("purchase_orders")
    .delete()
    .in("id", orderIds);
  if (orderDeleteError) throw orderDeleteError;
}

async function ensureUser(tenantId, coreCompanyId, appId, fullName, email, role) {
  const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  let authUser = usersPage.users.find((user) => user.email === email);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    authUser = data.user;
  }
  const coreUser = await upsertOne("core_usuarios", {
    auth_user_id: authUser.id,
    empresa_id: coreCompanyId,
    nome: fullName,
    email,
    tipo: mapCoreUserType(role),
    tipo_global: mapCoreUserType(role),
    status: "ativo",
  }, "auth_user_id");
  await upsertOne("core_usuario_app_permissoes", {
    usuario_id: coreUser.id,
    empresa_id: coreCompanyId,
    app_id: appId,
    perfil_app: role.toLowerCase(),
    status: "ativo",
  }, "usuario_id,app_id");

  const profile = await upsertOne("users_profile", {
    core_usuario_id: coreUser.id,
    auth_user_id: authUser.id,
    full_name: fullName,
    email,
    role,
    status: "ativo",
  }, "auth_user_id");
  await upsertOne("tenant_users", { tenant_id: tenantId, user_profile_id: profile.id, role, status: "ativo" }, "tenant_id,user_profile_id");
  return profile;
}

function mapCoreUserType(role) {
  if (role === "ADMIN_EMPRESA") return "admin_empresa";
  if (role === "CONFERENTE") return "operador";
  return "usuario";
}

async function upsertUnits() {
  const { error } = await supabase.from("unit_types").upsert([
    { code: "UN", name: "Unidade", plural_name: "Unidades" },
    { code: "CX", name: "Caixa", plural_name: "Caixas" },
  ], { onConflict: "code" });
  if (error) throw error;
}

async function upsertOne(table, payload, onConflict) {
  const columns = onConflict.split(",").map((column) => column.trim());
  let select = supabase.from(table).select("*");
  for (const column of columns) select = select.eq(column, payload[column]);
  const { data: existing, error: selectError } = await select.maybeSingle();
  if (selectError) throw new Error(`${table}: ${selectError.message}`);
  if (existing) {
    const { data, error } = await supabase.from(table).update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data;
  }
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insertMany(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error && error.code !== "23505") throw new Error(`${table}: ${error.message}`);
}
