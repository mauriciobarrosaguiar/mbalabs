import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      configured: Boolean(
        process.env.MBA_ESCOLA_SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ESCOLA_SERVICE_ROLE_KEY
      )
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
