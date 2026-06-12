import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Logout should still return the user to the central login.
    }
  }

  const target = process.env.NEXT_PUBLIC_CORE_URL
    ? new URL("/login", process.env.NEXT_PUBLIC_CORE_URL)
    : new URL("/login", request.url);
  const error = request.nextUrl.searchParams.get("erro");
  if (error) target.searchParams.set("erro", error);

  const response = NextResponse.redirect(target);
  response.cookies.delete("cotafarma-demo-session");
  return response;
}
