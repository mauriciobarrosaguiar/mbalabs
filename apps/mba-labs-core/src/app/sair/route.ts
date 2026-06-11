import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
