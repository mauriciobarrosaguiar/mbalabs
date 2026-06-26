import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, StatCard, SubmitButton, formatMoney } from "@/components/ui-kit";
import { pagarComissoesFuncionario as registrarAcertoFuncionario } from "@/lib/actions/lavagestor-comissoes-actions";
import { firstParam } from "@/lib/form-utils";
import { listLavaComissoesResumo } from "@/lib/lavagestor-comissoes-data";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function ComissoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { rows, totals, error } = await listLavaComissoesResumo();

  return (
    <LavaGestorShell activePath="/lavagestor/comissoes">
      <section className="grid gap-6">
        <PageHeader eyebrow="LavaGestor" title="Comissões" description="Acerto por funcionário com desconto de vale integral, parcial ou sem desconto." actions={<BackButton href="/lavagestor" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Comissões pendentes" value={formatMoney(totals.totalPendente)} />
          <StatCard label="Vales em aberto" value={formatMoney(totals.totalValesAbertos)} />
          <StatCard label="Líquido com desconto" value={formatMoney(totals.liquidoSeAbaterTudo)} />
          <StatCard label="Comissões já acertadas" value={formatMoney(totals.totalPago)} />
        </div>
        <div className="grid gap-4">
          {rows.length === 0 ? <div className="rounded-lg border border-border bg-card p-6 text-center text-sm font-semibold text-muted-foreground">Nenhum acerto para exibir.</div> : rows.map((row) => <AcertoCard key={String(row.funcionario_id)} row={row} />)}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function AcertoCard({ row }: { row: Row }) {
  const totalComissao = Number(row.total_pendente ?? 0);
  const totalVales = Number(row.total_vales_abertos ?? 0);
  const liquido = Number(row.liquido_com_vales ?? 0);

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Funcionário</p>
          <h2 className="mt-1 text-2xl font-black">{String(row.funcionario)}</h2>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{String(row.qtd_comissoes_pendentes ?? 0)} comissão(ões) · {String(row.qtd_vales_abertos ?? 0)} vale(s) aberto(s)</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Mini label="Comissão" value={formatMoney(totalComissao)} />
          <Mini label="Vales" value={formatMoney(totalVales)} />
          <Mini label="Líquido" value={formatMoney(liquido)} />
        </div>
      </div>
      {totalComissao > 0 ? (
        <form action={registrarAcertoFuncionario} className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <input name="funcionario_id" type="hidden" value={String(row.funcionario_id)} />
          <p className="text-sm font-black">Como deseja tratar os vales neste acerto?</p>
          <label className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-bold"><input name="modo_desconto" type="radio" value="nao" defaultChecked /> Não descontar vale agora</label>
          <label className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-bold"><input name="modo_desconto" type="radio" value="integral" /> Descontar valor integral possível</label>
          <label className="grid gap-2 rounded-lg bg-white p-3 text-sm font-bold"><span className="flex items-center gap-2"><input name="modo_desconto" type="radio" value="parcial" /> Descontar valor parcial</span><input className="input" name="valor_desconto_vale" inputMode="decimal" placeholder="Valor parcial. Ex.: 50,00" /></label>
          <SubmitButton>Salvar acerto</SubmitButton>
        </form>
      ) : totalVales > 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Há vale aberto, mas não há comissão pendente. Fica para o próximo acerto.</p> : null}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-muted p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}
