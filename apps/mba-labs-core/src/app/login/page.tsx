import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Link className="text-sm text-slate-300" href="/">
          Voltar para o inicio
        </Link>
        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Acesso seguro</p>
            <h1 className="text-3xl font-black">Entrar na MBA Labs</h1>
            <p className="text-sm leading-6 text-slate-300">
              Use o email e senha cadastrados no Supabase Auth.
            </p>
          </div>
          <LoginForm />
          <Link className="text-sm font-semibold text-cyan-200" href="/setup-admin">
            Primeiro acesso? Criar Admin Master
          </Link>
        </section>
      </div>
    </main>
  );
}
