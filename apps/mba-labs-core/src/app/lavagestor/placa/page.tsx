import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import { confirmarLavaPlacaLeitura, saveLavaPlacaLeitura } from "@/lib/actions/lavagestor-placa-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaAiMode } from "@/lib/lavagestor-ai";
import { getLavaPlacaData } from "@/lib/lavagestor-placa-data";
import { requireLavaGestorCounterAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function PlacaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorCounterAccess("/lavagestor/placa");
  const data = await getLavaPlacaData();
  const aiMode = await getLavaAiMode(current);
  const veiculoId = firstParam(params.veiculo_id) ?? firstParam(params.veiculo);
  const placa = firstParam(params.placa) ?? "";
  const foundVehicle = veiculoId ? data.veiculos.find((row) => String(row.id) === veiculoId) : null;

  return (
    <LavaGestorShell activePath="/lavagestor/placa" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Ler placa"
          description={aiMode.allowPlateReading ? "Reconhecimento de placa com IAMob/Gemini ou modo manual." : "Reconhecimento de placa em modo manual com foto opcional."}
          actions={<><BackButton href="/lavagestor/operacao" /><Link className="button-secondary" href="/lavagestor/nova-lavagem">Nova lavagem</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className={`rounded-xl border p-4 text-sm font-bold leading-6 ${aiMode.allowPlateReading ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {aiMode.allowPlateReading ? "Leitura de placa com IAMob ativa. Confirme a placa antes de abrir lavagem ou cadastro." : "Reconhecimento automatico nao configurado. Digite a placa manualmente."}
        </div>

        {foundVehicle ? (
          <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-xl font-black">Veículo encontrado</h2>
            <p className="font-semibold">{String(foundVehicle.veiculo)}</p>
            <p className="text-sm font-bold text-emerald-950">Cliente: {String(data.clientes.find((row) => String(row.id) === String(foundVehicle.cliente_id))?.nome ?? "-")}</p>
            <div className="flex flex-wrap gap-2">
              <Link className="button-primary" href={`/lavagestor/nova-lavagem?cliente_id=${foundVehicle.cliente_id ?? ""}&veiculo_id=${foundVehicle.id}&placa=${encodeURIComponent(String(foundVehicle.placa ?? placa))}`}>Nova lavagem</Link>
              <Link className="button-secondary" href={`/lavagestor/veiculos/${foundVehicle.id}`}>Abrir veículo</Link>
            </div>
          </section>
        ) : null}

        {!foundVehicle && placa ? (
          <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Placa não localizada</h2>
            <p className="text-sm font-semibold text-muted-foreground">Cadastre o cliente ou vincule um veículo antes de abrir a lavagem.</p>
            <div className="flex flex-wrap gap-2">
              <Link className="button-primary" href={`/lavagestor/veiculos?placa=${encodeURIComponent(placa)}`}>Cadastrar veículo</Link>
              <Link className="button-secondary" href={`/lavagestor/clientes?placa=${encodeURIComponent(placa)}`}>Cadastrar cliente</Link>
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
              <input className="input uppercase" name="placa" placeholder="ABC1D23" maxLength={8} defaultValue={placa} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" name="intent" type="submit" value="manual">Salvar leitura manual</button>
            {aiMode.allowPlateReading ? <button className="button-secondary" name="intent" type="submit" value="gemini">Ler placa com IAMob</button> : null}
          </div>
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
                    <p className="text-sm font-semibold text-muted-foreground">{String(row.veiculo || "Veículo não localizado")}</p>
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
