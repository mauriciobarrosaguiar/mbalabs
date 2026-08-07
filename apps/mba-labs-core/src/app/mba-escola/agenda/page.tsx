import type { Metadata } from "next";
import AgendaPageClient from "./agenda-page-client";

export const metadata: Metadata = {
  title: "Agenda Escolar | MBA Escola",
  description: "Agenda escolar e linha do tempo do aluno."
};

export default function AgendaPage() {
  return <AgendaPageClient />;
}
