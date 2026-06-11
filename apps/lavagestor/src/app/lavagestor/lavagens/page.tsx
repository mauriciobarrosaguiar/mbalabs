import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function LavagensPage() {
  const result = await readLavaGestorRows("lava_lavagens", "cliente_id,veiculo_id,funcionario_id,servico_id,valor,comissao,status");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Lavagens"
          description="Atendimentos e valores registrados."
          rows={result.rows}
          columns={["cliente_id", "veiculo_id", "funcionario_id", "servico_id", "valor", "comissao", "status"]}
        />
      )}
    </LavaGestorShell>
  );
}
