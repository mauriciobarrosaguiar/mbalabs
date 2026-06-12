import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return redirectToCentralLogin(request);
}

export async function POST(request: NextRequest) {
  return redirectToCentralLogin(request);
}

function redirectToCentralLogin(request: NextRequest) {
  const next = normalizeNextPath(request.nextUrl.searchParams.get("next") || "/app/dashboard");
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL;
  const url = coreUrl ? new URL("/login", coreUrl) : new URL("/login", request.url);
  url.searchParams.set("next", coreUrl ? "/cotacoes" : next);
  return NextResponse.redirect(url, { status: 303 });
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  return value;
}
