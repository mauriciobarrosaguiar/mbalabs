import { GraduationCap, ShieldCheck } from "lucide-react";
import { FirstAccessForm } from "@/components/first-access-form";

export const metadata = {
  title: "Primeiro acesso"
};

export default function FirstAccessPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:grid sm:place-items-center">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 md:grid-cols-[1.05fr_.95fr]">
        <div className="hidden bg-[#176b5b] p-12 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="mb-10 grid h-16 w-16 place-items-center rounded-2xl bg-white/15">
              <GraduationCap size={38} />
            </div>
            <p className="text-sm font-black uppercase tracking-[.18em] text-emerald-100">MBA Escola</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">Crie seu acesso com segurança.</h1>
            <p className="mt-5 max-w-md text-lg leading-8 text-emerald-50/90">
              Use exatamente o e-mail que recebeu autorização da escola ou da administração do sistema.
            </p>
          </div>
          <p className="flex items-center gap-3 text-sm font-semibold text-emerald-50">
            <ShieldCheck size={22} /> Apenas pessoas previamente convidadas terão acesso aos dados.
          </p>
        </div>

        <div className="p-6 sm:p-10 md:p-12">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#176b5b] text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <p className="text-xl font-black">MBA Escola</p>
              <p className="text-sm text-slate-500">Primeiro acesso</p>
            </div>
          </div>

          <p className="text-sm font-black uppercase tracking-[.16em] text-[#176b5b]">Primeiro acesso</p>
          <h2 className="mt-3 text-3xl font-black">Crie sua conta</h2>
          <p className="mb-8 mt-3 leading-7 text-slate-500">
            Informe o e-mail convidado e escolha sua senha. Você pode usar a mesma senha de outro sistema, mas ela será salva separadamente.
          </p>
          <FirstAccessForm />
        </div>
      </section>
    </main>
  );
}
