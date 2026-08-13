"use client";

import { useEffect, useState } from "react";
import { DroneMonthlyOfficialReport } from "./DroneMonthlyOfficialReport";
import { OfficialMapTemplateManager } from "./OfficialMapTemplateManager";

const HEADER_KEY="dronegestor:monthlyReportHeader:v1";

type ApiProfile={operadorNome?:string;registroMapa?:string;processoSei?:string;rtNome?:string};

export function DroneMonthlyReportProfileBridge({userName}:{userName:string}){
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    void (async()=>{
      try{
        const response=await fetch("/api/dronegestor/perfil-operacional",{cache:"no-store"});
        const payload=await response.json().catch(()=>null);
        if(response.ok&&payload?.profile){
          const p=payload.profile as ApiProfile;
          let current:Record<string,string>={};
          try{current=JSON.parse(localStorage.getItem(HEADER_KEY)||"{}");}catch{current={};}
          const next={
            ...current,
            operador:p.operadorNome||current.operador||"",
            registroMapa:p.registroMapa||current.registroMapa||"",
            processoSei:p.processoSei||current.processoSei||"",
            responsavelTecnico:p.rtNome||current.responsavelTecnico||userName
          };
          localStorage.setItem(HEADER_KEY,JSON.stringify(next));
        }
      }finally{setReady(true);}
    })();
  },[userName]);
  if(!ready)return <main className="min-h-screen bg-[#f4f8f1] p-6 text-center text-sm font-bold text-[#4b665a]">Preparando relatório...</main>;
  return <><div className="bg-slate-100 px-3 pt-5 sm:px-6 sm:pt-8"><OfficialMapTemplateManager/></div><DroneMonthlyOfficialReport userName={userName}/></>;
}
