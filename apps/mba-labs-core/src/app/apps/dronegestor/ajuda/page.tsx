import Link from "next/link";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { ArrowLeft, BookOpen, ClipboardCheck, FileCheck2, FolderOpen, HelpCircle, MapPinned, ShieldCheck, Sprout, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";
const root="/apps/dronegestor";

const steps=[
  {title:"1. Selecione uma ordem de serviço",description:"Abra Operações e escolha a OS. Os dados da fazenda e do talhão seguem vinculados ao serviço.",path:"gestao",text:"Abrir ordens de serviço"},
  {title:"2. Confirme o planejamento",description:"O gestor ou RT define os parâmetros da operação. O piloto utiliza o planejamento aprovado, sem redigitar informações.",path:"gestao",text:"Ver planejamento"},
  {title:"3. Confira os documentos",description:"Anexos não comprovam uma autorização oficial. Verifique a situação documental e os requisitos aplicáveis.",path:"documentos",text:"Conferir documentos"},
  {title:"4. Execute as verificações de campo",description:"Segurança, equipamento, calibração e preparo de calda precisam ser conferidos antes do início. O pré-voo permanece obrigatório.",path:"campo",text:"Abrir modo campo"},
  {title:"5. Registre o que foi realizado",description:"Durante uma execução autorizada, informe abastecimentos, área atendida, pausas e ocorrências. Não registre voo fictício como realizado.",path:"campo",text:"Voltar à operação"},
  {title:"6. Confira e encerre",description:"Após o campo, o gestor/RT revisa o pacote, resolve pendências e prepara os relatórios necessários.",path:"conferencia",text:"Abrir conferência"}
];

export default async function DroneGestorHelpPage(){
  const current=await requireAppAccess("dronegestor",`${root}/ajuda`);
  const manager=canManageDroneGestor({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes});
  return <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6">
    <header className="rounded-2xl bg-emerald-950 p-5 text-white">
      <Link href={root} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-100"><ArrowLeft size={18}/>Voltar ao início</Link>
      <div className="mt-2 flex items-center gap-3"><HelpCircle size={30}/><h1 className="text-2xl font-black">Como usar o MBA DroneGestor</h1></div>
      <p className="mt-2 text-sm text-emerald-100">Acompanhe uma ordem de serviço do planejamento ao relatório, sem perder o vínculo com a operação selecionada.</p>
    </header>
    <section aria-label="Fluxo recomendado" className="mt-4 grid gap-3">
      {steps.map(step=><article key={step.title} className="rounded-2xl border border-emerald-100 bg-white p-4">
        <h2 className="text-lg font-black text-emerald-950">{step.title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-700">{step.description}</p>
        <Link href={`${root}/${!manager&&step.path==="conferencia"?"fichas":step.path}`} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald-200 px-4 text-sm font-bold text-emerald-800">{!manager&&step.path==="conferencia"?"Consultar minhas fichas":step.text}</Link>
      </article>)}
    </section>
    <section className="mt-5 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 text-lg font-black text-amber-950"><ShieldCheck size={20}/>Liberação e segurança</h2>
      <p className="text-sm leading-6 text-amber-950">O sistema não emite autorização SARPAS e não substitui inspeções físicas, medições de campo, prescrição técnica nem os procedimentos oficiais. Os botões de iniciar ou retomar permanecem condicionados às conferências exigidas.</p>
    </section>
    <section aria-label="Outros atalhos" className="mt-5 grid gap-3 sm:grid-cols-2">
      {[
        ...(manager?[{title:"Cadastros",detail:"Clientes, propriedades, talhões e equipamentos.",icon:MapPinned,path:"cadastros"}]:[]),
        {title:"MBA Calda",detail:"Misturador, vazão, rendimento e custos.",icon:Sprout,path:"ferramentas"},
        {title:"Piloto Pro",detail:"Biblioteca de aprendizagem e consulta.",icon:BookOpen,path:"piloto-pro"},
        {title:"Relatórios MAPA",detail:"Conferência de competência e exportação.",icon:FileCheck2,path:"relatorio-mensal"},
        {title:"Documentos",detail:"Arquivos vinculados às ordens de serviço.",icon:FolderOpen,path:"documentos"},
        {title:manager?"Equipe e acessos":"Histórico",detail:manager?"Cadastre e vincule usuários de sua empresa.":"Consulte registros das operações.",icon:manager?Wrench:ClipboardCheck,path:manager?"equipe":"historico"}
      ].map(x=><Link key={x.title} href={`${root}/${x.path}`} className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-slate-900">
        <x.icon size={24} className="shrink-0 text-emerald-700"/>
        <span><strong className="block text-sm">{x.title}</strong><small className="text-slate-600">{x.detail}</small></span>
      </Link>)}
    </section>
  </main>;
}
