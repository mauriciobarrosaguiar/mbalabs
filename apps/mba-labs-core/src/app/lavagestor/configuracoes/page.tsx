import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { MessageTemplateEditor } from "@/components/lavagestor/MessageTemplateEditor";
import { BackButton, MessageBanner, PageHeader } from "@/components/ui-kit";
import { requireAppAccess } from "@/lib/core-data";
import { removeLavaAiConnectionAction, saveLavaAiSettingsAction, testLavaAiConnectionAction } from "@/lib/actions/lavagestor-ai-actions";
import { saveLavaConfiguracoesEmpresa } from "@/lib/actions/lavagestor-configuracoes-actions";
import { saveLavaWhatsappIntegrationAction, testLavaWhatsappIntegrationAction } from "@/lib/actions/lavagestor-whatsapp-actions";
import { firstParam } from "@/lib/form-utils";
import { betterGeminiModel, defaultGeminiModel, getLavaAiMode } from "@/lib/lavagestor-ai";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";
import { getLavaStorageOverview, lavaStorageProviderLabel, type LavaStorageProvider } from "@/lib/lavagestor-storage";
import { getWhatsappIntegration, type WhatsappIntegrationView } from "@/lib/lavagestor-whatsapp";

export const dynamic = "force-dynamic";

export default async function LavaConfiguracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const params = await searchParams;
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  const requestOrigin = await getRequestOrigin();
  const [{ config, error }, storageOverview, aiMode, whatsappIntegration] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    getLavaStorageOverview(current, requestOrigin).catch((storageError) => ({
      connections: [],
      pendingCount: 0,
      errorCount: 0,
      error: storageError instanceof Error ? storageError.message : "Não foi possível carregar armazenamento."
    })),
    getLavaAiMode(current).catch((aiError) => ({
      active: false,
      mode: "regras" as const,
      label: "IAMob em modo regras",
      allowPhotoAnalysis: false,
      allowPlateReading: false,
      connection: {
        provider: "gemini" as const,
        status: "erro" as const,
        model: configSafeModel(),
        accountHint: "",
        ultimoTesteEm: null,
        ultimoErro: aiError instanceof Error ? aiError.message : "Nao foi possivel carregar IA.",
        usoTotal: 0,
        apiKeyConfigured: false
      },
      error: aiError instanceof Error ? aiError.message : "Nao foi possivel carregar IA."
    })),
    getWhatsappIntegration(current)
  ]);
  const color = config.cor_principal || "#059669";

  return (
    <LavaGestorShell activePath="/lavagestor/configuracoes" companyName={config.nome_exibicao}>
      <section className="grid gap-5 pb-24">
        <PageHeader
          eyebrow="LavaGestor"
          title="Configurações"
          description="Deixe o LavaGestor com a cara da empresa: recibo, WhatsApp, relatório, comissão e regras de pagamento."
          actions={<><BackButton href="/lavagestor" /><Link className="button-primary" href="/lavagestor/setup-facil">Configuracao Facil IA + WhatsApp</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? ("error" in storageOverview ? storageOverview.error : undefined) ?? undefined} />

        <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Setup guiado</p>
            <h2 className="mt-1 text-xl font-black">IA + WhatsApp automatico em poucos passos</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">Use o modo simples para ativar Gemini, conectar WhatsApp e fazer um teste sem mexer nas configuracoes avancadas.</p>
          </div>
          <Link className="button-primary justify-center" href="/lavagestor/setup-facil">Configurar agora</Link>
        </div>

        <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Prévia da empresa</p>
            <h2 className="mt-2 break-words text-3xl font-black" style={{ color }}>{config.nome_exibicao || "Nome do lava-jato"}</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Esse nome aparecerá no sistema, recibos, relatórios e mensagens.</p>
          </div>
          <div className="grid gap-2 rounded-xl border border-border bg-white p-3 text-sm font-bold shadow-sm">
            <span>{config.whatsapp || "WhatsApp não informado"}</span>
            <span className="text-muted-foreground">{[config.cidade, config.estado].filter(Boolean).join(" - ") || "Cidade / UF"}</span>
          </div>
        </div>

        <StorageSection overview={storageOverview} />
        <AiRealSection aiMode={aiMode} config={config} />
        <WhatsappAutomationSection integration={whatsappIntegration} whatsapp={config.whatsapp} />

        <form action={saveLavaConfiguracoesEmpresa} className="grid gap-4">
          <ConfigBlock badge="01" title="Empresa" description="Dados que aparecem no cabeçalho, recibo e relatório." defaultOpen>
            <Field label="Nome no sistema" name="nome_exibicao" defaultValue={config.nome_exibicao} required wide />
            <Field label="Nome fantasia" name="nome_fantasia" defaultValue={config.nome_fantasia} />
            <Field label="CNPJ / CPF" name="documento" defaultValue={config.documento} />
            <Field label="WhatsApp principal" name="whatsapp" defaultValue={config.whatsapp} placeholder="Ex.: 63999999999" />
            <Field label="Telefone secundário" name="telefone" defaultValue={config.telefone} placeholder="Opcional" />
            <Field label="Endereço" name="endereco" defaultValue={config.endereco} wide />
            <Field label="Cidade" name="cidade" defaultValue={config.cidade} />
            <Field label="UF" name="estado" defaultValue={config.estado} placeholder="TO" />
            <Field label="Logo opcional por URL" name="logo_url" defaultValue={config.logo_url} placeholder="https://..." helper="Depois podemos trocar isso por upload direto da imagem." wide />
          </ConfigBlock>

          <ConfigBlock badge="02" title="Financeiro" description="Padrões usados ao criar lavagem, pagar comissão e receber do cliente." defaultOpen>
            <Field label="Comissão padrão (%)" name="percentual_comissao_padrao" defaultValue={String(config.percentual_comissao_padrao)} type="number" step="0.01" />
            <label className="grid gap-2">
              <span className="text-sm font-black">Pagamento padrão</span>
              <select className="input" name="forma_pagamento_padrao" defaultValue={config.forma_pagamento_padrao}>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="transferencia">Transferência</option>
                <option value="fiado">Fiado</option>
              </select>
            </label>
            <Field label="Chave PIX" name="chave_pix" defaultValue={config.chave_pix} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" wide />
            <Toggle label="Permitir fiado" description="Mostra a opção fiado nos pagamentos." name="permitir_fiado" defaultChecked={config.permitir_fiado} />
            <Toggle label="Permitir desconto" description="Se desligar, o sistema zera desconto ao salvar." name="permitir_desconto" defaultChecked={config.permitir_desconto} />
            <Toggle label="Bloquear entrega sem pagamento" description="Recibo e entrega ficam protegidos até pagar." name="bloquear_entrega_sem_pagamento" defaultChecked={config.bloquear_entrega_sem_pagamento} />
            <Toggle label="Exigir checklist antes de finalizar" description="Impede finalizar lavagem sem checklist concluído." name="exigir_checklist_antes_finalizar" defaultChecked={config.exigir_checklist_antes_finalizar} />
            <Toggle label="Exigir checklist antes de entregar" description="Impede entrega sem checklist concluído." name="exigir_checklist_antes_entregar" defaultChecked={config.exigir_checklist_antes_entregar} />
            <Toggle label="Exigir foto de entrada" description="Impede concluir checklist sem pelo menos uma foto antes." name="exigir_foto_entrada" defaultChecked={config.exigir_foto_entrada} />
            <Toggle label="Permitir checklist sem foto" description="Libera exceção manual para concluir entrada sem foto." name="permitir_concluir_checklist_sem_foto" defaultChecked={config.permitir_concluir_checklist_sem_foto} />
            <Toggle label="Exigir checkout antes da entrega" description="Impede entregar sem foto final do veículo/item." name="exigir_foto_checkout_antes_entrega" defaultChecked={config.exigir_foto_checkout_antes_entrega} />
            <Toggle label="Permitir recibo sem checklist" description="Se desligar, recibo pago também exige checklist concluído." name="permitir_recibo_sem_checklist" defaultChecked={config.permitir_recibo_sem_checklist} />
          </ConfigBlock>

          <ConfigBlock badge="03" title="Operação" description="Listas usadas dentro da fila e da nova lavagem.">
            <Field label="Abertura da agenda" name="horario_abertura" defaultValue={config.horario_abertura} type="time" />
            <Field label="Fechamento da agenda" name="horario_fechamento" defaultValue={config.horario_fechamento} type="time" />
            <Field label="Intervalo da agenda (min)" name="intervalo_agenda_min" defaultValue={String(config.intervalo_agenda_min)} type="number" step="5" />
            <TextArea label="Motivos de cancelamento" name="motivos_cancelamento" defaultValue={config.motivos_cancelamento.join("\n")} helper="Um motivo por linha. Ex.: Cliente desistiu." />
            <TextArea label="Tipos de entrega" name="tipos_entrega" defaultValue={config.tipos_entrega.join("\n")} helper="Um tipo por linha. Ex.: Cliente retira / Levar ao cliente." />
            <TextArea label="Itens padrão do checklist" name="checklist_itens_padrao" defaultValue={config.checklist_itens_padrao.join("\n")} helper="Um item por linha para orientar a conferência." />
            <TextArea label="Tipos de foto do checklist" name="checklist_tipos_foto" defaultValue={config.checklist_tipos_foto.join("\n")} helper="Use códigos como frente, traseira, avaria, antes, depois." />
            <TextArea label="Fotos de entrada obrigatórias" name="fotos_entrada_obrigatorias" defaultValue={config.fotos_entrada_obrigatorias.join("\n")} helper="Opcional. Um código por linha, como frente, traseira ou painel_km." />
          </ConfigBlock>

          <ConfigBlock badge="04" title="WhatsApp" description="Textos enviados ao cliente. Toque numa mensagem e depois numa variável para inserir.">
            <MessageTemplateEditor readyDefault={config.mensagem_veiculo_pronto} receiptDefault={config.mensagem_recibo} />
            <TextArea compact label="Agendamento: confirmação" name="mensagem_confirmacao_agendamento" defaultValue={config.mensagem_confirmacao_agendamento} />
            <TextArea compact label="Pos-venda: agradecimento" name="mensagem_pos_venda_agradecimento" defaultValue={config.mensagem_pos_venda_agradecimento} />
            <TextArea compact label="Pos-venda: pesquisa de satisfação" name="mensagem_pesquisa_satisfacao" defaultValue={config.mensagem_pesquisa_satisfacao} />
            <TextArea compact label="Pos-venda: lembrete de retorno" name="mensagem_retorno" defaultValue={config.mensagem_retorno} />
            <TextArea compact label="Pos-venda: cobrança de fiado" name="mensagem_cobranca_fiado" defaultValue={config.mensagem_cobranca_fiado} />
            <TextArea compact label="Pos-venda: promoção" name="mensagem_promocao" defaultValue={config.mensagem_promocao} />
          </ConfigBlock>

          <ConfigBlock badge="05" title="Identidade visual" description="Cor e aparência do LavaGestor para esta empresa.">
            <label className="grid gap-2">
              <span className="text-sm font-black">Cor principal</span>
              <div className="grid grid-cols-[72px_1fr] gap-3">
                <input className="h-14 w-full rounded-xl border border-border bg-white p-1" name="cor_principal" type="color" defaultValue={color} />
                <input className="input font-black" defaultValue={color} readOnly aria-label="Código da cor principal" />
              </div>
            </label>
            <div className="rounded-2xl border border-border bg-muted p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Como vai aparecer</p>
              <div className="mt-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-3 h-2 w-20 rounded-full" style={{ backgroundColor: color }} />
                <h3 className="break-words text-3xl font-black" style={{ color }}>{config.nome_exibicao || "Nome da empresa"}</h3>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Recibos, relatórios e WhatsApp usarão essa identidade.</p>
              </div>
            </div>
          </ConfigBlock>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-100 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border md:p-4">
            <button className="button-primary w-full" type="submit">Salvar configurações</button>
          </div>
        </form>
      </section>
    </LavaGestorShell>
  );
}

type StorageOverview = Awaited<ReturnType<typeof getLavaStorageOverview>> | { connections: Record<string, unknown>[]; pendingCount: number; errorCount: number; error: string; oauth?: Record<string, unknown>[]; lastSyncErrors?: Record<string, unknown>[] };

function AiRealSection({ aiMode, config }: { aiMode: Awaited<ReturnType<typeof getLavaAiMode>>; config: { iamob_model: string; iamob_modo: string; iamob_permitir_analise_foto: boolean; iamob_permitir_leitura_placa: boolean } }) {
  const connection = aiMode.connection;
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">IAMob com IA real</p>
          <h2 className="mt-1 text-xl font-black">Gemini API por empresa</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Use uma chave criada pela propria conta Google/Gmail da empresa no Google AI Studio. A MBA Labs nao paga o consumo da IA do cliente.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${connection.status === "conectado" ? "bg-emerald-50 text-emerald-900" : connection.status === "erro" ? "bg-red-50 text-red-900" : "bg-muted text-muted-foreground"}`}>
          {aiMode.label}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <InfoTile label="Status Gemini" value={connection.status} />
        <InfoTile label="API Key" value={connection.apiKeyConfigured ? "Configurada" : "Nao configurada"} />
        <InfoTile label="Modelo" value={connection.model || config.iamob_model || defaultGeminiModel()} />
        <InfoTile label="Uso aproximado" value={String(connection.usoTotal)} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
        No plano gratuito da Gemini API, evite enviar dados sensiveis, documentos confidenciais ou informacoes pessoais desnecessarias.
      </div>

      {connection.ultimoErro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-950">
          <strong className="block text-xs uppercase tracking-[0.1em]">Ultimo erro</strong>
          <span className="break-words">{connection.ultimoErro}</span>
        </div>
      ) : null}

      <form action={saveLavaAiSettingsAction} className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">Modo</span>
          <select className="input" name="iamob_modo" defaultValue={aiMode.mode || config.iamob_modo || "regras"}>
            <option value="regras">Regras internas</option>
            <option value="gemini">Gemini API</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Modelo</span>
          <input className="input" list="gemini-models" name="iamob_model" defaultValue={connection.model || config.iamob_model || defaultGeminiModel()} />
          <datalist id="gemini-models">
            <option value={defaultGeminiModel()} />
            <option value={betterGeminiModel()} />
          </datalist>
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-black">API Key Gemini</span>
          <input className="input" name="gemini_api_key" placeholder={connection.apiKeyConfigured ? "Chave configurada. Preencha apenas para trocar." : "Cole a API Key criada no Google AI Studio"} type="password" autoComplete="new-password" />
        </label>
        <Toggle label="Permitir analise de fotos" description="Libera o botao Analisar foto com IAMob nos checklists." name="iamob_permitir_analise_foto" defaultChecked={aiMode.allowPhotoAnalysis || config.iamob_permitir_analise_foto} />
        <Toggle label="Permitir leitura de placa por IA" description="Libera Ler placa com IAMob na tela de placa." name="iamob_permitir_leitura_placa" defaultChecked={aiMode.allowPlateReading || config.iamob_permitir_leitura_placa} />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="button-primary" type="submit">Salvar chave</button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={testLavaAiConnectionAction}>
          <button className="button-secondary" disabled={!connection.apiKeyConfigured} type="submit">Testar IA</button>
        </form>
        <form action={removeLavaAiConnectionAction}>
          <button className="button-danger" disabled={!connection.apiKeyConfigured} type="submit">Remover chave</button>
        </form>
        <a className="button-secondary" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>
      </div>
    </section>
  );
}

function WhatsappAutomationSection({ integration, whatsapp }: { integration: WhatsappIntegrationView; whatsapp?: string | null }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">WhatsApp automatico com IA</p>
          <h2 className="mt-1 text-xl font-black">Manual, aprovacao ou automatico total</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Se o WhatsApp automatico nao estiver configurado, o LavaGestor continuara usando envio manual pelo wa.me.</p>
        </div>
        <a className="button-secondary" href="/lavagestor/whatsapp">Abrir fila</a>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <InfoTile label="Status" value={integration.status} />
        <InfoTile label="Provider" value={providerLabel(integration.provider)} />
        <InfoTile label="Modo" value={modeLabel(integration.modoEnvio)} />
        <InfoTile label="Numero" value={integration.numero || whatsapp || "Nao informado"} />
      </div>

      {integration.ultimoErro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-950">
          <strong className="block text-xs uppercase tracking-[0.1em]">Ultimo erro</strong>
          <span className="break-words">{integration.ultimoErro}</span>
        </div>
      ) : null}

      <form action={saveLavaWhatsappIntegrationAction} className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">Modo de envio</span>
          <select className="input" name="modo_envio" defaultValue={integration.modoEnvio}>
            <option value="manual">Manual</option>
            <option value="automatico_com_aprovacao">Automatico com aprovacao</option>
            <option value="automatico_total">Automatico total</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Provedor</span>
          <select className="input" name="provider" defaultValue={integration.provider}>
            <option value="manual">Manual / wa.me</option>
            <option value="evolution">Evolution API</option>
            <option value="whatsapp_cloud_api">WhatsApp Cloud API oficial</option>
          </select>
        </label>
        <Field label="Numero da empresa" name="numero" defaultValue={integration.numero || whatsapp || ""} placeholder="Ex.: 5563999999999" />
        <Field label="Nome de exibicao" name="nome_exibicao" defaultValue={integration.nomeExibicao} />
        <Field label="Evolution API URL" name="api_url" defaultValue={integration.apiUrl} placeholder="https://sua-evolution-api.com" />
        <Field label="Instancia Evolution" name="instancia_id" defaultValue={integration.instanciaId} />
        <SecretField label="Evolution API Key" name="api_key" configured={integration.apiKeyConfigured} />
        <Field label="Phone Number ID" name="phone_number_id" defaultValue={integration.phoneNumberId} />
        <Field label="Business Account ID" name="business_account_id" defaultValue={integration.businessAccountId} />
        <SecretField label="Access Token Cloud API" name="access_token" configured={integration.accessTokenConfigured} />
        <SecretField label="Webhook Secret" name="webhook_secret" configured={integration.webhookSecretConfigured} />
        <Toggle label="Usar IAMob/Gemini nas mensagens" description="Se falhar, usa o modelo padrao." name="usar_ia_para_mensagens" defaultChecked={integration.usarIaParaMensagens} />
        <Toggle label="Exigir aprovacao" description="Recomendado para mensagens geradas por IA." name="exigir_aprovacao" defaultChecked={integration.exigirAprovacao} />
        <Toggle label="Confirmacao de agendamento" description="Criar/enviar confirmacao automaticamente." name="enviar_agendamento_auto" defaultChecked={integration.eventFlags.confirmacao_agendamento} />
        <Toggle label="Lembrete de agendamento" description="Preparar lembretes futuros." name="enviar_lembrete_auto" defaultChecked={integration.eventFlags.lembrete_agendamento} />
        <Toggle label="Veiculo recebido" description="Avisar entrada da lavagem." name="enviar_veiculo_recebido_auto" defaultChecked={integration.eventFlags.lavagem_recebida} />
        <Toggle label="Checklist concluido" description="Avisar checklist ao cliente." name="enviar_checklist_auto" defaultChecked={integration.eventFlags.checklist_concluido} />
        <Toggle label="Veiculo pronto" description="Evento principal do piloto." name="enviar_veiculo_pronto_auto" defaultChecked={integration.eventFlags.veiculo_pronto} />
        <Toggle label="Pagamento recebido" description="Confirmar pagamento." name="enviar_pagamento_auto" defaultChecked={integration.eventFlags.pagamento_recebido} />
        <Toggle label="Pos-venda" description="Agradecimento e pesquisa." name="enviar_pos_venda_auto" defaultChecked={integration.eventFlags.pos_venda} />
        <Toggle label="Cobranca de fiado" description="Cobrar valores em aberto." name="enviar_cobranca_auto" defaultChecked={integration.eventFlags.cobranca_fiado} />
        <Toggle label="Promocao" description="Promocoes exigem aprovacao por seguranca." name="enviar_promocao_auto" defaultChecked={integration.eventFlags.promocao} />
        <Field label="Horario inicio" name="horario_envio_inicio" defaultValue={integration.horarioEnvioInicio} type="time" />
        <Field label="Horario fim" name="horario_envio_fim" defaultValue={integration.horarioEnvioFim} type="time" />
        <Field label="Limite cliente/dia" name="limite_mensagens_cliente_dia" defaultValue={String(integration.limiteMensagensClienteDia)} type="number" />
        <Field label="Limite de tentativas" name="limite_tentativas" defaultValue={String(integration.limiteTentativas)} type="number" />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="button-primary" type="submit">Salvar WhatsApp</button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={testLavaWhatsappIntegrationAction}>
          <button className="button-secondary" type="submit">Testar conexao</button>
        </form>
        <a className="button-secondary" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Meta Developers</a>
      </div>
      <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
        <span>Modo manual: o sistema abre o WhatsApp com mensagem pronta.</span>
        <span>Modo automatico com aprovacao: a IA gera a mensagem, voce aprova e o sistema envia.</span>
        <span>Modo automatico total: a IA gera e o sistema envia sozinho conforme as regras ativadas.</span>
      </div>
    </section>
  );
}

function configSafeModel() {
  return defaultGeminiModel();
}

function providerLabel(provider: string) {
  if (provider === "evolution") return "Evolution API";
  if (provider === "whatsapp_cloud_api") return "WhatsApp Cloud API";
  return "Manual / wa.me";
}

function modeLabel(mode: string) {
  if (mode === "automatico_com_aprovacao") return "Automatico com aprovacao";
  if (mode === "automatico_total") return "Automatico total";
  return "Manual";
}

function SecretField({ label, name, configured }: { label: string; name: string; configured: boolean }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <input className="input" name={name} type="password" autoComplete="new-password" placeholder={configured ? "Configurado. Preencha apenas para trocar." : "Nao configurado"} />
    </label>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WhatsappCompanySection({ whatsapp }: { whatsapp?: string | null }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">WhatsApp da empresa</p>
        <h2 className="mt-1 text-xl font-black">Envio manual agora, integracao futura preparada</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">O LavaGestor gera a mensagem e abre o WhatsApp. Quando houver provedor oficial configurado, a fila vai registrar envio e erro por integracao.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <InfoTile label="Número principal" value={whatsapp || "Não informado"} />
        <InfoTile label="Provider atual" value="Manual / wa.me" />
        <InfoTile label="Status" value="Pronto para fila manual" />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
        Configure o numero principal no bloco Empresa. As proximas integracoes poderao usar a fila `lava_whatsapp_envios` sem travar agendamentos, fotos ou lavagens.
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <strong className="mt-1 block break-words text-sm">{value}</strong>
    </div>
  );
}

function StorageSection({ overview }: { overview: StorageOverview }) {
  const providers: LavaStorageProvider[] = ["google_drive", "dropbox"];
  const connections = new Map((overview.connections ?? []).map((connection) => [String(connection.provider), connection]));
  const oauth = new Map((overview.oauth ?? []).map((config) => [String(config.provider), config]));
  const lastSyncErrors = new Map(((overview.lastSyncErrors ?? []) as Record<string, unknown>[]).map((row) => [String(row.provider), row]));

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Backup externo</p>
          <h2 className="mt-1 text-xl font-black">Google Drive ou Dropbox</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">As fotos continuam salvas no Supabase. O backup externo é opcional por empresa.</p>
        </div>
        <form action="/api/lavagestor/storage/sync" method="post">
          <button className="button-secondary" type="submit">Sincronizar pendentes</button>
        </form>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Pendentes</p>
          <strong className="mt-1 block text-2xl font-black">{overview.pendingCount}</strong>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Com erro</p>
          <strong className="mt-1 block text-2xl font-black">{overview.errorCount}</strong>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => {
          const connection = connections.get(provider);
          const oauthConfig = oauth.get(provider);
          const connected = connection?.status === "conectado";
          const hasError = connection?.status === "erro";
          const lastError = String(connection?.last_error || (connected || hasError ? lastSyncErrors.get(provider)?.erro : "") || "").trim();
          return (
            <div className="grid min-w-0 gap-3 overflow-hidden rounded-xl border border-border bg-muted/40 p-3" key={provider}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black">{lavaStorageProviderLabel(provider)}</h3>
                  <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{connected || hasError ? String(connection?.account_email || "Conta conectada") : "Não conectado"}</p>
                  {connection?.root_folder_path ? <p className="mt-1 break-words text-xs font-semibold text-muted-foreground">{String(connection.root_folder_path)}</p> : null}
                  {connection?.last_test_at ? <p className="mt-1 text-xs font-semibold text-muted-foreground">Último teste: {formatDateTimeShort(connection.last_test_at)}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${connected ? "bg-emerald-50 text-emerald-900" : hasError ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>{connected ? "Conectado" : hasError ? "Erro" : "Não conectado"}</span>
              </div>
              {oauthConfig?.redirectUri ? (
                <div className="grid min-w-0 gap-1 rounded-lg border border-border bg-white p-2 text-xs font-semibold text-muted-foreground">
                  <span className="font-black uppercase tracking-[0.08em]">Redirect URI usada</span>
                  <code className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1 font-mono text-[11px] leading-5 text-foreground">{String(oauthConfig.redirectUri)}</code>
                  <span>Client ID: {oauthConfig.clientIdConfigured ? "configurado" : "pendente"} - origem: {sourceLabel(String(oauthConfig.clientIdSource ?? ""))}</span>
                  <span>Redirect: {sourceLabel(String(oauthConfig.redirectSource ?? ""))}</span>
                </div>
              ) : null}
              {lastError ? (
                <div className="grid max-h-56 min-w-0 gap-2 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-950">
                  <span className="font-black uppercase tracking-[0.08em]">Último erro</span>
                  <span className="whitespace-pre-wrap break-words">{lastError}</span>
                  <ProviderFixInstructions provider={provider} error={lastError} />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <a className={connected || hasError ? "button-secondary" : "button-primary"} href={`/api/lavagestor/storage/connect/${provider}`}>{connected || hasError ? "Reconectar" : "Conectar"}</a>
                <form action="/api/lavagestor/storage/test" method="post">
                  <input name="provider" type="hidden" value={provider} />
                  <button className="button-secondary" disabled={!connected && !hasError} type="submit">Testar</button>
                </form>
                {connected || hasError ? (
                  <form action="/api/lavagestor/storage/disconnect" method="post">
                    <input name="provider" type="hidden" value={provider} />
                    <button className="button-danger" type="submit">Desconectar</button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function getRequestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "mbalabs.vercel.app";
  const proto = headerList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function sourceLabel(value: string) {
  if (value === "request_origin") return "domínio atual";
  return value || "domínio atual";
}

function formatDateTimeShort(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
}

function ProviderFixInstructions({ provider, error }: { provider: LavaStorageProvider; error: string }) {
  const lower = error.toLowerCase();
  if (provider === "google_drive" && (lower.includes("drive api") || lower.includes("has not been used") || lower.includes("disabled"))) {
    return (
      <div className="grid gap-1 rounded-md bg-white/70 p-2 text-red-950">
        <span>Para corrigir: ative a Google Drive API no projeto Google Cloud usado pelo Client ID do LavaGestor.</span>
        <a className="break-all font-black underline" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer">https://console.cloud.google.com/apis/library/drive.googleapis.com</a>
      </div>
    );
  }

  if (provider === "dropbox" && lower.includes("missing_scope")) {
    return (
      <div className="grid gap-1 rounded-md bg-white/70 p-2 text-red-950">
        <span>Para corrigir: abra o Dropbox App Console, vá em Permissions, marque as permissões necessárias, salve e reconecte o Dropbox no LavaGestor.</span>
        <span className="font-black">Permissões: account_info.read, files.content.write, files.content.read, files.metadata.read, files.metadata.write.</span>
      </div>
    );
  }

  if (lower.includes("refresh token") || lower.includes("invalid_grant") || lower.includes("invalid credentials")) {
    return <span className="rounded-md bg-white/70 p-2 text-red-950">Reconecte este provedor para gerar um novo token.</span>;
  }

  return null;
}

function ConfigBlock({ badge, title, description, children, defaultOpen = false }: { badge: string; title: string; description: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-2xl border border-border bg-white shadow-sm" open={defaultOpen}>
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">{badge}</span>
        <span className="min-w-0"><span className="block text-xl font-black">{title}</span><span className="mt-1 block text-sm font-semibold leading-5 text-muted-foreground">{description}</span></span>
        <span className="text-2xl font-black text-muted-foreground group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

function Field({ label, name, defaultValue, placeholder, type = "text", required = false, wide = false, step, helper }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; required?: boolean; wide?: boolean; step?: string; helper?: string }) {
  return <label className={`grid gap-2 ${wide ? "md:col-span-2" : ""}`}><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} step={step} />{helper ? <span className="text-xs font-semibold text-muted-foreground">{helper}</span> : null}</label>;
}

function TextArea({ label, name, defaultValue, helper, compact = false }: { label: string; name: string; defaultValue?: string; helper?: string; compact?: boolean }) {
  return <label className="grid gap-2 md:col-span-2"><span className="text-sm font-black">{label}</span><textarea className={`input resize-y ${compact ? "min-h-24" : "min-h-32"}`} name={name} defaultValue={defaultValue ?? ""} />{helper ? <span className="text-xs font-semibold text-muted-foreground">{helper}</span> : null}</label>;
}

function Toggle({ label, description, name, defaultChecked }: { label: string; description: string; name: string; defaultChecked: boolean }) {
  return <label className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"><span><span className="block font-black">{label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{description}</span></span><input className="h-6 w-6" name={name} type="checkbox" defaultChecked={defaultChecked} /></label>;
}
