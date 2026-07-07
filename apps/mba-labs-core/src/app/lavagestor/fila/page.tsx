import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FilaLavagemPage() {
  redirect("/lavagestor/operacao/fila");
}
