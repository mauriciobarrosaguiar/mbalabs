import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { AgroVooBetaClient } from "./AgroVooBetaClient";

export const dynamic = "force-dynamic";

export default async function AgroVooBetaPage() {
  // Fase 2: versão isolada, com acesso herdado do DroneGestor e sem migração.
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/agrovoo");
  const canManage = canManageDroneGestor({
    tipo: current.tipo,
    isAdminMaster: current.isAdminMaster,
    permissoes: current.permissoes,
  });
  if (!canManage) redirect("/apps/dronegestor/gestao");
  return <AgroVooBetaClient userName={current.usuario.nome || "Gestor"} />;
}
