import { WhatsappMbaCotacoesSettingsPage } from "@/modules/cotacoes/components/settings/whatsapp-settings-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 180;

/**
 * Somente o administrador master configura endereço e chave da infraestrutura.
 * QR Codes, sessões e números de WhatsApp são geridos no acesso de cada farmácia.
 */
export default async function InfraWhatsApp({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <WhatsappMbaCotacoesSettingsPage
      currentPath="/cotacoes/gestao/infra-whatsapp"
      subtitle="Administração master · infraestrutura compartilhada"
      searchParams={searchParams}
    />
  );
}
