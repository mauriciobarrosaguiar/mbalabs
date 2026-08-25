import type { Metadata } from "next";
import MbaEscolaClient from "./mba-escola-client-v2";

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

export default function MbaEscolaPage() {
  return <MbaEscolaClient />;
}
