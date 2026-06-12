import { redirect } from "next/navigation";
import { getCurrentAuthContext, getDefaultRouteForContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppIndexPage() {
  const auth = await getCurrentAuthContext();

  if (auth.isAuthenticated && auth.isActive) {
    redirect(getDefaultRouteForContext(auth));
  }

  redirect("/app/dashboard");
}
