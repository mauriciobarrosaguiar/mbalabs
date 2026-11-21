import { requireAppAccess } from "@/lib/core-data";
import { PilotoProLibrary } from "./PilotoProLibrary";

export const dynamic = "force-dynamic";

export default async function PilotoProPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/piloto-pro");
  return <PilotoProLibrary owner={`${current.empresaId || "solo"}:${current.usuario.id}`} />;
}
