import { redirect } from "next/navigation";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaGestorPortalPage() {
  await requireLavaGestorAccess("/lavagestor/operacao");
  redirect("/lavagestor/operacao");
}
