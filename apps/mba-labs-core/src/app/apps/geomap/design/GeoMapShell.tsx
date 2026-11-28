"use client";
import type { ReactNode } from "react";
import { AppShell } from "./components/geo/AppShell";
import { Toaster } from "sonner";
import "./theme.css";
export function GeoMapShell({children}:{children:ReactNode}){
 return <AppShell>{children}<Toaster position="bottom-right" richColors/></AppShell>;
}
