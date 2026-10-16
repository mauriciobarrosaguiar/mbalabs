import { redirect } from "next/navigation";

// Compatibilidade com link antigo do admin master: conexão é feita no cliente.
export default function AdminWhatsappMbaCotacoesPage() {
  redirect("/cotacoes/gestao/infra-whatsapp");
}
