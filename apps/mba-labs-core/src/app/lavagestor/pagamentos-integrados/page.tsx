import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { saveLavaCobranca, updateLavaCobrancaStatus } from "@/lib/actions/lavagestor-integracoes-pagamento-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaPagamentosIntegradosData } from "@/lib/lavagestor-integracoes-pagamento-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function PagamentosIntegradosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorFinanceAccess("/lavagestor/pagamentos-integrados");
  const data = await getLavaPagamentosIntegradosData();

  return (
    <LavaGestorShell activePath="/lavagestor/pagamentos-integrados" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Pagamentos integrados"
          description="Estrutura simulada para Pix e cartao futuros. O pagamento manual atual continua sendo o fluxo principal."
          actions={<BackButton href="/lavagestor/operacao" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
          Integracao de pagamento ainda nao configurada. Use baixa manual ou cobranca simulada.
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Pendentes" value={data.summary.pendentes} warning />
          <Metric label="Pagas" value={data.summary.pagas} green />
          <Metric label="Vencidas" value={data.summary.vencidas} />
          <Metric label="Total pendente" value={formatMoney(data.summary.totalPendente)} warning />
        </div>

        <form action={saveLavaCobranca} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Nova cobranca simulada</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-sm font-black">Cliente</span>
              <select className="input" name="cliente_id">
                <option value="">Opcional</option>
                {data.clientes.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Lavagem</span>
              <select className="input" name="lavagem_id">
                <option value="">Opcional</option>
                {data.lavagens.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.cliente)} - {String(row.veiculo)} - {formatMoney(row.valor)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Metodo</span>
              <select className="input" name="metodo" defaultValue="pix">
                <option value="pix">Pix simulado</option>
                <option value="cartao">Cartao simulado</option>
                <option value="link">Link simulado</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Provider</span>
              <select className="input" name="provider" defaultValue="manual">
                <option value="manual">Manual</option>
                <option value="asaas">Asaas futuro</option>
                <option value="mercado_pago">Mercado Pago futuro</option>
                <option value="efi">Efí futuro</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <Input label="Valor" name="valor" type="number" step="0.01" required />
            <Input label="Vencimento" name="vencimento" type="date" />
          </div>
          <button className="button-primary w-fit" type="submit">Criar cobranca</button>
        </form>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Cobrancas</h2>
          {data.cobrancas.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhuma cobranca simulada.</p> : null}
          <div className="grid gap-2">
            {data.cobrancas.map((row) => (
              <article className="grid gap-3 rounded-lg border border-border p-3 lg:grid-cols-[1fr_auto]" key={String(row.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="break-words">{String(row.cliente || "Cliente avulso")}</strong>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{String(row.status)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.veiculo || "-")} - {String(row.metodo || "manual")} - {formatDateTime(row.created_at)}</p>
                  <strong className="mt-2 block text-xl">{formatMoney(row.valor)}</strong>
                  {row.payment_url ? <p className="mt-2 break-all rounded-lg bg-muted p-2 text-xs font-semibold">{String(row.payment_url)}</p> : null}
                </div>
                <div className="grid content-start gap-2 sm:grid-cols-3 lg:w-64 lg:grid-cols-1">
                  <StatusButton id={String(row.id)} status="pago" label="Marcar paga" />
                  <StatusButton id={String(row.id)} status="cancelado" label="Cancelar" />
                  <StatusButton id={String(row.id)} status="erro" label="Marcar erro" danger />
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </LavaGestorShell>
  );
}

function StatusButton({ id, status, label, danger = false }: { id: string; status: string; label: string; danger?: boolean }) {
  return (
    <form action={updateLavaCobrancaStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button className={`${danger ? "button-danger" : "button-secondary"} w-full`} type="submit">{label}</button>
    </form>
  );
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function Input({ label, name, type = "text", required = false, step }: { label: string; name: string; type?: string; required?: boolean; step?: string }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} required={required} step={step} /></label>;
}
