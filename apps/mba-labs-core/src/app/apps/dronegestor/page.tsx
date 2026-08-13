import Link from "next/link";
import { BookOpenCheck, ClipboardList, Drone, FileSpreadsheet, History, MapPinned, Scale, Settings2, Sprout } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

function canManageEquipment(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor");
  const primeiroNome = (current.usuario.nome || "Piloto").split(" ")[0];
  const canManage = canManageEquipment(current.tipo, current.isAdminMaster);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_46%,#eef2f7_100%)] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <section className="overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_85%_15%,rgba(16,185,129,.18),transparent_28%),linear-gradient(135deg,#052e16,#064e3b)] p-6 text-white sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-emerald-100"><Sprout size={15}/> DroneGestor</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Olá, {primeiroNome}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">Você não precisa decorar o processo. Escolha o que vai fazer e o DroneGestor conduz a operação passo a passo.</p>
          </div>
          <div className={`grid gap-3 p-4 sm:grid-cols-2 sm:p-6 ${canManage ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <Action href="/apps/dronegestor/campo" icon={<Drone size={24}/>} title="Começar ou continuar operação" text="Escolha o drone e siga calda, segurança, equipamento, liberação, voo e finalização." primary />
            <Action href="/apps/dronegestor/gestao" icon={<ClipboardList size={24}/>} title="Preparar uma operação" text="Cadastre cliente, fazenda e talhão e crie a ordem de serviço (OS)." />
            <Action href="/apps/dronegestor/produtos" icon={<BookOpenCheck size={24}/>} title="Produtos e bulas" text="Consulte produto, registro e revisão técnica sem transformar a biblioteca em recomendação de dose." />
            <Action href="/apps/dronegestor/fichas" icon={<History size={24}/>} title="Ver operações feitas" text="Abra uma ficha simples de cada aplicação, com mapa e conferências. O histórico/CSV continua disponível lá dentro." />
            {canManage && <Action href="/apps/dronegestor/equipamentos" icon={<Settings2 size={24}/>} title="Drones e equipamentos" text="Cadastre cada drone uma vez para preencher automaticamente os dados no campo." />}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Action href="/apps/dronegestor/regulacao" icon={<Scale size={24}/>} title="Regras e segurança por Estado" text="Veja o que é regra legal, o que é padrão interno e quais pontos ainda exigem conferência do RT/órgão estadual." />
          <Action href="/apps/dronegestor/relatorio-mensal" icon={<FileSpreadsheet size={24}/>} title="Relatório mensal MAPA" text="Consolide as operações do mês nos campos obrigatórios e imprima o espelho para conferência antes da remessa oficial pelo SEI." />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mini icon={<MapPinned size={19}/>} title="1. Cadastre o local" text="Cliente, fazenda e talhão. Faça isso uma vez e reutilize depois." />
          <Mini icon={<Drone size={19}/>} title="2. Cadastre o drone" text="Tanque, ANAC, bico e padrões ficam salvos para não digitar de novo." />
          <Mini icon={<ClipboardList size={19}/>} title="3. Crie a OS" text="Informe o serviço e escolha o talhão. O piloto recebe o necessário." />
          <Mini icon={<Sprout size={19}/>} title="4. Siga o passo a passo" text="No campo, escolha o drone e o sistema mostra somente o que precisa ser conferido." />
        </section>
      </div>
    </main>
  );
}

function Action({ href, icon, title, text, primary = false }: { href:string; icon:React.ReactNode; title:string; text:string; primary?:boolean }) {
  return <Link href={href} className={`group rounded-2xl border p-4 no-underline transition hover:-translate-y-0.5 hover:shadow-md ${primary?"border-emerald-300 bg-emerald-50":"border-slate-200 bg-white"}`}><span className={`grid size-11 place-items-center rounded-xl ${primary?"bg-emerald-600 text-white":"bg-slate-100 text-slate-700"}`}>{icon}</span><strong className="mt-3 block text-base font-black text-slate-950">{title}</strong><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></Link>;
}

function Mini({ icon, title, text }: { icon:React.ReactNode; title:string; text:string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="inline-flex items-center gap-2 text-sm font-black text-emerald-800">{icon}{title}</span><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>;
}
