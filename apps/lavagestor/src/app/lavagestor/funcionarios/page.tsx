import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const result = await readLavaGestorRows("lava_funcionarios", "nome,telefone,percentual_comissao,ativo,created_at");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Funcionarios"
          description="Equipe operacional e regras de comissao."
          rows={result.rows}
          columns={["nome", "telefone", "percentual_comissao", "ativo", "created_at"]}
        />
      )}
    </LavaGestorShell>
  );
}
