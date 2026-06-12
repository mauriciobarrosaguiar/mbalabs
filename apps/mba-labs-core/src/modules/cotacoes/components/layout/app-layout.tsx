import { AppShell } from "./app-shell";

export function CompanyAppLayout({
  children,
  currentPath,
  title,
}: {
  children: React.ReactNode;
  currentPath: string;
  title: string;
}) {
  return (
    <AppShell mode="app" currentPath={currentPath} title={title} subtitle="Painel da empresa">
      {children}
    </AppShell>
  );
}
