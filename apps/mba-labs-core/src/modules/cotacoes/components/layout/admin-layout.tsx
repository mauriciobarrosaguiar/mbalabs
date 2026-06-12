import { AppShell } from "./app-shell";

export function AdminLayout({
  children,
  currentPath,
  title,
}: {
  children: React.ReactNode;
  currentPath: string;
  title: string;
}) {
  return (
    <AppShell mode="admin" currentPath={currentPath} title={title} subtitle="Super Admin">
      {children}
    </AppShell>
  );
}
