import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { BrandLogo } from "@/components/BrandLogo";
import { InstallAppCard } from "@/components/InstallAppCard";
import { PwaRegister } from "@/components/PwaRegister";
import { getLoginDestination, getSessionProfile } from "@/lib/core-data";
import { getElshadayLoginIdentity } from "@/lib/elshaday-login";
import { safeNextPath } from "@/lib/form-utils";
import { ElshadayAuthView } from "./ElshadayLoginView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const appParam = Array.isArray(params.app) ? params.app[0] : params.app;
  const nextPath = safeNextPath(params.next);
  const isElshadayLogin =
    appParam === "elshaday" || nextPath === "/elshaday" || nextPath.startsWith("/elshaday/");

  return isElshadayLogin
    ? {
        title: "Entrar | Assembleia de Deus Elshaday",
        description: "Acesso à área de membros da Assembleia de Deus Elshaday."
      }
    : { title: "Entrar | MBA Labs" };
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const appParam = Array.isArray(params.app) ? params.app[0] : params.app;
  const isElshadayLogin =
    appParam === "elshaday" || nextPath === "/elshaday" || nextPath.startsWith("/elshaday/");
  const { user } = await getSessionProfile();

  if (user) {
    redirect(await getLoginDestination(isElshadayLogin ? "/elshaday" : nextPath));
  }

  if (isElshadayLogin) {
    const identity = await getElshadayLoginIdentity();
    return (
      <ElshadayAuthView
        churchName={identity.churchName}
        location={identity.location}
        subtitle="Acesse sua área de membro"
        title="Bem-vindo"
      >
        {params.senha === "alterada" ? (
          <div className="mb-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Senha atualizada com sucesso. Entre novamente com a nova senha.
          </div>
        ) : null}
        <LoginForm
          nextPath="/elshaday"
          recoveryHref="/recuperar-senha?app=elshaday"
          variant="elshaday"
        />
      </ElshadayAuthView>
    );
  }

  return (
    <main className="page-shell grid min-h-screen content-center py-6 sm:py-10">
      <PwaRegister />
      <div className="mx-auto grid w-full max-w-md gap-4 sm:gap-6">
        <Link className="w-fit" href="/" aria-label="Voltar para o início da MBA Labs">
          <BrandLogo size="md" />
        </Link>

        <InstallAppCard />

        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Acesso à plataforma</p>
            <h1 className="text-3xl font-black">Entrar na MBA Labs</h1>
            <p className="text-sm leading-6 text-slate-300">
              Entre com seu e-mail e senha para acessar seus sistemas.
            </p>
          </div>
          {params.senha === "alterada" ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
              Senha atualizada com sucesso. Entre novamente com a nova senha.
            </div>
          ) : null}
          <LoginForm nextPath={nextPath} />
        </section>

        <Link className="text-center text-sm text-slate-400 transition hover:text-white" href="/">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
