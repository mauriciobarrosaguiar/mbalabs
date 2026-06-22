/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { generatePurchaseOrders } from "@/modules/cotacoes/lib/data/repository";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/modules/cotacoes/lib/supabase/server";
import {
  listWhatsappEnvios,
  sendQuotationLinksByQuotation,
  sendWhatsAppMbaCotacoes,
  sendWinnerOrderLinksByQuotation,
  type WhatsappTipoEnvio,
} from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

type Body = {
  action?: "send_quotation_links" | "send_winner_orders" | "resend";
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
    return NextResponse.json({ envios });
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
      const orders = await generatePurchaseOrders(body.quotationId);
      const whatsapp = await sendWinnerOrderLinksByQuotation({ quotationId: body.quotationId, origin, orders });
      return NextResponse.json({ ok: true, orders, whatsapp });
    }

    if (body.action === "resend" || (body.tipoEnvio && body.vendedorId)) {
      if (!body.tipoEnvio || !body.vendedorId) return NextResponse.json({ error: "Tipo de envio e vendedor são obrigatórios para reenviar." }, { status: 400 });
      if (body.tipoEnvio === "link_cotacao") {
        const result = await resendQuotationLink({ quotationId: body.quotationId, vendedorId: body.vendedorId, origin });
        return NextResponse.json({ ok: true, whatsapp: summarizeSingle(result) });
      }
      const orders = await generatePurchaseOrders(body.quotationId);
      const whatsapp = await sendWinnerOrderLinksByQuotation({ quotationId: body.quotationId, origin, orders, vendedorId: body.vendedorId, forceResend: true });
      return NextResponse.json({ ok: true, orders, whatsapp });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    console.error("Erro no envio automático de WhatsApp", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no envio automático de WhatsApp." }, { status: 500 });
  }
}

async function ensureQuotationAccess(auth: Awaited<ReturnType<typeof getCurrentAuthContext>>, quotationId: string) {
  if (!auth.isAuthenticated || !auth.isActive) return { ok: false as const, status: 401, error: "Sessão expirada." };
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) return { ok: false as const, status: 409, error: "Supabase não configurado." };
  if (auth.isSuperAdmin) return { ok: true as const };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("quotations").select("tenant_id").eq("id", quotationId).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, status: 404, error: "Cotação não encontrada." };
  if (data.tenant_id !== auth.tenantAccess?.tenantId) return { ok: false as const, status: 403, error: "Sem permissão para esta cotação." };
  return { ok: true as const };
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
