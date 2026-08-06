"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage("E-mail ou senha incorretos. Confira os dados e tente novamente.");
        return;
      }

      window.location.assign("/app");
    } catch {
      setMessage("O acesso ainda não foi configurado pela escola.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 font-bold">
        E-mail
        <input
          autoComplete="email"
          className="field"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@exemplo.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="grid gap-2 font-bold">
        Senha
        <span className="relative block">
          <input
            autoComplete="current-password"
            className="field pr-14"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1 top-1 grid h-12 w-12 place-items-center rounded-xl text-slate-500"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        </span>
      </label>

      {message ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
          {message}
        </p>
      ) : null}

      <button className="primary-button flex items-center justify-center gap-2" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="animate-spin" size={22} /> : <LogIn size={22} />}
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm leading-6 text-slate-500">
        Primeiro acesso ou esqueceu a senha? Procure a secretaria da escola.
      </p>
    </form>
  );
}
