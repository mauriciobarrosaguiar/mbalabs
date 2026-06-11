import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ValesPage() {
  const result = await readLavaGestorRows("lava_vales", "funcionario_id,valor,descricao,data_vale,status,created_at");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Vales"
          description="Vales para controle financeiro de funcionarios."
          rows={result.rows}
          columns={["funcionario_id", "valor", "descricao", "data_vale", "status", "created_at"]}
        />
      )}
    </LavaGestorShell>
  );
}
