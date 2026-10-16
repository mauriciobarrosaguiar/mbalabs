import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { ensureQuotationAccess } from "@/modules/cotacoes/lib/auth/quotation-access";
import { isQuotationClosed } from "@/modules/cotacoes/lib/quotation-status";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

/**
 * Entrada autenticada de preços recebidos da distribuidora.
 * Não consulta portais nem afirma que haja API homologada; os conectores
 * futuros deverão usar um serviço interno, sem expor segredos no navegador.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentAuthContext();
    if (!auth.isSuperAdmin && !["ADMIN_EMPRESA", "COMPRADOR"].includes(auth.profile?.role ?? "")) {
      return NextResponse.json({ error: "Somente compradores e administradores podem importar ofertas." }, { status: 403 });
    }

    const body = await request.json() as {
      quotationId?: unknown;
      supplierId?: unknown;
      offers?: Array<{ quotationItemId?: unknown; ean?: unknown; unitPrice?: unknown; availableQuantity?: unknown }>;
    };

    if (typeof body.quotationId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.quotationId) ||
        typeof body.supplierId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.supplierId) ||
        !Array.isArray(body.offers) || body.offers.length < 1 || body.offers.length > 1000) {
      return NextResponse.json({ error: "Cotação, fornecedor e lista de ofertas são obrigatórios (até 1.000 itens)." }, { status: 400 });
    }

    const access = await ensureQuotationAccess(
      auth, body.quotationId, "id,tenant_id,module_type,status,deleted_at",
    );
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const quote = access.quotation;
    if (quote.module_type !== "pharmacy" || isQuotationClosed(String(quote.status)) || quote.deleted_at) {
      return NextResponse.json({ error: "Apenas cotações de farmácia abertas aceitam ofertas importadas." }, { status: 409 });
    }

    const supabase = createSupabaseAdminClient();
    const tenantId = quote.tenant_id;
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id,tipo_fornecedor,status")
      .eq("id", body.supplierId).eq("tenant_id", tenantId).maybeSingle();
    if (supplierError) throw supplierError;
    if (!supplier || supplier.status !== "ativo" || supplier.tipo_fornecedor !== "distribuidora") {
      return NextResponse.json({ error: "Selecione uma distribuidora ativa cadastrada nesta empresa." }, { status: 400 });
    }

    const ids = body.offers.map((offer) => offer.quotationItemId);
    if (ids.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) ||
        new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Itens inválidos ou repetidos na lista." }, { status: 400 });
    }
    const { data: items, error: itemsError } = await supabase
      .from("quotation_items")
      .select("id,ean,requested_quantity,requested_unit")
      .eq("quotation_id", body.quotationId).eq("tenant_id", tenantId).in("id", ids as string[]);
    if (itemsError) throw itemsError;
    if ((items ?? []).length !== body.offers.length) {
      return NextResponse.json({ error: "Um ou mais itens não pertencem à cotação selecionada." }, { status: 400 });
    }

    type ExpectedItem = { id: string; ean: string | null; requested_quantity: number; requested_unit: string | null };
    const productById = new Map<string, ExpectedItem>((items ?? []).map((item: ExpectedItem) => [item.id, item]));
    const rows = [];
    for (const offer of body.offers) {
      const item = productById.get(offer.quotationItemId as string);
      // Importação sem conversão de embalagem: bloquear cotações em CP/CAP/ML/G/KG.
      const unit = String(item?.requested_unit ?? "").toUpperCase();
      if (!["CX", "FR", "FLAC", "BIS", "UN", "AMP", "SACHE"].includes(unit)) {
        return NextResponse.json({ error: "A unidade deste produto exige conversão de embalagem antes da comparação automática." }, { status: 400 });
      }
      const expectedEan = String(item?.ean ?? "").replace(/\D/g, "");
      const offeredEan = String(offer.ean ?? "").replace(/\D/g, "");
      if (!expectedEan || offeredEan !== expectedEan) {
        return NextResponse.json({ error: "A apresentação/EAN não confere. Importe somente produtos com EAN idêntico." }, { status: 400 });
      }
      const price = offer.unitPrice;
      const available = offer.availableQuantity;
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 999999 ||
          typeof available !== "number" || !Number.isFinite(available) || available < Number(item.requested_quantity)) {
        return NextResponse.json({ error: "Preço inválido ou estoque insuficiente para atender integralmente o item." }, { status: 400 });
      }
      rows.push({
        tenant_id: tenantId,
        quotation_id: body.quotationId,
        quotation_item_id: offer.quotationItemId,
        supplier_id: body.supplierId,
        source: "importacao_autorizada",
        ean: expectedEan,
        unit_price: price,
        available_quantity: available,
        collected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabase.from("cot_distributor_offers").upsert(
      rows, { onConflict: "tenant_id,quotation_id,quotation_item_id,supplier_id" },
    );
    if (error) throw error;
    return NextResponse.json({
      ok: true, imported: rows.length,
      message: "Ofertas importadas e adicionadas à comparação provisória, sem encerrar a cotação dos representantes.",
    });
  } catch (error) {
    console.error("[Cotacoes] Falha na importação das ofertas digitais.", error);
    return NextResponse.json({ error: "Não foi possível importar ofertas. Verifique a integração e tente novamente." }, { status: 500 });
  }
}
