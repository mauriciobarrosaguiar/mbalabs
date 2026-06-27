import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, EmptyState, PageHeader } from "@/components/ui-kit";
import { NovaLavagemForm } from "@/components/lavagestor/NovaLavagemForm";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { getLavaLookups } from "@/lib/lavagestor-data";
import { listLavaServicosAvancados } from "@/lib/lavagestor-servicos-data";

export const dynamic = "force-dynamic";

export default async function NovaLavagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [lookups, servicosResult, { config, error: configError }] = await Promise.all([getLavaLookups(), listLavaServicosAvancados(), getLavaConfiguracoesEmpresa()]);
  const clientes = lookups.clientes.map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    telefone: toText(row.telefone),
    observacao: toText(row.observacao)
  }));
  const veiculos = lookups.veiculos.map((row) => ({
    id: String(row.id),
    cliente_id: String(row.cliente_id ?? ""),
    placa: toText(row.placa),
    marca: toText(row.marca),
    modelo: toText(row.modelo),
    cor: toText(row.cor),
    tipo: toText(row.tipo),
    observacao: toText(row.observacao)
  }));
  const funcionarios = lookups.funcionarios.map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    percentual_comissao: row.percentual_comissao == null ? null : Number(row.percentual_comissao)
  }));
  const servicos = servicosResult.rows
    .filter((row) => row.ativo !== false)
    .map((row) => ({
      id: String(row.id),
      nome: String(row.nome),
      preco: row.preco == null ? 0 : Number(row.preco),
      percentual_comissao: row.percentual_comissao == null ? null : Number(row.percentual_comissao),
      tipo: toText(row.tipo),
      aplicacao: toText(row.aplicacao),
      categoria: toText(row.categoria),
      adicional: Boolean(row.adicional)
    }));
  const ready = funcionarios.length > 0 && servicos.length > 0;

  return (
    <LavaGestorShell activePath="/lavagestor/nova-lavagem" companyName={config.nome_exibicao}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Nova lavagem"
          description="Abra a lavagem com cliente, veículo ou item, serviço, lavadores e cálculo automático."
          actions={<BackButton href="/lavagestor" />}
        />
        {!ready ? (
          <EmptyState title="Cadastros necessários" description="Cadastre pelo menos um funcionário ativo e um serviço com preço." />
        ) : (
          <NovaLavagemForm
            clientes={clientes}
            veiculos={veiculos}
            funcionarios={funcionarios}
            servicos={servicos}
            ok={firstParam(params.ok)}
            error={firstParam(params.error) ?? servicosResult.error ?? configError ?? undefined}
          />
        )}
      </section>
    </LavaGestorShell>
  );
}

function toText(value: unknown) {
  const text = String(value ?? "");
  return text || null;
}
