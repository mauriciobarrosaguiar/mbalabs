"use client";

import { FormEvent, useState } from "react";
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
        setMessage(error.message);
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
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@empresa.com"
          required
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Senha</span>
        <input
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
