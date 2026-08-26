"use client";

import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquareText,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getMbaEscolaSupabase } from "@/lib/mba-escola/supabase-client";

const supabase = getMbaEscolaSupabase();

type GateState = "checking" | "pass" | "choose" | "phone-enroll" | "phone-verify" | "totp-enroll" | "totp-verify" | "error";
type Factor = { id: string; status?: string; phone?: string };

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [phoneFactor, setPhoneFactor] = useState<Factor | null>(null);
  const [totpFactor, setTotpFactor] = useState<Factor | null>(null);
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneLabel, setPhoneLabel] = useState("");
  const [emailLabel, setEmailLabel] = useState("");
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

        setEmailLabel(maskEmail(session.user.email || ""));

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

        const phones = (factorResult.data.phone ?? []) as Factor[];
        const totps = (factorResult.data.totp ?? []) as Factor[];
        const verifiedPhone = phones.find(item => item.status === "verified") ?? null;
        const verifiedTotp = totps.find(item => item.status === "verified") ?? null;

        // Enrollment incompleto não deve sobreviver a uma nova tentativa. Isso também
        // invalida automaticamente qualquer QR/segredo TOTP exibido e não confirmado.
        const stale = [...phones, ...totps].filter(item => item.status !== "verified");
        await Promise.all(stale.map(item => supabase.auth.mfa.unenroll({ factorId: item.id }).catch(() => null)));

        if (!mounted) return;
        setPhoneFactor(verifiedPhone);
        setTotpFactor(verifiedTotp);
        if (verifiedPhone?.phone) setPhoneLabel(maskPhone(verifiedPhone.phone));
        setState("choose");
      } catch (error) {
        if (!mounted) return;
        setMessage(readError(error, "Não foi possível validar a segurança da conta."));
        setState("error");
      }
    }

    void check();
    return () => {
      mounted = false;
    };
  }, []);

  function resetFlow() {
    setFactorId("");
    setChallengeId("");
    setCode("");
    setPhone("");
    setQrCode("");
    setSecret("");
    setMessage("");
    setState("choose");
  }

  async function choosePhone() {
    setMessage("");
    setCode("");
    if (!phoneFactor) {
      setState("phone-enroll");
      return;
    }

    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: phoneFactor.id });
      if (challenge.error) throw challenge.error;
      setFactorId(phoneFactor.id);
      setChallengeId(challenge.data.id);
      setPhoneLabel(maskPhone(phoneFactor.phone || ""));
      setState("phone-verify");
    } catch (error) {
      setMessage(phoneMfaError(error));
    } finally {
      setBusy(false);
    }
  }

  async function enrollPhone() {
    const normalized = normalizeBrazilPhone(phone);
    if (!normalized) {
      setMessage("Informe um celular brasileiro válido com DDD.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const factor = await supabase.auth.mfa.enroll({
        factorType: "phone",
        phone: normalized,
        friendlyName: "MBA Labs - ADMIN MBA - Celular"
      });
      if (factor.error) throw factor.error;

      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.data.id });
      if (challenge.error) throw challenge.error;

      setFactorId(factor.data.id);
      setChallengeId(challenge.data.id);
      setPhoneLabel(maskPhone(normalized));
      setState("phone-verify");
    } catch (error) {
      setMessage(phoneMfaError(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendSms() {
    if (!factorId) return;
    setBusy(true);
    setMessage("");
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      setChallengeId(challenge.data.id);
      setCode("");
    } catch (error) {
      setMessage(phoneMfaError(error));
    } finally {
      setBusy(false);
    }
  }

  async function chooseTotp() {
    setMessage("");
    setCode("");
    if (totpFactor) {
      setFactorId(totpFactor.id);
      setState("totp-verify");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "MBA Labs - ADMIN MBA"
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setState("totp-enroll");
    } catch (error) {
      setMessage(readError(error, "Não foi possível iniciar o aplicativo autenticador."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone() {
    if (!factorId || !challengeId || code.trim().length < 6) {
      setMessage("Digite o código de 6 dígitos enviado ao celular.");
      return;
    }
    await verifyFactor("SMS", challengeId);
  }

  async function verifyTotp() {
    if (!factorId || code.trim().length < 6) {
      setMessage("Digite o código de 6 dígitos do aplicativo autenticador.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      await finishVerification("aplicativo autenticador", challenge.data.id);
    } catch (error) {
      setMessage(readError(error, "Código inválido ou expirado."));
      setCode("");
      setBusy(false);
    }
  }

  async function verifyFactor(method: string, activeChallengeId: string) {
    setBusy(true);
    setMessage("");
    try {
      await finishVerification(method, activeChallengeId);
    } catch (error) {
      setMessage(readError(error, "Código inválido ou expirado."));
      setCode("");
      setBusy(false);
    }
  }

  async function finishVerification(method: string, activeChallengeId: string) {
    const verification = await supabase.auth.mfa.verify({
      factorId,
      challengeId: activeChallengeId,
      code: code.trim()
    });
    if (verification.error) throw verification.error;

    await fetch("/api/auth/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: `MFA do ADMIN MBA validado por ${method}` })
    }).catch(() => null);

    window.location.reload();
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
      <section className="w-full max-w-2xl rounded-[28px] border border-[#E1E6F2] bg-white p-5 shadow-[0_26px_80px_-50px_rgba(30,41,59,0.55)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF1FF] text-[#4353C7]">
            <ShieldCheck size={26} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#5968CA]">Proteção do proprietário</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Confirme que é você</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Escolha como deseja fazer a segunda verificação antes de entrar no ADMIN MBA.
            </p>
          </div>
        </div>

        {state === "error" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            {message || "Não foi possível validar a autenticação em duas etapas."}
          </div>
        ) : null}

        {state === "choose" ? (
          <div className="mt-6 grid gap-3">
            <button
              className="group flex w-full items-center gap-4 rounded-2xl border border-[#DCE3FF] bg-gradient-to-r from-[#F4F6FF] to-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#AEB9F3] hover:shadow-md disabled:opacity-60"
              disabled={busy}
              onClick={() => void choosePhone()}
              type="button"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#4353C7] text-white"><MessageSquareText size={23} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-base">Código por SMS</b>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">Recomendado</span>
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  {phoneFactor ? `Enviar código para ${phoneLabel || "seu celular cadastrado"}.` : "Cadastre seu celular e receba um código de 6 dígitos."}
                </span>
              </span>
              {busy ? <LoaderCircle className="animate-spin text-[#4353C7]" size={20} /> : <Smartphone className="text-[#4353C7]" size={20} />}
            </button>

            <button
              className="flex w-full items-center gap-4 rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C8D0DE] hover:shadow-md disabled:opacity-60"
              disabled={busy}
              onClick={() => void chooseTotp()}
              type="button"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#5968CA] shadow-sm"><QrCode size={23} /></span>
              <span className="min-w-0 flex-1">
                <b className="text-base">Aplicativo autenticador</b>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  {totpFactor ? "Usar o autenticador já configurado." : "Google Authenticator, Microsoft Authenticator ou similar."}
                </span>
              </span>
              <KeyRound className="text-slate-400" size={20} />
            </button>

            <div className="flex gap-3 rounded-2xl border border-[#E7EBF3] bg-white p-4">
              <Mail className="mt-0.5 shrink-0 text-slate-400" size={21} />
              <div>
                <p className="font-black">E-mail da conta {emailLabel ? `· ${emailLabel}` : ""}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  O e-mail continua disponível para recuperação da conta. Para a segunda etapa do ADMIN MBA, o provedor de autenticação reconhece SMS ou aplicativo autenticador como fator AAL2.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {state === "phone-enroll" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#DCE3FF] bg-[#F8F9FF] p-5">
            <FlowHeader icon={<Smartphone size={22} />} title="Cadastrar celular" text="Informe um celular com DDD. O código será enviado por SMS." />
            <label className="grid gap-2">
              <span className="text-sm font-black">Número do celular</span>
              <input
                autoFocus
                className="min-h-12 rounded-xl border border-[#DCE2EC] bg-white px-4 text-base font-bold outline-none focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]"
                inputMode="tel"
                onChange={event => setPhone(event.target.value)}
                placeholder="(63) 99999-9999"
                value={phone}
              />
            </label>
            <button className={primaryButton} disabled={busy} onClick={() => void enrollPhone()} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <MessageSquareText size={18} />}
              Enviar código por SMS
            </button>
            <BackButton onClick={resetFlow} />
          </div>
        ) : null}

        {state === "phone-verify" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#DCE3FF] bg-[#F8F9FF] p-5">
            <FlowHeader icon={<MessageSquareText size={22} />} title="Digite o código recebido" text={`Enviamos um código de 6 dígitos para ${phoneLabel || "seu celular"}.`} />
            <CodeInput code={code} setCode={setCode} onEnter={() => void verifyPhone()} />
            <button className={primaryButton} disabled={busy} onClick={() => void verifyPhone()} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Validar e acessar o ADMIN MBA
            </button>
            <button className={secondaryButton} disabled={busy} onClick={() => void resendSms()} type="button">
              <RefreshCw size={16} /> Reenviar código
            </button>
            <BackButton onClick={resetFlow} />
          </div>
        ) : null}

        {state === "totp-enroll" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-5">
            <div className="grid justify-items-center gap-3 text-center">
              <p className="font-black">Escaneie o novo QR Code</p>
              <img className="h-52 w-52 rounded-xl border border-[#DCE2EC] bg-white p-2" src={qrCode} alt="QR Code para configurar aplicativo autenticador" />
              <p className="text-xs leading-5 text-slate-500">Se não conseguir escanear, use a chave abaixo no aplicativo autenticador.</p>
              <code className="max-w-full break-all rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#4353C7] shadow-sm">{secret}</code>
            </div>
            <CodeInput code={code} setCode={setCode} onEnter={() => void verifyTotp()} />
            <button className={primaryButton} disabled={busy} onClick={() => void verifyTotp()} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Ativar e acessar
            </button>
            <BackButton onClick={resetFlow} />
          </div>
        ) : null}

        {state === "totp-verify" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[#E5EAF2] bg-[#FAFBFD] p-5">
            <FlowHeader icon={<KeyRound size={22} />} title="Código do autenticador" text="Abra seu aplicativo autenticador e informe o código atual." />
            <CodeInput code={code} setCode={setCode} onEnter={() => void verifyTotp()} />
            <button className={primaryButton} disabled={busy} onClick={() => void verifyTotp()} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Validar e acessar
            </button>
            <BackButton onClick={resetFlow} />
          </div>
        ) : null}

        {message && state !== "error" ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-5 text-rose-800">{message}</p>
        ) : null}

        <button className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800" onClick={() => void signOut()} type="button">
          <LogOut size={16} /> Sair da conta
        </button>
      </section>
    </main>
  );
}

const primaryButton = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4353C7] px-4 font-black text-white shadow-lg shadow-indigo-100 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DCE2EC] bg-white px-4 text-sm font-black text-[#465169] disabled:opacity-50";

function FlowHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 shrink-0 text-[#4353C7]">{icon}</span><div><p className="font-black">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>;
}

function CodeInput({ code, setCode, onEnter }: { code: string; setCode: (value: string) => void; onEnter: () => void }) {
  return <input
    autoFocus
    autoComplete="one-time-code"
    className="min-h-14 rounded-xl border border-[#DCE2EC] bg-white px-4 text-center text-2xl font-black tracking-[.28em] outline-none focus:border-[#6574D9] focus:ring-4 focus:ring-[#EEF1FF]"
    inputMode="numeric"
    maxLength={8}
    onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
    onKeyDown={event => { if (event.key === "Enter") onEnter(); }}
    placeholder="000000"
    value={code}
  />;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800" onClick={onClick} type="button"><ArrowLeft size={16} /> Escolher outro método</button>;
}

function normalizeBrazilPhone(value: string) {
  const numbers = value.replace(/\D/g, "");
  if ((numbers.length === 12 || numbers.length === 13) && numbers.startsWith("55")) return `+${numbers}`;
  if (numbers.length === 10 || numbers.length === 11) return `+55${numbers}`;
  return "";
}

function maskPhone(value: string) {
  const numbers = value.replace(/\D/g, "");
  const local = numbers.startsWith("55") ? numbers.slice(2) : numbers;
  if (local.length < 8) return "seu celular";
  const ddd = local.slice(0, 2);
  const tail = local.slice(-4);
  return `(${ddd}) *****-${tail}`;
}

function maskEmail(value: string) {
  const [user, domain] = value.split("@");
  if (!user || !domain) return "";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(3, Math.min(6, user.length - visible.length)))}@${domain}`;
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function phoneMfaError(error: unknown) {
  const raw = readError(error, "Não foi possível enviar o código por SMS.");
  const lower = raw.toLowerCase();
  if (lower.includes("phone") || lower.includes("sms") || lower.includes("mfa")) {
    if (lower.includes("disabled") || lower.includes("enable") || lower.includes("unsupported") || lower.includes("not allowed") || lower.includes("not configured")) {
      return "O SMS ainda precisa ser habilitado no provedor de autenticação do MBA Labs. O aplicativo autenticador continua disponível enquanto essa configuração não estiver ativa.";
    }
  }
  return raw;
}
