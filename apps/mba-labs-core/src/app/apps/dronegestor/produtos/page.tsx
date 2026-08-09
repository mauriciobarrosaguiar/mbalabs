import { requireAppAccess } from "@/lib/core-data";
import { ProductLibraryClient } from "./ProductLibraryClient";

export const dynamic = "force-dynamic";

export default async function DroneGestorProductsPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/produtos");
  return <ProductLibraryClient />;
}
