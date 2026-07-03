import { NextRequest, NextResponse } from "next/server";
import {
  canUseSupabaseOperational,
  createSupabaseQuotation,
} from "@/modules/cotacoes/lib/data/supabase-operational";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import { canFinishQuotation, isQuotationClosed } from "@/modules/cotacoes/lib/quotation-status";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import {
  ensureCreateQuotationAccess,
  ensureQuotationAccess,
  normalizeModuleType,
} from "@/modules/cotacoes/lib/auth/quotation-access";

export async function POST(request: NextRequest) {
  if (!canUseSupabaseOperational()) {
    return NextResponse.json(
      { error: "Supabase não configurado para gravação real." },
      { status: 409 },
    );
  }

  try {
    const body = await request.json();
    const auth = await getCurrentAuthContext();
    const moduleType = normalizeModuleType(body.moduleType);
    if (!moduleType) return NextResponse.json({ error: "Modulo invalido." }, { status: 400 });

    const access = ensureCreateQuotationAccess(auth, moduleType, body.tenantId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const tenantId = access.tenantId;
    console.info("[API] POST /api/quotations", {
      moduleType,
      tenantId,
      tenantName: auth.tenantAccess?.tenantName,
      isSuperAdmin: auth.isSuperAdmin,
    });
    const result = await createSupabaseQuotation({ ...body, moduleType, tenantId });
    return NextResponse.json({
      ...result,
      links: result.sessions.map((session: { supplierId?: string; publicToken: string }) => ({
        supplierId: session.supplierId,
        token: session.publicToken,
        url: `${request.nextUrl.origin}/cotacoes/responder/${session.publicToken}`,
      })),
    });
  } catch (error) {
    console.error("Erro ao criar cotação", error);
    return NextResponse.json(
      { error: resolveErrorMessage(error, "Erro ao criar cotação.") },
      { status: 500 },
    );
  }
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}

export async function PATCH(request: NextRequest) {
  if (!canUseSupabaseOperational()) {
    return NextResponse.json(
      { error: "Supabase não configurado para gravação real." },
      { status: 409 },
    );
  }

  try {
    const body = await request.json() as { id?: string; action?: string; reason?: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const auth = await getCurrentAuthContext();
    const access = await ensureQuotationAccess(auth, body.id, "*");
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const quotation = access.quotation as Record<string, any>;

    if (body.action === "finish") {
      if (!canFinishQuotation(quotation.status)) {
        return NextResponse.json({ error: "Somente cotações abertas, aguardando respostas ou em análise podem ser finalizadas." }, { status: 409 });
      }

      const now = new Date().toISOString();
      const { error: sessionUpdateError } = await supabase
        .from("supplier_quote_sessions")
        .update({ status: "canceled", updated_at: now })
        .eq("quotation_id", body.id)
        .neq("status", "submitted");
      if (sessionUpdateError) throw sessionUpdateError;

      const { error: updateError } = await supabase
        .from("quotations")
        .update({ status: "finished", updated_at: now })
        .eq("id", body.id);
      if (updateError) throw updateError;

      return NextResponse.json({ ok: true, status: "finished" });
    }

    if (body.action === "cancel") {
      if (isQuotationClosed(quotation.status)) {
        return NextResponse.json({ error: "Cotação finalizada, gerada ou cancelada não pode ser cancelada." }, { status: 409 });
      }
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("quotations")
        .update({
          status: "canceled",
          notes: [quotation.notes, body.reason ? `Cancelada em ${now}. Motivo: ${body.reason}` : `Cancelada em ${now}.`]
            .filter(Boolean)
            .join("\n"),
          updated_at: now,
        })
        .eq("id", body.id);
      if (updateError) throw updateError;

      await supabase
        .from("supplier_quote_sessions")
        .update({ status: "canceled" })
        .eq("quotation_id", body.id)
        .neq("status", "submitted");

      return NextResponse.json({ ok: true, status: "canceled" });
    }

    if (body.action === "reopen_links") {
      if (isQuotationClosed(quotation.status)) {
        return NextResponse.json({ error: "Cotação cancelada ou finalizada não permite gerar novos links." }, { status: 409 });
      }
      const { error: updateError } = await supabase
        .from("quotations")
        .update({ status: "waiting_responses", updated_at: new Date().toISOString() })
        .eq("id", body.id);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true, status: "waiting_responses" });
    }

    if (body.action === "update_basic") {
      if (isQuotationClosed(quotation.status)) {
        return NextResponse.json({ error: "Cotação cancelada ou finalizada não permite edição." }, { status: 409 });
      }
      const patch = body as {
        name?: string;
        deadlineAt?: string;
        notes?: string;
      };
      const updatePayload: Record<string, unknown> = {
        deadline_at: patch.deadlineAt ? new Date(patch.deadlineAt).toISOString() : quotation.deadline_at,
        notes: patch.notes ?? quotation.notes,
        updated_at: new Date().toISOString(),
      };
      if (quotation.status === "draft" && patch.name) {
        updatePayload.name = patch.name;
      }
      const { error: updateError } = await supabase
        .from("quotations")
        .update(updatePayload)
        .eq("id", body.id);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "duplicate") {
      const { data: itemRows, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", body.id)
        .order("item_number", { ascending: true });
      if (itemsError) throw itemsError;

      const quotationPayload = { ...quotation };
      delete quotationPayload.id;
      delete quotationPayload.created_at;
      delete quotationPayload.updated_at;

      const { data: duplicate, error: duplicateError } = await supabase
        .from("quotations")
        .insert({
          ...quotationPayload,
          name: `${quotation.name} (copia)`,
          status: "draft",
          notes: quotation.notes ?? null,
        })
        .select("*")
        .single();
      if (duplicateError) throw duplicateError;

      const duplicatedItems = (itemRows ?? []).map((item: Record<string, unknown>) => {
        const itemPayload = { ...item };
        delete itemPayload.id;
        delete itemPayload.created_at;
        delete itemPayload.updated_at;
        return {
          ...itemPayload,
          quotation_id: duplicate.id,
          status: "aguardando_respostas",
        };
      });

      if (duplicatedItems.length > 0) {
        const { error: itemInsertError } = await supabase
          .from("quotation_items")
          .insert(duplicatedItems);
        if (itemInsertError) throw itemInsertError;
      }

      return NextResponse.json({ ok: true, id: duplicate.id, status: "draft" });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    console.error("Erro ao atualizar cotação", error);
    return NextResponse.json(
      { error: resolveErrorMessage(error, "Erro ao atualizar cotação.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!canUseSupabaseOperational()) {
    return NextResponse.json(
      { error: "Supabase não configurado para gravação real." },
      { status: 409 },
    );
  }

  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const auth = await getCurrentAuthContext();
    const access = await ensureQuotationAccess(auth, body.id, "id,status,tenant_id,module_type,deleted_at");
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    await softDeleteQuotation(supabase, body.id, now);
    await cleanupDeletedQuotationRelations(supabase, body.id, now);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir cotacao", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir cotação." },
      { status: 500 },
    );
  }
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function softDeleteQuotation(supabase: SupabaseAdminClient, quotationId: string, now: string) {
  const attempts: Array<{ label: string; payload: Record<string, string> }> = [
    {
      label: "status excluida com deleted_at",
      payload: { status: "excluida", deleted_at: now, updated_at: now },
    },
    {
      label: "status deleted com deleted_at",
      payload: { status: "deleted", deleted_at: now, updated_at: now },
    },
    {
      label: "status excluida sem deleted_at",
      payload: { status: "excluida", updated_at: now },
    },
    {
      label: "deleted_at sem alterar status",
      payload: { deleted_at: now, updated_at: now },
    },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    const { error } = await supabase
      .from("quotations")
      .update(attempt.payload)
      .eq("id", quotationId);

    if (!error) return;

    lastError = error;
    console.warn("[Supabase] Falha em tentativa de exclusao de cotacao.", {
      quotationId,
      attempt: attempt.label,
      error,
    });
  }

  throw new Error(resolveErrorMessage(lastError, "Erro ao excluir cotacao."));
}

async function cleanupDeletedQuotationRelations(supabase: SupabaseAdminClient, quotationId: string, now: string) {
  const cleanupErrors: Array<{ step: string; error: unknown }> = [];

  const sessionResult = await supabase
    .from("supplier_quote_sessions")
    .update({ status: "canceled" })
    .eq("quotation_id", quotationId);
  if (sessionResult.error) cleanupErrors.push({ step: "supplier_quote_sessions", error: sessionResult.error });

  const orderError = await cancelPurchaseOrdersForDeletedQuotation(supabase, quotationId);
  if (orderError) cleanupErrors.push({ step: "purchase_orders", error: orderError });

  const pendingResult = await supabase
    .from("winner_order_pending_items")
    .update({ status: "cancelado", updated_at: now })
    .eq("quotation_id", quotationId)
    .eq("status", "pendente");
  if (pendingResult.error) cleanupErrors.push({ step: "winner_order_pending_items", error: pendingResult.error });

  if (cleanupErrors.length > 0) {
    console.warn("[Supabase] Cotacao excluida, mas houve falhas ao limpar vinculos dependentes.", {
      quotationId,
      cleanupErrors,
    });
  }
}

async function cancelPurchaseOrdersForDeletedQuotation(supabase: SupabaseAdminClient, quotationId: string) {
  const activeStatuses = [
    "gerado",
    "enviado",
    "enviado_ao_vendedor",
    "aberto_pelo_vendedor",
    "em_conferencia",
    "draft",
    "sent",
    "generated",
  ];

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelado" })
    .eq("quotation_id", quotationId)
    .in("status", activeStatuses);

  if (!error) return null;
  if (!shouldRetryPurchaseOrderCanceledStatus(error)) return error;

  const fallback = await supabase
    .from("purchase_orders")
    .update({ status: "canceled" })
    .eq("quotation_id", quotationId)
    .in("status", [...activeStatuses, "cancelado"]);

  return fallback.error ?? null;
}

function shouldRetryPurchaseOrderCanceledStatus(error: unknown) {
  const text = JSON.stringify(error).toLowerCase();
  return text.includes("purchase_orders_status_check") ||
    text.includes("constraint") ||
    text.includes("status");
}
