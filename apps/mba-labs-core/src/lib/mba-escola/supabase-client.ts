"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MBA_ESCOLA_SUPABASE_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";
const MBA_ESCOLA_PUBLISHABLE_KEY = "sb_publishable_dEfjGxNY_xpLXKAE2atiag_vRHwqVLw";
const MBA_ESCOLA_STORAGE_KEY = "mba-escola-sso-v2";

let client: SupabaseClient | null = null;

const tabStorage = {
  getItem(key: string) {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  }
};

export function getMbaEscolaSupabase() {
  if (!client) {
    client = createClient(MBA_ESCOLA_SUPABASE_URL, MBA_ESCOLA_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: MBA_ESCOLA_STORAGE_KEY,
        storage: tabStorage
      }
    });
  }

  return client;
}

export function removeLegacyMbaEscolaSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("mba-escola-auth");
  }
}
