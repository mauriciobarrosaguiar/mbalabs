"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Bell, BookOpenText, CalendarDays, ClipboardCheck, Home, Settings, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AcademicCenter from "./academic-center";
import AgendaTimeline from "./agenda-timeline";
import AuthorizationsPanel from "./authorizations-panel";
import ManagementTools from "./management-tools";
import RoleSections from "./role-sections";
import SchoolDirectory from "./school-directory";
import TodayDashboard from "./today-dashboard";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type StaffArea = "hoje" | "academico" | "alunos" | "comunicacao" | "gestao";
type GuardianArea = "hoje" | "filhos" | "pendencias" | "agenda";
type Area = StaffArea | GuardianArea;
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string; escola: { nome: string } | null } };

export default function SchoolPortal({ supabase, profile }: Props) {
  const guardian = profile.papel === "responsavel";
  const manager = profile.papel === "admin_escola" || profile.papel === "direcao";
  const coordinator = profile.papel === "coordenacao";
  const [area, setArea] = useState<Area>("hoje");
  const items = useMemo(() => guardian ? [
    { id: "hoje" as const, label: "Hoje", icon: Home },
    { id: "filhos" as const, label: "Meus filhos", icon: UsersRound },
    { id: "pendencias" as const, label: "Pendências", icon: ClipboardCheck },
    { id: "agenda" as const, label: "Agenda", icon: CalendarDays }
  ] : [
    { id: "hoje" as const, label: "Hoje", icon: Home },
    { id: "academico" as const, label: "Acadêmico", icon: BookOpenText },
    { id: "alunos" as const, label: "Alunos", icon: UsersRound },
    { id: "comunicacao" as const, label: "Comunicação", icon: Bell },
    ...((manager || coordinator) ? [{ id: "gestao" as const, label: "Gestão", icon: Settings }] : [])
  ], [guardian, manager, coordinator]);

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "") as Area;
      if (items.some(x => x.id === hash)) setArea(hash);
    };
    handler(); window.addEventListener("hashchange", handler); return () => window.removeEventListener("hashchange", handler);
  }, [items]);

  function navigate(next: Area | "pendencias" | "agenda") {
    const target = guardian ? (next === "academico" ? "filhos" : next === "alunos" ? "filhos" : next === "comunicacao" ? "pendencias" : next === "gestao" ? "filhos" : next) : (next === "pendencias" || next === "agenda" ? "comunicacao" : next);
    setArea(target as Area); window.history.replaceState(null, "", `#${target}`); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <section className="grid gap-6">
    <nav className="sticky top-2 z-30 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur sm:flex sm:flex-wrap">
      {items.map(item => { const Icon = item.icon; return <button key={item.id} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${area === item.id ? "bg-[#176b5b] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => navigate(item.id)} type="button"><Icon size={17}/>{item.label}</button>; })}
    </nav>

    {!guardian && area === "hoje" ? <TodayDashboard supabase={supabase} profile={profile} onNavigate={navigate as never}/> : null}
    {guardian && area === "hoje" ? <TodayDashboard supabase={supabase} profile={profile} onNavigate={navigate as never}/> : null}

    {!guardian && area === "academico" ? <div className="grid gap-6">
      {manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="academic"/> : null}
      <AcademicCenter supabase={supabase} profile={profile} section="academic"/>
      <RoleSections supabase={supabase} profile={profile} section="academic"/>
    </div> : null}

    {!guardian && area === "alunos" ? <div className="grid gap-6">
      {manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="students"/> : null}
      <RoleSections supabase={supabase} profile={profile} section="students"/>
      <AcademicCenter supabase={supabase} profile={profile} section="students"/>
    </div> : null}

    {!guardian && area === "comunicacao" ? <div className="grid gap-6">
      <RoleSections supabase={supabase} profile={profile} section="communication"/>
      <AcademicCenter supabase={supabase} profile={profile} section="communication"/>
      {profile.papel !== "professor" ? <AuthorizationsPanel supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/> : null}
      <AgendaTimeline supabase={supabase} profile={profile}/>
    </div> : null}

    {!guardian && area === "gestao" ? <div className="grid gap-6">
      {manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="management"/> : null}
      {(manager || coordinator) ? <ManagementTools supabase={supabase} profile={{ papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/> : null}
    </div> : null}

    {guardian && area === "filhos" ? <div className="grid gap-6"><RoleSections supabase={supabase} profile={profile} section="students"/><AcademicCenter supabase={supabase} profile={profile} section="students"/></div> : null}
    {guardian && area === "pendencias" ? <div className="grid gap-6"><RoleSections supabase={supabase} profile={profile} section="communication"/><AuthorizationsPanel supabase={supabase} profile={{ nome: profile.nome, papel: "responsavel", escola_id: profile.escola_id }}/></div> : null}
    {guardian && area === "agenda" ? <AgendaTimeline supabase={supabase} profile={profile}/> : null}
  </section>;
}
