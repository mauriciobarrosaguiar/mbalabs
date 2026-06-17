import { FormCliente } from "@/components/lexgestor/FormCliente";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";

export default function NovoClientePage() {
  return (
    <ResponsivePageContainer
      title="Novo cliente"
      description="Cadastre pessoa fisica ou juridica com dados de contato e observacoes do atendimento."
    >
      <FormCliente />
    </ResponsivePageContainer>
  );
}
