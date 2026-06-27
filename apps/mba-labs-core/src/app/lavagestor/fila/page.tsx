import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { FilaKanbanClient } from "@/components/lavagestor/FilaKanbanClient";
import { BackButton, MessageBanner, PageHeader } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";

export const dynamic = "force-dynamic";

export default async function FilaLavagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [{ rows, error }, { config, error: configError }] = await Promise.all([listLavaFila(), getLavaConfiguracoesEmpresa()]);

  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={config.nome_exibicao}>
      <section className="grid max-w-full gap-6 overflow-x-hidden">
        <PageHeader
          eyebrow="LavaGestor"
          title="Fila de lavagem"
          description="Kanban por etapa, com prioridade automática. Arraste os cards para avançar a lavagem."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-primary" href="/lavagestor/nova-lavagem">Nova lavagem</Link>
            </>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? configError ?? undefined} />
        <FilaKanbanClient rows={rows} config={config as Record<string, unknown>} />
      </section>
    </LavaGestorShell>
  );
}
