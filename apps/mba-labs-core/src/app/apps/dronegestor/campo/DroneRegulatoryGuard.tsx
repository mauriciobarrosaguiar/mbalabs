"use client";

import Link from "next/link";
import { Scale, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getRulesForUf } from "@/lib/dronegestor-regulations";

type Mission = { uf?: string; distanciaSensivel?: number | null; semAreaSensivel?: boolean } & Record<string, unknown>;
type Settings = { margemPreventiva?: number; bloquearMargemPreventiva?: boolean };
const VIEWS = new Set(["estrategia", "seguranca"]);

function readMission(): Mission { try { return JSON.parse(localStorage.getItem("dronegestor:mission:v2") || "{}") as Mission; } catch { return {}; } }
function readView() { try { return localStorage.getItem("dronegestor:view:v3") || "inicio"; } catch { return "inicio"; } }

export function DroneRegulatoryGuard() {
  const [mission, setMission] = useState<Mission>({});
  const [view, setView] = useState("inicio");
  const [settings, setSettings] = useState<Settings>({ margemPreventiva: 90, bloquearMargemPreventiva: true });

  useEffect(() => {
    const sync = () => { setMission(readMission()); setView(readView()); };
    sync();
    const interval = window.setInterval(sync, 450);
    fetch("/api/dronegestor/config", { cache: "no-store" }).then((res)=>res.json()).then((payload)=>{ if (payload?.settings) setSettings(payload.settings); }).catch(()=>undefined);
    return () => window.clearInterval(interval);
  }, []);

  const rules = useMemo(() => getRulesForUf(mission.uf), [mission.uf]);
  if (!VIEWS.has(view)) return null;

  const distance = mission.distanciaSensivel == null ? null : Number(mission.distanciaSensivel);
  const legalMinimum = rules.federalMinimumM;
  const internalMinimum = Math.max(0, Number(settings.margemPreventiva ?? 90) || 0);
  const legalProblem = !mission.semAreaSensivel && distance != null && distance < legalMinimum;
  const internalProblem = !mission.semAreaSensivel && distance != null && settings.bloquearMargemPreventiva !== false && distance < internalMinimum;
  const goReview = rules.uf === "GO" && rules.state.some((rule)=>rule.applicability === "review");

  return <section className="border-b border-emerald-900/20 bg-[#07110d] px-3 py-3 text-white sm:px-5">
    <div className="mx-auto grid w-full max-w-3xl gap-2">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-700 bg-emerald-950/80 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-800"><Scale size={19}/></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Regra da operação • {rules.uf || "UF não informada"}</strong><span className="rounded-full bg-emerald-800 px-2 py-1 text-[10px] font-black">fonte verificada 12/08/2026</span></div><p className="mt-1 text-xs leading-5 text-emerald-100/85">Federal para ARP: <strong>20 m</strong> nas situações do art. 9º da Portaria MAPA 298/2021, sem reduzir restrições maiores de bula/receita/legislação específica.</p><p className="mt-1 text-xs leading-5 text-emerald-100/85">Padrão interno da empresa: <strong>{internalMinimum} m</strong>{settings.bloquearMargemPreventiva === false ? " (orientativo)" : " (bloqueio interno)"}. Este valor não é apresentado como lei.</p></div>
        <ShieldCheck className="shrink-0 text-emerald-300" size={20}/>
      </div>

      {legalProblem && <Alert danger title="Abaixo do mínimo federal cadastrado" text={`A distância registrada (${distance} m) está abaixo dos ${legalMinimum} m da regra federal geral para ARP. Não prossiga sem corrigir a situação ou confirmar formalmente uma exceção legal aplicável.`}/>} 
      {!legalProblem && internalProblem && <Alert title="Abaixo do padrão interno" text={`A distância registrada (${distance} m) supera ou não viola o piso federal mostrado, mas está abaixo da margem preventiva interna de ${internalMinimum} m configurada pela empresa.`}/>} 
      {goReview && <Alert title="Goiás exige conferência adicional" text="A lei estadual vigente traz 500 m/250 m para 'pulverização aérea', mas define essa modalidade por avião, hidroavião e helicóptero. O DroneGestor não aplica esses números automaticamente a ARP sem confirmação da Agrodefesa/RT."/>}
      {!rules.state.length && rules.uf && <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs leading-5 text-slate-200">Nenhuma regra estadual específica de ARP está cadastrada como verificada para {rules.uf}. Isso não significa que não exista regra estadual/local; confira a legislação aplicável ao caso.</div>}

      <Link href="/apps/dronegestor/regulacao" className="justify-self-start text-xs font-black text-emerald-300 underline underline-offset-4">Ver fontes e detalhes das regras</Link>
    </div>
  </section>;
}

function Alert({title,text,danger=false}:{title:string;text:string;danger?:boolean}) { return <div className={`flex gap-2 rounded-xl border px-3 py-2 text-xs leading-5 ${danger?"border-red-700 bg-red-950/80 text-red-100":"border-amber-700 bg-amber-950/70 text-amber-100"}`}>{danger?<ShieldAlert className="mt-0.5 shrink-0" size={17}/>:<TriangleAlert className="mt-0.5 shrink-0" size={17}/>}<div><strong className="block">{title}</strong>{text}</div></div>; }
