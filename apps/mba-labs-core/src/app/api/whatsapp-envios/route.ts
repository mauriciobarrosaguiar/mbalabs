import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { ensureQuotationAccess } from "@/modules/cotacoes/lib/auth/quotation-access";
import { generatePurchaseOrders } from "@/modules/cotacoes/lib/data/repository";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import {
  listWhatsappEnvios,
  sendQuotationLinksByQuotation,
  sendWhatsAppMbaCotacoes,
  sendWinnerOrderLinksByQuotation,
  type WhatsappTipoEnvio,
} from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

type Body = {
  action?: "send_quotation_links" | "send_winner_orders" | "resend" | "confirm_manual";
  quotationId?: string;
  tipoEnvio?: WhatsappTipoEnvio;
  vendedorId?: string;
};

export async function GET(request: NextRequest) {
  const quotationId = request.nextUrl.searchParams.get("quotationId") ?? "";
  const tipoEnvio = (request.nextUrl.searchParams.get("tipoEnvio") ?? "link_cotacao") as WhatsappTipoEnvio;
  const vendedorId = request.nextUrl.searchParams.get("vendedorId") ?? undefined;
  if (!quotationId) return NextResponse.json({ envios: [] });

  try {
    const auth = await getCurrentAuthContext();
    const access = await ensureQuotationAccess(auth, quotationId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const envios = await listWhatsappEnvios({ quotationId, tipoEnvio, vendedorId });
    if (envios.length === 0) return NextResponse.json({ envios });

    const supabase = createSupabaseAdminClient();
    const { data: deliveryRows, error: deliveryError } = await supabase
      .from("cot_whatsapp_envios")
      .select("id, provider_message_id, delivery_status, entregue_em, lido_em, status_atualizado_em")
      .in("id", envios.map((envio) => envio.id));

    if (deliveryError || !deliveryRows) return NextResponse.json({ envios });
    const deliveryById = new Map(deliveryRows.map((row) => [row.id, row]));
    const enriched = envios.map((envio) => {
      const delivery = deliveryById.get(envio.id);
      return {
        ...envio,
        providerMessageId: delivery?.provider_message_id ?? undefined,
        deliveryStatus: delivery?.delivery_status ?? undefined,
        entregueEm: delivery?.entregue_em ?? undefined,
        lidoEm: delivery?.lido_em ?? undefined,
        statusAtualizadoEm: delivery?.status_atualizado_em ?? undefined,
      };
    });
    return NextResponse.json({ envios: enriched });
  } catch {
    return NextResponse.json({ envios: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body;
    if (!body.quotationId) return NextResponse.json({ error: "Cotação obrigatória." }, { status: 400 });
    const auth = await getCurrentAuthContext();
    const access = await ensureQuotationAccess(auth, body.quotationId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const origin = request.nextUrl.origin;

    if (body.action === "send_quotation_links") {
      const whatsapp = await sendQuotationLinksByQuotation({ quotationId: body.quotationId, origin });
      return NextResponse.json({ ok: true, whatsapp });
    }

    if (body.action === "send_winner_orders") {
      const orders = await generatePurchaseOrders(body.quotationId, access.tenantId);
      const whatsapp = await sendWinnerOrderLinksByQuotation({ quotationId: body.quotationId, origin, orders });
      return NextResponse.json({ ok: true, orders, whatsapp });
    }

    if (body.action === "confirm_manual") {
      if (!body.tipoEnvio || !body.vendedorId) return NextResponse.json({ error: "Tipo de envio e vendedor são obrigatórios para confirmar o envio manual." }, { status: 400 });
      const envio = await confirmManualSend({ quotationId: body.quotationId, tipoEnvio: body.tipoEnvio, vendedorId: body.vendedorId });
      return NextResponse.json({ ok: true, envio });
    }

    if (body.action === "resend" || (body.tipoEnvio && body.vendedorId)) {
      if (!body.tipoEnvio || !body.vendedorId) return NextResponse.json({ error: "Tipo de envio e vendedor são obrigatórios para reenviar." }, { status: 400 });
      if (body.tipoEnvio === "link_cotacao") {
        const result = await resendQuotationLink({ quotationId: body.quotationId, vendedorId: body.vendedorId, origin });
        return NextResponse.json({ ok: true, whatsapp: summarizeSingle(result) });
      }
      const orders = await generatePurchaseOrders(body.quotationId, access.tenantId);
      const whatsapp = await sendWinnerOrderLinksByQuotation({ quotationId: body.quotationId, origin, orders, vendedorId: body.vendedorId, forceResend: true });
      return NextResponse.json({ ok: true, orders, whatsapp });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    console.error("Erro no envio automático de WhatsApp", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no envio automático de WhatsApp." }, { status: 500 });
  }
}

async function confirmManualSend(input: { quotationId: string; tipoEnvio: WhatsappTipoEnvio; vendedorId: string }) {
  const supabase = createSupabaseAdminClient();
  const { data: envio, error: findError } = await supabase
    .from("cot_whatsapp_envios")
    .select("id, telefone")
    .eq("cotacao_id", input.quotationId)
    .eq("tipo_envio", input.tipoEnvio)
    .eq("vendedor_id", input.vendedorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (!envio) throw new Error("Não foi encontrado um envio automático anterior para registrar a confirmação manual.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("cot_whatsapp_envios")
    .update({
      status: "enviado",
      erro: null,
      enviado_por: "manual_whatsapp",
      enviado_em: now,
      delivery_status: "manual_confirmed",
      status_atualizado_em: now,
    })
    .eq("id", envio.id);
  if (updateError) throw updateError;

  return { vendedorId: input.vendedorId, telefone: envio.telefone, status: "enviado", enviadoPor: "manual_whatsapp", deliveryStatus: "manual_confirmed" };
}

async function resendQuotationLink(input: { quotationId: string; vendedorId: string; origin: string }) {
  const supabase = createSupabaseAdminClient();
  const { data: quotation, error: quotationError } = await supabase.from("quotations").select("id, tenant_id, module_type, pharmacy_id, buyer_company_name").eq("id", input.quotationId).maybeSingle();
  if (quotationError) throw quotationError;
  if (!quotation) throw new Error("Cotação não encontrada.");

  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id, supplier_id, seller_name, seller_company, seller_whatsapp, public_token")
    .eq("quotation_id", input.quotationId)
    .or(`id.eq.${input.vendedorId},supplier_id.eq.${input.vendedorId}`)
    .limit(1)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("Vendedor não encontrado para esta cotação.");

  const companyName = await buyerName(supabase, quotation);
  const link = `${input.origin}/${quotation.module_type === "bidding" ? "licitacao" : "cotacao"}/responder/${session.public_token}`;
  const sellerName = session.seller_name || session.seller_company || "vendedor";
  const mensagem = `Olá ${sellerName}, a farmácia ${companyName} enviou uma nova cotação pelo MBA Cotações.\n\nPara responder, acesse:\n${link}\n\nNão responda esta mensagem. A resposta da cotação deve ser feita pelo link acima.`;

  return sendWhatsAppMbaCotacoes({ empresaId: quotation.tenant_id, cotacaoId: quotation.id, vendedorId: session.supplier_id || session.id, telefone: session.seller_whatsapp, mensagem, tipoEnvio: "link_cotacao", linkEnviado: link, forceResend: true });
}

async function buyerName(supabase: ReturnType<typeof createSupabaseAdminClient>, quotation: Record<string, any>) {
  const [{ data: tenant }, { data: pharmacy }] = await Promise.all([
    supabase.from("tenants").select("nome_fantasia, razao_social").eq("id", quotation.tenant_id).maybeSingle(),
    quotation.pharmacy_id ? supabase.from("pharmacies").select("nome_fantasia, razao_social").eq("id", quotation.pharmacy_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return pharmacy?.nome_fantasia || pharmacy?.razao_social || quotation.buyer_company_name || tenant?.nome_fantasia || tenant?.razao_social || "Farmácia";
}

function summarizeSingle(result: Awaited<ReturnType<typeof sendWhatsAppMbaCotacoes>>) {
  return { total: 1, enviado: result.status === "enviado" ? 1 : 0, falhou: result.status === "falhou" ? 1 : 0, pendente: result.status === "pendente" ? 1 : 0, ignorado: result.skipped ? 1 : 0, results: [result] };
}
