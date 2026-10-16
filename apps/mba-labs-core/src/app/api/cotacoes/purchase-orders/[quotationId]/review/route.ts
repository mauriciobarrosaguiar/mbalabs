import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { ensureQuotationAccess } from "@/modules/cotacoes/lib/auth/quotation-access";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

type ReviewBody = {
  orderId?: string;
  itemId?: string;
  quantity?: number;
  note?: string;
  supplierConfirmationNote?: string;
};

function isBuyer(role?: string) {
  return ["SUPER_ADMIN", "ADMIN_EMPRESA", "COMPRADOR"].includes(role ?? "");
}

async function orderContext(request: NextRequest, quotationId: string, body: ReviewBody) {
  const auth = await getCurrentAuthContext();
  const access = await ensureQuotationAccess(auth, quotationId);
  if (!access.ok) return { failure: NextResponse.json({ error: access.error }, { status: access.status }) };
  if (!isBuyer(auth.profile?.role)) {
    return { failure: NextResponse.json({ error: "Somente o comprador ou administrador pode revisar pedidos." }, { status: 403 }) };
  }
  if (access.quotation.module_type !== "pharmacy") {
    return { failure: NextResponse.json({ error: "A revisão de quantidades desta etapa é exclusiva das cotações de farmácia." }, { status: 409 }) };
  }
  if (!body.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId)) {
    return { failure: NextResponse.json({ error: "Informe um pedido válido." }, { status: 400 }) };
  }
  const supabase = createSupabaseAdminClient();
  const { data: order, error } = await supabase.from("purchase_orders")
    .select("id,tenant_id,quotation_id,module_type,buyer_review_status,status,buyer_sent_at")
    .eq("tenant_id", access.quotation.tenant_id).eq("quotation_id", quotationId)
    .eq("id", body.orderId).maybeSingle();
  if (error) throw error;
  if (!order) return { failure: NextResponse.json({ error: "Pedido não encontrado nesta empresa." }, { status: 404 }) };
  if (order.buyer_review_status !== "pending" || !["gerado", "draft"].includes(order.status) || order.buyer_sent_at) {
    return { failure: NextResponse.json({ error: "Pedido já aprovado ou enviado: não pode ser editado." }, { status: 409 }) };
  }
  return { supabase, order, auth };
}

/** Altera apenas a quantidade do item, mantendo o preço unitário ofertado. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ quotationId: string }> }) {
  try {
    const { quotationId } = await params;
    const body = await request.json() as ReviewBody;
    const ctx = await orderContext(request, quotationId, body);
    if (ctx.failure) return ctx.failure;
    const { supabase, order, auth } = ctx;
    const quantity = body.quantity;
    if (!body.itemId || !/^[0-9a-f-]{36}$/i.test(body.itemId) ||
        typeof quantity !== "number" || !Number.isFinite(quantity) ||
        quantity < 0 || quantity > 1000000 || Math.round(quantity * 1000) / 1000 !== quantity) {
      return NextResponse.json({ error: "Item ou quantidade inválida (até três casas decimais)." }, { status: 400 });
    }
    const { data: item, error: itemError } = await supabase.from("purchase_order_items")
      .select("id,tenant_id,purchase_order_id,quantity_to_buy,initial_quantity_to_buy,unit,unit_price,packages_to_buy")
      .eq("id", body.itemId).eq("tenant_id", order!.tenant_id)
      .eq("purchase_order_id", order!.id).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ error: "O produto não pertence a este pedido." }, { status: 404 });
    const initial = Number(item.initial_quantity_to_buy ?? item.quantity_to_buy);
    const oldPackages = item.packages_to_buy == null ? null : Number(item.packages_to_buy);
    // Evita conversões incorretas entre caixas, comprimidos e cartelas.
    if (quantity !== Number(item.quantity_to_buy) && oldPackages !== null && Math.abs(oldPackages - initial) > 0.0001) {
      return NextResponse.json({
        error: "Este item utiliza conversão de embalagens. A alteração exige nova cotação ou conferência específica de unidade."
      }, { status: 409 });
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const supplierConfirmationNote = typeof body.supplierConfirmationNote === "string"
      ? body.supplierConfirmationNote.trim().slice(0, 500) : "";
    if (quantity > initial && supplierConfirmationNote.length < 10) {
      return NextResponse.json({ error: "Para aumentar a quantidade, registre a confirmação do representante sobre preço e estoque (mínimo 10 caracteres)." }, { status: 409 });
    }
    if (quantity === 0 && note.length < 4) {
      return NextResponse.json({ error: "Informe o motivo da retirada do item." }, { status: 400 });
    }
    const unitPrice = Number(item.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Preço unitário inválido." }, { status: 409 });
    }
    const updated = await supabase.from("purchase_order_items")
      .update({
        quantity_to_buy: quantity,
        packages_to_buy: oldPackages === null ? null : quantity,
        total_price: Number((quantity * unitPrice).toFixed(4)),
        missing_quantity: quantity,
        buyer_change_note: note || null,
        supplier_confirmation_note: quantity > initial ? supplierConfirmationNote : null,
        buyer_changed_by: auth!.user?.id ?? "comprador",
        buyer_changed_at: new Date().toISOString(),
      })
      .eq("id", item.id).eq("tenant_id", order!.tenant_id)
      .eq("purchase_order_id", order!.id).select("id,quantity_to_buy,total_price").single();
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true, item: updated.data, message: "Quantidade salva. O total do pedido foi recalculado e a alteração registrada no histórico." });
  } catch (error) {
    console.error("[Cotacoes] Falha ao revisar quantidade", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a revisão." }, { status: 500 });
  }
}

/** Aprovação explícita libera o pedido para posterior envio, sem disparar WhatsApp. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ quotationId: string }> }) {
  try {
    const { quotationId } = await params;
    const body = await request.json() as ReviewBody;
    const ctx = await orderContext(request, quotationId, body);
    if (ctx.failure) return ctx.failure;
    const { supabase, order, auth } = ctx;
    const { data: items, error } = await supabase.from("purchase_order_items")
      .select("id,quantity_to_buy,initial_quantity_to_buy,supplier_confirmation_note")
      .eq("tenant_id", order!.tenant_id).eq("purchase_order_id", order!.id);
    if (error) throw error;
    if (!items?.some((item) => Number(item.quantity_to_buy) > 0)) {
      return NextResponse.json({ error: "O pedido está sem produtos. Mantenha pelo menos um item com quantidade maior que zero." }, { status: 409 });
    }
    if (items.some((item) => Number(item.quantity_to_buy) > Number(item.initial_quantity_to_buy) &&
      String(item.supplier_confirmation_note ?? "").trim().length < 10)) {
      return NextResponse.json({ error: "Acréscimos exigem registro da confirmação do representante sobre preço e estoque." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const result = await supabase.from("purchase_orders").update({
      buyer_review_status: "approved",
      buyer_approved_at: now,
      buyer_approved_by: auth!.user?.id ?? "comprador",
      updated_at: now,
    }).eq("tenant_id", order!.tenant_id).eq("id", order!.id)
      .eq("buyer_review_status", "pending").select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ error: "Este pedido já foi aprovado ou modificado." }, { status: 409 });
    return NextResponse.json({ ok: true, message: "Pedido aprovado. Agora você pode enviar ao representante ou distribuidora." });
  } catch (error) {
    console.error("[Cotacoes] Falha ao aprovar pedido", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível aprovar o pedido." }, { status: 500 });
  }
}
