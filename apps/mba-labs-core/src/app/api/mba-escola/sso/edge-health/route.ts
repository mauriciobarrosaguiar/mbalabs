import { NextResponse } from "next/server";

const SCHOOL_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await fetch(`${SCHOOL_URL}/functions/v1/mba-escola-sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(text) as Record<string, unknown>; } catch {}
    const code = typeof payload.code === "string" ? payload.code : null;

    return NextResponse.json(
      {
        reachable: response.status === 401 && code === "CORE_TOKEN_MISSING",
        status: response.status,
        code,
        responseType: response.headers.get("content-type"),
        bodyPreview: text.slice(0, 180)
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    return NextResponse.json(
      {
        reachable: false,
        status: null,
        code: "NETWORK_ERROR",
        error: error instanceof Error ? error.message : String(error),
        cause
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
