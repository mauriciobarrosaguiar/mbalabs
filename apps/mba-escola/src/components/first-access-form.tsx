"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, UserRoundCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function FirstAccessForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setMessage("As duas senhas precisam ser iguais.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`
        }
      });

      if (error) {
        if (error.message.toLowerCase().includes("already")) {
          setMessage("Este e-mail já possui conta. Volte para a tela de login.");
        } else {
          setMessage("Não foi possível criar o acesso. Confira o e-mail informado.");
        }
        return;
      }

      if (data.session) {
        window.location.assign("/app");
        return;
      }

      setSuccess(true);
      setMessage("Conta criada. Abra o e-mail recebido para confirmar o acesso.");
    } catch {
      setMessage("O primeiro acesso ainda não está disponível. Tente novamente em alguns minutos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 font-bold">
          E-mail convidado
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
          Crie sua senha
          <span className="relative block">
            <input
              autoComplete="new-password"
              className="field pr-14"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
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

        <label className="grid gap-2 font-bold">
          Repita a senha
          <input
            autoComplete="new-password"
            className="field"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Digite a mesma senha novamente"
            required
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
          />
        </label>

        {message ? (
          <p
            className={`rounded-xl border p-3 text-sm font-semibold ${
              success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            role="alert"
          >
            {message}
          </p>
        ) : null}

        <button className="primary-button flex items-center justify-center gap-2" disabled={loading} type="submit">
          {loading ? <LoaderCircle className="animate-spin" size={22} /> : <UserRoundCheck size={22} />}
          {loading ? "Criando acesso..." : "Criar meu acesso"}
        </button>
      </form>

      <Link className="text-center text-sm font-bold text-[#176b5b]" href="/login">
        Já tenho acesso
      </Link>
    </div>
  );
}
