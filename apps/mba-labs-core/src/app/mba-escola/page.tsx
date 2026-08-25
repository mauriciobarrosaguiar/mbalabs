import type { Metadata } from "next";
import { requireAppAccess } from "@/lib/core-data";
import MbaEscolaSsoShell from "./mba-escola-sso-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MBA Escola",
  description: "Comunicação simples entre escola, professores e famílias.",
  applicationName: "MBA Escola",
  manifest: "/mba-escola/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MBA Escola",
    statusBarStyle: "default"
  }
};

export default async function MbaEscolaPage() {
  const current = await requireAppAccess("mba-escola", "/mba-escola");

  return (
    <MbaEscolaSsoShell
      identity={{
        id: current.authUser.id,
        email: current.authUser.email ?? "",
        nome: current.usuario.nome
      }}
    />
  );
}
