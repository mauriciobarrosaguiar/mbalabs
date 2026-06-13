import { redirect } from "next/navigation";
import { logAction } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  redirect("/login");
}

export async function POST() {
  await logAction({ acao: "logout" });
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
