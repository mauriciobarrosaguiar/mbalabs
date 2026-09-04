import type { ReactNode } from "react";
import { PublicMemberRegistrationGuard } from "./PublicMemberRegistrationGuard";

export default function PublicMemberRegistrationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PublicMemberRegistrationGuard />
    </>
  );
}
