"use client";

import { LogOut } from "lucide-react";
import { createSupabaseClient } from "@mba-labs/shared/supabase/client";

type LogoutButtonLexGestorProps = {
  variant?: "sidebar" | "topbar" | "mobile";
};

export function LogoutButtonLexGestor({ variant = "sidebar" }: LogoutButtonLexGestorProps) {
  async function handleLogout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (variant === "topbar") {
    return (
      <button className="button secondary topbar-icon-button" type="button" onClick={handleLogout} aria-label="Sair" title="Sair">
        <LogOut size={17} aria-hidden />
      </button>
    );
  }

  if (variant === "mobile") {
    return (
      <button type="button" onClick={handleLogout} title="Sair">
        <LogOut size={18} aria-hidden />
        <span>Sair</span>
      </button>
    );
  }

  return (
    <button className="nav-link" type="button" onClick={handleLogout}>
      <LogOut size={18} aria-hidden />
      <span>Sair</span>
    </button>
  );
}
