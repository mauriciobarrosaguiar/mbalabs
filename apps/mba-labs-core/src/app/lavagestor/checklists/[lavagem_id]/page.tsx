import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { LavaPhotoCard, LavaSyncPendingButton } from "@/components/lavagestor/LavaPhotoCard";
import { PhotoUploadSubmitButton } from "@/components/lavagestor/PhotoUploadSubmitButton";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import { deleteLavaChecklistFoto, saveLavaChecklist, uploadLavaChecklistFoto } from "@/lib/actions/lavagestor-checklists-actions";
import { firstParam } from "@/lib/form-utils";
import { canUploadCheckoutPhoto, getLavaChecklistPageData, LAVA_CHECKLIST_PHOTO_TYPES } from "@/lib/lavagestor-checklists-data";

export const dynamic = "force-dynamic";

export default async function LavaChecklistPage({
  params,
  searchParams
}: {
  params: Promise<{ lavagem_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lavagem_id: lavagemId } = await params;
  const query = await searchParams;
  const { lavagem, checklist, servicos, fotos, config, error } = await getLavaChecklistPageData(lavagemId);

  if (!lavagem || !checklist) {
    return (
      <LavaGestorShell activePath="/lavagestor/fila">
        <section className="grid gap-5">
          <PageHeader eyebrow="LavaGestor" title="Checklist nao encontrado" actions={<BackButton href="/lavagestor/fila" />} />
          <MessageBanner error={firstParam(query.error) ?? error ?? "Nao foi possivel abrir o checklist."} />
        </section>
      </LavaGestorShell>
    );
  }

  const locked = String(checklist.status) === "concluido";
  const status = String(lavagem.status ?? "na_fila");
  const isDelivered = status === "entregue";
  const canUploadCheckout = canUploadCheckoutPhoto(status);
  const fotoRows = fotos as Record<string, unknown>[];
  const showCheckout = canUploadCheckout || isDelivered || fotoRows.some((foto) => String(foto.momento ?? "entrada") === "checkout");
  const entradaFotos = fotoRows.filter((foto) => String(foto.momento ?? "entrada") !== "checkout");
  const checkoutFotos = fotoRows.filter((foto) => String(foto.momento ?? "entrada") === "checkout");
  const photoTypes = photoTypeOptions(config.checklist_tipos_foto);
  const entryPhotoRequired = config.exigir_foto_entrada && !config.permitir_concluir_checklist_sem_foto;

  return (
    <LavaGestorShell activePath="/lavagestor/fila">
      <section className="grid gap-5 pb-20">
        <PageHeader
          eyebrow="LavaGestor"
          title={`Checklist ${String(lavagem.id).slice(0, 8).toUpperCase()}`}
          description={`${String(lavagem.cliente || "Cliente")} - ${String(lavagem.veiculo || "Veiculo/item")} - entrada ${formatDateTime(lavagem.data_entrada ?? lavagem.data_lavagem)}`}
          actions={
            <>
              <BackButton href="/lavagestor/fila" />
              <Link className="button-secondary" href={`/lavagestor/tickets/${lavagem.id}`}>Ticket</Link>
            </>
          }
        />
        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error) ?? error ?? undefined} />

        {locked ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-950">
            Checklist concluido. As informacoes ficam protegidas contra alteracoes destrutivas.
          </div>
        ) : null}
        {entryPhotoRequired && entradaFotos.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-950">
            Adicione pelo menos uma foto de entrada antes de concluir o checklist.
          </div>
        ) : null}

        <form action={saveLavaChecklist} className="grid gap-4">
          <input name="lavagem_id" type="hidden" value={String(lavagem.id)} />
          <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-xl font-black">Estado do veiculo/item</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Marque o que foi conferido na entrada.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Toggle label="Pintura ok" name="pintura_ok" checked={bool(checklist.pintura_ok, true)} disabled={locked} />
              <Toggle label="Riscos" name="riscos" checked={bool(checklist.riscos)} disabled={locked} />
              <Toggle label="Amassados" name="amassados" checked={bool(checklist.amassados)} disabled={locked} />
              <Toggle label="Vidro trincado" name="vidro_trincado" checked={bool(checklist.vidro_trincado)} disabled={locked} />
              <Toggle label="Retrovisor ok" name="retrovisor_ok" checked={bool(checklist.retrovisor_ok, true)} disabled={locked} />
              <Toggle label="Pneus ok" name="pneus_ok" checked={bool(checklist.pneus_ok, true)} disabled={locked} />
              <Toggle label="Farois ok" name="farois_ok" checked={bool(checklist.farois_ok, true)} disabled={locked} />
              <Toggle label="Interior ok" name="interior_ok" checked={bool(checklist.interior_ok, true)} disabled={locked} />
              <Toggle label="Objetos do cliente" name="objetos_cliente" checked={bool(checklist.objetos_cliente)} disabled={locked} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nivel de combustivel" name="combustivel_nivel" defaultValue={String(checklist.combustivel_nivel ?? "")} disabled={locked} />
              <Field label="KM" name="km" defaultValue={String(checklist.km ?? "")} disabled={locked} />
              <TextArea label="Observacao de avarias" name="observacao_avarias" defaultValue={String(checklist.observacao_avarias ?? "")} disabled={locked} />
              <TextArea label="Observacao geral" name="observacao_geral" defaultValue={String(checklist.observacao_geral ?? "")} disabled={locked} />
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-xl font-black">Servicos confirmados</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Confira o que entrou na ordem de servico.</p>
            </div>
            <div className="grid gap-2">
              {servicos.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum servico detalhado vinculado.</p> : null}
              {servicos.map((servico) => (
                <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-[1fr_auto]" key={String(servico.id)}>
                  <input name="checklist_servico_ids" type="hidden" value={String(servico.id)} />
                  <div className="min-w-0">
                    <strong className="block break-words">{String(servico.descricao)}</strong>
                    <input className="input mt-2 bg-white" disabled={locked} name={`servico_${servico.id}_observacao`} defaultValue={String(servico.observacao ?? "")} placeholder="Observacao opcional" />
                  </div>
                  <label className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-black">
                    <input disabled={locked} name={`servico_${servico.id}_conferido`} type="checkbox" defaultChecked={servico.conferido !== false} />
                    Conferido
                  </label>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={locked} name="intent" type="submit" value="save">Salvar rascunho</button>
            <button className="button-primary" disabled={locked} name="intent" type="submit" value="concluir">Concluir checklist</button>
          </div>
        </form>

        <PhotoSection
          canDelete={!locked}
          canUpload={!locked}
          description="Use a camera do celular ou anexe imagens da galeria antes de concluir o checklist."
          emptyText="Nenhuma foto de entrada anexada ainda."
          fotos={entradaFotos}
          lavagemId={String(lavagem.id)}
          momento="entrada"
          photoTypes={photoTypes}
          title="Fotos de entrada / Antes"
        />

        {showCheckout ? (
          <PhotoSection
            canDelete={canUploadCheckout && !isDelivered}
            canUpload={canUploadCheckout && !isDelivered}
            description={isDelivered ? "Lavagem entregue: as fotos de checkout ficam apenas para consulta." : "Registre o estado final antes da retirada ou entrega ao cliente."}
            emptyText="Nenhuma foto de checkout anexada ainda."
            fotos={checkoutFotos}
            lavagemId={String(lavagem.id)}
            momento="checkout"
            photoTypes={photoTypes}
            title="Fotos de checkout / Depois"
          />
        ) : null}
      </section>
    </LavaGestorShell>
  );
}

function PhotoSection({
  title,
  description,
  emptyText,
  fotos,
  lavagemId,
  momento,
  canUpload,
  canDelete,
  photoTypes
}: {
  title: string;
  description: string;
  emptyText: string;
  fotos: Record<string, unknown>[];
  lavagemId: string;
  momento: "entrada" | "checkout";
  canUpload: boolean;
  canDelete: boolean;
  photoTypes: { value: string; label: string }[];
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm" id={`fotos-${momento}`}>
      <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-black">{fotos.length} foto(s)</span>
          <LavaSyncPendingButton compact lavagemId={lavagemId} returnTo={`/lavagestor/checklists/${lavagemId}#fotos-${momento}`} />
        </div>
      </div>

      {canUpload ? (
        <form action={uploadLavaChecklistFoto} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input name="lavagem_id" type="hidden" value={lavagemId} />
          <input name="momento" type="hidden" value={momento} />
          <label className="grid gap-2">
            <span className="text-sm font-black">Tipo de foto</span>
            <select className="input" name="tipo">
              {photoTypes.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black">Foto</span>
            <input accept="image/*" capture="environment" className="input min-h-12 bg-white" name="foto" type="file" required />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-black">Legenda</span>
            <input className="input" name="legenda" placeholder="Opcional" />
          </label>
          <PhotoUploadSubmitButton idleLabel={momento === "checkout" ? "Tirar foto depois" : "Tirar foto antes"} />
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fotos.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground sm:col-span-2 lg:col-span-3">{emptyText}</p> : null}
        {fotos.map((foto) => (
          <LavaPhotoCard
            foto={foto}
            key={String(foto.id)}
            returnTo={`/lavagestor/checklists/${lavagemId}#fotos-${momento}`}
            subtitle={foto.legenda ? String(foto.legenda) : undefined}
            title={photoTypeLabel(String(foto.tipo))}
          >
              {canDelete ? (
                <form action={deleteLavaChecklistFoto}>
                  <input name="lavagem_id" type="hidden" value={lavagemId} />
                  <input name="foto_id" type="hidden" value={String(foto.id)} />
                  <button className="button-danger w-full" type="submit">Excluir foto</button>
                </form>
              ) : null}
          </LavaPhotoCard>
        ))}
      </div>
    </section>
  );
}

function Toggle({ label, name, checked, disabled }: { label: string; name: string; checked: boolean; disabled: boolean }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-white px-3 text-sm font-black"><input disabled={disabled} name={name} type="checkbox" defaultChecked={checked} />{label}</label>;
}

function Field({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" disabled={disabled} name={name} defaultValue={defaultValue} /></label>;
}

function TextArea({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <label className="grid gap-2 md:col-span-2"><span className="text-sm font-black">{label}</span><textarea className="input min-h-24 resize-y" disabled={disabled} name={name} defaultValue={defaultValue} /></label>;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function photoTypeLabel(value: string) {
  return LAVA_CHECKLIST_PHOTO_TYPES.find((item) => item.value === value)?.label ?? value;
}

function photoTypeOptions(values: unknown) {
  const configured = Array.isArray(values) ? values.map(String).filter(Boolean) : [];
  const known = new Map(LAVA_CHECKLIST_PHOTO_TYPES.map((item) => [item.value, item.label]));
  const items = configured.length ? configured : LAVA_CHECKLIST_PHOTO_TYPES.map((item) => item.value);
  return items.map((value) => ({ value, label: known.get(value) ?? value.replaceAll("_", " ") }));
}
