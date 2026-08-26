"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@mba-labs/shared/supabase/client";

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          <Link className="text-xs font-bold text-cyan-300 transition hover:text-cyan-200" href="/recuperar-senha">
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

export function RecoverPasswordForm() {
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
        redirectTo: `${window.location.origin}/alterar-senha`
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
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
          Se esse e-mail estiver cadastrado, enviamos um link seguro para você criar uma nova senha. Verifique também a caixa de spam.
        </div>
        <button className="button-secondary" type="button" onClick={() => setSent(false)}>
          Enviar novamente
        </button>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">E-mail cadastrado</span>
        <input
          autoComplete="email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@exemplo.com"
          required
        />
      </label>
      {message ? <p className="text-sm text-red-200">{message}</p> : null}
      <button className="button-primary" type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link para redefinir senha"}
      </button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoveryReady(Boolean(data.session));
      setCheckingLink(false);
    });

    return () => {
      active = false;
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
      window.location.assign("/login?senha=alterada");
    } catch {
      setMessage("Não foi possível alterar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingLink) {
    return <p className="text-sm text-slate-300">Validando o link de recuperação...</p>;
  }

  if (!recoveryReady) {
    return (
      <div className="grid gap-4">
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          Este link de recuperação é inválido ou expirou.
        </p>
        <Link className="button-primary text-center" href="/recuperar-senha">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Nova senha</span>
        <input
          autoComplete="new-password"
          className="input"
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
          className="input"
          minLength={8}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Digite novamente"
          required
        />
      </label>
      {message ? <p className="text-sm text-red-200">{message}</p> : null}
      <button className="button-primary" type="submit" disabled={loading}>
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
