import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";
import { listPendingShortageItems, mapShortageItem } from "@/modules/cotacoes/lib/data/shortage-items";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

type ShortagePayload = {
  productName?: string;
  ean?: string;
  requestedQuantity?: number | string;
  requestedUnit?: string;
  notes?: string;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantAccess();
    const supabase = createSupabaseAdminClient();
    const [items, productsResult] = await Promise.all([
      listPendingShortageItems(tenantId),
      supabase
        .from("products")
        .select("id,nome,ean,unidade_base,status")
        .eq("tenant_id", tenantId)
        .eq("status", "ativo")
        .order("nome", { ascending: true }),
    ]);

    if (productsResult.error) throw productsResult.error;

    return NextResponse.json({
      items,
      products: (productsResult.data ?? []).map((product) => ({
        id: product.id,
        name: product.nome,
        ean: product.ean ?? "",
        unit: product.unidade_base ?? "UN",
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, profileId } = await requireTenantAccess();
    const payload = validatePayload(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("shortage_items")
      .insert({
        tenant_id: tenantId,
        product_name: payload.productName,
        ean: payload.ean || null,
        requested_quantity: payload.requestedQuantity,
        requested_unit: payload.requestedUnit,
        notes: payload.notes || null,
        status: "pending",
        created_by: profileId,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ item: mapShortageItem(data) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await requireTenantAccess();
    const body = await request.json() as { id?: string; data?: ShortagePayload };
    if (!body.id) throw new ApiError("Item obrigatório.", 400);
    const payload = validatePayload(body.data ?? {});
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("shortage_items")
      .update({
        product_name: payload.productName,
        ean: payload.ean || null,
        requested_quantity: payload.requestedQuantity,
        requested_unit: payload.requestedUnit,
        notes: payload.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError("Item não encontrado nesta empresa.", 404);
    return NextResponse.json({ item: mapShortageItem(data) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { tenantId } = await requireTenantAccess();
    const body = await request.json() as { id?: string };
    if (!body.id) throw new ApiError("Item obrigatório.", 400);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("shortage_items")
      .delete()
      .eq("id", body.id)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError("Item não encontrado nesta empresa.", 404);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

async function requireTenantAccess() {
  const auth = await getCurrentAuthContext();
  if (!auth.isAuthenticated || !auth.profile) {
    throw new ApiError("Sessão expirada ou usuário não autenticado.", 401);
  }
  if (!auth.isActive) throw new ApiError("Usuário inativo.", 403);
  if (auth.isSuperAdmin) {
    throw new ApiError("A Lista de Faltas deve ser usada dentro do acesso de uma empresa.", 403);
  }
  if (!auth.tenantAccess || isTenantSuspended(auth.tenantAccess.tenantStatus)) {
    throw new ApiError("Empresa sem acesso ativo ao MBA Cotações.", 403);
  }
  return { tenantId: auth.tenantAccess.tenantId, profileId: auth.profile.id };
}

function validatePayload(input: ShortagePayload) {
  const productName = String(input.productName ?? "").trim();
  const ean = String(input.ean ?? "").trim();
  const requestedQuantity = Number(input.requestedQuantity ?? 0);
  const requestedUnit = String(input.requestedUnit ?? "UN").trim().toUpperCase() || "UN";
  const notes = String(input.notes ?? "").trim();

  if (!productName) throw new ApiError("Informe o produto.", 400);
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new ApiError("A quantidade deve ser maior que zero.", 400);
  }
  if (productName.length > 240 || ean.length > 32 || requestedUnit.length > 16 || notes.length > 1000) {
    throw new ApiError("Um ou mais campos excedem o tamanho permitido.", 400);
  }

  return { productName, ean, requestedQuantity, requestedUnit, notes };
}

function errorResponse(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Erro ao processar a Lista de Faltas.";
  if (status >= 500) console.error("[Lista de Faltas]", error);
  return NextResponse.json({ error: message }, { status });
}
