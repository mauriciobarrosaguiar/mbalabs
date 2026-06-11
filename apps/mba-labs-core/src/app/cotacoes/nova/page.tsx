import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  EmptyState,
  FormInput,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton
} from "@/components/ui-kit";
import { createCotacao } from "@/lib/actions/cotacoes-actions";
import { getCotacoesLookups } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function NovaCotacaoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { produtos } = await getCotacoesLookups();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Nova Cotação"
          description="Selecione produtos e quantidades para iniciar uma cotação aberta."
          actions={<BackButton href="/cotacoes" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error)} />

        {produtos.length === 0 ? (
          <EmptyState title="Cadastre um produto primeiro" description="A cotação precisa de pelo menos um produto ativo." />
        ) : (
          <form action={createCotacao}>
            <ResourceForm title="Dados da cotação" actions={<SubmitButton>Criar cotação</SubmitButton>}>
              <FormInput label="Título" name="titulo" placeholder="Ex.: Cotação de genéricos" required />
              <FormTextarea label="Observação" name="observacao" />
              <div className="grid gap-3 md:col-span-2">
                <h2 className="text-lg font-black">Produtos</h2>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_130px_1fr]" key={index}>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold">Produto {index + 1}</span>
                      <select className="input" name="produto_id">
                        <option value="">Selecione</option>
                        {produtos.map((produto) => (
                          <option key={String(produto.id)} value={String(produto.id)}>
                            {String(produto.nome)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold">Quantidade</span>
                      <input className="input" min="0.001" name="quantidade" step="0.001" type="number" defaultValue="1" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-bold">Observação do item</span>
                      <input className="input" name="item_observacao" placeholder="Opcional" />
                    </label>
                  </div>
                ))}
              </div>
            </ResourceForm>
          </form>
        )}
      </section>
    </main>
  );
}
