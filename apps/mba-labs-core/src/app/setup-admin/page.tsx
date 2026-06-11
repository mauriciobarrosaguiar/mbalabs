import Link from "next/link";
import { SetupAdminForm } from "@/components/AuthForms";

export default function SetupAdminPage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <div className="mx-auto grid w-full max-w-lg gap-6">
        <Link className="text-sm text-slate-300" href="/">
          Voltar para o inicio
        </Link>
        <section className="panel grid gap-6 p-6">
          <div className="grid gap-2">
            <p className="eyebrow">Primeira configuracao</p>
            <h1 className="text-3xl font-black">Cadastrar Admin Master</h1>
            <p className="text-sm leading-6 text-slate-300">
              Esta tela cria o primeiro usuario principal. Ela usa a service role somente em rota server-side.
            </p>
          </div>
          <SetupAdminForm />
        </section>
      </div>
    </main>
  );
}
