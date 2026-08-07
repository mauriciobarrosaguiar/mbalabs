import type { Metadata } from "next";
import SchoolManagementPage from "./school-management-page";

export const metadata: Metadata = {
  title: "Gestão da Escola | MBA Escola",
  description: "Turmas, equipe, alunos, responsáveis e acessos da escola."
};

export default function GestaoEscolaPage() {
  return <SchoolManagementPage />;
}
