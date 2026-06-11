import { CotacoesShell, LoginRequired, RowsPreview } from "@/components/CotacoesShell";
import { readCotacoesRows } from "@/lib/cotacoes-data";

export const dynamic = "force-dynamic";

export default async function CotacoesPage() {
  const result = await readCotacoesRows("cot_cotacoes", "id,titulo,status,observacao,created_at");

  return (
    <CotacoesShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Cotacoes"
          description="Primeira leitura das cotacoes filtradas pelas politicas RLS do Supabase."
          rows={result.rows}
          columns={["titulo", "status", "observacao", "created_at"]}
        />
      )}
    </CotacoesShell>
  );
}
