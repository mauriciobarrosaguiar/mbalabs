import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/cotacoes", "/lavagestor", "/acesso-bloqueado"];

export function proxy(request: NextRequest) {
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mba-current-path", currentPath);

  if (isPublicCotacoesPath(request.nextUrl.pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  if (isProtectedPath(request.nextUrl.pathname) && !hasSupabaseAuthCookie(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", currentPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/cotacoes/:path*",
    "/lavagestor/:path*",
    "/acesso-bloqueado"
  ]
};

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicCotacoesPath(pathname: string) {
  return (
    pathname.startsWith("/cotacoes/responder/") ||
    pathname.startsWith("/cotacoes/pedido/") ||
    pathname.startsWith("/cotacoes/cotacao/responder/") ||
    pathname.startsWith("/cotacoes/licitacao/responder/") ||
    pathname.startsWith("/cotacoes/cotacao/pedido/") ||
    pathname.startsWith("/cotacoes/licitacao/pedido/")
  );
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}
