import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { FilaKanbanClient } from "@/components/lavagestor/FilaKanbanClient";
import { LavaSyncPendingButton } from "@/components/lavagestor/LavaPhotoCard";
import { MessageBanner, PageHeader } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";

export const dynamic = "force-dynamic";

export default async function FilaLavagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [{ rows, error }, { config, error: configError }] = await Promise.all([listLavaFila(), getLavaConfiguracoesEmpresa()]);

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
        <FilaKanbanClient rows={rows} config={config as Record<string, unknown>} />
      </section>
    </LavaGestorShell>
  );
}
