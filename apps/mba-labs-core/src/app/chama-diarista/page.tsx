import Link from "next/link";
import { Wrench } from "lucide-react";

export const metadata = {
  title: "ChamaDiarista | MBA Labs",
  description: "Sistema temporariamente indisponível para manutenção."
};

export default function ChamaDiaristaMaintenancePage() {
  return (
    <main className="page-shell grid min-h-screen content-center py-10">
      <section className="panel mx-auto grid w-full max-w-xl gap-5 p-6 text-center sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
          <Wrench size={28} />
        </span>
        <div className="grid gap-2">
          <p className="eyebrow">ChamaDiarista</p>
          <h1 className="text-3xl font-black">Sistema em manutenção</h1>
          <p className="text-sm leading-6 text-slate-300">
            O ChamaDiarista foi retirado temporariamente do catálogo ativo enquanto a interface é restaurada e validada.
            Nenhum acesso comercial será liberado até a conclusão dos testes.
          </p>
        </div>
        <Link className="button-primary mx-auto w-fit" href="/dashboard">
          Voltar para o MBA Labs
        </Link>
      </section>
    </main>
  );
}
