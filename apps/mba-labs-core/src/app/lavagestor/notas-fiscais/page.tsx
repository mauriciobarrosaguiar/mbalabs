import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { saveLavaNotaConfig, saveLavaNotaFiscal, updateLavaNotaFiscalStatus } from "@/lib/actions/lavagestor-notas-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaNotasFiscaisData } from "@/lib/lavagestor-notas-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function NotasFiscaisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorFinanceAccess("/lavagestor/notas-fiscais");
  const data = await getLavaNotasFiscaisData();
  const config = data.nfConfig ?? {};

  return (
    <LavaGestorShell activePath="/lavagestor/notas-fiscais" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Notas fiscais"
          description="Módulo estrutural e simulado para emissão fiscal futura. Não emite nota real nesta fase."
          actions={<BackButton href="/lavagestor/operacao" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
          Emissão fiscal automática é módulo opcional e depende de configuração fiscal da empresa e provedor homologado.
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Rascunhos" value={data.summary.rascunho} warning />
          <Metric label="Emitidas" value={data.summary.emitidas} green />
          <Metric label="Canceladas" value={data.summary.canceladas} />
          <Metric label="Com erro" value={data.summary.erro} warning />
        </div>

        <form action={saveLavaNotaConfig} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Configuração fiscal</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Provider" name="provider" defaultValue={String(config.provider ?? "simulado")} />
            <label className="grid gap-2">
              <span className="text-sm font-black">Status</span>
              <select className="input" name="status" defaultValue={String(config.status ?? "inativo")}>
                <option value="inativo">Inativo</option>
                <option value="simulado">Simulado</option>
                <option value="ativo">Ativo futuro</option>
              </select>
            </label>
            <Input label="Cidade" name="cidade" defaultValue={String(config.cidade ?? "")} />
            <Input label="UF" name="uf" defaultValue={String(config.uf ?? "")} />
            <Input label="Inscrição municipal" name="inscricao_municipal" defaultValue={String(config.inscricao_municipal ?? "")} />
            <Input label="CNAE" name="cnae" defaultValue={String(config.cnae ?? "")} />
            <Input label="Alíquota ISS %" name="aliquota_iss" type="number" step="0.01" defaultValue={String(config.aliquota_iss ?? 0)} />
            <Input label="Ambiente" name="ambiente" defaultValue={String(config.ambiente ?? "homologacao")} />
          </div>
          <button className="button-primary w-fit" type="submit">Salvar configuração</button>
        </form>

        <form action={saveLavaNotaFiscal} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Gerar nota simulada</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-sm font-black">Lavagem</span>
              <select className="input" name="lavagem_id">
                <option value="">Opcional</option>
                {data.lavagens.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.cliente)} - {String(row.veiculo)} - {formatMoney(row.valor)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Cliente</span>
              <select className="input" name="cliente_id">
                <option value="">Opcional</option>
                {data.clientes.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
              </select>
            </label>
            <Input label="Numero" name="numero" placeholder="Simulado" />
            <Input label="Serie" name="serie" placeholder="A" />
            <Input label="Valor" name="valor" type="number" step="0.01" required />
            <Input label="Provider" name="provider" defaultValue="simulado" />
          </div>
          <button className="button-primary w-fit" type="submit">Criar nota simulada</button>
        </form>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Notas</h2>
          {data.notas.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhuma nota simulada criada.</p> : null}
          <div className="grid gap-2">
            {data.notas.map((row) => (
              <article className="grid gap-3 rounded-lg border border-border p-3 lg:grid-cols-[1fr_auto]" key={String(row.id)}>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong>{String(row.cliente || "Cliente avulso")}</strong>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{String(row.status)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.veiculo || "-")} - {String(row.provider || "simulado")} - {formatDateTime(row.created_at)}</p>
                  <strong className="mt-2 block text-xl">{formatMoney(row.valor)}</strong>
                </div>
                <div className="grid content-start gap-2 sm:grid-cols-3 lg:w-64 lg:grid-cols-1">
                  <StatusButton id={String(row.id)} status="emitida" label="Marcar emitida" />
                  <StatusButton id={String(row.id)} status="cancelada" label="Cancelar" />
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
    <form action={updateLavaNotaFiscalStatus}>
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

function Input({ label, name, type = "text", required = false, step, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; step?: string; defaultValue?: string; placeholder?: string }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} required={required} step={step} defaultValue={defaultValue} placeholder={placeholder} /></label>;
}
