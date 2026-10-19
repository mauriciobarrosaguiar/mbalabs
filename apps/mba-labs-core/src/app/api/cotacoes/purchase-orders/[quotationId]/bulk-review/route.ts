import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { ensureQuotationAccess } from "@/modules/cotacoes/lib/auth/quotation-access";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import { getPurchaseOrdersByQuotation } from "@/modules/cotacoes/lib/data/repository";
import { sendWinnerOrderLinksByQuotation } from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Change = { orderId: string; itemId: string; quantity: number; note?: string };
type MinimumException = {
  orderId: string;
  distributorId: string;
  confirmed: boolean;
  reason: string;
};
type RequestBody = {
  action?: "save" | "approve_send";
  items?: Change[];
  minimumExceptions?: MinimumException[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Uma operação única para TODOS os pedidos ainda pendentes.
 * As alterações de quantidade e a aprovação são atômicas no PostgreSQL.
 * Em caso de falha de envio, a aprovação permanece registrada, com status
 * individual por representante e possibilidade de reenvio manual.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ quotationId: string }> }) {
  try {
    const { quotationId } = await params;
    if (!uuid.test(quotationId)) return NextResponse.json({ error: "Cotação inválida." }, { status: 400 });
    const auth = await getCurrentAuthContext();
    const access = await ensureQuotationAccess(auth, quotationId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (access.quotation.module_type !== "pharmacy") {
      return NextResponse.json({ error: "Revisão conjunta disponível apenas para cotações de farmácia." }, { status: 409 });
    }
    if (!["ADMIN_EMPRESA", "COMPRADOR"].includes(auth.profile?.role ?? "") || auth.isSuperAdmin) {
      return NextResponse.json({ error: "Somente o comprador ou administrador da farmácia pode aprovar pedidos." }, { status: 403 });
    }
    const body = await request.json() as RequestBody;
    if (!["save", "approve_send"].includes(body.action ?? "")) {
      return NextResponse.json({ error: "Ação de revisão inválida." }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 2000 ||
        body.items.some((item) =>
          !uuid.test(item.orderId) || !uuid.test(item.itemId) ||
          typeof item.quantity !== "number" || !Number.isFinite(item.quantity) ||
          item.quantity < 0 || item.quantity > 1000000 ||
          Math.round(item.quantity * 1000) / 1000 !== item.quantity ||
          (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 500))
        )) {
      return NextResponse.json({ error: "Revise os identificadores e as quantidades dos produtos." }, { status: 400 });
    }

    const minimumExceptions = body.minimumExceptions ?? [];
    if (!Array.isArray(minimumExceptions) || minimumExceptions.length > 200 ||
      minimumExceptions.some((exception) =>
        !uuid.test(exception.orderId) || !uuid.test(exception.distributorId) ||
        exception.confirmed !== true || typeof exception.reason !== "string" ||
        exception.reason.trim().length < 10 || exception.reason.trim().length > 500) ||
      (body.action === "save" && minimumExceptions.length > 0)) {
      return NextResponse.json({
        error: "Confirme cada exceção de pedido mínimo e informe justificativa de 10 a 500 caracteres.",
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("cot_review_winner_orders_batch", {
      p_tenant_id: access.tenantId,
      p_quotation_id: quotationId,
      p_actor: auth.user?.id ?? "comprador",
      p_items: body.items.map((item) => ({
        orderId: item.orderId,
        itemId: item.itemId,
        quantity: item.quantity.toString(),
        note: item.note ?? "",
      })),
      p_approve: body.action === "approve_send",
      p_exceptions: minimumExceptions.map((exception) => ({
        orderId: exception.orderId,
        distributorId: exception.distributorId,
        confirmed: exception.confirmed,
        reason: exception.reason.trim(),
      })),
    });
    if (error) {
      const message = /Cotacao|Pedido|pedido|cotacao|Item|Produto|produto|Quantidade|quantidade|identificador|revisao|alterados|Preco|minimo|excecao|Confirmacao|distribuidora/.test(error.message)
        ? error.message : "Não foi possível salvar a revisão conjunta. Atualize a página e tente novamente.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (body.action === "approve_send") {
      const tenantId = access.tenantId;
      const origin = request.nextUrl.origin;
      after(async () => {
        try {
          const allOrders = await getPurchaseOrdersByQuotation(quotationId, tenantId);
          const eligible = allOrders.filter((order) =>
            order.buyerReviewStatus === "approved" &&
            !order.buyerSentAt &&
            !["cancelado", "canceled"].includes(order.status) &&
            order.items.some((item) => item.quantityToBuy > 0),
          );
          if (eligible.length === 0) return;
          const batch = await sendWinnerOrderLinksByQuotation({ quotationId, origin, orders: eligible });
          const now = new Date().toISOString();
          const sentIds = eligible
            .filter((order) => batch.results.some((result) =>
              result.vendedorId === (order.supplierId || order.id) && result.status === "enviado"))
            .map((order) => order.id);
          if (sentIds.length > 0) {
            const { error: updateError } = await createSupabaseAdminClient()
              .from("purchase_orders").update({
                buyer_sent_at: now,
                status: "enviado_ao_vendedor",
                updated_at: now,
              })
              .eq("tenant_id", tenantId).eq("quotation_id", quotationId)
              .eq("buyer_review_status", "approved").is("buyer_sent_at", null)
              .in("id", sentIds);
            if (updateError) throw updateError;
          }
          for (const result of batch.results) {
            if (!result.providerMessageId) continue;
            await createSupabaseAdminClient().from("cot_whatsapp_envios").update({
              provider_message_id: result.providerMessageId,
              delivery_status: "sent",
              status_atualizado_em: now,
            }).eq("cotacao_id", quotationId).eq("tipo_envio", "resultado_cotacao")
              .eq("vendedor_id", result.vendedorId);
          }
          if (batch.falhou > 0) {
            console.warn("[Cotações] Envio automático parcial após aprovação coletiva", {
              quotationId, falhou: batch.falhou, total: batch.total,
            });
          }
        } catch (error) {
          console.error("[Cotações] Não foi possível concluir a distribuição automática dos pedidos", error);
        }
      });
      return NextResponse.json({
        ok: true, ...data, queued: true,
        message: "Todos os pedidos foram aprovados; exceções de pedido mínimo foram auditadas. O envio aos representantes foi iniciado.",
      });
    }
    return NextResponse.json({ ok: true, ...data, message: "Quantidades de todos os representantes salvas juntas. Revise o total antes de aprovar." });
  } catch (error) {
    console.error("[Cotações] Erro na revisão coletiva", error);
    return NextResponse.json({ error: "Erro interno ao revisar os pedidos. Nenhuma confirmação de envio foi registrada." }, { status: 500 });
  }
}
