import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const [appsResult, userResult] = await Promise.all([
      supabase.from("core_apps").select("slug,nome").limit(10),
      supabase.auth.getUser()
    ]);

    return NextResponse.json({
      ok: !appsResult.error,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      core_apps: appsResult.data ?? [],
      core_apps_error: appsResult.error?.message ?? null,
      authenticated: Boolean(userResult.data.user)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
