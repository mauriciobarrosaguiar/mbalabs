import { getOptionalElshadayContext } from "@/lib/elshaday";
import { PublicElshadayHome } from "../PublicElshadayHome";

export const dynamic = "force-dynamic";

export default async function ElshadayPublicPreviewPage() {
  const context = await getOptionalElshadayContext();
  return <PublicElshadayHome showMembership={!context} />;
}
