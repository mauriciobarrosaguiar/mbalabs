import { notFound, redirect } from "next/navigation";
import { getInternalAppBySlug } from "@/lib/app-registry";

export const dynamic = "force-dynamic";

type AppAliasPageProps = {
  params: Promise<{ appSlug: string }>;
};

export default async function AppAliasPage({ params }: AppAliasPageProps) {
  const { appSlug } = await params;
  const app = getInternalAppBySlug(appSlug);

  if (!app) notFound();

  redirect(app.urlPath);
}
