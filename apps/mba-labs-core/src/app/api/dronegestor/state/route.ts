import { NextRequest, NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const STATE_ACTION = "estado_campo_v2";
const FINALIZED_ACTION = "operacao_finalizada";
const MAX_STATE_BYTES = 180_000;

type StoredState = Record<string, unknown>;

async function getContext() {
  return requireAppAccess("dronegestor", "/apps/dronegestor/campo");
}

function validateState(value: unknown): StoredState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Estado da operacao invalido.");
  }

  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
    throw new Error("Estado da operacao excedeu o limite de sincronizacao.");
  }

  return value as StoredState;
}

export async function GET(request: NextRequest) {
  try {
    const current = await getContext();
    const admin = createSupabaseAdminClient() as any;
    const history = request.nextUrl.searchParams.get("history") === "1";

    if (history) {
      const { data, error } = await admin
        .from("core_logs")
        .select("id,detalhes,created_at")
        .eq("usuario_id", current.usuario.id)
        .eq("app_slug", "dronegestor")
        .eq("acao", FINALIZED_ACTION)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json({ ok: true, items: data ?? [] });
    }

    const { data, error } = await admin
      .from("core_logs")
      .select("id,detalhes,created_at")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", STATE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const details = data?.detalhes && typeof data.detalhes === "object" ? data.detalhes : null;
    return NextResponse.json({
      ok: true,
      state: details && "state" in details ? (details as any).state : null,
      updatedAt: details && "updatedAt" in details ? (details as any).updatedAt : data?.created_at ?? null
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar os dados do DroneGestor." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const current = await getContext();
    const body = await request.json();
    const state = validateState(body?.state);
    const updatedAt = typeof body?.updatedAt === "string" ? body.updatedAt : new Date().toISOString();
    const admin = createSupabaseAdminClient() as any;

    const { data: existing, error: findError } = await admin
      .from("core_logs")
      .select("id")
      .eq("usuario_id", current.usuario.id)
      .eq("app_slug", "dronegestor")
      .eq("acao", STATE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    const detalhes = { state, updatedAt, version: 2 };
    if (existing?.id) {
      const { error } = await admin.from("core_logs").update({ detalhes }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("core_logs").insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario.id,
        app_slug: "dronegestor",
        acao: STATE_ACTION,
        detalhes
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar os dados do DroneGestor." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const current = await getContext();
    const body = await request.json();
    const state = validateState(body?.state);
    const admin = createSupabaseAdminClient() as any;
    const finalizedAt = new Date().toISOString();

    const { error } = await admin.from("core_logs").insert({
      empresa_id: current.empresaId,
      usuario_id: current.usuario.id,
      app_slug: "dronegestor",
      acao: FINALIZED_ACTION,
      detalhes: { state, finalizedAt, version: 2 }
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, finalizedAt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao finalizar a operacao no Supabase." },
      { status: 500 }
    );
  }
}
