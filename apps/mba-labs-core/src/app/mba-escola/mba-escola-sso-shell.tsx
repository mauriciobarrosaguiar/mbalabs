"use client";

import { GraduationCap, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { getMbaEscolaSupabase, removeLegacyMbaEscolaSession } from "@/lib/mba-escola/supabase-client";

type Props = {
  children: ReactNode;
  identity: {
    id: string;
    email: string;
    nome: string;
  };
};

type SsoResponse = {
  tokenHash?: string;
  schoolUserId?: string;
  error?: string;
  code?: string;
};

export default function MbaEscolaSsoShell({ children, identity }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function enter() {
      try {
        removeLegacyMbaEscolaSession();
        navigator.serviceWorker?.register("/mba-escola-sw.js", { scope: "/mba-escola/" }).catch(() => undefined);

        const schoolSupabase = getMbaEscolaSupabase();

        const response = await fetch("/api/mba-escola/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as SsoResponse;

        if (!response.ok || !payload.tokenHash || !payload.schoolUserId) {
          throw new Error(payload.error || "Não foi possível concluir o acesso único ao MBA Escola.");
        }

        const { data: current } = await schoolSupabase.auth.getUser();

        if (current.user?.id === payload.schoolUserId) {
          if (active) setState("ready");
          return;
        }

        // A sessão escolar é sempre descartada quando não pertence ao usuário atual da MBA Labs.
        if (current.user) {
          await schoolSupabase.auth.signOut({ scope: "local" });
        }

        const { data: verified, error: verifyError } = await schoolSupabase.auth.verifyOtp({
          token_hash: payload.tokenHash,
          type: "email"
        });

        if (verifyError) throw verifyError;
        if (verified.user?.id !== payload.schoolUserId) {
          await schoolSupabase.auth.signOut({ scope: "local" });
          throw new Error("A identidade escolar retornada não corresponde ao usuário da MBA Labs.");
        }
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
  }, [identity.email, identity.id]);

  if (state === "ready") {
    return children;
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
