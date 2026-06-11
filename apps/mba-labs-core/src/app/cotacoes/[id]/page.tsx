import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  DataTable,
  EmptyState,
  MessageBanner,
  PageHeader,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { finalizarCotacao } from "@/lib/actions/cotacoes-actions";
import { getCotacaoDetail } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function CotacaoDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { cotacao, items, responses, error } = await getCotacaoDetail(id);
  const isOpen = cotacao?.status === "aberta";

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title={String(cotacao?.titulo ?? "Cotação")}
          description={`Status: ${String(cotacao?.status ?? "-")} | Criada em ${formatDate(cotacao?.created_at)}`}
          actions={
            <>
              <BackButton href="/cotacoes/abertas" />
              {isOpen ? (
                <form action={finalizarCotacao}>
                  <input name="id" type="hidden" value={id} />
                  <SubmitButton>Finalizar cotação</SubmitButton>
                </form>
              ) : null}
            </>
          }
        />
        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? error ?? undefined} />

        <div className="panel p-5">
          <h2 className="text-xl font-black">Observação</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{String(cotacao?.observacao ?? "Sem observação.")}</p>
        </div>

        <div className="grid gap-3">
          <h2 className="text-xl font-black">Itens da cotação</h2>
          <DataTable
            columns={[
              { key: "produto", label: "Produto" },
              { key: "quantidade", label: "Quantidade" },
              { key: "observacao", label: "Observação" }
            ]}
            rows={items}
          />
        </div>

        <div className="grid gap-3">
          <h2 className="text-xl font-black">Respostas de vendedores</h2>
          {responses.length === 0 ? (
            <EmptyState
              title="Espaço preparado para respostas"
              description="Na próxima fase, os vendedores poderão responder preços e comentários por item."
            />
          ) : (
            <DataTable
              columns={[
                { key: "vendedor", label: "Vendedor" },
                { key: "preco", label: "Preço" },
                { key: "comentario", label: "Comentário" },
                { key: "respondido_em", label: "Respondido em" }
              ]}
              rows={responses.map((row) => ({
                ...row,
                preco: formatMoney(row.preco),
                respondido_em: formatDate(row.respondido_em)
              }))}
            />
          )}
        </div>

        <EmptyState
          title="Pedidos serão gerados aqui"
          description="A estrutura de pedidos já está pronta para a próxima etapa de compra a partir da melhor resposta."
        />
      </section>
    </main>
  );
}
