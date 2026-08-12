import { NextResponse } from "next/server";
import { getLoginDestination, getSessionProfile, isSuperAdminType, normalizeAppSlug } from "@/lib/core-data";

const DIRECT_APP_PATHS: Array<{ prefix: string; slug: string; adminOnly?: boolean }> = [
  { prefix: "/conteudo-ia", slug: "conteudo-ia" },
  { prefix: "/apps/conteudo-ia", slug: "conteudo-ia" },
  { prefix: "/apps/dronegestor", slug: "dronegestor" },
  { prefix: "/dronegestor", slug: "dronegestor" },
  { prefix: "/google-empresas", slug: "google-empresas", adminOnly: true }
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeInternalPath(url.searchParams.get("next") || "/dashboard");

  const directApp = DIRECT_APP_PATHS.find(
    ({ prefix }) => next === prefix || next.startsWith(`${prefix}/`)
  );

  if (directApp) {
    const context = await getSessionProfile();
    const profile = context.profile;

    if (context.user && profile?.status === "ativo") {
      const isAdmin = isSuperAdminType(profile.tipo);
      const hasAppAccess = (context.appsLiberados ?? []).some(
        (app) => normalizeAppSlug(app.slug) === normalizeAppSlug(directApp.slug) && app.canAccess
      );

      if (isAdmin || (!directApp.adminOnly && hasAppAccess)) {
        return NextResponse.json({ destination: next });
      }
    }
  }

  const destination = await getLoginDestination(next);
  return NextResponse.json({ destination });
}

function sanitizeInternalPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  return path;
}
