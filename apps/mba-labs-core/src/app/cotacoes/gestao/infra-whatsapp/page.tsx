import { redirect } from "next/navigation";

// A configuração do WhatsApp deve ocorrer exclusivamente no acesso da
// farmácia. Credenciais da infraestrutura não devem ser exibidas no painel.
export default function InfraWhatsApp() {
  redirect("/cotacoes/gestao");
}
