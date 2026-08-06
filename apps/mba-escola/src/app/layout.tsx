import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MBA Escola",
    template: "%s | MBA Escola"
  },
  description: "Comunicação simples entre escola, professores e famílias.",
  applicationName: "MBA Escola",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MBA Escola",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#176b5b"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
