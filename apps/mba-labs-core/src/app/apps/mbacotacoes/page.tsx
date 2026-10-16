import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
export const dynamic = "force-dynamic";
export default async function AbrirMbaCotacoes() {
 const context=await requireAppAccess("mba-cotacoes","/apps/mbacotacoes");
 redirect(context.isAdminMaster?"/cotacoes/gestao":"/cotacoes");
}
