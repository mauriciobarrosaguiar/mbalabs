import { BikeComandaApp } from "@/components/BikeComandaApp";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function BikeComandaPage() {
  await requireAppAccess("bikecomanda", "/bikecomanda");

  return <BikeComandaApp />;
}
