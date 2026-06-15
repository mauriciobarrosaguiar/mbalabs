import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  EmptyState,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  SubmitButton
} from "@/components/ui-kit";
import { createLavagem } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaLookups } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function NovaLavagemPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedCliente = firstParam(params.cliente) ?? "";
  const lookups = await getLavaLookups();
  const clientes = lookups.clientes.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const veiculos = lookups.veiculos
    .filter((row) => (selectedCliente ? row.cliente_id === selectedCliente : true))
    .map((row) => ({
      label: `${String(row.placa ?? "Sem placa")} - ${String(row.marca ?? "")} ${String(row.modelo ?? row.cliente ?? "")}`.trim(),
      value: String(row.id)
    }));
  const funcionarios = lookups.funcionarios.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const servicos = lookups.servicos.map((row) => ({ label: `${String(row.nome)} - ${formatPrice(row.preco)}`, value: String(row.id) }));
  const ready = funcionarios.length > 0;

  return (
    <LavaGestorShell activePath="/lavagestor/nova-lavagem">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Nova lavagem"
          description="Abra a lavagem em etapas: cliente, veículo, serviços, funcionário, valores e confirmação de entrada."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error)} />

        {!ready ? (
          <EmptyState
            title="Cadastros necessários"
            description="Para abrir uma lavagem, cadastre pelo menos um funcionário ativo. Serviços cadastrados ajudam a preencher valores e comissões."
          />
        ) : (
          <form action={createLavagem} className="grid gap-5">
            <Step title="1. Cliente" description="Selecione um cliente existente ou cadastre rapidamente. O WhatsApp é obrigatório para novo cliente.">
              <FormSelect label="Cliente existente" name="cliente_id" options={clientes} defaultValue={selectedCliente} />
              <FormInput label="Novo cliente" name="cliente_nome" placeholder="Nome do cliente" />
              <FormInput label="WhatsApp" name="cliente_whatsapp" placeholder="5599999999999" />
              <FormTextarea label="Observação do cliente" name="cliente_observacao" />
            </Step>

            <Step title="2. Veículo" description="Selecione um veículo do cliente ou cadastre um novo veículo vinculado automaticamente.">
              <FormSelect label="Veículo existente" name="veiculo_id" options={veiculos} />
              <FormSelect
                label="Tipo"
                name="veiculo_tipo"
                options={[
                  { label: "Carro", value: "carro" },
                  { label: "Moto", value: "moto" },
                  { label: "Caminhonete", value: "caminhonete" },
                  { label: "Caminhão", value: "caminhao" },
                  { label: "Sofá", value: "sofa" },
                  { label: "Tapete", value: "tapete" },
                  { label: "Máquina", value: "maquina" },
                  { label: "Outro", value: "outro" }
                ]}
              />
              <FormInput label="Placa" name="veiculo_placa" />
              <FormInput label="Marca" name="veiculo_marca" />
              <FormInput label="Modelo" name="veiculo_modelo" />
              <FormInput label="Cor" name="veiculo_cor" />
              <FormTextarea label="Observação do veículo" name="veiculo_observacao" />
            </Step>

            <Step title="3. Serviços e funcionário" description="Informe o serviço principal, o lavador responsável e, se necessário, um serviço avulso.">
              <FormSelect label="Serviço cadastrado" name="servico_id" options={servicos} />
              <FormMoneyInput label="Valor do serviço" name="valor_servico" />
              <FormSelect label="Funcionário responsável" name="funcionario_id" options={funcionarios} required />
              <FormInput label="Serviço avulso" name="servico_avulso" placeholder="Ex.: Remoção de manchas" />
              <FormMoneyInput label="Valor avulso" name="valor_avulso" />
              <FormInput label="Comissão avulsa %" name="percentual_comissao_avulso" type="number" min="0" step="0.01" />
              <FormTextarea label="Descrição extra" name="descricao_extra" />
            </Step>

            <Step title="4. Valores" description="Revise total, desconto e situação do pagamento antes de confirmar a entrada.">
              <FormMoneyInput label="Total bruto" name="valor_total" />
              <FormMoneyInput label="Desconto" name="valor_desconto" />
              <FormMoneyInput label="Total final" name="valor_final" />
              <FormMoneyInput label="Valor recebido" name="valor_recebido" />
              <FormSelect
                label="Status do pagamento"
                name="status_pagamento"
                defaultValue="aberto"
                options={[
                  { label: "Aberto", value: "aberto" },
                  { label: "Parcial", value: "parcial" },
                  { label: "Pago", value: "pago" },
                  { label: "Fiado", value: "fiado" }
                ]}
              />
              <FormSelect
                label="Forma de pagamento"
                name="forma_pagamento"
                options={[
                  { label: "Dinheiro", value: "dinheiro" },
                  { label: "Pix", value: "pix" },
                  { label: "Cartão", value: "cartao" },
                  { label: "Fiado", value: "fiado" }
                ]}
              />
              <FormTextarea label="Observações da entrada" name="observacoes" />
            </Step>

            <div className="panel grid gap-3 p-5">
              <h2 className="text-xl font-black">5. Confirmar entrada</h2>
              <p className="text-sm leading-6 text-slate-300">
                Ao confirmar, a lavagem entra com status <strong>Na fila</strong>. Ela não será finalizada automaticamente.
              </p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton>Confirmar entrada</SubmitButton>
                <BackButton href="/lavagestor/fila" label="Ver fila" />
              </div>
            </div>
          </form>
        )}
      </section>
    </LavaGestorShell>
  );
}

function Step({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel grid gap-4 p-5">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function formatPrice(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
