import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, PageHeader } from "@/components/ui-kit";

export const dynamic = "force-dynamic";

const settings = [
  "Toda nova lavagem entra como Na fila.",
  "O veículo só deve ser entregue com pagamento pago, fiado marcado ou liberação manual do Admin.",
  "Comissões são registradas por serviço na estrutura de dados do LavaGestor.",
  "Mensagens de WhatsApp usam links wa.me para entrada, veículo pronto e entrega."
];

export default function ConfiguracoesPage() {
  return (
    <LavaGestorShell activePath="/lavagestor/configuracoes">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Configurações"
          description="Regras operacionais atuais do fluxo de lavagem."
          actions={<BackButton href="/lavagestor" />}
        />

        <div className="panel grid gap-3 p-5">
          {settings.map((item) => (
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm font-semibold" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>
    </LavaGestorShell>
  );
}
