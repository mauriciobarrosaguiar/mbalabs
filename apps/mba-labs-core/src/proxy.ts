import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mba-current-path", currentPath);

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
    "/empresa/:path*",
    "/selecionar-app",
    "/apps/:path*",
    "/cotacoes/:path*",
    "/lavagestor/:path*",
    "/bikecomanda/:path*",
    "/portal-associativo/:path*",
    "/acesso-bloqueado"
  ]
};
