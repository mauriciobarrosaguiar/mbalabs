"use client";

import { KeyRound, LoaderCircle, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";

const supabase = getMbaEscolaSupabase();

type GateState = "checking" | "pass" | "enroll" | "challenge" | "error";

type TotpFactor = {
  id: string;
  status?: string;
};

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          if (mounted) setState("pass");
          return;
        }

        const { data: admin, error: adminError } = await supabase
          .from("escola_super_admins")
          .select("user_id,ativo")
          .eq("user_id", session.user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (adminError || !admin) {
          if (mounted) setState("pass");
          return;
        }

        const [aalResult, factorResult] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors()
        ]);

        if (aalResult.error) throw aalResult.error;
        if (factorResult.error) throw factorResult.error;

        if (aalResult.data.currentLevel === "aal2") {
          if (mounted) setState("pass");
          return;
        }

        const factors = (factorResult.data.totp ?? []) as TotpFactor[];
        const verified = factors.find(item => item.status === "verified") ?? factors[0];

        if (verified) {
          if (mounted) {
            setFactorId(verified.id);
            setState("challenge");
          }
          return;
        }

        if (mounted) setState("enroll");
      } catch (error) {
        if (!mounted) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível validar a segurança da conta.");
        setState("error");
      }
    }

    void check();
    return () => {
      mounted = false;
    };
  }, []);

  async function startEnrollment() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "MBA Labs - ADMIN MBA"
      });

      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a autenticação em duas etapas.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!factorId || code.trim().length < 6) {
      setMessage("Digite o código de 6 dígitos do aplicativo autenticador.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verification = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim()
      });
      if (verification.error) throw verification.error;

      await fetch("/api/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: state === "enroll" ? "MFA do ADMIN MBA ativado" : "MFA do ADMIN MBA validado" })
      }).catch(() => null);

      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Código inválido ou expirado.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/login?next=/mba-escola/admin");
  }

  if (state === "pass") return <>{children}</>;

  if (state === "checking") {
    return (
      <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC]">
        <div className="grid justify-items-center gap-3 text-[#4353C7]">
          <LoaderCircle className="animate-spin" size={38} />
          <p className="text-sm font-bold text-slate-500">Validando segurança do ADMIN MBA...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="cotacoes-module grid min-h-screen place-items-center bg-[#F6F8FC] p-4 text-[#172033]">
      <section className="w-full max-w-xl rounded-[28px] border border-[#E1E6F2] bg-white p-5 shadow-[0_26px_80px_-50px_rgba(30,41,59,0.55)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF1FF] text-[#4353C7]">
            <ShieldCheck size={26} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#5968CA]">Proteção do proprietário</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Autenticação em duas etapas</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              O painel ADMIN MBA exige um segundo fator antes de liberar dados e ações administrativas.
            </p>
          </div>
        </div>

        {state === "error" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            {message || "Não foi possível validar a autenticação em duas etapas."}
          </div>
        ) : null}

        {state === "enroll" ? (
          <div className="mt-6 grid gap-5">
            {!qrCode ? (
              <div className="rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-5">
                <div className="flex gap-3">
                  <Smartphone className="mt-0.5 shrink-0 text-[#4353C7]" size={22} />
                  <div>
                    <p className="font-black">Configure uma vez</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Use Google Authenticator, Microsoft Authenticator ou outro aplicativo compatível com TOTP.
                    </p>
                  </div>
                </div>
                <button
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void startEnrollment()}
                  type="button"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={18} /> : <KeyRound size={18} />}
                  Gerar QR Code de segurança
                </button>
              </div>
            ) : (
              <div className="grid gap-4 rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-5">
                <div className="grid justify-items-center gap-3 text-center">
                  <p className="font-black">1. Escaneie o QR Code</p>
                  <img className="h-52 w-52 rounded-xl border border-[#DCE2EC] bg-white p-2" src={qrCode} alt="QR Code para ativar autenticação em duas etapas" />
                  <p className="text-xs leading-5 text-slate-500">Se não conseguir escanear, use a chave abaixo no aplicativo autenticador.</p>
                  <code className="max-w-full break-all rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#4353C7] shadow-sm">{secret}</code>
                </div>
                <div>
                  <label className="grid gap-2">
                    <span className="text-sm font-black">2. Digite o código de 6 dígitos</span>
                    <input
                      autoComplete="one-time-code"
                      className="min-h-12 rounded-xl border border-[#DCE2EC] bg-white px-4 text-center text-xl font-black tracking-[.28em] outline-none focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]"
                      inputMode="numeric"
                      maxLength={8}
                      onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      value={code}
                    />
                  </label>
                  <button
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void verify()}
                    type="button"
                  >
                    {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                    Ativar e entrar no ADMIN MBA
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {state === "challenge" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-5">
            <div className="flex gap-3">
              <KeyRound className="mt-0.5 shrink-0 text-[#4353C7]" size={22} />
              <div>
                <p className="font-black">Confirme que é você</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">Abra seu aplicativo autenticador e informe o código atual.</p>
              </div>
            </div>
            <input
              autoFocus
              autoComplete="one-time-code"
              className="min-h-12 rounded-xl border border-[#DCE2EC] bg-white px-4 text-center text-xl font-black tracking-[.28em] outline-none focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]"
              inputMode="numeric"
              maxLength={8}
              onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
              onKeyDown={event => {
                if (event.key === "Enter") void verify();
              }}
              placeholder="000000"
              value={code}
            />
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void verify()}
              type="button"
            >
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Validar e acessar
            </button>
          </div>
        ) : null}

        {message && state !== "error" ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{message}</p>
        ) : null}

        <button className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800" onClick={() => void signOut()} type="button">
          <LogOut size={16} /> Sair da conta
        </button>
      </section>
    </main>
  );
}
