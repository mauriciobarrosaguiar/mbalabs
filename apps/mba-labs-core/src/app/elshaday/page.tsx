import { getOptionalElshadayContext } from "@/lib/elshaday";
import { PrivateElshadayDashboard } from "./PrivateElshadayDashboard";
import { PublicElshadayHome } from "./PublicElshadayHome";

export const dynamic = "force-dynamic";

export default async function ElshadayHomePage() {
  const context = await getOptionalElshadayContext();

  if (context) {
    return <PrivateElshadayDashboard />;
  }

  return <PublicElshadayHome showMembership />;
}
