import { notFound, redirect } from "next/navigation";
import { normalizeAppSlug, requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

const internalDestinations: Record<string, string> = {
  "mba-cotacoes": "/cotacoes",
  lavagestor: "/lavagestor"
};

export default async function AppEntryPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const appSlug = normalizeAppSlug(slug);
  const destination = internalDestinations[appSlug];

  if (!destination) {
    notFound();
  }

  await requireAppAccess(appSlug, `/apps/${slug}`);
  redirect(destination);
}
