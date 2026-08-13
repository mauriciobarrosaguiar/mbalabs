import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ExternalLink, ShieldAlert } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";
import { FEDERAL_ARP_RULES, STATE_RULES } from "@/lib/dronegestor-regulations";
import { DroneRegulationExplorer } from "./DroneRegulationExplorer";

export const dynamic = "force-dynamic";

export default async function DroneRegulationPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/regulacao");

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5,#f8fafc_36%,#eef2f7)] px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <Link href="/apps/dronegestor" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="Voltar"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-emerald-700"><ShieldAlert size={15}/> Segurança regulatória</span>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Regras por Estado</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">O sistema separa <strong>regra legal verificada</strong>, <strong>padrão interno da empresa</strong> e <strong>insight de campo</strong>. Experiência prática nunca é mostrada como lei sem fonte oficial.</p>
            </div>
          </div>
        </header>

        <DroneRegulationExplorer federal={FEDERAL_ARP_RULES} stateRules={STATE_RULES}/>

        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <BookOpenCheck className="mr-2 inline" size={18}/><strong>Regra de segurança do sistema:</strong> restrições da bula, receita agronômica, legislação ambiental/local e determinações do órgão competente podem exigir distância maior. O motor regulatório nunca reduz uma exigência específica.
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <strong className="text-slate-950">Fontes federais conferidas em 12/08/2026</strong>
          <p className="mt-1 leading-6">MAPA — Portaria nº 298/2021 e página oficial de Aviação Agrícola. As normas podem mudar; por isso cada regra do sistema mantém fonte e data de verificação.</p>
          <a href="https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/legislacao" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-black text-emerald-700">Abrir legislação do MAPA <ExternalLink size={15}/></a>
        </section>
      </div>
    </main>
  );
}
