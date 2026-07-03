"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, Play, Settings2 } from "lucide-react";
import {
  finishEasySetupAction,
  saveEasyWhatsappModeAction,
  sendEasyIntegratedTestAction,
  startEasySetupAction
} from "@/lib/actions/lavagestor-setup-facil-actions";
import { EvolutionQrPanel } from "./EvolutionQrPanel";
import { GeminiKeyGuide } from "./GeminiKeyGuide";
import { SetupStatusCards } from "./SetupStatusCards";

type EasySetupWizardProps = {
  data: any;
  initialStep?: string;
};

const steps = [
  { id: "ia", label: "Ativar IA" },
  { id: "whatsapp", label: "Conectar WhatsApp" },
  { id: "teste", label: "Fazer teste" },
  { id: "pronto", label: "Pronto para usar" }
];

export function EasySetupWizard({ data, initialStep }: EasySetupWizardProps) {
  const [step, setStep] = useState(normalizeStep(initialStep));
  const [pendingForm, setPendingForm] = useState<"start" | "whatsapp" | "test" | "finish" | "">("");
  const integration = data.whatsappIntegration;
  const aiMode = data.aiMode;
  const supportMode = data.perfil === "admin_master";
  const providerDefault = integration.provider !== "manual" ? integration.provider : data.evolutionManager.configured || data.evolutionManager.apiUrl ? "evolution" : "manual";
  const hasWhatsappSetup = integration.provider !== "manual" || Boolean(integration.instanciaId) || integration.status !== "inativo";

  return (
    <div className="grid min-w-0 gap-5">
      <SetupStatusCards cards={data.statusCards} />

      {!data.canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
          Seu perfil pode visualizar este setup, mas somente admin da empresa ou admin master pode alterar.
        </div>
      ) : null}

      <form action={startEasySetupAction} className="flex flex-wrap gap-2" onSubmit={() => setPendingForm("start")}>
        <button className="button-primary" disabled={!data.canEdit || Boolean(pendingForm)} type="submit">
          <Play className="h-4 w-4" aria-hidden />
          {pendingForm === "start" ? "Iniciando..." : "Iniciar configuração fácil"}
        </button>
      </form>

      <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Etapas da configuração fácil">
        {steps.map((item, index) => {
          const active = step === item.id;
          return (
            <button
              className={`min-h-14 rounded-xl border px-3 text-left text-sm font-black transition ${active ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-border bg-white hover:bg-muted"}`}
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
            >
              <span className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">0{index + 1}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {step === "ia" ? (
        <GeminiKeyGuide
          canEdit={data.canEdit}
          active={aiMode.active}
          apiKeyConfigured={aiMode.connection.apiKeyConfigured}
          status={aiMode.connection.status}
          model={aiMode.connection.model}
          lastError={aiMode.connection.ultimoErro || data.setup.lastError}
          demo={data.geminiDemo}
        />
      ) : null}

      {step === "whatsapp" ? (
        <div className="grid gap-4">
          <EvolutionQrPanel canEdit={data.canEdit} showDiagnostics={supportMode} manager={data.evolutionManager} integration={integration} />
          <form action={saveEasyWhatsappModeAction} className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm" onSubmit={() => setPendingForm("whatsapp")}>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Modo de envio</p>
              <h2 className="text-2xl font-black">Escolher automação</h2>
              {!supportMode ? (
                <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                  A configuração técnica do WhatsApp é gerenciada pela MBA Labs. Você só escolhe como quer aprovar os envios.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <RadioCard name="modo_envio" value="manual" title="Manual" text="Abre o WhatsApp com mensagem pronta." checked={integration.modoEnvio === "manual"} />
              <RadioCard name="modo_envio" value="automatico_com_aprovacao" title="Com aprovação" text="A IA prepara e alguém aprova antes de enviar." checked={integration.modoEnvio !== "automatico_total" && integration.modoEnvio !== "manual"} recommended />
              <RadioCard name="modo_envio" value="automatico_total" title="Automático" text="Envia sozinho quando as regras permitirem." checked={integration.modoEnvio === "automatico_total"} />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Toggle name="enviar_agendamento_auto" label="Confirmar agendamento" checked={flagDefault(integration.eventFlags.confirmacao_agendamento, true, hasWhatsappSetup)} />
              <Toggle name="enviar_lembrete_auto" label="Lembrar agendamento" checked={flagDefault(integration.eventFlags.lembrete_agendamento, true, hasWhatsappSetup)} />
              <Toggle name="enviar_veiculo_pronto_auto" label="Veículo pronto" checked={flagDefault(integration.eventFlags.veiculo_pronto, true, hasWhatsappSetup)} />
              <Toggle name="enviar_cobranca_auto" label="Cobrança" checked={integration.eventFlags.cobranca_fiado === true} />
              <Toggle name="enviar_promocao_auto" label="Promoção" checked={integration.eventFlags.promocao === true} />
            </div>

            {!supportMode ? (
              <input type="hidden" name="provider" value={providerDefault} />
            ) : (
              <details className="rounded-xl border border-border bg-muted/30">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 font-black [&::-webkit-details-marker]:hidden">
                  <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                  Configurações avançadas — suporte MBA Labs
                </summary>
                <div className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
                  <Field label="Evolution URL" name="api_url" defaultValue={integration.apiUrl || data.evolutionManager.apiUrl} />
                  <Field label="Instância" name="instancia_id" defaultValue={integration.instanciaId} />
                  <Field label="Número da empresa" name="numero" defaultValue={integration.numero} />
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Provider</span>
                    <select className="input" name="provider" defaultValue={providerDefault}>
                      <option value="manual">Manual / wa.me</option>
                      <option value="evolution">Evolution API</option>
                    </select>
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-sm font-black">Evolution API Key</span>
                    <input className="input" name="api_key" type="password" autoComplete="new-password" placeholder={integration.apiKeyConfigured ? "Configurada. Preencha apenas para trocar." : "Cole a API Key da Evolution"} />
                  </label>
                  <div className="rounded-lg bg-white p-3 text-xs font-semibold leading-5 text-muted-foreground md:col-span-2">
                    Gemini: provider gemini, modelo {aiMode.connection.model}. Evolution central: URL {data.evolutionManager.apiUrl || "não configurada"}, prefixo {data.evolutionManager.prefix}.
                  </div>
                </div>
              </details>
            )}

            <button className="button-primary w-full sm:w-fit" disabled={!data.canEdit || Boolean(pendingForm)} type="submit">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {pendingForm === "whatsapp" ? "Salvando..." : "Salvar modo do WhatsApp"}
            </button>
          </form>
        </div>
      ) : null}

      {step === "teste" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Passo 3</p>
            <h2 className="text-2xl font-black">Fazer teste</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Se o WhatsApp automático estiver conectado, o envio sai pela Evolution. Caso contrário, abre o wa.me.</p>
          </div>
          <form action={sendEasyIntegratedTestAction} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end" onSubmit={() => setPendingForm("test")}>
            <label className="grid gap-2">
              <span className="text-sm font-black">WhatsApp para teste</span>
              <input className="input" name="telefone_teste" inputMode="tel" placeholder="Ex.: 63999999999" disabled={!data.canEdit || Boolean(pendingForm)} required />
            </label>
            <button className="button-primary" disabled={!data.canEdit || Boolean(pendingForm)} type="submit">
              <MessageCircle className="h-4 w-4" aria-hidden />
              {pendingForm === "test" ? "Enviando..." : "Enviar teste"}
            </button>
          </form>
          {pendingForm === "test" ? <p className="rounded-xl bg-muted p-3 text-sm font-semibold text-muted-foreground">Mensagem recebida. Aguarde o envio...</p> : null}
          {data.lastWhatsappTest ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold leading-6">
              <strong className="block">Último teste: {data.lastWhatsappTest.status}</strong>
              <span className="block break-words text-muted-foreground">{data.lastWhatsappTest.message}</span>
              {data.lastWhatsappTest.error ? <span className="mt-2 block break-words text-red-700">{data.lastWhatsappTest.error}</span> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "pronto" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Passo 4</p>
            <h2 className="text-2xl font-black">Pronto para usar</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <CheckItem label="IA Gemini" ok={aiMode.active} value={data.statusCards.ia} />
            <CheckItem label="WhatsApp" ok={data.statusCards.whatsapp === "Conectado"} value={data.statusCards.whatsapp} />
            <CheckItem label="Modo de envio" ok={integration.modoEnvio !== "manual"} value={data.statusCards.envio} />
            <CheckItem label="Teste integrado" ok={Boolean(data.setup.lastTestAt || data.lastWhatsappTest)} value={data.setup.lastTestAt || data.lastWhatsappTest?.createdAt || "Pendente"} />
          </div>
          <form action={finishEasySetupAction} onSubmit={() => setPendingForm("finish")}>
            <button className="button-primary w-full sm:w-fit" disabled={!data.canEdit || Boolean(pendingForm)} type="submit">
              {pendingForm === "finish" ? "Finalizando..." : "Finalizar setup"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function normalizeStep(value?: string) {
  return steps.some((item) => item.id === value) ? String(value) : "ia";
}

function flagDefault(value: boolean, fallback: boolean, hasSavedSetup: boolean) {
  return hasSavedSetup ? value === true : fallback;
}

function RadioCard({ name, value, title, text, checked, recommended = false }: { name: string; value: string; title: string; text: string; checked: boolean; recommended?: boolean }) {
  return (
    <label className="grid min-h-32 cursor-pointer gap-2 rounded-xl border border-border bg-muted/30 p-3 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
      <span className="flex items-start justify-between gap-2">
        <span className="font-black">{title}</span>
        <input name={name} type="radio" value={value} defaultChecked={checked} />
      </span>
      {recommended ? <span className="w-fit rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-900">Recomendado</span> : null}
      <span className="text-xs font-semibold leading-5 text-muted-foreground">{text}</span>
    </label>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 text-sm font-black">
      <span>{label}</span>
      <input className="h-5 w-5" name={name} type="checkbox" defaultChecked={checked} />
    </label>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <input className="input" name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function CheckItem({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <strong className="mt-1 block break-words text-sm">{value}</strong>
    </div>
  );
}
