import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function LavaGestorPage() {
  const result = await readLavaGestorRows("lava_lavagens", "id,cliente_id,veiculo_id,valor,status,data_lavagem");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Lavagens"
          description="Primeira leitura operacional do LavaGestor filtrada pela empresa logada."
          rows={result.rows}
          columns={["cliente_id", "veiculo_id", "valor", "status", "data_lavagem"]}
        />
      )}
    </LavaGestorShell>
  );
}
