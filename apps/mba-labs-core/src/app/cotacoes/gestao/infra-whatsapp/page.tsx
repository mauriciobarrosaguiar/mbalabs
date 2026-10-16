import { WhatsappMbaCotacoesSettingsPage } from "@/modules/cotacoes/components/settings/whatsapp-settings-page";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function InfraWhatsApp({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <WhatsappMbaCotacoesSettingsPage
    searchParams={searchParams}
    currentPath="/cotacoes/gestao/infra-whatsapp"
    subtitle="Infraestrutura · Admin MBA Cotações"
  />;
}
