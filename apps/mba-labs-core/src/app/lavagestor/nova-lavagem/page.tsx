import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  EmptyState,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton
} from "@/components/ui-kit";
import { createLavagem } from "@/lib/actions/lavagestor-actions";
import { getLavaLookups } from "@/lib/lavagestor-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function NovaLavagemPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lookups = await getLavaLookups();
  const clientes = lookups.clientes.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const veiculos = lookups.veiculos.map((row) => ({
    label: `${String(row.placa ?? "Sem placa")} - ${String(row.modelo ?? row.cliente ?? "")}`,
    value: String(row.id)
  }));
  const funcionarios = lookups.funcionarios.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const servicos = lookups.servicos.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const ready = clientes.length > 0 && funcionarios.length > 0 && servicos.length > 0;

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="LavaGestor"
          title="Nova Lavagem"
          description="Registre a lavagem, informe o valor e o sistema cria a comissão automaticamente."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error)} />

        {!ready ? (
          <EmptyState
            title="Cadastros necessários"
            description="Para salvar uma lavagem, cadastre pelo menos um cliente, um funcionário ativo e um serviço ativo."
          />
        ) : (
          <form action={createLavagem}>
            <ResourceForm title="Dados da lavagem" actions={<SubmitButton>Salvar lavagem</SubmitButton>}>
              <FormSelect label="Cliente" name="cliente_id" options={clientes} required />
              <FormSelect label="Veículo" name="veiculo_id" options={veiculos} />
              <FormSelect label="Funcionário" name="funcionario_id" options={funcionarios} required />
              <FormSelect label="Serviço" name="servico_id" options={servicos} required />
              <FormMoneyInput label="Valor cobrado" name="valor" required />
              <FormTextarea label="Descrição extra" name="descricao_extra" />
            </ResourceForm>
          </form>
        )}
      </section>
    </main>
  );
}
