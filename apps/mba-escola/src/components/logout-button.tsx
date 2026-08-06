"use client";

import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <button className="secondary-button flex items-center gap-2" onClick={logout} type="button">
      <LogOut size={18} />
      Sair
    </button>
  );
}
