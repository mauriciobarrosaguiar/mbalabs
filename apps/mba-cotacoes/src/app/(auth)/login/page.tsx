import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  redirect(getCentralLoginUrl(params.next || "/app/dashboard"));
}

function getCentralLoginUrl(nextPath: string) {
  const safeNext = normalizeNextPath(nextPath);
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL;

  if (coreUrl) {
    const url = new URL("/login", coreUrl);
    url.searchParams.set("next", toCoreNextPath(safeNext));
    return url.toString();
  }

  return `/login?next=${encodeURIComponent(safeNext)}`;
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  return value;
}

function toCoreNextPath(_appPath: string) {
  return "/cotacoes";
}
