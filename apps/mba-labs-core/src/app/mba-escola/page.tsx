import Link from "next/link";
import { redirect } from "next/navigation";

export default function MbaEscolaEntryPage() {
  const appUrl = process.env.NEXT_PUBLIC_MBA_ESCOLA_URL;

  if (appUrl) {
    redirect(appUrl);
  }

  return (
    <main className="page-shell grid min-h-screen place-items-center py-10">
      <section className="panel max-w-xl p-7 text-center">
        <p className="eyebrow">MBA Escola</p>
        <h1 className="mt-3 text-3xl font-black">Aplicativo em configuração</h1>
        <p className="mt-4 leading-7 text-slate-300">
          O MBA Escola já faz parte do portal, mas o endereço do projeto separado ainda precisa ser configurado na Vercel.
        </p>
        <Link className="button-secondary mt-6" href="/dashboard">
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
