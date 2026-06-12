import { NextRequest, NextResponse } from "next/server";
import { canUseSupabaseOperational } from "@/modules/cotacoes/lib/data/supabase-operational";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  if (!canUseSupabaseOperational()) {
    return NextResponse.json(
      { error: "Supabase não configurado para gravação real." },
      { status: 409 },
    );
  }

  try {
    const body = await request.json() as { id?: string; action?: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data: session, error: sessionError } = await supabase
      .from("supplier_quote_sessions")
      .select("id,status,quotation_id")
      .eq("id", body.id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });

    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("status")
      .eq("id", session.quotation_id)
      .maybeSingle();
    if (quotationError) throw quotationError;
    if (!quotation) return NextResponse.json({ error: "Cotação não encontrada." }, { status: 404 });

    if (body.action === "revoke") {
      const { error } = await supabase
        .from("supplier_quote_sessions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .neq("status", "submitted");
      if (error) throw error;
      return NextResponse.json({ ok: true, status: "canceled" });
    }

    if (body.action === "regenerate") {
      if (quotation.status === "finished" || quotation.status === "canceled") {
        return NextResponse.json({ error: "Cotação cancelada ou finalizada não permite novo token." }, { status: 409 });
      }
      if (session.status === "submitted" || session.status === "canceled") {
        return NextResponse.json({ error: "Este link não permite novo token." }, { status: 409 });
      }
      const publicToken = crypto.randomUUID().replaceAll("-", "");
      const { data, error } = await supabase
        .from("supplier_quote_sessions")
        .update({
          public_token: publicToken,
          status: "opened",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id)
        .neq("status", "submitted")
        .select("public_token,status")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, token: data.public_token, status: data.status });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar link." },
      { status: 500 },
    );
  }
}
