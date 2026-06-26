import { requireAppAccess } from "./core-data";
import { getSupabaseServer } from "./supabase";

type AnyRow = Record<string, unknown>;

export async function listLavaComissoesResumo() {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [funcionariosResult, comissoesResult, valesResult] = await Promise.all([
    client
      .from("lava_funcionarios")
      .select("id,nome,telefone,ativo")
      .eq("empresa_id", current.empresaId)
      .order("nome", { ascending: true })
      .limit(300),
    client
      .from("lava_comissoes")
      .select("id,funcionario_id,lavagem_id,valor,status,pago_em,created_at")
      .eq("empresa_id", current.empresaId)
      .in("status", ["pendente", "pago"])
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("lava_vales")
      .select("id,funcionario_id,valor,descricao,data_vale,status,created_at")
      .eq("empresa_id", current.empresaId)
      .in("status", ["aberto", "descontado"])
      .order("data_vale", { ascending: false })
      .limit(500)
  ]);

  const funcionarios = (funcionariosResult.data ?? []) as AnyRow[];
  const comissoes = (comissoesResult.data ?? []) as AnyRow[];
  const vales = (valesResult.data ?? []) as AnyRow[];

  const rows = funcionarios
    .map((funcionario) => {
      const funcionarioId = String(funcionario.id);
      const comissoesFuncionario = comissoes.filter((row) => String(row.funcionario_id) === funcionarioId);
      const valesFuncionario = vales.filter((row) => String(row.funcionario_id) === funcionarioId);
      const pendentes = comissoesFuncionario.filter((row) => row.status === "pendente");
      const pagas = comissoesFuncionario.filter((row) => row.status === "pago");
      const valesAbertos = valesFuncionario.filter((row) => row.status === "aberto");
      const totalPendente = sumRows(pendentes, "valor");
      const totalPago = sumRows(pagas, "valor");
      const totalValesAbertos = sumRows(valesAbertos, "valor");
      const liquidoComVales = Math.max(totalPendente - totalValesAbertos, 0);

      return {
        id: funcionarioId,
        funcionario_id: funcionarioId,
        funcionario: String(funcionario.nome ?? "Funcionário"),
        telefone: String(funcionario.telefone ?? ""),
        ativo: funcionario.ativo !== false,
        total_pendente: totalPendente,
        total_pago: totalPago,
        total_vales_abertos: totalValesAbertos,
        liquido_com_vales: liquidoComVales,
        qtd_comissoes_pendentes: pendentes.length,
        qtd_vales_abertos: valesAbertos.length,
        comissoes_pendentes: pendentes,
        vales_abertos: valesAbertos
      };
    })
    .filter((row) => row.total_pendente > 0 || row.total_vales_abertos > 0 || row.total_pago > 0);

  return {
    rows,
    totals: {
      totalPendente: sumRows(rows, "total_pendente"),
      totalPago: sumRows(rows, "total_pago"),
      totalValesAbertos: sumRows(rows, "total_vales_abertos"),
      liquidoSeAbaterTudo: sumRows(rows, "liquido_com_vales")
    },
    error: funcionariosResult.error?.message ?? comissoesResult.error?.message ?? valesResult.error?.message ?? null
  };
}

function sumRows(rows: AnyRow[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}
