"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseClient } from "@mba-labs/shared/supabase/client";

const ELSHADAY_INPUT_CLASS =
  "min-h-[52px] w-full min-w-0 rounded-[14px] border border-slate-300 bg-white px-4 text-[16px] text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-[#b58a35] focus:ring-4 focus:ring-[#d4aa54]/20";
const ELSHADAY_BUTTON_CLASS =
  "min-h-[54px] w-full rounded-[15px] border border-[#d4aa54] bg-[#123d2d] px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(18,61,45,.2)] transition active:scale-[.99] disabled:cursor-wait disabled:opacity-70";

export function LoginForm({
  nextPath = "/dashboard",
  recoveryHref = "/recuperar-senha",
  variant = "default"
}: {
  nextPath?: string;
  recoveryHref?: string;
  variant?: "default" | "elshaday";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setMessage("E-mail ou senha inválidos.");
        return;
      }

      await fetch("/api/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "login realizado" })
      }).catch(() => null);

      const destination = await fetch(`/api/auth/resolve?next=${encodeURIComponent(nextPath)}`)
        .then((response) => response.json())
        .then((payload: { destination?: string }) => payload.destination)
        .catch(() => null);

      const resolvedDestination = destination && !destination.startsWith("/login") ? destination : nextPath;
      window.location.assign(resolvedDestination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro no login.");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "elshaday") {
    return (
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2 text-sm font-bold text-[#123d2d]">
          <label htmlFor="elshaday-email">E-mail</label>
          <input
            aria-invalid={Boolean(message)}
            autoCapitalize="none"
            autoComplete="email"
            className={ELSHADAY_INPUT_CLASS}
            id="elshaday-email"
            inputMode="email"
            spellCheck={false}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seuemail@exemplo.com"
            required
          />
        </div>

        <div className="grid gap-2 text-sm font-bold text-[#123d2d]">
          <span className="flex items-center justify-between gap-3">
            <label htmlFor="elshaday-password">Senha</label>
            <Link className="text-sm font-bold text-[#176445] underline-offset-4 hover:underline" href={recoveryHref}>
              Esqueceu sua senha?
            </Link>
          </span>
          <div className="relative">
            <input
              aria-invalid={Boolean(message)}
              autoComplete="current-password"
              className={`${ELSHADAY_INPUT_CLASS} pr-[3.25rem]`}
              id="elshaday-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
            />
            <button
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 grid w-[3.25rem] place-items-center rounded-r-[14px] text-slate-600 transition hover:text-[#123d2d]"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? <EyeOff aria-hidden="true" size={21} /> : <Eye aria-hidden="true" size={21} />}
            </button>
          </div>
        </div>

        {message ? (
          <p
            aria-live="polite"
            className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            role="alert"
          >
            {message}
          </p>
        ) : null}

        <button
          className={`${ELSHADAY_BUTTON_CLASS} mt-1`}
          aria-busy={loading}
          type="submit"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">E-mail</span>
        <input
          autoComplete="email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@empresa.com"
          required
        />
      </label>
      <label className="grid gap-2">
        <span className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>Senha</span>
          <Link className="text-xs font-bold text-cyan-300 transition hover:text-cyan-200" href={recoveryHref}>
            Esqueceu sua senha?
          </Link>
        </span>
        <input
          autoComplete="current-password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua senha"
          required
        />
      </label>
      {message ? <p className="text-sm text-red-200">{message}</p> : null}
      <button className="button-primary" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

export function RecoverPasswordForm({ variant = "default" }: { variant?: "default" | "elshaday" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/alterar-senha${variant === "elshaday" ? "?app=elshaday" : ""}`
      });

      if (error) {
        setMessage("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.");
        return;
      }

      setSent(true);
      await fetch("/api/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "recuperação de senha solicitada" })
      }).catch(() => null);
    } catch {
      setMessage("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <div className={variant === "elshaday" ? "rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800" : "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100"}>
          Se esse e-mail estiver cadastrado, enviamos um link seguro para você criar uma nova senha. Verifique também a caixa de spam.
        </div>
        <button className={variant === "elshaday" ? ELSHADAY_BUTTON_CLASS : "button-secondary"} type="button" onClick={() => setSent(false)}>
          Enviar novamente
        </button>
      </div>
    );
  }

  return (
    <form className={variant === "elshaday" ? "grid gap-4 text-[#123d2d]" : "grid gap-4"} onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">E-mail cadastrado</span>
        <input
          autoComplete="email"
          className={variant === "elshaday" ? ELSHADAY_INPUT_CLASS : "input"}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@exemplo.com"
          required
        />
      </label>
      {message ? <p className={variant === "elshaday" ? "text-sm font-semibold text-red-700" : "text-sm text-red-200"}>{message}</p> : null}
      <button className={variant === "elshaday" ? ELSHADAY_BUTTON_CLASS : "button-primary"} type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link para redefinir senha"}
      </button>
    </form>
  );
}

export function UpdatePasswordForm({ variant = "default" }: { variant?: "default" | "elshaday" }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    let active = true;
    let recoveryResolved = false;

    const acceptRecoverySession = () => {
      if (!active || recoveryResolved) return;
      recoveryResolved = true;
      setRecoveryReady(true);
      setCheckingLink(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        acceptRecoverySession();
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) acceptRecoverySession();
    });

    // O SDK processa o token de recuperação da URL de forma assíncrona.
    // Em dispositivos móveis, getSession() pode retornar vazio antes do
    // evento PASSWORD_RECOVERY. Aguarde a inicialização antes de invalidar.
    const invalidLinkTimer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!active || recoveryResolved) return;
        if (data.session) {
          acceptRecoverySession();
          return;
        }

        recoveryResolved = true;
        setRecoveryReady(false);
        setCheckingLink(false);
      });
    }, 4_000);

    return () => {
      active = false;
      window.clearTimeout(invalidLinkTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas digitadas não são iguais.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setRecoveryReady(false);
        setMessage("O link de recuperação é inválido ou expirou. Solicite um novo link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("Não foi possível alterar a senha. Solicite um novo link e tente novamente.");
        return;
      }

      await fetch("/api/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "senha redefinida por recuperação de e-mail" })
      }).catch(() => null);

      await supabase.auth.signOut();
      const loginPath = `/login?senha=alterada${variant === "elshaday" ? "&app=elshaday" : ""}`;
      window.location.assign(new URL(loginPath, window.location.origin).toString());
    } catch {
      setMessage("Não foi possível alterar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingLink) {
    return (
      <p className={variant === "elshaday" ? "text-sm text-slate-600" : "text-sm text-slate-300"}>
        Validando o link de recuperação...
      </p>
    );
  }

  if (!recoveryReady) {
    return (
      <div className="grid gap-4">
        <p className={variant === "elshaday" ? "rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" : "rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"}>
          Este link de recuperação é inválido ou expirou.
        </p>
        <Link className={variant === "elshaday" ? `${ELSHADAY_BUTTON_CLASS} text-center` : "button-primary text-center"} href={variant === "elshaday" ? "/recuperar-senha?app=elshaday" : "/recuperar-senha"}>
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <form className={variant === "elshaday" ? "grid gap-4 text-[#123d2d]" : "grid gap-4"} onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Nova senha</span>
        <input
          autoComplete="new-password"
          className={variant === "elshaday" ? ELSHADAY_INPUT_CLASS : "input"}
          minLength={8}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo de 8 caracteres"
          required
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Confirmar nova senha</span>
        <input
          autoComplete="new-password"
          className={variant === "elshaday" ? ELSHADAY_INPUT_CLASS : "input"}
          minLength={8}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Digite novamente"
          required
        />
      </label>
      {message ? <p className={variant === "elshaday" ? "text-sm font-semibold text-red-700" : "text-sm text-red-200"}>{message}</p> : null}
      <button className={variant === "elshaday" ? ELSHADAY_BUTTON_CLASS : "button-primary"} type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}

export function SetupAdminForm({ setupKey }: { setupKey?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const query = setupKey ? `?key=${encodeURIComponent(setupKey)}` : "";
      const response = await fetch(`/api/setup-admin${query}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        setMessage(payload.error ?? "Não foi possível criar o Admin Master.");
        return;
      }

      setMessage("Admin Master criado. Você já pode entrar.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro no cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Nome do Admin Master</span>
        <input className="input" name="nome" placeholder="Maurício Barros" required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">E-mail</span>
        <input className="input" name="email" type="email" placeholder="admin@mbalabs.com" required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Senha</span>
        <input className="input" name="password" type="password" minLength={8} required />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Empresa inicial</span>
        <input className="input" name="empresa" defaultValue="MBA Labs" required />
      </label>
      {message ? <p className="text-sm text-cyan-100">{message}</p> : null}
      <button className="button-primary" type="submit" disabled={loading}>
        {loading ? "Criando..." : "Criar Admin Master"}
      </button>
    </form>
  );
}
