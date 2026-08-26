import Link from "next/link";
import { UpdatePasswordForm } from "@/components/AuthForms";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-md gap-4 sm:gap-6">
        <Link className="w-fit" href="/" aria-label="Voltar para o início da MBA Labs">
          <BrandLogo size="md" />
        </Link>

        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Nova senha</p>
            <h1 className="text-3xl font-black">Redefinir senha</h1>
            <p className="text-sm leading-6 text-slate-300">
              Crie uma nova senha para sua conta. A MBA Labs nunca envia sua senha em texto por e-mail.
            </p>
          </div>
          <UpdatePasswordForm />
        </section>

        <Link className="text-center text-sm text-slate-400 transition hover:text-white" href="/login">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
