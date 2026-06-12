import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isMissingProductionConfig } from "@/lib/runtime-mode";

const inactiveProfileMessage = "Usuário sem perfil ativo. Procure o administrador.";
const suspendedTenantStatuses = new Set(["suspended", "suspenso", "canceled", "cancelado", "inactive", "inativo"]);

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseConfigured = hasSupabaseEnv();

  if (!supabaseConfigured && isMissingProductionConfig()) {
    if (pathname === "/app/configuracoes/supabase") {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = "/app/configuracoes/supabase";
    return NextResponse.redirect(url);
  }

  if (!supabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const pendingCookies: PendingCookie[] = [];
  let pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: "tokens-only",
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingHeaders = { ...pendingHeaders, ...headers };
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pendingCookies.push({ name, value, options });
          });
          response = NextResponse.next({ request });
          applySupabaseCookies(response, pendingCookies, pendingHeaders);
        },
      },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return redirectToLogin(request, pendingCookies, pendingHeaders);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("id, role, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "ativo") {
    return redirectToLogin(request, pendingCookies, pendingHeaders, inactiveProfileMessage);
  }

  if (pathname.startsWith("/admin") && profile.role !== "SUPER_ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.search = "";
    return withSupabaseCookies(NextResponse.redirect(url), pendingCookies, pendingHeaders);
  }

  if (pathname.startsWith("/app") && profile.role !== "SUPER_ADMIN") {
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("status, tenants(tipo_cliente, status)")
      .eq("user_profile_id", profile.id)
      .eq("status", "ativo")
      .limit(1)
      .maybeSingle();

    const tenant = Array.isArray(tenantUser?.tenants) ? tenantUser?.tenants[0] : tenantUser?.tenants;
    const tenantType = tenant?.tipo_cliente as string | undefined;
    const tenantStatus = String(tenant?.status ?? "").toLowerCase();

    if (suspendedTenantStatuses.has(tenantStatus) && pathname !== "/app/acesso-suspenso") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/acesso-suspenso";
      url.search = "";
      return withSupabaseCookies(NextResponse.redirect(url), pendingCookies, pendingHeaders);
    }

    if (pathname !== "/app/acesso-suspenso" && pathname !== "/app/sem-permissao") {
      const blocked =
        (tenantType === "pharmacy" && isBiddingPath(pathname)) ||
        (tenantType === "distributor_bidding" && isPharmacyPath(pathname));

      if (blocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/sem-permissao";
        url.search = "";
        return withSupabaseCookies(NextResponse.redirect(url), pendingCookies, pendingHeaders);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};

function redirectToLogin(
  request: NextRequest,
  cookies: PendingCookie[],
  headers: Record<string, string>,
  message?: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (message) url.searchParams.set("erro", message);
  return withSupabaseCookies(NextResponse.redirect(url), cookies, headers);
}

function withSupabaseCookies(
  response: NextResponse,
  cookies: PendingCookie[],
  headers: Record<string, string>,
) {
  applySupabaseCookies(response, cookies, headers);
  return response;
}

function applySupabaseCookies(
  response: NextResponse,
  cookies: PendingCookie[],
  headers: Record<string, string>,
) {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

function isPharmacyPath(pathname: string) {
  return (
    pathname.startsWith("/app/cotacoes-farmacia") ||
    pathname === "/app/pedidos-gerados-farmacia" ||
    pathname === "/app/historico-compras"
  );
}

function isBiddingPath(pathname: string) {
  return (
    pathname.startsWith("/app/licitacoes") ||
    pathname === "/app/mapa-comparativo" ||
    pathname === "/app/analise-unidade" ||
    pathname === "/app/pedidos-gerados-licitacao" ||
    pathname === "/app/historico-precos"
  );
}
