import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const names = [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "SUPABASE_DATABASE_URL",
    "SUPABASE_CONNECTION_STRING"
  ];

  const configured = Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])])) as Record<string, boolean>;
  return NextResponse.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}
