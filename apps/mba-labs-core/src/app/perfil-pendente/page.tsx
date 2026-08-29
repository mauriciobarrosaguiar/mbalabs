import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function PerfilPendentePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="page-shell grid min-h-screen content-center py-8">
      <section className="panel mx-auto grid w-full max-w-lg gap-5 p-6 sm:p-8">
        <BrandLogo size="md" />
        <div className="grid gap-2">
          <p className="eyebrow">Acesso pendente</p>
          <h1 className="text-3xl font-black">Seu login está ativo, mas o perfil ainda não está vinculado.</h1>
          <p className="text-sm leading-6 text-slate-300">
            Se você recebeu um convite para uma escola, confirme que ele usa o mesmo e-mail deste login.
            Caso o vínculo ainda não apareça, solicite ao administrador da instituição ou ao ADMIN MBA a revisão do acesso.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href="/mba-escola">
            Tentar novamente
          </Link>
          <Link className="button-secondary" href="/sair">
            Sair
          </Link>
        </div>
      </section>
    </main>
  );
}
