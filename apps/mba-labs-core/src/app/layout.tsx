import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("mba-platform-theme");
    var theme = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.dataset.mbaTheme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.mbaTheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "MBA Labs",
  description: "Sistemas simples para gestão inteligente de negócios."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}