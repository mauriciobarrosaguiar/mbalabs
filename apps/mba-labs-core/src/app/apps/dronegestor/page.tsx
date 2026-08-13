import Link from "next/link";
import { ClipboardList, Drone, History, MapPinned, Sprout } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor");
  const primeiroNome = (current.usuario.nome || "Piloto").split(" ")[0];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_46%,#eef2f7_100%)] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <section className="overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_85%_15%,rgba(16,185,129,.18),transparent_28%),linear-gradient(135deg,#052e16,#064e3b)] p-6 text-white sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-emerald-100"><Sprout size={15}/> DroneGestor Agro</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Olá, {primeiroNome}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">Escolha o que você precisa fazer agora. A ordem de serviço conecta o cliente e o talhão à missão de campo e ao histórico final.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6">
            <Action href="/apps/dronegestor/campo" icon={<Drone size={24}/>} title="Operação de campo" text="Cálculos, clima, segurança, calibração, checklist, SARPAS e execução." primary />
            <Action href="/apps/dronegestor/gestao" icon={<ClipboardList size={24}/>} title="Clientes e OS" text="Clientes, fazendas, talhões e ordens de serviço vinculadas à aplicação." />
            <Action href="/apps/dronegestor/historico" icon={<History size={24}/>} title="Histórico" text="Aplicações concluídas, hectares, ocorrências e exportação dos registros." />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Mini icon={<MapPinned size={19}/>} title="1. Prepare a área" text="Cadastre produtor, fazenda e talhão." />
          <Mini icon={<ClipboardList size={19}/>} title="2. Crie a OS" text="Defina área, cultura, alvo e data." />
          <Mini icon={<Drone size={19}/>} title="3. Vá ao campo" text="A missão abre com os dados da OS." />
        </section>
      </div>
    </main>
  );
}

function Action({ href, icon, title, text, primary = false }: { href:string; icon:React.ReactNode; title:string; text:string; primary?:boolean }) {
  return <Link href={href} className={`group rounded-2xl border p-4 no-underline transition hover:-translate-y-0.5 hover:shadow-md ${primary?"border-emerald-300 bg-emerald-50":"border-slate-200 bg-white"}`}><span className={`grid size-11 place-items-center rounded-xl ${primary?"bg-emerald-600 text-white":"bg-slate-100 text-slate-700"}`}>{icon}</span><strong className="mt-3 block text-base font-black text-slate-950">{title}</strong><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></Link>;
}

function Mini({ icon, title, text }: { icon:React.ReactNode; title:string; text:string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="inline-flex items-center gap-2 text-sm font-black text-emerald-800">{icon}{title}</span><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}
