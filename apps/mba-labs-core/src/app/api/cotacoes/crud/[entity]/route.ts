import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import {
  createDistributor,
  createLaboratory,
  createMonthlySubscription,
  createPharmacy,
  createProduct,
  createSubscriptionPlan,
  createSupplier,
  createTenant,
  deleteDistributor,
  deleteLaboratory,
  deleteMonthlySubscription,
  deletePharmacy,
  deleteProduct,
  deleteSubscriptionPlan,
  deleteSupplier,
  deleteTenant,
  getLaboratories,
  getProducts,
  getSuppliers,
  updateDistributor,
  updateLaboratory,
  updateMonthlySubscription,
  updatePharmacy,
  updateProduct,
  updateSubscriptionPlan,
  updateSupplier,
  updateTenant,
} from "@/modules/cotacoes/lib/data/repository";
import { getCurrentAuthContext, isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";
import { isSupabaseWriteConfigured } from "@/modules/cotacoes/lib/runtime-mode";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import type { Distributor, Laboratory, MonthlySubscription, Pharmacy, Product, SubscriptionPlan, Supplier, Tenant } from "@/modules/cotacoes/lib/types";

type Entity = "products" | "suppliers" | "distributors" | "laboratories" | "tenants" | "pharmacies" | "plans" | "monthly_subscriptions";
type Row = Record<string, unknown> & { id?: string };
type CrudAuth = { isSuperAdmin: boolean; tenantId?: string };

const adminOnlyEntities = new Set<Entity>(["tenants", "plans", "monthly_subscriptions"]);
const tenantTables: Partial<Record<Entity, string>> = {
  products: "products",
  suppliers: "suppliers",
  distributors: "distributors",
  laboratories: "laboratories",
  pharmacies: "pharmacies",
};

class RouteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  return mutate(request, params, "create");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  return mutate(request, params, "update");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  if (!isSupabaseWriteConfigured()) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 409 });
  }

  let entity: Entity | null = null;

  try {
    entity = parseEntity((await params).entity);
    const auth = await authorizeCrud(entity);
    const { id } = await request.json() as { id?: string };
    if (!id) throw new RouteError("ID obrigatorio.", 400);
    if (!auth.isSuperAdmin && auth.tenantId) {
      await assertEntityOwnership(entity, id, auth.tenantId);
    }
    await deleteByEntity(entity, id, auth.tenantId);
    const deleted = entity === "suppliers";
    return NextResponse.json({
      ok: true,
      deleted,
      row: deleted ? { id } : { id, status: "inativo" },
    });
  } catch (error) {
    if (entity === "suppliers" && errorCode(error) === "23503") {
      return NextResponse.json(
        {
          error: "Este fornecedor possui um vínculo que impede a exclusão. Nenhum dado foi alterado.",
        },
        { status: 409 },
      );
    }
    return errorResponse(error, entity === "suppliers" ? "Erro ao excluir fornecedor." : "Erro ao inativar registro.");
  }
}

async function mutate(
  request: NextRequest,
  params: Promise<{ entity: string }>,
  operation: "create" | "update",
) {
  if (!isSupabaseWriteConfigured()) {
    return NextResponse.json({ error: "Supabase service role nao configurado." }, { status: 409 });
  }

  try {
    const entity = parseEntity((await params).entity);
    const auth = await authorizeCrud(entity);
    const { id, data } = await request.json() as { id?: string; data?: Row };
    if (!data) throw new RouteError("Dados obrigatorios.", 400);
    if (operation === "update" && !id) throw new RouteError("ID obrigatorio.", 400);

    const scopedData: Row = auth.isSuperAdmin || !auth.tenantId
      ? { ...data }
      : { ...data, tenantId: auth.tenantId };

    if (operation === "update" && id && !auth.isSuperAdmin && auth.tenantId) {
      await assertEntityOwnership(entity, id, auth.tenantId);
    }

    await assertNoDuplicateEntity(entity, scopedData, operation === "update" ? id : undefined);

    const saved = operation === "create"
      ? await createByEntity(entity, scopedData)
      : await updateByEntity(entity, id!, scopedData);

    if (!saved) throw new Error("Supabase nao retornou o registro salvo.");

    return NextResponse.json({ ok: true, row: normalizeRow(entity, saved, scopedData) });
  } catch (error) {
    return errorResponse(error, "Erro ao salvar registro.");
  }
}

async function authorizeCrud(entity: Entity): Promise<CrudAuth> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) {
    throw new RouteError("Sessao expirada ou usuario nao autenticado.", 401);
  }

  const coreType = String(session.profile.tipo ?? "");
  const isCoreSuperAdmin = coreType === "super_admin" || coreType === "admin_master";
  const hasCotacoesAccess = isCoreSuperAdmin || (session.appsLiberados ?? []).some((app) => (
    (app.slug === "mba-cotacoes" || app.slug === "mbacotacoes") && app.canAccess
  ));
  if (!hasCotacoesAccess) {
    throw new RouteError("Usuario sem acesso ao MBA Cotacoes.", 403);
  }

  const auth = await getCurrentAuthContext();
  if (!auth.isAuthenticated || !auth.profile || !auth.isActive) {
    throw new RouteError("Usuario inativo ou sem perfil valido.", 403);
  }

  if (auth.isSuperAdmin || isCoreSuperAdmin) {
    return { isSuperAdmin: true };
  }

  if (adminOnlyEntities.has(entity)) {
    throw new RouteError("Operacao restrita ao ADMIN MBA.", 403);
  }

  if (!auth.tenantAccess || isTenantSuspended(auth.tenantAccess.tenantStatus)) {
    throw new RouteError("Empresa sem acesso ativo ao MBA Cotacoes.", 403);
  }

  return { isSuperAdmin: false, tenantId: auth.tenantAccess.tenantId };
}

async function assertEntityOwnership(entity: Entity, id: string, tenantId: string) {
  const table = tenantTables[entity];
  if (!table) throw new RouteError("Operacao restrita ao ADMIN MBA.", 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(table)
    .select("id,tenant_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new RouteError("Registro nao encontrado.", 404);
  if (!data.tenant_id || data.tenant_id !== tenantId) {
    throw new RouteError("Registro pertence a outra empresa ou ao catalogo global.", 403);
  }
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof RouteError ? error.status : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status },
  );
}

function parseEntity(value: string): Entity {
  if (
    value === "products" ||
    value === "suppliers" ||
    value === "distributors" ||
    value === "laboratories" ||
    value === "tenants" ||
    value === "pharmacies" ||
    value === "plans" ||
    value === "monthly_subscriptions"
  ) {
    return value;
  }

  throw new RouteError("Entidade nao suportada.", 400);
}

async function createByEntity(entity: Entity, row: Row) {
  if (entity === "products") return createProduct(await productPayload(row) as Parameters<typeof createProduct>[0]);
  if (entity === "suppliers") return createSupplier(supplierPayload(row) as Parameters<typeof createSupplier>[0]);
  if (entity === "distributors") return createDistributor(distributorPayload(row) as Parameters<typeof createDistributor>[0]);
  if (entity === "laboratories") return createLaboratory(laboratoryPayload(row) as Parameters<typeof createLaboratory>[0]);
  if (entity === "tenants") {
    const tenant = await createTenant(tenantPayload(row) as Parameters<typeof createTenant>[0]);
    await createTenantSideEffects(tenant, row);
    return tenant;
  }
  if (entity === "pharmacies") return createPharmacy(pharmacyPayload(row) as Parameters<typeof createPharmacy>[0]);
  if (entity === "plans") return createSubscriptionPlan(planPayload(row) as Parameters<typeof createSubscriptionPlan>[0]);
  if (entity === "monthly_subscriptions") return createMonthlySubscription(monthlySubscriptionPayload(row) as Parameters<typeof createMonthlySubscription>[0]);
  throw new RouteError("Entidade nao suportada.", 400);
}

async function updateByEntity(entity: Entity, id: string, row: Row) {
  if (entity === "products") return updateProduct(id, await productPayload(row));
  if (entity === "suppliers") return updateSupplier(id, supplierPayload(row));
  if (entity === "distributors") return updateDistributor(id, distributorPayload(row));
  if (entity === "laboratories") return updateLaboratory(id, laboratoryPayload(row));
  if (entity === "tenants") return updateTenant(id, tenantPayload(row));
  if (entity === "pharmacies") return updatePharmacy(id, pharmacyPayload(row));
  if (entity === "plans") return updateSubscriptionPlan(id, planPayload(row));
  if (entity === "monthly_subscriptions") return updateMonthlySubscription(id, monthlySubscriptionPayload(row));
  throw new RouteError("Entidade nao suportada.", 400);
}

async function deleteByEntity(entity: Entity, id: string, tenantId?: string) {
  if (entity === "products") return deleteProduct(id);
  if (entity === "suppliers") return deleteSupplier(id, tenantId);
  if (entity === "distributors") return deleteDistributor(id);
  if (entity === "laboratories") return deleteLaboratory(id);
  if (entity === "tenants") return deleteTenant(id);
  if (entity === "pharmacies") return deletePharmacy(id);
  if (entity === "plans") return deleteSubscriptionPlan(id);
  if (entity === "monthly_subscriptions") return deleteMonthlySubscription(id);
  throw new RouteError("Entidade nao suportada.", 400);
}

async function assertNoDuplicateEntity(entity: Entity, row: Row, editingId?: string) {
  if (entity === "suppliers") {
    const whatsapp = onlyDigits(text(row.whatsapp));
    const document = onlyDigits(text(row.cpf ?? row.documento ?? row.cpfCnpj));
    if (!whatsapp && !document) return;

    const tenantId = text(row.tenantId);
    const suppliers = await getSuppliers();
    const duplicated = suppliers.find((supplier) => {
      if (supplier.id === editingId || supplier.status === "inativo") return false;
      if (tenantId && supplier.tenantId !== tenantId) return false;
      if (whatsapp && onlyDigits(supplier.whatsapp) === whatsapp) return true;
      const supplierDocument = onlyDigits(text((supplier as Supplier & { cpf?: string; documento?: string; cpfCnpj?: string }).cpf ??
        (supplier as Supplier & { documento?: string }).documento ??
        (supplier as Supplier & { cpfCnpj?: string }).cpfCnpj));
      return Boolean(document && supplierDocument === document);
    });

    if (duplicated) {
      throw new RouteError(whatsapp && onlyDigits(duplicated.whatsapp) === whatsapp
        ? "Ja existe vendedor/fornecedor cadastrado com este WhatsApp."
        : "Ja existe vendedor/fornecedor cadastrado com este CPF.", 409);
    }
  }

  if (entity === "products") {
    const nome = normalizeKey(text(row.nome));
    const ean = onlyDigits(text(row.ean));
    const laboratorioId = await resolveProductLaboratoryId(row);
    const tenantId = text(row.tenantId);
    if (!nome && !ean && !laboratorioId) return;

    const products = await getProducts();
    const duplicated = products.find((product) => {
      if (product.id === editingId || product.status === "inativo") return false;
      if (tenantId && product.tenantId !== tenantId) return false;
      const sameEan = ean && onlyDigits(text(product.ean)) === ean;
      const sameLaboratory = laboratorioId && product.laboratorioId === laboratorioId;
      const sameName = nome && normalizeKey(product.nome) === nome;
      return Boolean((sameEan && sameLaboratory) || (sameName && sameEan && sameLaboratory));
    });

    if (duplicated) {
      throw new RouteError("Produto duplicado: use outro EAN ou outro laboratorio para cadastrar uma excecao.", 409);
    }
  }
}

async function productPayload(row: Row): Promise<Partial<Product>> {
  const nome = text(row.nome);
  const ean = text(row.ean);
  if (!nome && !ean && !text(row.laboratorio) && text(row.status)) {
    return { status: text(row.status) as Product["status"], tenantId: text(row.tenantId) || undefined };
  }
  const laboratorioId = await resolveProductLaboratoryId(row);
  if (!ean) throw new RouteError("EAN obrigatorio.", 400);
  if (!nome) throw new RouteError("Produto obrigatorio.", 400);
  if (!laboratorioId) throw new RouteError("Laboratorio obrigatorio.", 400);

  return {
    nome,
    principioAtivo: text(row.principioAtivo),
    dosagem: text(row.dosagem),
    forma: text(row.forma),
    tipoProduto: (text(row.tipoProduto) || "generico") as Product["tipoProduto"],
    laboratorioId,
    ean,
    tenantId: text(row.tenantId) || undefined,
    unidadeBase: text(row.unidadeBase) || "CX",
    apresentacao: text(row.apresentacao) || nome,
    quantidadePorEmbalagem: number(row.quantidadePorEmbalagem) || 1,
    status: (text(row.status) || "ativo") as Product["status"],
  };
}

async function resolveProductLaboratoryId(row: Row) {
  const value = text(row.laboratorio);
  const tenantId = text(row.tenantId);
  if (!value) return "";
  if (uuid(value)) return value;

  const normalized = normalizeKey(value);
  const laboratories = await getLaboratories();
  const existing = laboratories.find((laboratory) => (
    normalizeKey(laboratory.nome) === normalized &&
    (!tenantId || !laboratory.tenantId || laboratory.tenantId === tenantId)
  ));
  if (existing) return existing.id;

  const created = await createLaboratory({
    tenantId,
    nome: value,
    tipo: "laboratorio",
    status: "ativo",
  });
  return created.id;
}

function supplierPayload(row: Row): Partial<Supplier> {
  return {
    nome: text(row.nome),
    empresa: text(row.empresa) || text(row.nome),
    whatsapp: text(row.whatsapp),
    email: text(row.email),
    tipoFornecedor: (text(row.tipoFornecedor) || "vendedor") as Supplier["tipoFornecedor"],
    observacao: text(row.observacao),
    tenantId: text(row.tenantId) || undefined,
    status: (text(row.status) || "ativo") as Supplier["status"],
  };
}

function distributorPayload(row: Row): Partial<Distributor> {
  return {
    nome: text(row.nome),
    unidadeCd: text(row.unidadeCd),
    uf: text(row.uf),
    pedidoMinimo: number(row.pedidoMinimo),
    prazoMedio: text(row.prazoMedio),
    portal: text(row.portal),
    observacao: text(row.observacao),
    tenantId: text(row.tenantId) || undefined,
    status: (text(row.status) || "ativo") as Distributor["status"],
  };
}

function laboratoryPayload(row: Row): Partial<Laboratory> {
  return {
    nome: text(row.nome),
    cnpj: text(row.cnpj),
    tipo: (text(row.tipo) || "laboratorio") as Laboratory["tipo"],
    tenantId: text(row.tenantId) || undefined,
    status: (text(row.status) || "ativo") as Laboratory["status"],
  };
}

function tenantPayload(row: Row): Partial<Tenant> {
  return {
    nomeFantasia: text(row.nomeFantasia),
    razaoSocial: text(row.razaoSocial) || text(row.nomeFantasia),
    cnpj: onlyDigits(text(row.cnpj)),
    tipoCliente: (text(row.tipoCliente) || "pharmacy") as Tenant["tipoCliente"],
    responsavelNome: text(row.responsavelNome),
    responsavelEmail: text(row.responsavelEmail),
    responsavelWhatsapp: text(row.responsavelWhatsapp),
    planoId: text(row.planoId),
    status: (text(row.status) || "teste") as Tenant["status"],
    dataInicio: text(row.dataInicio) || new Date().toISOString().slice(0, 10),
    dataVencimento: text(row.dataVencimento),
    valorMensal: number(row.valorMensal),
  };
}

async function createTenantSideEffects(tenant: Tenant, row: Row) {
  if (text(row.autoCreatePharmacy) === "on" && tenant.tipoCliente === "pharmacy") {
    await createPharmacy({
      tenantId: tenant.id,
      nomeFantasia: `${tenant.nomeFantasia} - Matriz`,
      razaoSocial: tenant.razaoSocial,
      cnpj: tenant.cnpj,
      cidade: text(row.cidade),
      uf: text(row.uf),
      responsavel: tenant.responsavelNome,
      whatsapp: tenant.responsavelWhatsapp,
      email: tenant.responsavelEmail,
      status: "ativo",
    });
  }

  if (tenant.planoId && tenant.valorMensal > 0 && tenant.dataVencimento) {
    await createMonthlySubscription({
      tenantId: tenant.id,
      planId: tenant.planoId,
      referenceMonth: monthReference(tenant.dataVencimento),
      dueDate: tenant.dataVencimento,
      amount: tenant.valorMensal,
      status: "pending",
      paymentMethod: "pix",
    });
  }
}

function pharmacyPayload(row: Row): Partial<Pharmacy> {
  return {
    tenantId: text(row.tenantId) || undefined,
    nomeFantasia: text(row.nomeFantasia) || text(row.nome),
    razaoSocial: text(row.razaoSocial) || text(row.nomeFantasia) || text(row.nome),
    cnpj: onlyDigits(text(row.cnpj)),
    cidade: text(row.cidade),
    uf: text(row.uf),
    responsavel: text(row.responsavel),
    whatsapp: text(row.whatsapp),
    email: text(row.email),
    status: (text(row.status) || "ativo") as Pharmacy["status"],
  };
}

function planPayload(row: Row): Partial<SubscriptionPlan> {
  return {
    name: text(row.name) || text(row.nome),
    monthlyPrice: number(row.monthlyPrice ?? row.valorMensal),
    modules: (text(row.modules) || "pharmacy") as SubscriptionPlan["modules"],
    maxUsers: number(row.maxUsers ?? row.quantidadeUsuarios) || 1,
    maxQuotationsMonth: number(row.maxQuotationsMonth ?? row.quantidadeCotacoesMes) || 0,
    maxPharmacies: number(row.maxPharmacies ?? row.quantidadeFarmacias) || 1,
    status: (text(row.status) || "ativo") as SubscriptionPlan["status"],
    observation: text(row.observation ?? row.observacao),
  };
}

function monthlySubscriptionPayload(row: Row): Partial<MonthlySubscription> {
  return {
    tenantId: text(row.tenantId),
    planId: text(row.planId),
    referenceMonth: text(row.referenceMonth),
    dueDate: text(row.dueDate),
    amount: number(row.amount),
    status: (text(row.status) || "pending") as MonthlySubscription["status"],
    paymentMethod: text(row.paymentMethod),
    paidAt: text(row.paidAt),
    paidAmount: number(row.paidAmount),
    manualPaymentNote: text(row.manualPaymentNote),
    txid: text(row.txid),
    efiStatus: text(row.efiStatus),
  };
}

function normalizeRow(entity: Entity, saved: Product | Supplier | Distributor | Laboratory | Pharmacy | Tenant | SubscriptionPlan | MonthlySubscription, sourceRow?: Row) {
  if (entity === "products") {
    const product = saved as Product;
    return {
      id: product.id,
      tenantId: product.tenantId,
      nome: product.nome,
      principioAtivo: product.principioAtivo,
      dosagem: product.dosagem,
      forma: product.forma,
      tipoProduto: product.tipoProduto,
      laboratorio: text(sourceRow?.laboratorio) || product.laboratorioId || "",
      ean: product.ean ?? "",
      unidadeBase: product.unidadeBase,
      apresentacao: product.apresentacao,
      quantidadePorEmbalagem: product.quantidadePorEmbalagem,
      status: product.status,
    };
  }

  if (entity === "suppliers") {
    const supplier = saved as Supplier;
    return {
      id: supplier.id,
      tenantId: supplier.tenantId,
      nome: supplier.nome,
      empresa: supplier.empresa,
      whatsapp: supplier.whatsapp,
      email: supplier.email,
      tipoFornecedor: supplier.tipoFornecedor,
      observacao: supplier.observacao,
      status: supplier.status,
    };
  }

  if (entity === "distributors") {
    const distributor = saved as Distributor;
    return {
      id: distributor.id,
      tenantId: distributor.tenantId,
      nome: distributor.nome,
      unidadeCd: distributor.unidadeCd,
      uf: distributor.uf,
      pedidoMinimo: distributor.pedidoMinimo,
      prazoMedio: distributor.prazoMedio,
      portal: distributor.portal,
      observacao: distributor.observacao,
      status: distributor.status,
    };
  }

  if (entity === "laboratories") {
    const laboratory = saved as Laboratory;
    return {
      id: laboratory.id,
      tenantId: laboratory.tenantId,
      nome: laboratory.nome,
      cnpj: laboratory.cnpj,
      tipo: laboratory.tipo,
      status: laboratory.status,
    };
  }

  if (entity === "pharmacies") {
    const pharmacy = saved as Pharmacy;
    return {
      id: pharmacy.id,
      tenantId: pharmacy.tenantId,
      nomeFantasia: pharmacy.nomeFantasia,
      razaoSocial: pharmacy.razaoSocial,
      cnpj: pharmacy.cnpj,
      cidade: pharmacy.cidade,
      uf: pharmacy.uf,
      responsavel: pharmacy.responsavel,
      whatsapp: pharmacy.whatsapp,
      email: pharmacy.email,
      status: pharmacy.status,
    };
  }

  if (entity === "plans") {
    const plan = saved as SubscriptionPlan;
    return {
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      modules: plan.modules,
      maxUsers: plan.maxUsers,
      maxQuotationsMonth: plan.maxQuotationsMonth,
      maxPharmacies: plan.maxPharmacies,
      status: plan.status,
      observation: plan.observation,
    };
  }

  if (entity === "monthly_subscriptions") {
    const subscription = saved as MonthlySubscription;
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      referenceMonth: subscription.referenceMonth,
      dueDate: subscription.dueDate,
      amount: subscription.amount,
      status: subscription.status,
      paymentMethod: subscription.paymentMethod,
      paidAt: subscription.paidAt,
      paidAmount: subscription.paidAmount,
      manualPaymentNote: subscription.manualPaymentNote,
      txid: subscription.txid,
      efiStatus: subscription.efiStatus,
    };
  }

  return saved;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function number(value: unknown) {
  if (typeof value === "number") return value;
  return Number(text(value).replace(/\./g, "").replace(",", ".")) || 0;
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function monthReference(date: string) {
  return text(date).slice(0, 7) || new Date().toISOString().slice(0, 7);
}
