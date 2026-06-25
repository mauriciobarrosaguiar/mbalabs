import { WhatsappMbaCotacoesSettingsPage } from "@/modules/cotacoes/components/settings/whatsapp-settings-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WhatsappMbaCotacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <WhatsappMbaCotacoesSettingsPage
      searchParams={searchParams}
      currentPath="/cotacoes/configuracoes/whatsapp"
      subtitle="Admin Master MBA Labs"
    />
  );
}
