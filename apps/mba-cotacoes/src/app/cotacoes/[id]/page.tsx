import { CotacoesShell, LoginRequired, RowsPreview } from "@/components/CotacoesShell";
import { getCotacoesContext } from "@/lib/cotacoes-data";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function CotacaoDetalhePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getCotacoesContext();
  const { id } = await params;

  if (!context.signedIn) {
    return (
      <CotacoesShell>
        <LoginRequired error={context.error} />
      </CotacoesShell>
    );
  }

  const supabase = await getSupabaseServer();
  const { data } = await (supabase as any)
    .from("cot_cotacao_itens")
    .select("id,produto_id,quantidade,observacao,created_at")
    .eq("cotacao_id", id)
    .limit(50);

  return (
    <CotacoesShell>
      <RowsPreview
        title={`Cotacao ${id}`}
        description="Itens vinculados a cotacao selecionada."
        rows={(data ?? []) as Array<Record<string, unknown>>}
        columns={["produto_id", "quantidade", "observacao", "created_at"]}
      />
    </CotacoesShell>
  );
}
