import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(request: Request) {
  await logAction({ acao: "logout" });
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect(logoutDestination(request));
}

export async function POST(request: Request) {
  await logAction({ acao: "logout" });
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect(logoutDestination(request));
}

function logoutDestination(request: Request) {
  const app = new URL(request.url).searchParams.get("app");
  return app === "elshaday" ? "/login?app=elshaday" : "/login";
}
