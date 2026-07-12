import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, EmptyState } from "@/components/ui-kit";
import { EntradaRapidaForm } from "@/components/lavagestor/operacao/EntradaRapidaForm";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { getLavaLookups } from "@/lib/lavagestor-data";
import { listLavaServicosAvancados } from "@/lib/lavagestor-servicos-data";
import { requireLavaGestorOperationAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoEntradaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;

  const [lookups, servicosResult, { config, error: configError }] = await Promise.all([
    getLavaLookups(),
    listLavaServicosAvancados(),
    getLavaConfiguracoesEmpresa("/lavagestor/operacao/entrada"),
    requireLavaGestorOperationAccess("/lavagestor/operacao/entrada")
  ]);

  const servicos = servicosResult.rows
    .filter((row) => row.ativo !== false && !Boolean(row.adicional))
    .map((row) => ({
      id: String(row.id),
      nome: String(row.nome),
      preco: row.preco == null ? 0 : Number(row.preco)
    }));

  const clientes = lookups.clientes.map((row) => ({
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    telefone: String(row.telefone ?? "")
  })).filter((row) => row.id && row.nome);

  const veiculos = lookups.veiculos.map((row) => ({
    id: String(row.id ?? ""),
    cliente_id: String(row.cliente_id ?? ""),
    placa: String(row.placa ?? ""),
    marca: String(row.marca ?? ""),
    modelo: String(row.modelo ?? ""),
    cor: String(row.cor ?? "")
  })).filter((row) => row.id);

  const ready = servicos.length > 0;

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/entrada" companyName={config.nome_exibicao}>
      <section className="mx-auto grid w-full max-w-xl gap-3 py-3">
        <BackButton href="/lavagestor/operacao" label="Voltar" />

        {!ready ? (
          <EmptyState
            title="Falta cadastro"
            description="Cadastre pelo menos um servico com preco antes de usar a entrada rapida."
          />
        ) : (
          <EntradaRapidaForm
            clientes={clientes}
            veiculos={veiculos}
            servicos={servicos}
            ok={firstParam(params.ok)}
            error={firstParam(params.error) ?? servicosResult.error ?? configError ?? undefined}
          />
        )}
      </section>
    </LavaGestorShell>
  );
}
