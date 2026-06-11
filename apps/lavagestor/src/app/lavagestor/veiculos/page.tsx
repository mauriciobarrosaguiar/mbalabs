import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const result = await readLavaGestorRows("lava_veiculos", "placa,modelo,marca,cor,tipo,created_at");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Veiculos"
          description="Veiculos cadastrados para os clientes."
          rows={result.rows}
          columns={["placa", "modelo", "marca", "cor", "tipo", "created_at"]}
        />
      )}
    </LavaGestorShell>
  );
}
