import Link from "next/link";
import { SetupAdminForm } from "@/components/AuthForms";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const setupKey = firstParam(params.key) ?? "";
  const requiredKey = process.env.SETUP_ADMIN_SECRET?.trim();
  const isKeyValid = !requiredKey || setupKey === requiredKey;
  const adminExists = await hasAdminMaster();

  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-lg gap-6">
        <Link className="text-sm text-slate-300" href="/">
          Voltar para o início
        </Link>
        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Configuração inicial</p>
            <h1 className="text-3xl font-black">
              {adminExists ? "Configuração inicial já realizada" : "Cadastrar Admin Master"}
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              {adminExists
                ? "O acesso principal da MBA Labs já foi configurado."
                : isKeyValid
                  ? "Crie o primeiro usuário principal para começar a usar o portal."
                  : "Acesso restrito para configuração inicial."}
            </p>
          </div>
          {adminExists ? (
            <Link className="button-primary w-fit" href="/login">
              Ir para login
            </Link>
          ) : isKeyValid ? (
            <SetupAdminForm setupKey={setupKey} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

async function hasAdminMaster() {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { count, error } = await supabase
      .from("core_usuarios")
      .select("id", { count: "exact", head: true })
      .in("tipo", ["super_admin", "admin_master"]);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
