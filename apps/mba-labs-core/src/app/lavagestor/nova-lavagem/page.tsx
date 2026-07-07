import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LavaNovaLavagemRedirectPage() {
  redirect("/lavagestor/operacao/entrada");
}
