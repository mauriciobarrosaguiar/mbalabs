import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, EmptyState } from "@/components/ui-kit";
import { EntradaRapidaForm } from "@/components/lavagestor/operacao/EntradaRapidaForm";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { getLavaLookups } from "@/lib/lavagestor-data";
import { listLavaServicosAvancados } from "@/lib/lavagestor-servicos-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaOperacaoEntradaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;

  const [lookups, servicosResult, { config, error: configError }] = await Promise.all([
    getLavaLookups(),
    listLavaServicosAvancados(),
    getLavaConfiguracoesEmpresa(),
    requireLavaGestorAccess("/lavagestor/operacao/entrada")
  ]);

  const funcionarios = lookups.funcionarios.map((row) => ({
    id: String(row.id),
    nome: String(row.nome)
  }));

  const servicos = servicosResult.rows
    .filter((row) => row.ativo !== false && !Boolean(row.adicional))
    .map((row) => ({
      id: String(row.id),
      nome: String(row.nome),
      preco: row.preco == null ? 0 : Number(row.preco)
    }));

  const ready = funcionarios.length > 0 && servicos.length > 0;

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/entrada" companyName={config.nome_exibicao}>
      <section className="mx-auto grid w-full max-w-xl gap-4 py-4">
        <BackButton href="/lavagestor/operacao" label="Voltar" />

        {!ready ? (
          <EmptyState
            title="Falta cadastro"
            description="Cadastre pelo menos um funcionário ativo e um serviço com preço antes de usar a entrada rápida."
          />
        ) : (
          <EntradaRapidaForm
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
