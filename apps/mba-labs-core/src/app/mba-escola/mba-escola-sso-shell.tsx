"use client";

import { createClient } from "@supabase/supabase-js";
import { GraduationCap, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import MbaEscolaClient from "./mba-escola-client-v2";

const SCHOOL_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";
const SCHOOL_PUBLISHABLE_KEY = "sb_publishable_dEfjGxNY_xpLXKAE2atiag_vRHwqVLw";
const SCHOOL_STORAGE_KEY = "mba-escola-auth";

const schoolSupabase = createClient(SCHOOL_URL, SCHOOL_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: SCHOOL_STORAGE_KEY
  }
});

type Props = {
  identity: {
    id: string;
    email: string;
    nome: string;
  };
};

type SsoResponse = {
  tokenHash?: string;
  error?: string;
  code?: string;
};

export default function MbaEscolaSsoShell({ identity }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function enter() {
      try {
        const normalizedEmail = identity.email.trim().toLowerCase();
        const { data: current } = await schoolSupabase.auth.getUser();
        const currentEmail = current.user?.email?.trim().toLowerCase() ?? "";

        if (current.user && currentEmail === normalizedEmail) {
          if (active) setState("ready");
          return;
        }

        // Nunca reaproveita uma sessão escolar de outro usuário no mesmo aparelho.
        if (current.user && currentEmail !== normalizedEmail) {
          await schoolSupabase.auth.signOut();
        }

        const response = await fetch("/api/mba-escola/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as SsoResponse;

        if (!response.ok || !payload.tokenHash) {
          throw new Error(payload.error || "Não foi possível concluir o acesso único ao MBA Escola.");
        }

        const { error: verifyError } = await schoolSupabase.auth.verifyOtp({
          token_hash: payload.tokenHash,
          type: "email"
        });

        if (verifyError) throw verifyError;
        if (active) setState("ready");
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível abrir o MBA Escola.");
        setState("error");
      }
    }

    void enter();
    return () => {
      active = false;
    };
  }, [identity.email]);

  if (state === "ready") {
    return <MbaEscolaClient />;
  }

  if (state === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#176b5b]">
            <ShieldCheck size={30} />
          </div>
          <h1 className="mt-5 text-2xl font-black">Acesso pela MBA Labs</h1>
          <p className="mt-3 leading-7 text-slate-500">{message}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Não existe mais um segundo formulário de login do MBA Escola. O acesso é validado pela sua sessão da MBA Labs.
          </p>
          <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 font-bold text-white" href="/dashboard">
            Voltar para MBA Labs
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8fb] p-4 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#176b5b] text-white">
          <GraduationCap size={30} />
        </div>
        <LoaderCircle className="mx-auto mt-6 animate-spin text-[#176b5b]" size={30} />
        <h1 className="mt-4 text-xl font-black">Abrindo MBA Escola</h1>
        <p className="mt-2 text-sm text-slate-500">Validando automaticamente seu acesso da MBA Labs...</p>
      </section>
    </main>
  );
}
