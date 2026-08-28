"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Bell, BookOpenText, CalendarDays, ClipboardCheck, Home, Settings, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AbsenceExceptionPanel from "./absence-exception-panel";
import AcademicContentPanel from "./academic-content-panel";
import AcademicGradePanel from "./academic-grade-panel";
import AgendaTimeline from "./agenda-timeline";
import AuthorizationsPanel from "./authorizations-panel";
import GuardianActivitiesPanel from "./guardian-activities-panel";
import ManagementTools from "./management-tools";
import RoleSections from "./role-sections";
import SchoolDirectory from "./school-directory";
import StudentCommunicationCenter from "./student-communication-center";
import StudentSafetyPanel from "./student-safety-panel";
import TeacherSchedulePanel from "./teacher-schedule-panel";
import TeacherStudentPanel from "./teacher-student-panel";
import TodayDashboard from "./today-dashboard";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type StaffArea = "hoje" | "academico" | "alunos" | "comunicacao" | "gestao";
type GuardianArea = "hoje" | "filhos" | "pendencias" | "agenda";
type Area = StaffArea | GuardianArea;
type Props = { supabase: SupabaseClient; profile: { nome: string; papel: Role; escola_id: string; escola: { nome: string } | null } };

export default function SchoolPortal({ supabase, profile }: Props) {
  const guardian = profile.papel === "responsavel";
  const teacher = profile.papel === "professor";
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
      if (items.some(item => item.id === hash)) setArea(hash);
    };
    handler();
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [items]);

  function navigate(next: Area | "pendencias" | "agenda") {
    const target = guardian
      ? (next === "academico" ? "filhos" : next === "alunos" ? "filhos" : next === "comunicacao" ? "pendencias" : next === "gestao" ? "filhos" : next)
      : (next === "pendencias" || next === "agenda" ? "comunicacao" : next);
    setArea(target as Area);
    window.history.replaceState(null, "", `#${target}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <section className="grid gap-6">
    <nav className="sticky top-2 z-30 flex gap-2 overflow-x-auto rounded-[22px] border border-[#E2E7F0] bg-white/95 p-2 shadow-[0_14px_45px_-38px_rgba(30,41,59,0.55)] backdrop-blur sm:overflow-visible">
      {items.map(item => {
        const Icon = item.icon;
        const active = area === item.id;
        return <button
          key={item.id}
          className={`flex min-h-12 min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black transition sm:min-w-0 sm:flex-1 ${active ? "bg-[#4353C7] text-white shadow-lg shadow-indigo-200" : "bg-[#F8F9FC] text-[#667085] hover:bg-[#EEF1FF] hover:text-[#4353C7]"}`}
          onClick={() => navigate(item.id)}
          type="button"
        >
          <Icon size={18} />{item.label}
        </button>;
      })}
    </nav>

    {area === "hoje" ? <TodayDashboard supabase={supabase} profile={profile} onNavigate={navigate as never}/> : null}

    {!guardian && area === "academico" ? <div className="grid gap-6">
      {manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="academic"/> : null}
      {teacher ? <TeacherSchedulePanel supabase={supabase} profile={{ nome: profile.nome, papel: "professor", escola_id: profile.escola_id }}/> : <AcademicGradePanel supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/>}      
      <AcademicContentPanel supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as Exclude<Role, "responsavel">, escola_id: profile.escola_id }}/>
    </div> : null}

    {!guardian && area === "alunos" ? <div className="grid gap-6">
      {manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="students"/> : null}
      {teacher ? <><TeacherStudentPanel supabase={supabase} profile={{ nome: profile.nome, papel: "professor", escola_id: profile.escola_id }}/><AbsenceExceptionPanel supabase={supabase} profile={{ papel: "professor", escola_id: profile.escola_id }}/></> : <><RoleSections supabase={supabase} profile={profile} section="students"/><AbsenceExceptionPanel supabase={supabase} profile={{ papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/><StudentSafetyPanel supabase={supabase} profile={profile}/></>}
    </div> : null}

    {!guardian && area === "comunicacao" ? <div className="grid gap-6">
      <RoleSections supabase={supabase} profile={profile} section="communication"/>
      <StudentCommunicationCenter supabase={supabase} profile={profile} section="communication"/>
      {profile.papel !== "professor" ? <AuthorizationsPanel supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/> : null}
      <AgendaTimeline supabase={supabase} profile={profile}/>
    </div> : null}

    {!guardian && area === "gestao" ? <div className="grid gap-6">{manager ? <SchoolDirectory supabase={supabase} schoolName={profile.escola?.nome || "Minha escola"} role={profile.papel as "admin_escola" | "direcao"} section="management"/> : null}{(manager || coordinator) ? <ManagementTools supabase={supabase} profile={{ papel: profile.papel as "admin_escola" | "direcao" | "coordenacao", escola_id: profile.escola_id }}/> : null}</div> : null}

    {guardian && area === "filhos" ? <div className="grid gap-6"><RoleSections supabase={supabase} profile={profile} section="students"/><GuardianActivitiesPanel supabase={supabase} profile={{ nome: profile.nome, papel: "responsavel", escola_id: profile.escola_id }}/><AbsenceExceptionPanel supabase={supabase} profile={{ papel: "responsavel", escola_id: profile.escola_id }}/><StudentSafetyPanel supabase={supabase} profile={profile}/></div> : null}
    {guardian && area === "pendencias" ? <div className="grid gap-6"><RoleSections supabase={supabase} profile={profile} section="communication"/><AuthorizationsPanel supabase={supabase} profile={{ nome: profile.nome, papel: "responsavel", escola_id: profile.escola_id }}/></div> : null}
    {guardian && area === "agenda" ? <AgendaTimeline supabase={supabase} profile={profile}/> : null}
  </section>;
}
