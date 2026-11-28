import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/core-data";
import { GeoMapShell } from "./design/GeoMapShell";
export const dynamic="force-dynamic";
export default async function GeoMapLayout({children}:{children:ReactNode}){
 const current=await getCurrentUserProfile("/apps/geomap");
 if(!current.isAdminMaster)redirect("/acesso-bloqueado?app=geomap");
 return <><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap" precedence="geomap-fonts"/><GeoMapShell>{children}</GeoMapShell></>;
}
