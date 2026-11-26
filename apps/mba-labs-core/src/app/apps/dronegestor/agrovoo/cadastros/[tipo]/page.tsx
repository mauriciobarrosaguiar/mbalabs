import { notFound, redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { AgroVooRegistryClient, type RegistryKind } from "./AgroVooRegistryClient";
import { DronePilotsManager } from "../../../pilotos/DronePilotsManager";
import { DronePilotQualifications } from "../../../pilotos/DronePilotQualifications";

export const dynamic = "force-dynamic";

export default async function Page({params}: {params: Promise<{tipo:string}>}) {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/agrovoo");
  if (!canManageDroneGestor({tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes})) redirect("/apps/dronegestor/gestao");
  const {tipo} = await params;
  if (tipo === "pilotos") return <><DronePilotQualifications/><DronePilotsManager compact/></>;
  if (!["clientes","propriedades","talhoes","aeronaves"].includes(tipo)) notFound();
  return <AgroVooRegistryClient key={tipo} kind={tipo as RegistryKind}/>;
}
