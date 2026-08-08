import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MBA Educação",
  description: "Cursos rápidos, profissionalizantes, técnicos e pós-graduação em um só lugar."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
