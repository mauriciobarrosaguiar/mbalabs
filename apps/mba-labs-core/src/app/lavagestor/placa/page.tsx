import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import { confirmarLavaPlacaLeitura, saveLavaPlacaLeitura } from "@/lib/actions/lavagestor-placa-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaPlacaData } from "@/lib/lavagestor-placa-data";

export const dynamic = "force-dynamic";

export default async function PlacaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaPlacaData();
  const veiculoId = firstParam(params.veiculo);
  const foundVehicle = veiculoId ? data.veiculos.find((row) => String(row.id) === veiculoId) : null;

  return (
    <LavaGestorShell activePath="/lavagestor/placa">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Ler placa"
          description="Reconhecimento de placa preparado para IA futura. Nesta fase, funciona em modo manual com foto opcional."
          actions={<><BackButton href="/lavagestor" /><Link className="button-secondary" href="/lavagestor/nova-lavagem">Nova lavagem</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
          Reconhecimento automatico ainda nao configurado. Digite a placa manualmente.
        </div>

        {foundVehicle ? (
          <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-xl font-black">Veiculo encontrado</h2>
            <p className="font-semibold">{String(foundVehicle.veiculo)}</p>
            <div className="flex flex-wrap gap-2">
              <Link className="button-primary" href={`/lavagestor/nova-lavagem?veiculo=${foundVehicle.id}`}>Nova lavagem</Link>
              <Link className="button-secondary" href={`/lavagestor/veiculos/${foundVehicle.id}`}>Abrir veiculo</Link>
            </div>
          </section>
        ) : null}

        <form action={saveLavaPlacaLeitura} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm" encType="multipart/form-data">
          <h2 className="text-xl font-black">Nova leitura</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black">Foto da placa</span>
              <input className="input" name="foto" type="file" accept="image/*" capture="environment" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Placa manual</span>
              <input className="input uppercase" name="placa" placeholder="ABC1D23" maxLength={8} />
            </label>
          </div>
          <button className="button-primary w-fit" type="submit">Salvar leitura</button>
        </form>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Ultimas leituras</h2>
          {data.rows.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhuma leitura registrada.</p> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((row) => (
              <article className="grid gap-3 rounded-lg border border-border p-3" key={String(row.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-lg">{String(row.placa_confirmada || row.placa_detectada || "Sem placa")}</strong>
                    <p className="text-sm font-semibold text-muted-foreground">{String(row.veiculo || "Veiculo nao localizado")}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">{String(row.status)}</span>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">{formatDateTime(row.created_at)}</p>
                <form action={confirmarLavaPlacaLeitura} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input name="id" type="hidden" value={String(row.id)} />
                  <input className="input uppercase" name="placa" defaultValue={String(row.placa_confirmada || row.placa_detectada || "")} maxLength={8} />
                  <button className="button-secondary" type="submit">Confirmar</button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </section>
    </LavaGestorShell>
  );
}
