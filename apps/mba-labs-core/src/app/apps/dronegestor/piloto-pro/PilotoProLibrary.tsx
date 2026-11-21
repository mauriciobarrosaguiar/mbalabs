"use client";

import Link from "next/link";
import { BookOpen, Search, ChevronDown, ArrowRight } from "lucide-react";
import { useState } from "react";

const ROOT = "/apps/dronegestor";
const chapters = [
  { id:"legislacao", group:"Regulamentação", title:"Legislação e responsabilidades", summary:"ANAC, DECEA, MAPA, SISANT, SARPAS, SIPEAGRO, CAAR e RT.", body:["Identifique separadamente proprietário, operador, piloto e responsável técnico. Confira a documentação e as obrigações aplicáveis à atividade, à aeronave e à região.","Consulte a legislação vigente, as fontes oficiais e as exigências estaduais antes de cada operação. Cadastro não equivale a autorização de voo.","Registre documentos, datas de validade, autorização e receituário quando exigidos. A plataforma não substitui a autoridade competente."], path:"regulacao", action:"Consultar regras e fontes" },
  { id:"sarpas", group:"Regulamentação", title:"SARPAS NG e preparação documental", summary:"Fluxo de consulta, solicitação, comprovação e conferência.", body:["Confira o vínculo da aeronave, o local, a altitude, o horário e o enquadramento da operação no sistema oficial.","Solicite o acesso ao espaço aéreo quando aplicável; confira as condições da autorização e registre o comprovante na OS correspondente.","Se houver mudança relevante nas condições autorizadas, reavalie a autorização antes do voo. O DroneGestor não envia a solicitação oficial."], path:"documentos", action:"Abrir documentos" },
  { id:"modelos", group:"Equipamentos", title:"DJI Agras: T25P, T40, T50, T55, T70P e T100", summary:"Família de equipamentos e diferenças de configuração.", body:["Selecione o modelo e a versão regional exatos. Consulte o manual oficial correspondente para capacidade, limites de carga, baterias, atomizadores, sensores e firmware.","Não transfira parâmetros de um modelo para outro sem conferir a especificação. Dimensões, vazão, controles e limites podem variar.","A tabela técnica por modelo e as fotografias originais do e-book ainda precisam de importação e conferência documental."], path:"cadastros", action:"Consultar cadastros" },
  { id:"componentes", group:"Equipamentos", title:"Componentes da aeronave", summary:"Motores, hélices, ESC, IMU, GNSS, radares, bombas e atomizadores.", body:["Motores, ESC e hélices produzem e controlam a propulsão; controlador de voo, IMU e navegação auxiliam a estabilização e o posicionamento.","Sensores ajudam na percepção do ambiente, mas não garantem detecção de todos os obstáculos, especialmente cabos.","Tanque, filtros, tubulações, bombas, medidor de fluxo e atomizadores compõem o circuito de aplicação. Inspecione vazamentos, obstruções e desgaste."], },
  { id:"controle", group:"Equipamentos", title:"Controle remoto DJI RC Plus e RC Plus 2", summary:"Botões, sticks, tela, modos e retorno.", body:["Identifique os comandos no manual da versão exata do controle e confirme o modo dos sticks configurado antes do voo.","Não experimente combinações de sticks ou comandos de emergência durante o voo. Faça a familiarização supervisionada em ambiente seguro conforme o manual.","Verifique bateria, conexão, alertas, firmware e procedimento de emergência específico do modelo. As ilustrações reais dos botões serão adicionadas após validação."], },
  { id:"planejamento", group:"Operação", title:"Mapeamento e planejamento de voo", summary:"Talhões, obstáculos, limites e áreas sensíveis.", body:["Confira limites da área no campo, pontos de decolagem e pouso, obstáculos, relevo, cabos e áreas sensíveis. Não confie exclusivamente na imagem de satélite.","Planeje a rota considerando faixa efetiva, relevo, autonomia, vento, áreas de exclusão e condições da autorização.","Valide o mapa e a missão antes da execução; diferencie polígono planejado de área realmente tratada."], path:"gestao", action:"Abrir operações" },
  { id:"seguranca", group:"Operação", title:"Segurança, clima e redes elétricas", summary:"Deriva, afastamento, obstáculos, EPI e decisão de interrupção.", body:["Avalie vento, direção, temperatura e umidade medidas no local. Use os limites aplicáveis à bula, ao receituário, ao manual e à legislação.","Para redes elétricas, não adote uma distância universal. Cabos podem não ser detectados; avalie a tensão, o corredor de segurança, a área de manobra, a interferência e as orientações da concessionária e do fabricante.","Mantenha pessoas fora da zona operacional, use EPI adequado e interrompa a atividade se não houver condições seguras ou surgir alerta crítico."], path:"regulacao", action:"Consultar regras de segurança" },
  { id:"calibracao", group:"Operação", title:"Calibração do sistema de pulverização", summary:"Circuito, retirada de ar, fluxômetro, bomba e conferência.", body:["Inspecione filtros, conexões, tanque e circuito; utilize água limpa e siga a sequência de preparação e retirada de ar indicada pelo fabricante.","Execute a rotina de calibração apropriada ao modelo, incluindo fluxômetro e bomba quando prevista. Confira o resultado e investigue desvios ou vazamentos antes de operar.","Não substitua o procedimento do fabricante por uma sequência genérica. Os passos ilustrados por modelo dependem de validação técnica."], path:"campo", action:"Abrir modo campo" },
  { id:"tecnologia", group:"Aplicação", title:"Vazão, faixa, velocidade e gotas", summary:"Entenda os parâmetros antes de definir uma aplicação.", body:["Taxa de aplicação é o volume de calda por hectare (L/ha); vazão total é o volume liberado por unidade de tempo (L/min). A relação teórica é Q = taxa × velocidade (km/h) × faixa efetiva (m) ÷ 600.","Uma faixa efetiva de 6 m corresponde à largura total nominal entre passadas, e não a 6 m de cada lado. A cobertura real deve ser validada em campo.","O tamanho de gotas e a faixa dependem do produto, alvo, configuração do equipamento, condições ambientais e avaliação técnica. Não existem parâmetros universais por cultura."], path:"calculadora", action:"Abrir calculadora" },
  { id:"calda", group:"Aplicação", title:"Cálculo de calda, tanque e misturador", summary:"Área por carga, produtos por hectare, cargas completas e parciais.", body:["Área por tanque (ha) = volume útil da carga (L) ÷ taxa de aplicação (L/ha). Calda total (L) = área (ha) × taxa de aplicação (L/ha).","Número de cargas = arredondar para cima a divisão da calda total pelo volume útil por carga. Calcule a última carga separadamente.","Quantidade de cada produto = dose por hectare × área tratada pela calda, preservando a unidade da dose. Para o misturador, use seu volume útil e calcule a quantidade de produto para a área equivalente.","Exemplo matemático: 10 ha a 10 L/ha exigem 100 L de calda. Com 25 L úteis por carga, são 4 cargas de 25 L; cada carga corresponde a 2,5 ha. O exemplo não é recomendação de aplicação."], path:"calculadora", action:"Calcular calda" },
  { id:"defensivos", group:"Aplicação", title:"Defensivos, adjuvantes e compatibilidade", summary:"Herbicidas, fungicidas, inseticidas, biológicos e segurança.", body:["Identifique finalidade, ingrediente ativo, formulação, alvo autorizado e mecanismo de ação. Confira registro, bula e receituário válidos para a cultura e modalidade de aplicação.","Observe compatibilidade da mistura, qualidade da água, restrições de aplicação, EPI e descarte. Não prescreva doses nem misturas sem respaldo técnico.","O catálogo por ingrediente ativo, exemplos de alvos e imagens de ação será incorporado após revisão agronômica."], },
  { id:"voo", group:"Operação", title:"Pré-voo, voo manual e automático", summary:"Checklist, partida, execução, pausas e finalização.", body:["Conclua a conferência da aeronave, controle, circuito, clima, mapa, documentação e autorização. Verifique se a área de decolagem está livre.","Siga a sequência de energização, partida e parada do manual do modelo. Não cruze os sticks sem conhecer o comando e o contexto seguros.","Registre cargas reais, pausas, ocorrências e área efetivamente aplicada. Não reinicie a mesma missão concluída."], path:"campo", action:"Abrir modo campo" },
  { id:"posvoo", group:"Pós-operação", title:"Limpeza, manutenção e baterias", summary:"Tríplice lavagem quando aplicável, descarte, inspeções e ciclos.", body:["Realize limpeza da aeronave e do circuito conforme manual e requisitos do produto, com EPI e destinação adequada dos resíduos. Não descarte água de lavagem em corpos d’água ou redes de drenagem.","A tríplice lavagem de embalagens laváveis, quando exigida, segue instruções legais e de bula; a limpeza do tanque e das tubulações segue o protocolo específico do equipamento e do produto.","Registre manutenção, danos, ciclos e condição das baterias. Respeite os limites de temperatura, carga, transporte e armazenamento do fabricante."], path:"cadastros", action:"Abrir cadastros" },
  { id:"relatorios", group:"Pós-operação", title:"Relatórios e rastreabilidade", summary:"OS, registros de campo, evidências e conferência técnica.", body:["Registre dados reais: local, área, horários, equipamento, piloto, produtos, volume, condições ambientais, ocorrências e documentos vinculados.","Após concluir o campo, confira o pacote e regularize pendências antes de encerrar a OS. Diferencie relatório interno, relatório oficial e protocolo de envio.","Confira o modelo vigente e os prazos aplicáveis junto ao órgão competente; não considere um PDF interno como comprovante de protocolo."], path:"relatorio-mensal", action:"Abrir relatórios MAPA" }
];

const groups = ["Todos", ...new Set(chapters.map(c => c.group))];
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

export function PilotoProLibrary() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todos");
  const filtered = chapters.filter(c => (group === "Todos" || c.group === group) && normalize([c.title,c.summary,c.group,...c.body].join(" ")).includes(normalize(query.trim())));
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-5 sm:px-6">
      <header className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-200"><BookOpen size={18}/> Biblioteca técnica</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Piloto Pro</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">Guia de consulta para o piloto agrícola: da regularização à entrega da operação.</p>
      </header>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Conteúdo inicial em revisão.</strong> Este guia educacional reúne os temas do projeto Piloto Pro, não reproduz integralmente o PDF e ainda não inclui suas imagens. Consulte sempre o manual oficial, a norma vigente, a bula e o responsável técnico. Não é autorização de voo nem recomendação agronômica.
      </section>
      <section aria-label="Filtros da biblioteca" className="grid gap-3">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"><Search size={19} className="shrink-0 text-emerald-700"/><input aria-label="Buscar conteúdo do Piloto Pro" className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar: calda, SARPAS, faixa, T25P..."/></label>
        <div className="flex flex-wrap gap-2">{groups.map(g=><button key={g} type="button" aria-pressed={group===g} onClick={()=>setGroup(g)} className={`min-h-10 rounded-full border px-3 py-2 text-xs font-bold ${group===g?"border-emerald-800 bg-emerald-800 text-white":"border-slate-200 bg-white text-slate-700"}`}>{g}</button>)}</div>
        <p className="text-xs text-slate-600" aria-live="polite">{filtered.length} de {chapters.length} capítulos</p>
      </section>
      <section className="grid gap-3" aria-label="Capítulos">
        {filtered.map(c=><details key={c.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
            <div><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">{c.group}</span><h2 className="mt-1 text-lg font-bold text-slate-950">{c.title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{c.summary}</p></div>
            <ChevronDown size={20} className="mt-1 shrink-0 text-emerald-700 group-open:rotate-180"/>
          </summary>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700">
            {c.body.map(p=><p key={p}>{p}</p>)}
            {c.path && <Link className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-800" href={ROOT+"/"+c.path}>{c.action}<ArrowRight size={15}/></Link>}
          </div>
        </details>)}
        {!filtered.length && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nenhum capítulo encontrado. Tente outra palavra ou categoria.</p>}
      </section>
      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        <strong className="text-slate-950">Fontes para consulta</strong>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-emerald-800">
          <Link href={ROOT+"/regulacao"}>Regras e fontes legais</Link>
          <a href="https://ag.dji.com/" target="_blank" rel="noreferrer">DJI Agriculture</a>
          <a href="https://ag.dji.com/pt-br/t25p/downloads" target="_blank" rel="noreferrer">Manuais oficiais T25P</a>
          <a href="https://sarpas.decea.mil.br/" target="_blank" rel="noreferrer">SARPAS</a>
          <a href="https://www.gov.br/agricultura/" target="_blank" rel="noreferrer">MAPA</a>
          <a href="https://www.gov.br/anac/" target="_blank" rel="noreferrer">ANAC</a>
        </div>
      </footer>
    </main>
  );
}
