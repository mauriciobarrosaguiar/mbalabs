import { notFound } from "next/navigation";
import { FormCliente, type ClienteFormData } from "@/components/lexgestor/FormCliente";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { requireAppAccess } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarClientePage({ params }: PageProps) {
  const { id } = await params;
  const current = await requireAppAccess("lexgestor", `/lexgestor/clientes/${id}/editar`);
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId && !current.isAdminMaster) {
    notFound();
  }

  let query = client.from("lex_clientes").select("*").eq("id", id);
  if (escritorioId) {
    query = query.eq("escritorio_id", escritorioId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  const cliente: ClienteFormData = {
    id: String(data.id ?? ""),
    nome: String(data.nome ?? ""),
    cpfCnpj: String(data.cpf_cnpj ?? ""),
    rg: String(data.rg ?? ""),
    dataNascimento: String(data.data_nascimento ?? ""),
    estadoCivil: String(data.estado_civil ?? ""),
    profissao: String(data.profissao ?? ""),
    telefone: String(data.telefone ?? ""),
    whatsapp: String(data.whatsapp ?? ""),
    email: String(data.email ?? ""),
    origem: String(data.origem ?? ""),
    status: String(data.status ?? "Ativo"),
    endereco: String(data.endereco ?? ""),
    observacoes: String(data.observacoes ?? ""),
  };

  return (
    <ResponsivePageContainer
      title="Editar cliente"
      description="Altere os dados cadastrais, contatos e observaÃ§Ãµes do cliente."
    >
      <FormCliente cliente={cliente} />
    </ResponsivePageContainer>
  );
}