import type { ReactNode } from "react";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { MessageTemplateEditor } from "@/components/lavagestor/MessageTemplateEditor";
import { BackButton, MessageBanner, PageHeader } from "@/components/ui-kit";
import { saveLavaConfiguracoesEmpresa } from "@/lib/actions/lavagestor-configuracoes-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function LavaConfiguracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const params = await searchParams;
  const { config, error } = await getLavaConfiguracoesEmpresa();
  const color = config.cor_principal || "#059669";

  return (
    <LavaGestorShell activePath="/lavagestor/configuracoes" companyName={config.nome_exibicao}>
      <section className="grid gap-5 pb-24">
        <PageHeader
          eyebrow="LavaGestor"
          title="Configurações"
          description="Deixe o LavaGestor com a cara da empresa: recibo, WhatsApp, relatório, comissão e regras de pagamento."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

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
            <Toggle label="Exigir checklist antes de finalizar" description="Impede finalizar lavagem sem checklist concluido." name="exigir_checklist_antes_finalizar" defaultChecked={config.exigir_checklist_antes_finalizar} />
            <Toggle label="Exigir checklist antes de entregar" description="Impede entrega sem checklist concluido." name="exigir_checklist_antes_entregar" defaultChecked={config.exigir_checklist_antes_entregar} />
            <Toggle label="Permitir recibo sem checklist" description="Se desligar, recibo pago tambem exige checklist concluido." name="permitir_recibo_sem_checklist" defaultChecked={config.permitir_recibo_sem_checklist} />
          </ConfigBlock>

          <ConfigBlock badge="03" title="Operação" description="Listas usadas dentro da fila e da nova lavagem.">
            <TextArea label="Motivos de cancelamento" name="motivos_cancelamento" defaultValue={config.motivos_cancelamento.join("\n")} helper="Um motivo por linha. Ex.: Cliente desistiu." />
            <TextArea label="Tipos de entrega" name="tipos_entrega" defaultValue={config.tipos_entrega.join("\n")} helper="Um tipo por linha. Ex.: Cliente retira / Levar ao cliente." />
            <TextArea label="Itens padrao do checklist" name="checklist_itens_padrao" defaultValue={config.checklist_itens_padrao.join("\n")} helper="Um item por linha para orientar a conferencia." />
            <TextArea label="Tipos de foto do checklist" name="checklist_tipos_foto" defaultValue={config.checklist_tipos_foto.join("\n")} helper="Use codigos como frente, traseira, avaria, antes, depois." />
          </ConfigBlock>

          <ConfigBlock badge="04" title="WhatsApp" description="Textos enviados ao cliente. Toque numa mensagem e depois numa variável para inserir.">
            <MessageTemplateEditor readyDefault={config.mensagem_veiculo_pronto} receiptDefault={config.mensagem_recibo} />
            <TextArea compact label="Pos-venda: agradecimento" name="mensagem_pos_venda_agradecimento" defaultValue={config.mensagem_pos_venda_agradecimento} />
            <TextArea compact label="Pos-venda: pesquisa de satisfacao" name="mensagem_pesquisa_satisfacao" defaultValue={config.mensagem_pesquisa_satisfacao} />
            <TextArea compact label="Pos-venda: lembrete de retorno" name="mensagem_retorno" defaultValue={config.mensagem_retorno} />
            <TextArea compact label="Pos-venda: cobranca de fiado" name="mensagem_cobranca_fiado" defaultValue={config.mensagem_cobranca_fiado} />
            <TextArea compact label="Pos-venda: promocao" name="mensagem_promocao" defaultValue={config.mensagem_promocao} />
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
