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
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const code = typeof payload.code === "string" ? payload.code : null;

    return NextResponse.json(
      {
        reachable: response.status === 401 && code === "CORE_TOKEN_MISSING",
        status: response.status,
        code
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { reachable: false, status: null, code: "NETWORK_ERROR" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
