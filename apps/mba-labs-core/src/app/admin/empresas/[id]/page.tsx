import { redirect } from "next/navigation";

export default async function EmpresaDetalhePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/empresas?edit=${id}`);
}
