import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const result = await readLavaGestorRows("lava_clientes", "nome,telefone,email,documento,created_at");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Clientes"
          description="Clientes vinculados a empresa logada."
          rows={result.rows}
          columns={["nome", "telefone", "email", "documento", "created_at"]}
        />
      )}
    </LavaGestorShell>
  );
}
