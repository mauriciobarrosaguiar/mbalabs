import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {canonicalAgroVooPath,internalAgroVooPath} from "./lib/agrovoo-routes";

export function proxy(request: NextRequest) {
  const pathname=request.nextUrl.pathname;
  const canonical=canonicalAgroVooPath(pathname);
  if(canonical!==pathname&&(request.method==="GET"||request.method==="HEAD")){
    const url=request.nextUrl.clone();url.pathname=canonical;url.searchParams.delete("legacy");return NextResponse.redirect(url,307);
  }
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mba-current-path", currentPath);

  const internal=internalAgroVooPath(pathname);
  if(internal!==pathname){const url=request.nextUrl.clone();url.pathname=internal;return NextResponse.rewrite(url,{request:{headers:requestHeaders}});}
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
    "/mba-escola/:path*",
    "/google-empresas/:path*",
    "/acesso-bloqueado"
  ]
};
