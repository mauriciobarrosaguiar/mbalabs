import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ComissoesPage() {
  const result = await readLavaGestorRows("lava_comissoes", "funcionario_id,lavagem_id,valor,status,pago_em,created_at");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Comissoes"
          description="Comissoes geradas por lavagem."
          rows={result.rows}
          columns={["funcionario_id", "lavagem_id", "valor", "status", "pago_em", "created_at"]}
        />
      )}
    </LavaGestorShell>
  );
}
