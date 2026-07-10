import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { BrandLogo } from "@/components/BrandLogo";
import { getLoginDestination, getSessionProfile } from "@/lib/core-data";
import { safeNextPath } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const { user } = await getSessionProfile();

  if (user) {
    redirect(await getLoginDestination(nextPath));
  }

  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Link className="w-fit" href="/" aria-label="Voltar para o início da MBA Labs">
          <BrandLogo size="md" />
        </Link>
        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Acesso à plataforma</p>
            <h1 className="text-3xl font-black">Entrar na MBA Labs</h1>
            <p className="text-sm leading-6 text-slate-300">
              Entre com seu e-mail e senha para acessar seus sistemas.
            </p>
          </div>
          <LoginForm nextPath={nextPath} />
        </section>
        <Link className="text-center text-sm text-slate-400 transition hover:text-white" href="/">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
