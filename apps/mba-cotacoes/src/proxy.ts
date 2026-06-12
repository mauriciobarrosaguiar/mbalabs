import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isMissingProductionConfig } from "@/lib/runtime-mode";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseConfigured = hasSupabaseEnv();

  if (!supabaseConfigured && isMissingProductionConfig()) {
    if (pathname === "/app/configuracoes/supabase") {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = "/app/configuracoes/supabase";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (supabaseConfigured && !hasSupabaseAuthCookie(request)) {
    return redirectToCentralLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

function redirectToCentralLogin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_CORE_URL
    ? new URL("/login", process.env.NEXT_PUBLIC_CORE_URL)
    : new URL("/login", request.url);
  url.searchParams.set(
    "next",
    process.env.NEXT_PUBLIC_CORE_URL ? "/cotacoes" : `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(url);
}
