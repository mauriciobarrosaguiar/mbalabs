import { FormCliente } from "@/components/lexgestor/FormCliente";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";

export default function NovoClientePage() {
  return (
    <ResponsivePageContainer
      title="Novo cliente"
      description="Cadastre pessoa física ou jurídica com dados de contato e observações do atendimento."
    >
      <FormCliente />
    </ResponsivePageContainer>
  );
}
