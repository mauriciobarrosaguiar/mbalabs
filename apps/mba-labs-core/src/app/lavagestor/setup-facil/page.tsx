import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { EasySetupWizard } from "@/components/lavagestor/EasySetupWizard";
import { BackButton, MessageBanner, PageHeader } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { getLavaSetupFacilPageData } from "@/lib/lavagestor-setup-facil-data";

export const dynamic = "force-dynamic";

export default async function LavaSetupFacilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaSetupFacilPageData();

  return (
    <LavaGestorShell activePath="/lavagestor/setup-facil" companyName={data.companyName}>
      <section className="grid gap-5 pb-24">
        <PageHeader
          eyebrow="LavaGestor"
          title="Configuracao Facil / IA + WhatsApp automatico"
          description="Ative Gemini e WhatsApp automatico em etapas simples, com avancado escondido para quando precisar."
          actions={<><BackButton href="/lavagestor" /><Link className="button-secondary" href="/lavagestor/configuracoes">Configuracoes</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error)} />
        <EasySetupWizard data={data} initialStep={firstParam(params.step)} />
      </section>
    </LavaGestorShell>
  );
}
