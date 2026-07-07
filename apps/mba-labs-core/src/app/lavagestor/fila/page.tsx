import Link from "next/link";
import { redirect } from "next/navigation";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { FilaKanbanClient } from "@/components/lavagestor/FilaKanbanClient";
import { LavaSyncPendingButton } from "@/components/lavagestor/LavaPhotoCard";
import { MessageBanner, PageHeader } from "@/components/ui-kit";
import { alterarFuncionarioLavagem } from "@/lib/actions/lavagestor-fila-actions";
import { firstParam } from "@/lib/form-utils";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function FilaLavagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [{ rows, funcionarios, error }, { config, error: configError }] = await Promise.all([listLavaFila(), getLavaConfiguracoesEmpresa()]);

  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={config.nome_exibicao}>
      <section className="grid max-w-full gap-5 overflow-x-hidden">
        <PageHeader
          eyebrow="LavaGestor"
          title="Fila de lavagem"
          actions={
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
              <Link className="button-secondary min-h-11 px-4 text-sm" href="/lavagestor">Voltar</Link>
              <LavaSyncPendingButton compact returnTo="/lavagestor/fila" />
              <Link className="button-primary min-h-11 px-4 text-sm" href="/lavagestor/nova-lavagem">Nova lavagem</Link>
            </div>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? configError ?? undefined} />
        <TrocarFuncionarioPanel rows={rows} funcionarios={funcionarios} />
        <FilaKanbanClient rows={rows} config={config as Record<string, unknown>} />
      </section>
    </LavaGestorShell>
  );
}

function TrocarFuncionarioPanel({ rows, funcionarios }: { rows: Row[]; funcionarios: Row[] }) {
  const opcoesLavagem = rows.filter((row) => !["entregue", "cancelado"].includes(String(row.status ?? "")));
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-black">Alterar funcionário da fila</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">Use quando o agendamento veio sem funcionário ou quando foi selecionado errado.</p>
      </div>
      <form action={alterarFuncionarioLavagem} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
        <input name="return_to" type="hidden" value="/lavagestor/fila" />
        <label className="grid gap-2">
          <span className="text-sm font-black">Lavagem</span>
          <select className="input" name="lavagem_id" required defaultValue="">
            <option value="">Selecione a lavagem</option>
            {opcoesLavagem.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.cliente || "Cliente")} - {String(row.veiculo || "Veículo")} - atual: {String(row.funcionario || "sem funcionário")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Novo funcionário</span>
          <select className="input" name="funcionario_id" required defaultValue="">
            <option value="">Selecione</option>
            {funcionarios.map((funcionario) => (
              <option key={String(funcionario.id)} value={String(funcionario.id)}>{String(funcionario.nome)}</option>
            ))}
          </select>
        </label>
        <button className="button-primary self-end" type="submit" disabled={opcoesLavagem.length === 0 || funcionarios.length === 0}>Alterar funcionário</button>
      </form>
      {funcionarios.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Cadastre pelo menos um funcionário ativo para alterar a lavagem.</p> : null}
    </section>
  );
}

