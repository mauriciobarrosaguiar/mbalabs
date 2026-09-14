import type { Metadata } from "next";
import Link from "next/link";
import { RecoverPasswordForm } from "@/components/AuthForms";
import { BrandLogo } from "@/components/BrandLogo";
import { getElshadayLoginIdentity } from "@/lib/elshaday-login";
import { ElshadayAuthView } from "../login/ElshadayLoginView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const appParam = Array.isArray(params.app) ? params.app[0] : params.app;
  return appParam === "elshaday"
    ? { title: "Recuperar senha | Assembleia de Deus Elshaday" }
    : { title: "Recuperar senha | MBA Labs" };
}

export default async function RecoverPasswordPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const appParam = Array.isArray(params.app) ? params.app[0] : params.app;

  if (appParam === "elshaday") {
    const identity = await getElshadayLoginIdentity();
    return (
      <ElshadayAuthView
        churchName={identity.churchName}
        location={identity.location}
        subtitle="Receba um link seguro no seu e-mail"
        title="Recuperar senha"
      >
        <RecoverPasswordForm variant="elshaday" />
        <Link className="mt-5 block text-center text-sm font-bold text-[#176445]" href="/login?app=elshaday">
          Voltar para o login
        </Link>
      </ElshadayAuthView>
    );
  }

  return (
    <main className="page-shell grid min-h-screen content-center py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-md gap-4 sm:gap-6">
        <Link className="w-fit" href="/" aria-label="Voltar para o início da MBA Labs">
          <BrandLogo size="md" />
        </Link>

        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Recuperação de acesso</p>
            <h1 className="text-3xl font-black">Esqueceu sua senha?</h1>
            <p className="text-sm leading-6 text-slate-300">
              Informe o e-mail cadastrado. Você receberá um link seguro para criar uma nova senha.
            </p>
          </div>
          <RecoverPasswordForm />
        </section>

        <Link className="text-center text-sm text-slate-400 transition hover:text-white" href="/login">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
