"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import AttendanceChecklist from "./attendance-checklist";
import LegacyAcademicOperations from "./academic-operations-legacy";

type Role = "admin_escola" | "direcao" | "coordenacao" | "professor" | "responsavel";
type Props = {
  supabase: SupabaseClient;
  profile: { nome: string; papel: Role; escola_id: string };
};

export default function AcademicOperations({ supabase, profile }: Props) {
  const canTakeAttendance = ["admin_escola", "direcao", "coordenacao", "professor"].includes(profile.papel);

  return <>
    {canTakeAttendance ? <AttendanceChecklist supabase={supabase} profile={{ nome: profile.nome, papel: profile.papel as Exclude<Role, "responsavel">, escola_id: profile.escola_id }} /> : null}

    <div className={canTakeAttendance ? "mba-hide-legacy-frequency" : ""}>
      <LegacyAcademicOperations supabase={supabase} profile={profile} />
    </div>

    <style jsx global>{`
      .mba-hide-legacy-frequency > section > nav > button:nth-child(2) {
        display: none !important;
      }
    `}</style>
  </>;
}
